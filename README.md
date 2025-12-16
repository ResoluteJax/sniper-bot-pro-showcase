# 🎯 SniperBot Pro — Autonomous Algorithmic Trading System
### Versão: v7.0 (Institutional Build)

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Frontend](https://img.shields.io/badge/Frontend-React.js-61DAFB)
![License](https://img.shields.io/badge/License-Proprietary%20(Showcase)-red)

> **⚠️ AVISO DE PROPRIEDADE INTELECTUAL:**
> Este repositório é um **Showcase de Arquitetura**. A lógica proprietária de entrada (`strategy.py`) e os dados reais de produção foram sanitizados ou removidos para proteção de IP. O código presente demonstra a estrutura de engenharia, a gestão de risco e a implementação Full-Stack.

---

## 📋 Visão Executiva

O **SniperBot Pro** é um sistema de negociação quantitativa desenvolvido para o mercado Spot de criptomoedas. Diferente de bots comerciais focados apenas em sinal (lucro hipotético), este sistema foi arquitetado sob a filosofia de **"Preservação de Capital"**.

O projeto resolve o problema da latência humana e da disciplina emocional, operando 24/7 com uma arquitetura híbrida que separa a lógica pesada de processamento (Backend) da visualização em tempo real (Frontend).

---

## 🛠️ Arquitetura do Sistema

O sistema segue o padrão de **micro-serviços monolíticos**, onde módulos independentes operam em threads separadas sob um mesmo orquestrador.

### 🧠 Backend (The Core)
* **Engine:** Python 3.10+ com Flask.
* **Concorrência:** Multi-threading real para scan de mercado, execução de ordens e notificações assíncronas.
* **Conectividade:** Camada de abstração sobre CCXT (Binance API) com tratamento robusto de erros de rede (retries automáticos).
* **Dados:** SQLite para persistência de estado volátil e histórico de trades (eliminando arquivos `.env` inseguros).

### 💻 Frontend (The Dashboard)
* **Interface:** React.js (SPA - Single Page Application).
* **Visualização:** Recharts para plotagem de dados financeiros e logs em tempo real.
* **UX:** Feedback visual instantâneo de status do bot (Online, Offline, Winter Mode).

---

## 🛡️ Engenharia de Risco (Defense Layers)

O diferencial técnico deste projeto não é apenas "como ele ganha dinheiro", mas **como ele evita perder**. Implementei 4 camadas de defesa:

1.  **Sentinela Macro:** Bloqueio global de compras se o Bitcoin apresentar tendência de crash sistêmico.
2.  **Modo Inverno (Winter Mode):** Um algoritmo de "Cool Down". Se o bot atinge 3 stops consecutivos, ele se auto-bloqueia temporariamente para evitar *Revenge Trading*.
3.  **Execução Redundante:** Ao enviar uma ordem de compra, o sistema dispara imediatamente uma ordem de *Stop Loss* (Limit) para a corretora. Se o servidor cair ou a internet falhar, a posição já está protegida na Binance.
4.  **Circuit Breaker:** Desligamento total automático caso o *Drawdown* diário atinja um limite configurado (ex: -3%).

---

## 📸 Previews & Interface

### Dashboard de Monitoramento (React)
*Visão Tela de Login - Segurança e Validações*
![Login Preview](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/2.png?raw=true)
![Resgister Preview](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/3.png?raw=true).

*Visão geral do painel de controle em tempo real, mostrando o status da conexão e lucro líquido.*
![Dashboard Preview](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/4.png?raw=true)
![Dashboard Previe Comprado]([https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/5.png?raw=true)
![Ferramenta Sniper Lab - Backtest](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/6.png?raw=true)
![Ferramenta Sniper Lab - Backtest - Resultado Real](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/7.png?raw=true)
![Dados Cadastrais](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/8.png?raw=true)

### Logs de Execução e Auditoria
*O sistema mantém um log detalhado de cada decisão tomada pela IA (Sanitizado).*

![Logs Preview](https://github.com/ResoluteJax/sniper-bot-pro-showcase/blob/main/assets/1.png?raw=true)

*(Nota: Imagens ilustrativas do ambiente de desenvolvimento)*

---

## 🚀 Como Executar (Modo Demo)

Como a estratégia proprietária foi removida, o bot rodará em modo de demonstração estrutural.

### Pré-requisitos
* Python 3.10+
* Node.js & NPM
* Git


### 1. Backend Setup

# Clone o repositório
git clone [https://github.com/ResoluteJax/sniper-bot-pro-showcase.git](https://github.com/ResoluteJax/sniper-bot-pro-showcase.git)
cd sniper-bot-pro-showcase/backend

# Instale as dependências
pip install -r requirements.txt

# Inicie o servidor (O Banco de dados será criado automaticamente)
python server.py


###2. Frontend Setup

# Em outro terminal, navegue para a pasta frontend
cd ../frontend

# Instale os pacotes
npm install

# Inicie a aplicação
npm start
O Dashboard estará disponível em http://localhost:3000.

---

👨‍💻 Autor
Otávio Henrique Analista de Sistemas & Desenvolvedor Full-Stack

Especialista em automação de processos, sistemas financeiros e desenvolvimento web. Entre em contato para discutir arquitetura de software ou oportunidades.

LinkedIn • Portfólio

© 2025 SniperBot Systems. Code released for educational/portfolio purposes.
