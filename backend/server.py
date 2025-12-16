from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from notification import notify_bot_state, notify_config_saved, notify_environment_change, notify_connection_test, send_telegram_msg, setup_notification_system
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from logger import log_exec, log_error 
from flask_jwt_extended import verify_jwt_in_request
from execution import ExecutionManager 
from backtester import BacktesterEngine
import sys
import os
import numpy as np
import threading
import time
import ccxt
import traceback
import webbrowser
import uuid

# LISTA PREDEFINIDA DE PORTFÓLIO (Top Assets + Voláteis)
PORTFOLIO_TARGETS = [
    "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", 
    "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT", "LTC/USDT", 
    "UNI/USDT", "NEAR/USDT", "MATIC/USDT", "ATOM/USDT", "ARB/USDT", 
    "SUI/USDT", "OP/USDT", "APT/USDT", "INJ/USDT", "RNDR/USDT", 
    "FET/USDT", "DOGE/USDT", "SHIB/USDT", "PEPE/USDT", "FLOKI/USDT"
]

if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    ROOT_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    ROOT_DIR = BASE_DIR

STATIC_DIR = os.path.join(BASE_DIR, 'dist')
sys.path.append(ROOT_DIR)
load_dotenv(os.path.join(ROOT_DIR, '.env'))

try:
    from database import db, User 
    from market_data import fetch_market_data
    from indicators import add_indicators, check_trend_m5
    from paper_trading import PaperTrader
    from notification import notify_bot_state, notify_config_saved, notify_environment_change, notify_connection_test, send_telegram_msg
    try:
        from stats_manager import stats_manager
        HAS_STATS = True
    except ImportError:
        HAS_STATS = False
except ImportError as e:
    log_error.critical(f"Erro de Importação: {e}")
    sys.exit(1)

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')

