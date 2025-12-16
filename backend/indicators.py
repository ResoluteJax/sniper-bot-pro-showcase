import pandas as pd
import numpy as np

import pandas as pd
import numpy as np

def add_indicators(df):
    
    try:
        cols_to_float = ['close', 'high', 'low', 'open']
        for col in cols_to_float:
            if col in df.columns: df[col] = df[col].astype(float)

        # --- RSI 14 ---
        delta = df['close'].diff()
        up = delta.clip(lower=0)
        down = -1 * delta.clip(upper=0)
        ma_up = up.ewm(com=13, adjust=False).mean()
        ma_down = down.ewm(com=13, adjust=False).mean()
        rs = ma_up / ma_down
        df['rsi'] = 100 - (100 / (1 + rs))
        
        # --- Bollinger Bands (20, 2) ---
        sma20 = df['close'].rolling(window=20).mean()
        std20 = df['close'].rolling(window=20).std()
        df['bb_upper'] = sma20 + (std20 * 2)
        df['bb_lower'] = sma20 - (std20 * 2)
        
        # --- EMA 200 ---
        df['ema200'] = df['close'].ewm(span=200, adjust=False).mean()

        # --- ATR 14 ---
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['atr'] = true_range.ewm(alpha=1/14, adjust=False, min_periods=14).mean()

        # --- CORREÇÃO VITAL: FIBONACCI (DONCHIAN 50) ---
        # Sem isso, a estratégia recebe 0 e falha na confluência
        df['fibo_high'] = df['high'].rolling(window=50).max()
        df['fibo_low'] = df['low'].rolling(window=50).min()
        
        return df
    
    except Exception as e:
        print(f"⚠️ Erro crítico em indicators.py: {e}")
        return df

def check_trend_m5(df):
    
    if df is None or df.empty: return False, "SEM DADOS"
    try:
        last = df.iloc[-1]
        if pd.isna(last.get('ema200')) or last.get('ema200') == 0: return False, "CALIBRANDO..."
        is_bullish = float(last['close']) > float(last['ema200'])
        return is_bullish, "ALTA" if is_bullish else "BAIXA"
    except: return False, "ERRO"

def check_trend_m5(df):
    """
    Filtro de Tendência Macro (H1 ou M5 longo).
    Retorna True se o preço estiver acima da EMA200.
    """
    if df is None or df.empty: 
        return False, "SEM DADOS"
    
    try:
        last = df.iloc[-1]
        if pd.isna(last.get('ema200')) or last.get('ema200') == 0:
            return False, "CALIBRANDO..." 
            
        current_price = float(last['close'])
        ema_trend = float(last['ema200'])
        
        is_bullish = current_price > ema_trend
        reason = "ALTA" if is_bullish else "BAIXA"
        return is_bullish, reason
        
    except Exception as e:
        return False, "ERRO CÁLCULO"