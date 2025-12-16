import requests
import threading
from datetime import datetime

# --- CONFIGURAÇÕES DINÂMICAS ---
MASTER_TOKEN = None 

def setup_notification_system(token):
    """Função chamada pelo servidor para ativar as notificações via Banco de Dados"""
    global MASTER_TOKEN
    MASTER_TOKEN = token
    if MASTER_TOKEN:
        print(f"✅ Notificações Ativadas via DB | Token final: ...{MASTER_TOKEN[-10:]}")
    else:
        print("⚠️ AVISO: Sistema de notificação iniciou sem Token.")

# --- ASSETS ---
IMAGENS = {
    "BOOT": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_boot.jpg?raw=true",
    "SHUTDOWN": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_shutdown.jpg?raw=true", 
    "ENTRY": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_entry.jpg?raw=true",
    "WIN": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_win.jpg?raw=true",
    "LOSS": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_shield.jpg?raw=true", 
    "SUMMARY": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_report.jpg?raw=true",
    "CONNECT": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_connect.jpg?raw=true",
    "CONFIG": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_config.jpg?raw=true",
    "MODE_REAL": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_paper.jpg?raw=true", 
    "MODE_PAPER": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_paper.jpg?raw=true",
    "BACKTEST": "https://github.com/ResoluteJax/imagensProjetoSniper/blob/main/sniper_backtest.jpg?raw=true" 
}

def format_currency(value):
    if value is None: return "$ 0.00"
    try: return f"$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except: return "$ 0,00"

def _telegram_worker(chat_id, message, image_url):
    # Debug: Mostra o estado atual das variáveis globais
    if not MASTER_TOKEN:
        print(f"❌ FALHA DE ENVIO: MASTER_TOKEN está vazio/None. O server.py não injetou o token!")
        return

    try:
        url = ""
        payload = {}
        
        # Montagem da URL
        if image_url and image_url.startswith("http"):
            url = f"https://api.telegram.org/bot{MASTER_TOKEN}/sendPhoto"
            payload = {'chat_id': chat_id, 'photo': image_url, 'caption': message, 'parse_mode': 'Markdown'}
            print(f"📤 Tentando enviar FOTO para {chat_id}...")
        else:
            url = f"https://api.telegram.org/bot{MASTER_TOKEN}/sendMessage"
            payload = {'chat_id': chat_id, 'text': message, 'parse_mode': 'Markdown'}
            print(f"📤 Tentando enviar TEXTO para {chat_id}...")

        # Execução
        response = requests.post(url, data=payload, timeout=10)
        
        if response.status_code == 200:
            print("✅ Telegram SUCESSO: Mensagem entregue.")
        else:
            # Se der erro, mostra o porquê
            print(f"⛔ Telegram REJEITOU (Erro {response.status_code}): {response.text}")
            
    except Exception as e:
        print(f"⚠️ ERRO DE CONEXÃO (Exception): {e}")

def send_telegram_msg(chat_id, message, image_url=None):
    if not chat_id: 
        print("❌ Erro: Chat ID não fornecido para notificação.")
        return False, "Chat ID Ausente"

    t = threading.Thread(target=_telegram_worker, args=(chat_id, message, image_url))
    t.daemon = True
    t.start()
    return True, "Enviado"

# --- NOTIFICAÇÕES (Chat ID agora é Obrigatório) ---

def notify_connection_test(chat_id):
    msg = ("📡 *CONEXÃO ESTABELECIDA*\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\nO *SniperBot Pro* está conectado via Banco de Dados.\n\n✅ *Permissões:* Admin\n✅ *Mídia:* Ativa")
    return send_telegram_msg(chat_id, msg, image_url=IMAGENS["CONNECT"])

def notify_config_saved(chat_id):
    msg = ("⚙️ *CONFIGURAÇÃO SALVA*\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\nOs dados foram gravados no Banco de Dados local.")
    send_telegram_msg(chat_id, msg, image_url=IMAGENS["CONFIG"])

def notify_bot_state(is_running, chat_id):
    status = "🟢 ONLINE" if is_running else "🔴 OFFLINE"
    img = IMAGENS["BOOT"] if is_running else IMAGENS["SHUTDOWN"]
    msg = (f"🤖 *STATUS DO SISTEMA*\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\nStatus: *{status}*\n📅 {datetime.now().strftime('%H:%M:%S')}")
    send_telegram_msg(chat_id, msg, image_url=img)

def notify_environment_change(is_testnet, chat_id):
    modo = "🛡️ SIMULADOR" if is_testnet else "⚠️ CONTA REAL"
    img = IMAGENS["MODE_PAPER"] if is_testnet else IMAGENS["MODE_REAL"]
    msg = (f"🔄 *TROCA DE AMBIENTE*\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\nModo Atual: *{modo}*")
    send_telegram_msg(chat_id, msg, image_url=img)

def notify_entry(symbol, price, invested, balance, trigger, tp, sl, is_live, chat_id):
    env = "LIVE 🔴" if is_live else "DEMO 🛡️"
    msg = (f"🎯 *ENTRADA* | {env}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n💎 *{symbol}*\n💵 `{format_currency(price)}`\n💰 Margem: `{format_currency(invested)}`\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n⚡ {trigger}\n📈 TP: `{format_currency(tp)}`\n🛡️ SL: `{format_currency(sl)}`")
    send_telegram_msg(chat_id, msg, image_url=IMAGENS["ENTRY"])

def notify_exit(symbol, exit_price, profit, profit_pct, reason, new_balance, is_live, chat_id):
    header = "✅ GAIN" if profit > 0 else "🔻 LOSS"
    img = IMAGENS["WIN"] if profit > 0 else IMAGENS["LOSS"]
    msg = (f"{header}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n💎 *{symbol}*\n🚪 Saída: `{format_currency(exit_price)}`\n⚖️ {reason}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n📊 *{format_currency(profit)}* ({profit_pct:.2f}%)")
    send_telegram_msg(chat_id, msg, image_url=img)

def notify_backtest_report(chat_id, symbol, timeframe, days, stats):
    """Envia relatório consolidado do Backtest"""
    emoji_result = "✅" if stats['profit_total'] >= 0 else "🔻"
    
    msg = (
        f"🧪 **RELATÓRIO SNIPER LAB**\n"
        f"▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n"
        f"⚙️ **Parâmetros:**\n"
        f"Ativo: `{symbol}`\n"
        f"Tempo: `{timeframe}` ({days} dias)\n"
        f"▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n"
        f"📊 **Performance:**\n"
        f"Saldo Final: `{format_currency(stats['final_balance'])}`\n"
        f"Lucro Líquido: **{format_currency(stats['profit_total'])}**\n"
        f"Retorno (ROI): **{stats['roi_pct']:.2f}%** {emoji_result}\n"
        f"▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n"
        f"🎯 **Estatísticas:**\n"
        f"Trades: {stats['total_trades']} (W: {stats['wins']} | L: {stats['losses']})\n"
        f"Taxa de Acerto: **{stats['win_rate']:.1f}%**\n"
        f"Oportunidades Filtradas: {stats['ignored']}\n"
    )
    # Usa a imagem de SUMMARY ou BACKTEST se tiver
    return send_telegram_msg(chat_id, msg, image_url=IMAGENS.get("SUMMARY"))