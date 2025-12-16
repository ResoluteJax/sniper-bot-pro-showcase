from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from cryptography.fernet import Fernet
import re
import uuid

db = SQLAlchemy()
bcrypt = Bcrypt()

# --- CHAVE MESTRA DO SISTEMA ---
SYSTEM_SECRET_KEY = b"YOUR_API_KEY_HERE"
cipher_suite = Fernet(SYSTEM_SECRET_KEY)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    created_at = db.Column(db.String(30), nullable=True)
    session_token = db.Column(db.String(36), nullable=True)
    telegram_chat_id = db.Column(db.String(50), nullable=True) 
    telegram_token = db.Column(db.String(100), nullable=True)
    
    _real_key_enc = db.Column("real_key", db.LargeBinary, nullable=True)
    _real_secret_enc = db.Column("real_secret", db.LargeBinary, nullable=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def refresh_session_token(self):
        self.session_token = str(uuid.uuid4())
        return self.session_token

    def set_binance_keys(self, api_key, secret_key):
        if api_key: self._real_key_enc = cipher_suite.encrypt(api_key.encode('utf-8'))
        if secret_key: self._real_secret_enc = cipher_suite.encrypt(secret_key.encode('utf-8'))

    def get_binance_keys(self):
        api_key = None; secret_key = None
        try:
            if self._real_key_enc: api_key = cipher_suite.decrypt(self._real_key_enc).decode('utf-8')
            if self._real_secret_enc: secret_key = cipher_suite.decrypt(self._real_secret_enc).decode('utf-8')
        except Exception as e: return None, None
        return api_key, secret_key

    @staticmethod
    def validate_password_strength(password):
        if len(password) < 8: return False, "Senha muito curta (min 8)."
        if not re.search(r"[a-z]", password): return False, "Precisa de letra minúscula."
        if not re.search(r"[A-Z]", password): return False, "Precisa de letra maiúscula."
        if not re.search(r"[0-9]", password): return False, "Precisa de um número."
        return True, "Senha forte."
    
    @staticmethod
    def validate_email(email):
        email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
        if not re.match(email_regex, email): return False, "Formato de e-mail inválido."
        return True, "Email válido."

# --- NOVOS MODELOS PARA O TRADER (V6.4) ---

class BotState(db.Model):
    """Armazena o estado volátil da carteira e posição atual"""
    id = db.Column(db.Integer, primary_key=True)
    balance = db.Column(db.Float, default=100.00)
    accumulated_pnl = db.Column(db.Float, default=0.0)
    daily_start_balance = db.Column(db.Float, default=100.00)
    current_day = db.Column(db.Integer, default=0)
    
    # Armazenamos a posição como JSON dentro do banco para flexibilidade
    # SQLite suporta JSON text
    position_json = db.Column(db.JSON, nullable=True) 
    last_update = db.Column(db.String(30))

class Trade(db.Model):
    """Histórico imutável de operações"""
    id = db.Column(db.Integer, primary_key=True)
    exit_time = db.Column(db.String(30))
    symbol = db.Column(db.String(20))
    side = db.Column(db.String(10)) # LONG/SHORT
    invested = db.Column(db.Float)
    profit_usd = db.Column(db.Float)
    profit_pct = db.Column(db.Float)
    result = db.Column(db.String(10)) # WIN/LOSS
    reason = db.Column(db.String(50))