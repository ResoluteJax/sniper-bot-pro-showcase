import logging
from logging.handlers import RotatingFileHandler
import os
import sys

# Cria pasta de logs se não existir
LOG_DIR = "logs"
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

# Caminhos dos arquivos
EXEC_LOG_FILE = os.path.join(LOG_DIR, 'sniper_execution.log')
ERROR_LOG_FILE = os.path.join(LOG_DIR, 'sniper_error.log')

def setup_logger(name, log_file, level=logging.INFO):
    """Configura um logger com rotação automática (Max 5MB x 5 Arquivos)"""
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s', 
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Handler que escreve no arquivo e rotaciona quando cheio
    handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=5, encoding='utf-8')
    handler.setFormatter(formatter)
    
    # Handler opcional para mostrar no terminal também
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.addHandler(handler)
    logger.addHandler(console_handler)
    
    return logger

# --- INSTÂNCIAS GLOBAIS ---
log_exec = setup_logger('execution_logger', EXEC_LOG_FILE, level=logging.INFO)
log_error = setup_logger('error_logger', ERROR_LOG_FILE, level=logging.ERROR)

def log_trade_decision(symbol, action, reason, indicators):
    """Formata a decisão para ficar legível no log"""
    msg = (f"DECISÃO: {action} [{symbol}] | Motivo: {reason} | "
           f"Dados: RSI={indicators.get('rsi', 0):.2f}, "
           f"Preço={indicators.get('price', 0):.2f}")
    log_exec.info(msg)