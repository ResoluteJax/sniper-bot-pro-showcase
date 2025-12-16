import ccxt
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- NOVAS IMPORTAÇÕES V6.8 ---
from indicators import add_indicators
from paper_trading import ASSET_PARAMS
from notification import notify_backtest_report
from strategy import check_entry_strategy # O Cérebro Unificado

class BacktesterEngine:
    
    @staticmethod
    def timeframe_to_ms(timeframe):
        amount = int(timeframe[:-1])
        unit = timeframe[-1]
        if unit == 'm': return amount * 60 * 1000
        elif unit == 'h': return amount * 60 * 60 * 1000
        elif unit == 'd': return amount * 24 * 60 * 60 * 1000
        return 15 * 60 * 1000 

    @staticmethod
    def fetch_data_worker(args):
        """
        Worker que baixa dados da Binance. 
        CORREÇÃO V6.9: Aumento drástico do Warmup para estabilizar EMA200.
        """
        symbol, timeframe, days_target = args
        try:
            exchange = ccxt.binance({'enableRateLimit': True, 'options': {'defaultType': 'spot'}})
            now = exchange.milliseconds()
            ms_per_candle = BacktesterEngine.timeframe_to_ms(timeframe)
            
            # --- CORREÇÃO AQUI ---
            # Antes: 300 candles (Insuficiente para EMA200)
            # Agora: 1000 candles (Garante precisão matemática absoluta)
            warmup_ms = 1000 * ms_per_candle 
            
            duration_ms = days_target * 24 * 60 * 60 * 1000
            since = now - duration_ms - warmup_ms
            
            all_ohlcv = []
            while since < now:
                ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=1000)
                if not ohlcv: break
                
                # Evita duplicatas na paginação
                if all_ohlcv and ohlcv[0][0] == all_ohlcv[-1][0]: 
                    ohlcv = ohlcv[1:]
                    
                all_ohlcv.extend(ohlcv)
                
                # Avança o cursor de tempo
                since = ohlcv[-1][0] + 1
                
                # Se a exchange retornou menos que o limite, chegamos ao fim (ou aos dias atuais)
                if len(ohlcv) < 1000: 
                    # IMPORTANTE: Não breakamos imediatamente se ainda não cobrimos o tempo, 
                    # mas em 'since < now' o loop resolve. 
                    # Adicionamos um sleep para garantir rate limit
                    time.sleep(0.1)
            
            # Se tivermos poucos dados, aborta
            if len(all_ohlcv) < 200: return None 
            
            df = pd.DataFrame(all_ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            # Limpeza de dados
            df = df.drop_duplicates(subset=['timestamp'], keep='last').sort_values('timestamp')
            
            # --- INDICADORES ---
            # Calculamos os indicadores COM o histórico de warmup
            df = add_indicators(df)
            
            # --- CORTE DO WARMUP ---
            # Agora cortamos os dados "velhos" e entregamos apenas o período que o usuário pediu.
            # Como a EMA foi calculada antes do corte, ela estará perfeita no primeiro candle da simulação.
            cutoff_date = datetime.now() - timedelta(days=days_target)
            df = df[df['timestamp'] >= cutoff_date]
            
            return (symbol, df)
        except Exception as e:
            print(f"Erro download {symbol}: {e}")
            return None

    @staticmethod
    def prepare_btc_macro_data(timeframe, days):
        """
        Baixa e processa o BTC para servir de 'Sentinela' no backtest.
        Gera um dicionário {timestamp: status} ('BULL', 'BEAR', 'CRASH')
        """
        # Sempre baixamos BTC no H1 ou no timeframe selecionado? 
        # Para fidelidade com o bot real (que usa H1 para macro), idealmente usaríamos H1.
        # Mas para simplificar a sincronia neste backtest, usaremos o MESMO timeframe da simulação.
        # Se o usuário simular M5, usaremos a tendência do BTC em M5/H1 (aproximado).
        
        print("🔎 Baixando dados do BITCOIN para Correlação Macro...")
        res = BacktesterEngine.fetch_data_worker(("BTC/USDT", timeframe, days))
        if not res: return {}
        
        _, df = res
        btc_map = {}
        
        for index, row in df.iterrows():
            ts = row['timestamp']
            price = row['close']
            ema200 = row['ema200']
            rsi = row['rsi']
            
            status = "BULL"
            reason = "Normal"
            
            # Lógica idêntica ao get_bitcoin_health do market_data.py
            if rsi < 25:
                status = "CRASH"
            elif price < ema200:
                status = "BEAR"
            else:
                status = "BULL"
                
            btc_map[ts] = status
            
        return btc_map

    @staticmethod
    def run_portfolio(symbols_list, timeframe="5m", days=7, initial_balance=1000.0, risk_pct=10, chat_id=None, ignore_trend=False, progress_callback=None):
        """
        Executa simulação Async com suporte a Strategy Unificada, BTC Correlation e Modo Inverno.
        """
        
        # --- 1. DOWNLOAD DE DADOS (COM BARRA DE PROGRESSO) ---
        if progress_callback: progress_callback(5, "Baixando Histórico BTC (Macro)...")
        
        # A. Prepara o Mapa do Bitcoin (Sentinela)
        btc_macro_map = BacktesterEngine.prepare_btc_macro_data(timeframe, days)
        
        if progress_callback: progress_callback(10, "Baixando Altcoins...")
        
        data_feed = {}
        total_assets = len(symbols_list)
        completed_downloads = 0
        
        # B. Download Paralelo das Altcoins
        with ThreadPoolExecutor(max_workers=5) as executor:
            tasks = [(sym, timeframe, days) for sym in symbols_list]
            future_to_symbol = {executor.submit(BacktesterEngine.fetch_data_worker, task): task[0] for task in tasks} 
            
            for future in as_completed(future_to_symbol):
                res = future.result()
                completed_downloads += 1
                
                if progress_callback:
                    # Progresso visual de 10% a 85%
                    pct = 10 + int((completed_downloads / total_assets) * 75)
                    progress_callback(pct, f"Baixando: {completed_downloads}/{total_assets}")

                if res: 
                    sym, df = res
                    if not df.empty: data_feed[sym] = df

        if not data_feed: return {"success": False, "message": "Falha total no download dos dados."}
        
        # --- 2. SINCRONIZAÇÃO DE TIMEFRAMES ---
        if progress_callback: progress_callback(85, "Alinhando Dados...")
        valid_dfs = list(data_feed.values())
        all_timestamps = set()
        for df in valid_dfs: all_timestamps.update(set(df['timestamp']))
        timestamps = sorted(list(all_timestamps))
        
        if not timestamps: return {"success": False, "message": "Sem dados comuns entre os ativos."}
        
        # Mapa de acesso rápido para performance O(1)
        time_index_map = {sym: {t: i for i, t in enumerate(df['timestamp'])} for sym, df in data_feed.items()}

        # --- 3. SIMULAÇÃO (CORE LOOP) ---
        if progress_callback: progress_callback(90, "Executando Estratégia V6.8...")
        
        wallet_cash = float(initial_balance) 
        position = None 
        trades_log = []
        equity_curve = [] 
        ignored_count = 0
        peak_equity = float(initial_balance)
        max_drawdown_pct = 0.0              

        # Variáveis do MODO INVERNO (Cool Down)
        consecutive_losses = 0
        cooldown_until_ts = None # Timestamp de desbloqueio

        # Loop Cronológico (Candle a Candle)
        for current_time in timestamps:
            
            # [REGRA 1] MODO INVERNO: Se estiver de castigo, pula o candle
            if cooldown_until_ts and current_time < cooldown_until_ts:
                # Mantém o equity anterior no gráfico (linha reta)
                equity_curve.append({"time": int(current_time.timestamp() * 1000), "value": round(wallet_cash, 2)})
                continue
            elif cooldown_until_ts and current_time >= cooldown_until_ts:
                # Saiu do castigo
                cooldown_until_ts = None

            current_total_equity = wallet_cash
            
            # Status do Bitcoin neste minuto
            btc_status = btc_macro_map.get(current_time, "BEAR")

            # A. GESTÃO DE POSIÇÃO (EXIT)
            if position:
                sym = position['symbol']
                df = data_feed.get(sym)
                idx = time_index_map.get(sym, {}).get(current_time)
                
                if df is not None and idx is not None:
                    candle = df.iloc[idx]
                    current_price = candle['close']
                    high, low = candle['high'], candle['low']
                    
                    # Atualiza valor da posição para Equity Curve
                    position_value = position['amount'] * current_price
                    current_total_equity = wallet_cash + position_value
                    
                    trade_closed = False
                    pnl_realized = 0
                    result_type = ""

                    # Verifica SL e TP
                    # Prioridade 1: Stop Loss (Low tocou no SL?)
                    if low <= position['sl']:
                        exit_price = position['sl'] 
                        # Simula Slippage em Crash de BTC (-0.2%)
                        if btc_status == "CRASH": exit_price = exit_price * 0.998 
                        
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "LOSS"
                        trade_closed = True
                        
                    # Prioridade 2: Take Profit (High tocou no TP?)
                    elif high >= position['tp']:
                        exit_price = position['tp']
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "WIN"
                        trade_closed = True

                    if trade_closed:
                        # --- CONTABILIDADE MODO INVERNO ---
                        if pnl_realized > 0:
                            consecutive_losses = 0 # Vitória limpa o stress
                        else:
                            consecutive_losses += 1 # Derrota aumenta stress
                            if consecutive_losses >= 3:
                                # Ativa bloqueio de 4 horas
                                cooldown_until_ts = current_time + timedelta(hours=4)
                                consecutive_losses = 0 # Reseta para próximo ciclo
                        # ----------------------------------

                        current_total_equity = wallet_cash
                        trades_log.append({
                            'time': str(current_time), 'symbol': sym, 'side': 'SELL', 
                            'res': result_type, 'pnl': pnl_realized, 'balance': wallet_cash,
                            'reason': f"Hit {result_type} (LossStreak: {consecutive_losses})"
                        })
                        position = None

            # B. SCANNER (ENTRY) - Só se não estiver posicionado
            if not position:
                for sym in data_feed.keys():
                    df = data_feed[sym]
                    idx = time_index_map[sym].get(current_time)
                    if idx is None: continue 
                    
                   # Linha atual
                    candle_row = df.iloc[idx]
                    
                    # --- NOVO: Linha Anterior ---
                    # Se for o primeiro candle, não tem anterior (None)
                    prev_row = df.iloc[idx - 1] if idx > 0 else None
                    
                    if pd.isna(candle_row['ema200']) or pd.isna(candle_row['rsi']): continue

                    params = ASSET_PARAMS.get(sym, ASSET_PARAMS["DEFAULT"])
                    
                    # CHAMADA À ESTRATÉGIA (Passando prev_row)
                    should_buy, reason, meta = check_entry_strategy(
                        candle_row, 
                        prev_row,  # <--- Passamos o anterior aqui
                        params, 
                        btc_status=btc_status, 
                        ignore_trend=ignore_trend
                    )

                    if should_buy:
                        # Gestão de Risco
                        invest_amount = current_total_equity * (risk_pct / 100.0)
                        
                        # Trava Mínima Binance (~$10)
                        if invest_amount < 10.0 and current_total_equity >= 11.0:
                            invest_amount = 11.0
                        elif invest_amount < 10.0:
                            continue 

                        entry_p = float(candle_row['close'])
                        amount = invest_amount / entry_p
                        
                        wallet_cash -= invest_amount 
                        
                        position = {
                            'symbol': sym, 
                            'entry_price': entry_p, 
                            'amount': amount, 
                            'invested': invest_amount, 
                            'sl': meta['sl'], 
                            'tp': meta['tp'], 
                            'tp1': 0, 
                            'partial': False
                        }
                        
                        trades_log.append({
                            'time': str(current_time), 
                            'symbol': sym, 
                            'side': 'BUY', 
                            'res': 'ENTRY', 
                            'pnl': 0, 
                            'balance': wallet_cash,
                            'reason': f"{meta.get('trigger', 'Signal')} | BTC:{btc_status}"
                        })
                        break # Entrou em um, para de escanear neste candle
                    
                    elif "BLOQUEIO" in reason or "FALLING" in reason:
                        ignored_count += 1

            # Drawdown
            if current_total_equity > peak_equity: peak_equity = current_total_equity
            drawdown = (current_total_equity - peak_equity) / peak_equity
            if drawdown < max_drawdown_pct: max_drawdown_pct = drawdown

            # Equity Curve
            equity_curve.append({"time": int(current_time.timestamp() * 1000), "value": round(current_total_equity, 2)})

        # --- 4. RELATÓRIO FINAL ---
        if progress_callback: progress_callback(98, "Compilando Estatísticas...")
        
        final_balance = current_total_equity
        profit_total = final_balance - initial_balance
        wins = len([t for t in trades_log if t['res'] == 'WIN'])
        losses = len([t for t in trades_log if t['res'] == 'LOSS'])
        total_closed = wins + losses
        
        start_date_str = timestamps[0].strftime('%d/%m/%Y %H:%M') if timestamps else "N/A"
        end_date_str = timestamps[-1].strftime('%d/%m/%Y %H:%M') if timestamps else "N/A"
        delta = timestamps[-1] - timestamps[0] if timestamps else None
        duration_str = f"{delta.days}d {delta.seconds//3600}h" if delta else "0d"

        stats = {
            "initial_balance": initial_balance, "final_balance": final_balance, "profit_total": profit_total,
            "roi_pct": (profit_total / initial_balance) * 100 if initial_balance > 0 else 0,
            "total_trades": total_closed, "wins": wins, "losses": losses,
            "win_rate": (wins / total_closed * 100) if total_closed > 0 else 0,
            "ignored": ignored_count, "start_date": start_date_str, "end_date": end_date_str,
            "duration": duration_str, "max_drawdown": max_drawdown_pct * 100 
        }

        if chat_id:
            try:
                asset_label = "PORTFOLIO (Multi)" if len(symbols_list) > 1 else symbols_list[0]
                notify_backtest_report(chat_id, asset_label, timeframe, days, stats)
            except Exception as e: print(f"⚠️ Erro Telegram Backtest: {e}")

        return {"success": True, "stats": stats, "trades": trades_log, "equity_curve": equity_curve}
        
       
        # 3. SIMULAÇÃO LOOP
        if progress_callback: progress_callback(90, "Executando Estratégia V6.8 (Com Modo Inverno)...")
        
        wallet_cash = float(initial_balance) 
        position = None 
        trades_log = []
        equity_curve = [] 
        ignored_count = 0
        peak_equity = float(initial_balance)
        max_drawdown_pct = 0.0              

        # --- VARIÁVEIS DO MODO INVERNO (NOVO NO BACKTEST) ---
        consecutive_losses = 0
        cooldown_until_ts = None # Timestamp (datetime) de desbloqueio

        # Loop Cronológico (Candle a Candle)
        for current_time in timestamps:
            
            # 1. CHECAGEM DE COOL DOWN (Se estiver de castigo, pula o candle)
            if cooldown_until_ts and current_time < cooldown_until_ts:
                # Opcional: Adicionar no log de equity que está parado?
                # Por enquanto, apenas mantém o equity anterior e pula
                equity_curve.append({"time": int(current_time.timestamp() * 1000), "value": round(wallet_cash, 2)})
                continue

            current_total_equity = wallet_cash
            
            # Status do Bitcoin (Já implementado)
            btc_status = btc_macro_map.get(current_time, "NEUTRAL")

            # A. GESTÃO DE POSIÇÃO
            if position:
                sym = position['symbol']
                df = data_feed.get(sym)
                idx = time_index_map.get(sym, {}).get(current_time)
                
                if df is not None and idx is not None:
                    candle = df.iloc[idx]
                    current_price = candle['close']
                    high, low = candle['high'], candle['low']
                    
                    position_value = position['amount'] * current_price
                    current_total_equity = wallet_cash + position_value
                    
                    trade_closed = False
                    pnl_realized = 0
                    result_type = ""

                    # Verifica SL e TP
                    if low <= position['sl']:
                        exit_price = position['sl'] 
                        if btc_status == "CRASH": exit_price = exit_price * 0.998 # Slippage em Crash
                        
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "LOSS"
                        trade_closed = True
                        
                    elif high >= position['tp']:
                        exit_price = position['tp']
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "WIN"
                        trade_closed = True

                    if trade_closed:
                        # --- LÓGICA DO MODO INVERNO APÓS FECHAMENTO ---
                        if pnl_realized > 0:
                            consecutive_losses = 0 # Reset na vitória
                        else:
                            consecutive_losses += 1
                            if consecutive_losses >= 3:
                                # Ativa bloqueio de 4 horas
                                cooldown_until_ts = current_time + timedelta(hours=4)
                                consecutive_losses = 0 # Reseta contagem para próximo ciclo
                        # -----------------------------------------------

                        current_total_equity = wallet_cash
                        trades_log.append({
                            'time': str(current_time), 'symbol': sym, 'side': 'SELL', 
                            'res': result_type, 'pnl': pnl_realized, 'balance': wallet_cash,
                            'reason': f"Hit {result_type} (CoolDown Status: {consecutive_losses}/3)"
                        })
                        position = None

            # B. SCANNER (Só roda se não estiver posicionado E não estiver em Cool Down)
            # A checagem de Cool Down já foi feita no início do loop, então aqui é seguro.
            if not position:
                for sym in data_feed.keys():
                    df = data_feed[sym]
                    idx = time_index_map[sym].get(current_time)
                    if idx is None: continue 
                    
                    candle_row = df.iloc[idx]
                    if pd.isna(candle_row['ema200']) or pd.isna(candle_row['rsi']): continue

                    params = ASSET_PARAMS.get(sym, ASSET_PARAMS["DEFAULT"])
                    
                    should_buy, reason, meta = check_entry_strategy(
                        candle_row, params, btc_status=btc_status, ignore_trend=ignore_trend
                    )

                    if should_buy:
                        invest_amount = current_total_equity * (risk_pct / 100.0)
                        if invest_amount < 10.0 and current_total_equity >= 11.0: invest_amount = 11.0
                        elif invest_amount < 10.0: continue 

                        entry_p = float(candle_row['close'])
                        amount = invest_amount / entry_p
                        wallet_cash -= invest_amount 
                        
                        position = {
                            'symbol': sym, 'entry_price': entry_p, 'amount': amount, 
                            'invested': invest_amount, 'sl': meta['sl'], 'tp': meta['tp'], 
                            'tp1': 0, 'partial': False
                        }
                        
                        trades_log.append({
                            'time': str(current_time), 'symbol': sym, 'side': 'BUY', 
                            'res': 'ENTRY', 'pnl': 0, 'balance': wallet_cash,
                            'reason': f"{meta.get('trigger', 'Signal')} | BTC:{btc_status}"
                        })
                        break 
                    
                    elif "BLOQUEIO" in reason or "FALLING" in reason:
                        ignored_count += 1

            if current_total_equity > peak_equity: peak_equity = current_total_equity
            drawdown = (current_total_equity - peak_equity) / peak_equity
            if drawdown < max_drawdown_pct: max_drawdown_pct = drawdown

            equity_curve.append({"time": int(current_time.timestamp() * 1000), "value": round(current_total_equity, 2)})

        # FINALIZAÇÃO (MANTÉM IGUAL)
        # ... (retorno das estatísticas) ...
        # (Para facilitar, se precisar do bloco final avise, mas ele é igual ao anterior)
        
        # ... [Bloco Final de Estatísticas aqui] ...
        
        return {"success": True, "stats": stats, "trades": trades_log, "equity_curve": equity_curve}
        """
        Executa simulação Async com suporte a Strategy Unificada e BTC Correlation.
        """
        
        

        # 3. SIMULAÇÃO LOOP
        if progress_callback: progress_callback(90, "Executando Estratégia V6.8...")
        
        wallet_cash = float(initial_balance) 
        position = None 
        trades_log = []
        equity_curve = [] 
        ignored_count = 0
        peak_equity = float(initial_balance)
        max_drawdown_pct = 0.0              

        # Loop Cronológico (Candle a Candle)
        for current_time in timestamps:
            current_total_equity = wallet_cash
            
            # --- STATUS DO BITCOIN NESTE MOMENTO ---
            # Se não tiver dados do BTC para esse minuto, assumimos 'NEUTRAL' (sem bloqueio) ou 'BEAR' (segurança)
            # Para backtest fiel, se faltar dados do BTC, melhor assumir NEUTRAL para não distorcer.
            btc_status = btc_macro_map.get(current_time, "NEUTRAL")

            # A. GESTÃO DE POSIÇÃO (Se já estiver comprado)
            if position:
                sym = position['symbol']
                df = data_feed.get(sym)
                idx = time_index_map.get(sym, {}).get(current_time)
                
                if df is not None and idx is not None:
                    candle = df.iloc[idx]
                    current_price = candle['close']
                    high, low = candle['high'], candle['low']
                    
                    # Atualiza Equity Virtual
                    position_value = position['amount'] * current_price
                    current_total_equity = wallet_cash + position_value
                    
                    trade_closed = False
                    pnl_realized = 0
                    result_type = ""

                    # Verifica SL e TP (Simulação de Execução)
                    # Prioridade: O candle tocou no SL? (Low <= SL)
                    if low <= position['sl']:
                        exit_price = position['sl'] 
                        # Slippage simulado em crashes (-0.2%)
                        if btc_status == "CRASH": exit_price = exit_price * 0.998
                        
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "LOSS"
                        trade_closed = True
                        
                    # Prioridade: O candle tocou no TP? (High >= TP)
                    elif high >= position['tp']:
                        exit_price = position['tp']
                        exit_value = position['amount'] * exit_price
                        pnl_realized = exit_value - position['invested']
                        wallet_cash += exit_value
                        result_type = "WIN"
                        trade_closed = True
                        
                    # Parciais (Se ativado na estratégia)
                    # Não implementado no strategy.py simples, mas a estrutura suporta

                    if trade_closed:
                        current_total_equity = wallet_cash
                        trades_log.append({
                            'time': str(current_time), 'symbol': sym, 'side': 'SELL', 
                            'res': result_type, 'pnl': pnl_realized, 'balance': wallet_cash,
                            'reason': f"Hit {result_type}"
                        })
                        position = None

            # B. SCANNER (Se estiver líquido)
            if not position:
                # Itera sobre ativos disponíveis
                for sym in data_feed.keys():
                    df = data_feed[sym]
                    idx = time_index_map[sym].get(current_time)
                    if idx is None: continue 
                    
                    # Linha atual (Candle + Indicadores)
                    candle_row = df.iloc[idx]
                    
                    # Checagens de integridade
                    if pd.isna(candle_row['ema200']) or pd.isna(candle_row['rsi']): continue

                    params = ASSET_PARAMS.get(sym, ASSET_PARAMS["DEFAULT"])
                    
                    # --- CHAMADA AO CÉREBRO UNIFICADO (strategy.py) ---
                    # Aqui está a mágica: O Backtest usa a MESMA função do Robô Real
                    # Passamos o btc_status recuperado lá em cima
                    should_buy, reason, meta = check_entry_strategy(
                        candle_row, 
                        params, 
                        btc_status=btc_status, 
                        ignore_trend=ignore_trend
                    )

                    if should_buy:
                        # Gestão de Risco (Position Sizing)
                        invest_amount = current_total_equity * (risk_pct / 100.0)
                        
                        # Trava de Mínimo (Binance ~$6)
                        if invest_amount < 10.0 and current_total_equity >= 11.0:
                            invest_amount = 11.0
                        elif invest_amount < 10.0:
                            continue # Saldo insuficiente para operar

                        entry_p = float(candle_row['close'])
                        amount = invest_amount / entry_p
                        
                        wallet_cash -= invest_amount 
                        
                        # Cria a posição usando os Metadados da Strategy
                        position = {
                            'symbol': sym, 
                            'entry_price': entry_p, 
                            'amount': amount, 
                            'invested': invest_amount, 
                            'sl': meta['sl'], # Stop Loss calculado pela Strategy
                            'tp': meta['tp'], # Take Profit calculado pela Strategy
                            'tp1': 0, 
                            'partial': False
                        }
                        
                        trades_log.append({
                            'time': str(current_time), 
                            'symbol': sym, 
                            'side': 'BUY', 
                            'res': 'ENTRY', 
                            'pnl': 0, 
                            'balance': wallet_cash,
                            'reason': f"{meta.get('trigger', 'Signal')} | BTC:{btc_status}"
                        })
                        break # Entrou em um, encerra busca neste candle (Single Position)
                    
                    elif "BLOQUEIO" in reason or "FALLING" in reason:
                        ignored_count += 1

            # Drawdown Calculation
            if current_total_equity > peak_equity: peak_equity = current_total_equity
            drawdown = (current_total_equity - peak_equity) / peak_equity
            if drawdown < max_drawdown_pct: max_drawdown_pct = drawdown

            # Equity Curve Log
            equity_curve.append({"time": int(current_time.timestamp() * 1000), "value": round(current_total_equity, 2)})

        # FINALIZAÇÃO E RELATÓRIO
        if progress_callback: progress_callback(98, "Compilando Estatísticas...")
        
        final_balance = current_total_equity
        profit_total = final_balance - initial_balance
        wins = len([t for t in trades_log if t['res'] == 'WIN'])
        losses = len([t for t in trades_log if t['res'] == 'LOSS'])
        total_closed = wins + losses
        
        start_date_str = timestamps[0].strftime('%d/%m/%Y %H:%M') if timestamps else "N/A"
        end_date_str = timestamps[-1].strftime('%d/%m/%Y %H:%M') if timestamps else "N/A"
        delta = timestamps[-1] - timestamps[0] if timestamps else None
        duration_str = f"{delta.days}d {delta.seconds//3600}h" if delta else "0d"

        stats = {
            "initial_balance": initial_balance, "final_balance": final_balance, "profit_total": profit_total,
            "roi_pct": (profit_total / initial_balance) * 100 if initial_balance > 0 else 0,
            "total_trades": total_closed, "wins": wins, "losses": losses,
            "win_rate": (wins / total_closed * 100) if total_closed > 0 else 0,
            "ignored": ignored_count, "start_date": start_date_str, "end_date": end_date_str,
            "duration": duration_str, "max_drawdown": max_drawdown_pct * 100 
        }

        # Notifica Telegram se solicitado
        if chat_id:
            try:
                asset_label = "PORTFOLIO (Multi)" if len(symbols_list) > 1 else symbols_list[0]
                notify_backtest_report(chat_id, asset_label, timeframe, days, stats)
            except Exception as e: print(f"⚠️ Erro Telegram Backtest: {e}")

        return {"success": True, "stats": stats, "trades": trades_log, "equity_curve": equity_curve}