import time
from datetime import datetime
import pytz 
from database import db, BotState, Trade
from notification import notify_entry, notify_exit, send_telegram_msg
from strategy import check_entry_strategy
from market_data import get_bitcoin_health
from logger import log_exec, log_error, log_trade_decision

# --- GESTÃO DE RISCO INSTITUCIONAL ---
DAILY_LOSS_LIMIT_PCT = -3.0
COOLDOWN_SECONDS = 300
FEE_RATE = 0.001 # 0.1% (Taxa Padrão Binance Spot)

ASSET_PARAMS = {
    "DEFAULT": { "rsi_buy": 30, "stop_atr_mult": 1.5, "tp_risk_mult": 3.0 },
    "BTC/USDT": { "rsi_buy": 33, "stop_atr_mult": 1.3, "tp_risk_mult": 2.5 },
    "ETH/USDT": { "rsi_buy": 33, "stop_atr_mult": 1.4, "tp_risk_mult": 2.8 },
    "BNB/USDT": { "rsi_buy": 32, "stop_atr_mult": 1.4, "tp_risk_mult": 2.8 },
    "SOL/USDT": { "rsi_buy": 30, "stop_atr_mult": 1.5, "tp_risk_mult": 3.0 },
    "PEPE/USDT": { "rsi_buy": 24, "stop_atr_mult": 2.2, "tp_risk_mult": 4.0 },
}

def get_br_time_obj():
    tz = pytz.timezone('America/Sao_Paulo')
    return datetime.now(tz)

def get_br_time_str():
    return get_br_time_obj().strftime('%Y-%m-%d %H:%M:%S')