db_path = os.path.join(ROOT_DIR, 'users.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'sniper_v63_master_key_change_me')
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400 

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
db.init_app(app)
jwt = JWTManager(app)
limiter = Limiter(get_remote_address, app=app, default_limits=["2000 per hour"], storage_uri="memory://")


paper_trader = PaperTrader(initial_balance=100.00, live_mode=True)

with app.app_context():
    db.create_all() 
    print("📂 Carregando estado do banco de dados...")
    paper_trader.load_state() 
    
    try:
        # Pega o usuário Admin
        admin = User.query.first()
        
        if admin:
            print(f"👤 Usuário Admin encontrado: {admin.username}")
            
            
            if admin.telegram_token:
                setup_notification_system(admin.telegram_token)
            else:
                print("❌ ERRO CRÍTICO: Token não encontrado no Banco! Rode o inject_token.py novamente.")

            
            if admin.telegram_chat_id:
                paper_trader.set_chat_id(admin.telegram_chat_id)
                print(f"✅ Destinatário Configurado: {admin.telegram_chat_id}")
                
               
                # Envia mensagem direta para garantir que o canal está aberto agora
                print("📨 Tentando enviar mensagem de BOOT...")
                
            else:
                print("⚠️ AVISO: Chat ID não configurado.")
        else:
            print("⚠️ AVISO: Nenhum usuário registrado. O bot ficará mudo.")
            
    except Exception as e:
        print(f"❌ Erro na inicialização do Server: {e}")
        import traceback
        traceback.print_exc()


# --- VARIÁVEIS GLOBAIS ---
BOT_ACTIVE = False 
CURRENT_SYMBOL = "BTC/USDT"
IS_SCANNING = False
SCAN_CURRENT_LOOK = "..." 
REAL_BALANCE_CACHE = 0.0 
CACHE_LOCK = threading.Lock()
GLOBAL_CACHE = {"data_5m": None, "data_1h": None, "last_update": 0}
REAL_EXCHANGE_INSTANCE = None 
SCAN_TARGETS = [ "BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "DOGE/USDT", "SHIB/USDT", "PEPE/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT", "LTC/USDT", "MATIC/USDT", "NEAR/USDT", "ATOM/USDT", "UNI/USDT", "APT/USDT" ]
TRADING_LOCK = threading.Lock() 
BACKTEST_JOBS = {} 

# --- AUXILIARES ---

@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    token_in_jwt = jwt_data.get("session_token")
    user = User.query.filter_by(username=identity).one_or_none()
    if not user or user.session_token != token_in_jwt:
        return None 
    return user

def get_exchange_connection(user_obj):
    if not user_obj: return None
    api_key, secret = user_obj.get_binance_keys()
    if not api_key or not secret: return None 
    try:
        exchange = ccxt.binance({ 
            'apiKey': api_key, 
            'secret': secret, 
            'enableRateLimit': True, 
            'options': { 
                'defaultType': 'spot',
                'adjustForTimeDifference': True 
            } 
        })
        exchange.load_time_difference()
        return exchange
    except: return None

def update_real_balance():
    global REAL_BALANCE_CACHE
    if not paper_trader.is_testnet and REAL_EXCHANGE_INSTANCE:
        try:
            bal = REAL_EXCHANGE_INSTANCE.fetch_balance()
            REAL_BALANCE_CACHE = float(bal['total']['USDT'])
        except Exception as e: log_error.error(f"Erro saldo: {e}")

def process_analysis(symbol, timeframe):
    try:
        # --- CORREÇÃO VITAL DE RENDERIZAÇÃO ---
        # Pedimos 1500 candles. 
        # Os primeiros 500 servem apenas para estabilizar a EMA200 (Warmup).
        limit_fetch = 1500 
        
        df = fetch_market_data(symbol=symbol, timeframe=timeframe, limit=limit_fetch) 
        if df is None or df.empty: return None, None
        
        df = df.replace({np.nan: None})
        
        # --- CORTE DE WARMUP ---
        # Mantemos apenas os últimos 1000 candles para exibição.
        # Como a EMA foi calculada sobre 1500, o candle 0 deste recorte já terá a EMA precisa.
        if len(df) > 1000:
            df = df.iloc[-1000:]
            
        last = df.iloc[-1]
        
        prev_ema = df['ema200'].iloc[-2] if len(df) > 1 else last.get('ema200')
        current_ema = last.get('ema200')
        ema_slope = (current_ema - prev_ema) if (current_ema and prev_ema) else 0
        
        # Lista para o gráfico (Agora contém exatamente 1000 candles perfeitos)
        candles_list = df[['timestamp', 'open', 'high', 'low', 'close', 'bb_upper', 'bb_lower', 'ema200']].to_dict(orient='records')
        
        # Dados Fibo (da última linha)
        high_50 = last.get('fibo_high') if last.get('fibo_high') else 0
        low_50 = last.get('fibo_low') if last.get('fibo_low') else 0
        fibo_50 = high_50 - ((high_50 - low_50) * 0.5) if high_50 and low_50 else 0
        
        return {
            "price": last['close'], "open_price": last['open'], "rsi": last['rsi'], 
            "ema200": last.get('ema200'), "ema_slope": ema_slope, "atr": last.get('atr', 0),
            "fibo_level": fibo_50, "fibo_high": high_50, "fibo_low": low_50,
            "bb_upper": last['bb_upper'], "bb_lower": last['bb_lower'],
            "timestamp": str(last['timestamp']), "candles": candles_list 
        }, df
    except Exception as e: 
        log_error.error(f"Erro process_analysis: {e}")
        return None, None

def active_symbol_worker():
    global GLOBAL_CACHE
    tick_count = 0
    exec_manager = None
    with app.app_context():
        while True:
            try:
                if REAL_EXCHANGE_INSTANCE and not exec_manager:
                    exec_manager = ExecutionManager(REAL_EXCHANGE_INSTANCE)
                target_symbol = paper_trader.position['symbol'] if paper_trader.position else CURRENT_SYMBOL
                d_m5, df_m5 = process_analysis(target_symbol, '5m')
                d_h1, df_h1 = process_analysis(target_symbol, '1h')
                with CACHE_LOCK:
                    if d_m5: GLOBAL_CACHE["data_5m"] = d_m5
                    if d_h1: GLOBAL_CACHE["data_1h"] = d_h1
                    GLOBAL_CACHE["last_update"] = time.time()
                if not paper_trader.is_testnet and tick_count % 10 == 0: update_real_balance()
                tick_count += 1
                if BOT_ACTIVE and d_m5 and df_h1 is not None:
                    is_bullish, reason = check_trend_m5(df_h1)
                    with TRADING_LOCK: 
                        result_msg = paper_trader.update(
                            d_m5['price'], d_m5['open_price'], d_m5['rsi'], d_m5['bb_lower'], d_m5['bb_upper'], 
                            d_m5['fibo_high'], d_m5['fibo_low'], d_m5['timestamp'], is_bullish, target_symbol, 
                            d_m5['atr'], d_m5.get('ema_slope', 0)
                        )
                    if not paper_trader.is_testnet and result_msg:
                       if "COMPRA EXECUTADA" in result_msg:
                            fake_position = paper_trader.position 
                            amount_to_invest = fake_position['invested_value']
                            stop_loss_price = fake_position['sl_price'] 
                            
                            log_exec.info(f"⚡ Sinal de Compra! Executando MARKET BUY de ${amount_to_invest}...")
                            
                            # 1. Compra a Mercado (Garantia de Execução)
                            real_result = exec_manager.place_market_buy(target_symbol, amount_to_invest)
                            
                            if real_result['success']:
                                # 2. Hard Stop (Redundância na Exchange)
                                log_exec.info("🔒 Colocando Hard Stop na Binance...")
                                stop_res = exec_manager.place_hard_stop(target_symbol, real_result['amount'], stop_loss_price)
                                
                                # --- NOTIFICAÇÃO DE PROTEÇÃO ---
                                msg_protect = (f"🛡️ *PROTEÇÃO ARMADA*\nHard Stop posicionado na Binance: `{stop_loss_price}`")
                                # Usamos o ID do chat salvo no paper_trader
                                send_telegram_msg(paper_trader.chat_id, msg_protect)
                                # --------------------------------------

                                with TRADING_LOCK:
                                    if paper_trader.position: 
                                        paper_trader.position['entry_price'] = real_result['price']
                                        paper_trader.position['amount'] = real_result['amount']
                                        paper_trader.balance = REAL_BALANCE_CACHE - real_result['cost'] 
                                        paper_trader.save_state()
                                log_exec.info(f"✅ Compra e Proteção confirmadas: {real_result['amount']} a ${real_result['price']}")
                            else:
                                # --- NOTIFICAÇÃO DE ERRO CRÍTICO ---
                                err_msg = (f"⛔ *FALHA CRÍTICA DE EXECUÇÃO*\nA ordem de compra falhou na Binance!\n\nMotivo: `{real_result['message']}`\n\n⚠️ *Verifique sua conta imediatamente.*")
                                send_telegram_msg(paper_trader.chat_id, err_msg)
                                # ------------------------------------------

                                log_exec.error(f"❌ Falha Compra Real: {real_result['message']}. Revertendo posição.")
                                with TRADING_LOCK:
                                    paper_trader.position = None
                                    paper_trader.balance += amount_to_invest
                                    paper_trader.save_state()
                    elif "PARCIAL EXECUTADA" in result_msg:
                            log_exec.info(f"💰 Executando PARCIAL Real em {target_symbol}...")
                            coin = target_symbol.split('/')[0]
                            try:
                                bal = REAL_EXCHANGE_INSTANCE.fetch_balance()
                                total_coin = float(bal['total'].get(coin, 0))
                                amount_to_sell = total_coin * 0.5 
                                if amount_to_sell > 0:
                                    exec_manager.place_market_sell(target_symbol, amount_to_sell)
                                    log_exec.info(f"✅ Parcial Real executada: {amount_to_sell} {coin}")
                            except Exception as e: log_error.error(f"❌ Erro na Parcial Real: {e}")
                    elif "VENDA" in result_msg:
                            coin = target_symbol.split('/')[0]
                            try:
                                bal = REAL_EXCHANGE_INSTANCE.fetch_balance()
                                coin_amount = float(bal['total'].get(coin, 0))
                                if coin_amount > 0:
                                    log_exec.info(f"🔻 Venda Final Real: {coin_amount} {coin}")
                                    exec_manager.place_market_sell(target_symbol, coin_amount)
                            except Exception as e: log_error.error(f"Erro crítica venda real: {e}")
            except Exception as e: time.sleep(5)
            time.sleep(2)


def scanner_job():
    global CURRENT_SYMBOL, IS_SCANNING, SCAN_CURRENT_LOOK
    
    # Instância dedicada para o Scanner (não conflita com a trade)
    scanner_exchange = ccxt.binance({'enableRateLimit': True, 'options': {'defaultType': 'spot'}})
    

with app.app_context():
    db.create_all() 
    print("📂 Carregando estado do banco de dados...")
    paper_trader.load_state() 
    
    # === PATCH DE RECUPERAÇÃO DE ID ===
    # O bot precisa saber quem é o dono assim que acorda
    try:
        admin_user = User.query.first() # Pega o primeiro usuário cadastrado
        if admin_user and admin_user.telegram_chat_id:
            paper_trader.set_chat_id(admin_user.telegram_chat_id)
            print(f"✅ SISTEMA VINCULADO: Notificações enviadas para ID {admin_user.telegram_chat_id}")
            
            # Teste Rápido de Boot (Opcional - envia msg ao ligar)
            # send_telegram_msg(admin_user.telegram_chat_id, "🤖 SniperBot Reiniciado e Conectado!")
        else:
            print("⚠️ AVISO: Nenhum usuário configurado com Telegram no Banco de Dados.")
    except Exception as e:
        print(f"❌ Erro ao vincular usuário admin: {e}")
    # ==========================================

threading.Thread(target=active_symbol_worker, daemon=True).start()
threading.Thread(target=scanner_job, daemon=True).start()

# --- BACKTEST WORKER (ASYNC JOBS) ---
def backtest_worker(job_id, data, user_chat_id):
    def update_progress(pct, msg):
        if job_id in BACKTEST_JOBS:
            BACKTEST_JOBS[job_id]['progress'] = pct
            BACKTEST_JOBS[job_id]['message'] = msg
    try:
        timeframe = data.get('timeframe', '5m')
        days = int(data.get('days', 7))
        initial_balance = float(data.get('balance', 1000))
        risk_pct = float(data.get('risk', 10))
        ignore_trend = data.get('ignore_trend', False)
        mode = data.get('mode', 'single')
        symbol = data.get('symbol', 'BTC/USDT')
        target_list = PORTFOLIO_TARGETS if mode == 'portfolio' else [symbol]
        
        result = BacktesterEngine.run_portfolio(
            symbols_list=target_list, timeframe=timeframe, days=days,
            initial_balance=initial_balance, risk_pct=risk_pct,
            chat_id=user_chat_id, ignore_trend=ignore_trend,
            progress_callback=update_progress
        )
        BACKTEST_JOBS[job_id]['result'] = result
        BACKTEST_JOBS[job_id]['progress'] = 100
        BACKTEST_JOBS[job_id]['message'] = "Concluído!"
    except Exception as e:
        log_error.error(f"Erro Backtest Worker: {e}")
        BACKTEST_JOBS[job_id]['error'] = str(e)
        BACKTEST_JOBS[job_id]['progress'] = -1

# --- ROTAS ---

@app.route('/test_telegram', methods=['POST'])
@jwt_required()
def test_telegram_connection():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    
    if not user or not user.telegram_chat_id:
        return jsonify({"success": False, "message": "Usuário sem ID configurado no banco."}), 400

    print(f"🔎 TESTE: Tentando enviar para {user.username} no ID {user.telegram_chat_id}")
    
    # Tenta enviar mensagem simples sem imagem primeiro (para isolar erro de imagem)
    sucesso, msg = send_telegram_msg(user.telegram_chat_id, "🔔 *TESTE DE SOM*\nSe você está lendo isso, o sistema funciona.")
    
    return jsonify({"success": sucesso, "details": msg, "target_id": user.telegram_chat_id})

@app.route('/auth/register', methods=['POST'])
@limiter.limit("5 per hour")
def register():
    data = request.json
    username, email, password = data.get('username'), data.get('email'), data.get('password')
    if not username or not password or not email: return jsonify({"success": False, "message": "Incompleto"}), 400
    if not User.validate_password_strength(password)[0]: return jsonify({"success": False, "message": "Senha fraca"}), 400
    if not User.validate_email(email)[0]: return jsonify({"success": False, "message": "Email inválido"}), 400
    if User.query.filter_by(username=username).first(): return jsonify({"success": False, "message": "User existe"}), 400
    if User.query.filter_by(email=email).first(): return jsonify({"success": False, "message": "Email existe"}), 400
    new_user = User(username=username, email=email, created_at=time.strftime('%Y-%m-%d %H:%M:%S'))
    new_user.set_password(password)
    db.session.add(new_user); db.session.commit()
    return jsonify({"success": True})

@app.route('/auth/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.json
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        new_session = user.refresh_session_token()
        db.session.commit()
        access_token = create_access_token(identity=user.username, additional_claims={"session_token": new_session})
        paper_trader.set_chat_id(user.telegram_chat_id) 
        return jsonify({"success": True, "token": access_token, "username": user.username})
    return jsonify({"success": False, "message": "Credenciais Inválidas"}), 401

@app.route('/profile/delete', methods=['POST'])
@jwt_required()
def delete_account():
    current_user = get_jwt_identity()
    user = User.query.filter_by(username=current_user).first()
    data = request.json
    if not user.check_password(data.get('password')): return jsonify({"success": False, "message": "Senha incorreta."}), 403
    expected_phrase = f"EXCLUIRSNIPER{user.username}".upper()
    if str(data.get('confirm_phrase')).upper() != expected_phrase: return jsonify({"success": False, "message": "Frase incorreta"}), 400
    try:
        global BOT_ACTIVE; BOT_ACTIVE = False
        db.session.delete(user); db.session.commit()
        return jsonify({"success": True, "message": "Conta excluída."})
    except Exception as e: return jsonify({"success": False, "message": str(e)}), 500

@app.route('/profile/update', methods=['POST'])
@jwt_required()
def update_profile():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    data = request.json
    if not user.check_password(data.get('current_password')): return jsonify({"success": False, "message": "Senha atual incorreta."}), 403
    try:
        if data.get('new_password'):
            valid, msg = User.validate_password_strength(data['new_password'])
            if not valid: return jsonify({"success": False, "message": msg}), 400
            user.set_password(data['new_password']); user.refresh_session_token()
            
        if 'telegram_chat_id' in data: 
            user.telegram_chat_id = data['telegram_chat_id']
            paper_trader.set_chat_id(user.telegram_chat_id)

        if 'telegram_token' in data:
            user.telegram_token = data['telegram_token']
            # Reconfigura o sistema de notificação em tempo real
            from notification import setup_notification_system
            setup_notification_system(user.telegram_token)

        if data.get('real_key'): user.set_binance_keys(data['real_key'], data.get('real_secret', ''))
        db.session.commit()
        new_token = create_access_token(identity=user.username, additional_claims={"session_token": user.session_token}) if data.get('new_password') else None
        notify_config_saved(user.telegram_chat_id)
        return jsonify({"success": True, "message": "Perfil atualizado", "new_token": new_token})
    except Exception as e: return jsonify({"success": False, "message": str(e)}), 500

@app.route('/market')
@jwt_required()
def market():
    global BOT_ACTIVE, REAL_BALANCE_CACHE
    user = User.query.filter_by(username=get_jwt_identity()).first()
    processing_symbol = paper_trader.position['symbol'] if paper_trader.position else CURRENT_SYMBOL
    with CACHE_LOCK: cache_m5 = GLOBAL_CACHE["data_5m"]; cache_h1 = GLOBAL_CACHE["data_1h"]
    ts = paper_trader.get_status()
    auth_s = {"has_name": bool(user.username), "has_telegram": bool(user.telegram_chat_id), "has_real": bool(user._real_key_enc)}
    g_stats = stats_manager.get_stats() if HAS_STATS else {}
    return jsonify({
        "symbol": processing_symbol, "is_running": BOT_ACTIVE, "is_testnet": paper_trader.is_testnet,
        "trader_name": user.username, "paper_balance": ts['balance'], "accumulated_pnl": ts['accumulated_pnl'],
        "active_trade": ts['position_details'], "trade_history": ts['trades'], "risk_pct": int(paper_trader.risk_percentage*100), 
        "wins": g_stats.get('wins',0), "losses": g_stats.get('losses',0), "win_rate": g_stats.get('win_rate',0),
        "total_trades": g_stats.get('total_trades',0), "is_scanning": IS_SCANNING, "scanning_look": SCAN_CURRENT_LOOK,
        "auth_status": auth_s, "real_balance": REAL_BALANCE_CACHE, "data_5m": cache_m5, "data_1h": cache_h1,
    })

@app.route('/start', methods=['POST'])
@jwt_required()
def start_bot(): 
    user = User.query.filter_by(username=get_jwt_identity()).first()
    if not user.telegram_chat_id: return jsonify({"is_running": False, "message": "Sem Telegram"}), 400
    paper_trader.set_chat_id(user.telegram_chat_id)
    if not paper_trader.is_testnet:
        global REAL_EXCHANGE_INSTANCE
        exch = get_exchange_connection(user)
        if not exch: return jsonify({"is_running": False, "message": "Erro Chaves"}), 400
        REAL_EXCHANGE_INSTANCE = exch
        sync_msg = paper_trader.sync_with_exchange(REAL_EXCHANGE_INSTANCE)
        log_exec.info(f"Startup Sync: {sync_msg}")
    global BOT_ACTIVE; BOT_ACTIVE = True; notify_bot_state(True, user.telegram_chat_id); log_exec.info(f"START {user.username}")
    return jsonify({"is_running": True})

@app.route('/stop', methods=['POST'])
@jwt_required()
def stop_bot(): 
    user = User.query.filter_by(username=get_jwt_identity()).first()
    global BOT_ACTIVE; BOT_ACTIVE = False; notify_bot_state(False, user.telegram_chat_id if user else None); log_exec.info("STOP"); 
    return jsonify({"is_running": False})

@app.route('/manual_trade', methods=['POST'])
@jwt_required()
def manual_trade():
    try: 
        side = request.json.get('side')
        with CACHE_LOCK: 
            data_m5 = GLOBAL_CACHE.get("data_5m") or {}
            price = data_m5.get("price", 0)
        with TRADING_LOCK:
            if side == 'SELL':
                res = paper_trader.execute_manual_close(float(price))
                if res['success'] and not paper_trader.is_testnet and REAL_EXCHANGE_INSTANCE:
                    try:
                        coin = CURRENT_SYMBOL.split('/')[0]
                        bal = REAL_EXCHANGE_INSTANCE.fetch_balance()
                        amount = float(bal['total'].get(coin, 0))
                        if amount > 0:
                            exec_manager = ExecutionManager(REAL_EXCHANGE_INSTANCE)
                            exec_manager.place_market_sell(CURRENT_SYMBOL, amount)
                            log_exec.info(f"🔻 Venda Manual Real executada: {amount} {coin}")
                    except Exception as e: log_error.error(f"Erro Venda Manual Real: {e}")
            elif side == 'BUY':
                res = paper_trader.execute_manual_trade(side, float(price), CURRENT_SYMBOL)
            else: return jsonify({"success": False, "message": "Lado inválido"}), 400
        return jsonify(res)
    except Exception as e: return jsonify({"success": False, "message": str(e)}), 500

@app.route('/panic', methods=['POST'])
@jwt_required()
def panic_action():
    with CACHE_LOCK: price = GLOBAL_CACHE["data_5m"].get("price", 0)
    with TRADING_LOCK: res_msg = paper_trader.panic_sell(float(price))
    if REAL_EXCHANGE_INSTANCE and not paper_trader.is_testnet: pass 
    return jsonify({"success": True, "message": res_msg})

@app.route('/reset', methods=['POST'])
@jwt_required()
def reset_bot():
    if paper_trader.is_testnet: paper_trader.start_new_day(100.00); return jsonify({"success": True, "new_balance": 100.00})
    return jsonify({"success": False})

@app.route('/config', methods=['POST'])
@jwt_required()
def update_config():
    data = request.json
    if 'risk_percentage' in data: paper_trader.set_risk_percentage(int(data['risk_percentage']))
    return jsonify({"success": True})

@app.route('/switch_mode', methods=['POST'])
@jwt_required()
def switch_mode(): 
    global BOT_ACTIVE, REAL_BALANCE_CACHE, REAL_EXCHANGE_INSTANCE
    target_testnet = request.json.get('testnet', True)
    user = User.query.filter_by(username=get_jwt_identity()).first()
    try:
        cur_bal = 0.0
        if not target_testnet:
            exch = get_exchange_connection(user)
            if not exch: return jsonify({"success": False, "message": "Chaves Inválidas"}), 400
            REAL_BALANCE_CACHE = float(exch.fetch_balance()['total']['USDT'])
            cur_bal = REAL_BALANCE_CACHE; REAL_EXCHANGE_INSTANCE = exch
            notify_environment_change(False, user.telegram_chat_id)
        else:
            cur_bal = paper_trader.balance; notify_environment_change(True, user.telegram_chat_id); REAL_EXCHANGE_INSTANCE = None
        paper_trader.switch_environment(target_testnet); BOT_ACTIVE = False
        return jsonify({"success": True, "new_balance": cur_bal})
    except Exception as e: return jsonify({"success": False, "message": str(e)}), 500

# --- NOVAS ROTAS DE BACKTEST ASYNC ---
@app.route('/backtest/run', methods=['POST'])
@jwt_required()
def start_backtest():
    user = User.query.filter_by(username=get_jwt_identity()).first()
    job_id = uuid.uuid4().hex
    BACKTEST_JOBS[job_id] = {'progress': 0, 'message': 'Inicializando...', 'result': None, 'start_time': time.time()}
    threading.Thread(target=backtest_worker, args=(job_id, request.json, user.telegram_chat_id)).start()
    return jsonify({"success": True, "job_id": job_id})

@app.route('/backtest/status/<job_id>', methods=['GET'])
@jwt_required()
def check_backtest_status(job_id):
    job = BACKTEST_JOBS.get(job_id)
    if not job: return jsonify({"success": False, "message": "Job não encontrado"}), 404
    if time.time() - job.get('start_time', 0) > 600: BACKTEST_JOBS.pop(job_id, None)
    return jsonify(job)

@app.route('/logout', methods=['POST'])
@jwt_required()
def logout_system(): return jsonify({"success": True}) 

@app.route('/stats/get', methods=['GET'])
@jwt_required()
def get_global_stats(): return jsonify(stats_manager.get_stats()) if HAS_STATS else jsonify({})

@app.route('/liquidate', methods=['POST'])
@jwt_required()
def liquidate_assets(): paper_trader.position = None; return jsonify({"success": True})

@app.route('/')
def serve_react():
    if os.path.exists(os.path.join(app.static_folder, 'index.html')): return send_from_directory(app.static_folder, 'index.html')
    return "<h1>SniperBot Backend Online</h1>", 200

def open_browser(): time.sleep(1.5); webbrowser.open("http://127.0.0.1:5000")

if __name__ == '__main__':
    print(f"🚀 SniperBot Pro [DB + ASYNC] -> http://127.0.0.1:5000")
    threading.Thread(target=open_browser, daemon=True).start()
    app.run(debug=False, port=5000, threaded=True, use_reloader=False)