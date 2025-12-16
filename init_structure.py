import os

def create_structure():
    # Definição da estrutura de pastas do projeto
    folders = [
        "backend",              # O cérebro (Python)
        "backend/strategies",   # Onde ficará a lógica Sniper (Fibo, RSI)
        "frontend",             # A cara (React - Futuro)
        "data",                 # Banco de dados locais (JSON/CSV)
        "logs"                  # Registros de erros e operações
    ]

    # Arquivos iniciais para criar
    files = {
        "requirements.txt": "ccxt\npandas\npython-dotenv\n",
        "backend/.env": "# Chaves da Binance (Testnet)\nBINANCE_API_KEY=\nBINANCE_SECRET=\nUSE_TESTNET=True\n",
        "README.md": "# SniperBot Project\n\nEstrutura inicial criada."
    }

    print("🚀 Iniciando construção do QG SniperBot...")

    # 1. Criar Pastas
    for folder in folders:
        try:
            os.makedirs(folder, exist_ok=True)
            print(f"✅ Pasta criada: {folder}/")
        except Exception as e:
            print(f"❌ Erro ao criar {folder}: {e}")

    # 2. Criar Arquivos
    for filepath, content in files.items():
        try:
            if not os.path.exists(filepath):
                with open(filepath, "w", encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ Arquivo criado: {filepath}")
            else:
                print(f"⚠️ Arquivo já existe (ignorado): {filepath}")
        except Exception as e:
            print(f"❌ Erro ao criar {filepath}: {e}")

    print("\n🏁 Estrutura pronta! Próximos passos:")
    print("1. Abra o terminal na pasta raiz.")
    print("2. Crie o ambiente virtual: python -m venv venv")
    print("3. Ative o venv (Windows: venv\\Scripts\\activate | Mac/Linux: source venv/bin/activate)")
    print("4. Instale as dependências: pip install -r requirements.txt")
    print("5. Preencha o arquivo 'backend/.env' com suas chaves.")

if __name__ == "__main__":
    create_structure()