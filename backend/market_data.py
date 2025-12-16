import ccxt
import pandas as pd
from logger import log_error 
from indicators import add_indicators

# --- INSTÂNCIA GLOBAL ---
exchange = ccxt.binance({
    'enableRateLimit': True,
    'options': {'defaultType': 'spot'} 
})

def fetch_market_data(symbol, timeframe, limit=1000): 
    """
    Busca dados de mercado (OHLCV) na Binance.
    Suporta paginação automática para limites > 1000 candles (Vital para EMA precisa).
    """
    try:
        # 1. Busca os candles mais recentes (Limite API padrão é 1000)
        fetch_limit = min(limit, 1000)
        candles = exchange.fetch_ohlcv(symbol, timeframe, limit=fetch_limit)
        
        if not candles: return None

        # 2. Se precisarmos de mais de 1000, fazemos paginação para trás
        # Isso garante histórico suficiente para o Warmup da EMA200
        if limit > 1000 and len(candles) >= 1000:
            remaining = limit - len(candles)
            # Pega o timestamp do candle mais antigo que já temos
            oldest_timestamp = candles[0][0]
            
            # Busca o restante terminando ANTES do candle mais antigo atual
            # params={'endTime': ...} é específico da Binance para paginação reversa
            prev_candles = exchange.fetch_ohlcv(
                symbol, 
                timeframe, 
                limit=remaining, 
                params={'endTime': oldest_timestamp - 1}
            )
            
            if prev_candles:
                # Concatena: Antigos + Recentes
                candles = prev_candles + candles

        # Proteção mínima
        if not candles or len(candles) < 200: 
            return None

        df = pd.DataFrame(candles, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
        
        # --- CORREÇÃO DE FUSO HORÁRIO ---
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms', utc=True).dt.strftime('%Y-%m-%dT%H:%M:%S.000Z')
        
        cols = ['open', 'high', 'low', 'close', 'volume']
        df[cols] = df[cols].astype(float)
        
        # --- APLICAÇÃO DE INDICADORES ---
        # Calcula indicadores com todo o histórico baixado (ex: 1500)
        df = add_indicators(df)
        
        if df.empty: return None
        
        return df

    except Exception as e:
        log_error.error(f"Erro ao buscar dados de {symbol} ({timeframe}): {str(e)}")
        return None

def get_bitcoin_health():
    """
    Função 'Sentinela': Verifica a saúde macro do mercado (BTC).
    """
    try:
        # Analisa o BTC no H1 para tendência macro
        df_btc = fetch_market_data("BTC/USDT", "1h", limit=250)
        
        if df_btc is None or df_btc.empty:
            return "NEUTRAL", "BTC Dados Indisponíveis"
            
        last = df_btc.iloc[-1]
        price = float(last['close'])
        ema200 = float(last.get('ema200', 0))
        rsi = float(last['rsi'])
        
        if rsi < 25:
            return "CRASH", f"BTC Oversold Extremo ({rsi:.1f})"
            
        if price < ema200:
            return "BEAR", "BTC abaixo da EMA200 (H1)"
            
        return "BULL", "BTC Saudável"

    except Exception as e:
        print(f"Erro ao ler BTC: {e}")
        return "NEUTRAL", "Erro Leitura"