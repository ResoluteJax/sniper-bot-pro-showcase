from server import app, db, User
import requests

# --- SEU TOKEN PURO (Sem "SNIPER_TELEGRAM_TOKEN=", sem aspas extras) ---
TOKEN_CORRETO = "YOUR_API_KEY_HERE"
# -----------------------------------------------------------------------

def testar_telegram(token, chat_id):
    print(f"\n📡 Testando conexão com Telegram...")
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {'chat_id': chat_id, 'text': "🔔 TESTE DE INJEÇÃO: Se recebeu isso, funcionou!", 'parse_mode': 'Markdown'}
    
    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            print("✅ SUCESSO: Mensagem enviada! O Token e o ID estão corretos.")
            return True
        elif resp.status_code == 401:
            print("❌ ERRO 401: Token Inválido/Não Autorizado. Verifique se copiou certo.")
        elif resp.status_code == 400:
            print("❌ ERRO 400: Chat ID inválido ou conversa não iniciada.")
        else:
            print(f"❌ ERRO {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ ERRO DE CONEXÃO: {e}")
    return False

with app.app_context():
    print("--- INICIANDO CORREÇÃO ---")
    user = User.query.first()
    
    if user:
        print(f"👤 Usuário Admin: {user.username}")
        print(f"🔑 Token Antigo no Banco: {user.telegram_token}")
        
        # 1. Atualiza com o Token Limpo
        user.telegram_token = TOKEN_CORRETO.strip() # Remove espaços
        db.session.commit()
        print(f"💾 Token Novo Salvo: {user.telegram_token}")
        
        # 2. Testa imediatamente
        if user.telegram_chat_id:
            testar_telegram(user.telegram_token, user.telegram_chat_id)
        else:
            print("⚠️ Sem Chat ID para testar. Logue no bot e configure o ID.")
            
        print("\n⚠️ IMPORTANTE: Agora REINICIE o server.py para que ele carregue essa mudança!")
    else:
        print("❌ Nenhum usuário encontrado. Crie uma conta primeiro.")