class PaperTrader:
    def __init__(self, initial_balance=100.00, live_mode=False):
        self.initial_balance = initial_balance
        self.live_mode = live_mode
        self.is_testnet = True 
        self.telegram_chat_id = None 
        self.risk_percentage = 0.1
        self.prev_rsi_memory = {}

        # Estado em Memória
        self.balance = initial_balance
        self.accumulated_pnl = 0.0
        self.daily_start_balance = initial_balance
        self.current_day = get_br_time_obj().day
        self.position = None 
        
        # Modo Inverno
        self.consecutive_losses = 0  
        self.cooldown_until = 0      

        self.last_exit_time = 0 
        self.last_traded_symbol = ""

    def load_state(self):
        try:
            state = BotState.query.first()
            if not state:
                state = BotState(
                    balance=self.initial_balance,
                    daily_start_balance=self.initial_balance,
                    current_day=self.current_day,
                    accumulated_pnl=0.0,
                    position_json=None
                )
                db.session.add(state); db.session.commit()
            
            if self.is_testnet: self.balance = state.balance
            self.accumulated_pnl = state.accumulated_pnl
            self.daily_start_balance = state.daily_start_balance
            self.current_day = state.current_day
            self.position = state.position_json 
            
        except Exception as e:
            log_error.error(f"Erro critical DB Load: {e}")

    def save_state(self):
        try:
            state = BotState.query.first()
            if state:
                state.balance = self.balance
                state.accumulated_pnl = self.accumulated_pnl
                state.daily_start_balance = self.daily_start_balance
                state.current_day = self.current_day
                state.position_json = self.position
                state.last_update = get_br_time_str()
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            log_error.error(f"Erro critical DB Save: {e}")
  
    def set_chat_id(self, chat_id):
        self.telegram_chat_id = chat_id

    def check_new_day(self):
        today = get_br_time_obj().day
        if today != self.current_day:
            self.current_day = today
            self.daily_start_balance = self.balance
            self.save_state()
            log_exec.info(f"📅 NOVO DIA. Base Saldo: ${self.daily_start_balance:.2f}")

    def check_circuit_breaker(self):
        self.check_new_day()
        if self.daily_start_balance <= 0: return False, 0
        pnl_today = self.balance - self.daily_start_balance
        pnl_pct = (pnl_today / self.daily_start_balance) * 100
        if pnl_pct <= DAILY_LOSS_LIMIT_PCT: return True, pnl_pct
        return False, pnl_pct

    def sync_with_exchange(self, exchange_instance):
        if self.is_testnet or not exchange_instance: return "Modo Simulação."
        try:
            bal = exchange_instance.fetch_balance()
            real_usdt = float(bal['total'].get('USDT', 0.0))
            self.balance = real_usdt
            if abs(real_usdt - self.daily_start_balance) > (self.daily_start_balance * 0.1):
                self.daily_start_balance = real_usdt
            self.save_state()
            return "Sincronizado com Binance."
        except Exception as e: return f"Erro Sync: {e}"

    def switch_environment(self, is_testnet):
        self.is_testnet = is_testnet
        if is_testnet: self.load_state()

    def set_risk_percentage(self, pct): 
        self.risk_percentage = pct / 100.0
    
    def start_new_day(self, new_balance):
        self.balance = new_balance
        self.daily_start_balance = new_balance
        self.accumulated_pnl = 0.0
        self.position = None
        try:
            db.session.query(Trade).delete(); self.save_state()
            log_exec.info(f"♻️ BANCA RESETADA: ${new_balance}")
        except: db.session.rollback()

    def calculate_position_size(self):
        target = self.balance * self.risk_percentage
        if target < 10.0 and self.balance >= 11.0: target = 11.0
        final = min(target, self.balance * 0.98)
        return final if final >= 10.0 else 0.0

    # --- SIMULAÇÃO DE COMPRA COM TAXA DE ENTRADA ---
    def _open_position_logic(self, symbol, price, invested, sl, tp, trigger_name):
        # 1. Desconta Taxa de Entrada (0.1%)
        entry_fee_cost = invested * FEE_RATE
        net_invested = invested - entry_fee_cost
        
        # 2. Calcula quantidade de moedas com o valor líquido
        amount_tokens = net_invested / price
        
        # 3. Atualiza Saldo (Sai o valor BRUTO da carteira)
        self.balance -= invested
        
        self.position = {
            "entry_price": price,
            "invested_value": invested, # Valor bruto para cálculo de ROI
            "net_invested": net_invested, # Valor real em moedas
            "amount": amount_tokens,
            "entry_time": get_br_time_str(),
            "symbol": symbol,
            "sl_price": sl,
            "tp_price": tp,
            "side": "LONG",
            "partial_taken": False
        }
        self.save_state()
        
        log_msg = f"{trigger_name} | Taxa: ${entry_fee_cost:.2f}"
        log_trade_decision(symbol, "COMPRA", log_msg, {})
        notify_entry(symbol, price, invested, self.balance, log_msg, tp, sl, not self.is_testnet, self.telegram_chat_id)
        return "COMPRA EXECUTADA"

    def execute_manual_trade(self, side, current_price, symbol):
        if self.position: return {"success": False, "message": "Posição aberta."}
        is_broken, pct = self.check_circuit_breaker()
        if is_broken: return {"success": False, "message": f"Circuit Breaker: {pct:.2f}%"}
        
        invested = self.calculate_position_size()
        if invested <= 0: return {"success": False, "message": "Saldo insuficiente."}
        
        params = ASSET_PARAMS.get(symbol, ASSET_PARAMS.get("DEFAULT"))
        atr = current_price * 0.02
        sl = current_price - (atr * params['stop_atr_mult'])
        tp = current_price + ((current_price - sl) * params['tp_risk_mult'])
        
        self._open_position_logic(symbol, current_price, invested, sl, tp, "MANUAL")
        return {"success": True, "message": "Ordem Executada."}

    def execute_manual_close(self, current_price):
        if not self.position: return {"success": False, "message": "Nenhuma posição."}
        msg = self.close_position(current_price, "VENDA MANUAL", get_br_time_str())
        return {"success": True, "message": msg}

    def update(self, current_price, current_open, rsi, bb_lower, bb_upper, fibo_high, fibo_low, timestamp, is_bullish, symbol, atr_value, ema_slope=0):
        is_broken, daily_pct = self.check_circuit_breaker()
        if is_broken and not self.position: return f"BLOQUEIO: Perda Diária {daily_pct:.2f}%"

        if time.time() < self.cooldown_until: return "MODO INVERNO ❄️"

        params = ASSET_PARAMS.get(symbol, ASSET_PARAMS.get("DEFAULT"))
        
        # --- GESTÃO DE POSIÇÃO (SAÍDA) ---
        if self.position:
            if self.position['symbol'] != symbol: return None
            entry, sl, tp = self.position['entry_price'], self.position['sl_price'], self.position['tp_price']
            
            # Parcial (TP1)
            risk = entry - sl
            tp1 = entry + risk
            if not self.position.get('partial_taken') and current_price >= tp1:
                # Vende 50% das moedas
                sell_amt = self.position['amount'] * 0.5
                
                # Simula Venda com Taxa
                gross_return = sell_amt * current_price
                fee_exit = gross_return * FEE_RATE
                net_return = gross_return - fee_exit
                
                # Cálculo de Lucro Proporcional
                invested_part = self.position['invested_value'] * 0.5
                profit = net_return - invested_part # Lucro Real já descontando taxas de entrada (implicita) e saída
                
                self.balance += net_return
                self.accumulated_pnl += profit
                
                # Atualiza Posição
                self.position['amount'] -= sell_amt
                self.position['invested_value'] *= 0.5 # Reduz o principal investido
                self.position['sl_price'] = entry * 1.002 # Breakeven + Taxas
                self.position['partial_taken'] = True
                self.save_state()
                log_exec.info(f"💰 PARCIAL: {symbol} | Líquido: ${net_return:.2f}")
                return "PARCIAL EXECUTADA"

            if current_price <= sl: return self.close_position(current_price, "STOP LOSS", timestamp)
            if current_price >= tp: return self.close_position(current_price, "TAKE PROFIT", timestamp)
            
            # Trailing Stop
            atr_safe = atr_value if atr_value else (entry * 0.01)
            if current_price > entry + (atr_safe * 1.0):
                new_sl = current_price - (atr_safe * params['stop_atr_mult'])
                if new_sl > sl: self.position['sl_price'] = new_sl
            return None

        # --- SCANNER DE ENTRADA ---
        time_since_exit = time.time() - self.last_exit_time
        if symbol == self.last_traded_symbol and time_since_exit < COOLDOWN_SECONDS: return None

        btc_status, _ = get_bitcoin_health()
        curr_btc_stat = btc_status if symbol != "BTC/USDT" else "BULL"
        prev_rsi_val = self.prev_rsi_memory.get(symbol, 50.0)
        
        row = {'close': current_price, 'open': current_open, 'rsi': rsi, 'ema200': current_price if is_bullish else current_price*1.01, 'atr': atr_value, 'bb_lower': bb_lower, 'bb_upper': bb_upper, 'fibo_high': fibo_high, 'fibo_low': fibo_low}
        
        should_buy, trigger, meta = check_entry_strategy(row, {'rsi': prev_rsi_val}, params, btc_status=curr_btc_stat, ignore_trend=not is_bullish)
        self.prev_rsi_memory[symbol] = rsi 
        
        if should_buy:
            invested = self.calculate_position_size()
            if invested <= 0: return "SALDO INSUFICIENTE"
            return self._open_position_logic(symbol, current_price, invested, meta['sl'], meta['tp'], meta['trigger'])

        return None

    # --- SIMULAÇÃO DE VENDA COM TAXA DE SAÍDA ---
    def close_position(self, price, reason, ts_str):
        if not self.position: return None
        
        amt = self.position['amount']
        inv = self.position['invested_value'] # Valor Bruto investido inicialmente
        symbol = self.position['symbol']
        
        # 1. Valor Bruto da Venda
        gross = amt * price
        
        # 2. Desconta Taxa de Saída (0.1%)
        exit_fee = gross * FEE_RATE
        net_return = gross - exit_fee
        
        # 3. Lucro Líquido Real (Já descontou taxa na entrada e agora na saída)
        # Ex: Investiu 100 (Entrou 99.9) -> Virou 110 -> Saiu (109.89) -> Lucro = 9.89
        profit = net_return - inv
        pct = (profit / inv) * 100
        
        self.balance += net_return
        self.accumulated_pnl += profit
        
        # Modo Inverno
        if profit > 0: self.consecutive_losses = 0
        else:
            self.consecutive_losses += 1
            if self.consecutive_losses >= 3:
                self.cooldown_until = time.time() + (4 * 3600)
                msg = "❄️ MODO INVERNO: 3 Stops. Pausa de 4h."
                log_exec.warning(msg)
                if self.telegram_chat_id: send_telegram_msg(self.telegram_chat_id, msg)
                self.consecutive_losses = 0

        # Salva Trade
        try:
            db.session.add(Trade(exit_time=str(ts_str), symbol=symbol, side="LONG", invested=inv, profit_usd=profit, profit_pct=pct, result="WIN" if profit>0 else "LOSS", reason=reason))
        except: pass

        self.last_exit_time = time.time(); self.last_traded_symbol = symbol; self.position = None
        self.save_state()
        
        notify_exit(symbol, price, profit, pct, reason, self.balance, not self.is_testnet, self.telegram_chat_id)
        return f"VENDA ({reason})"

    def panic_sell(self, price):
        if not self.position: return "Sem posição"
        return self.close_position(price, "PÂNICO MANUAL", get_br_time_str())

    def get_status(self):
        trades_db = Trade.query.order_by(Trade.id.desc()).limit(50).all()
        trades = [{"id":t.id, "exit_time":t.exit_time, "symbol":t.symbol, "side":t.side, "invested":t.invested, "profit_usd":t.profit_usd, "profit_pct":t.profit_pct, "result":t.result, "reason":t.reason} for t in trades_db]
        wins = sum(1 for t in trades_db if t.profit_usd > 0)
        total = len(trades_db)
        return {"balance": self.balance, "accumulated_pnl": self.accumulated_pnl, "position_details": self.position, "trades": trades, "wins": wins, "losses": total-wins, "win_rate": (wins/total*100) if total else 0}