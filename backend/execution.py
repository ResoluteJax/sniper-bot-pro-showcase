import time
from logger import log_exec, log_error

class ExecutionManager:
    def __init__(self, exchange_instance):
        self.exchange = exchange_instance

    def place_market_buy(self, symbol, amount_usdt):
        """
        EXECUÇÃO AGRESSIVA (INSTITUCIONAL V1):
        Entra a Mercado para garantir a posição. 
        Evita o risco de 'ficar chupando dedo' em pumps rápidos.
        """
        if not self.exchange: 
            return {"success": False, "message": "Sem conexão Exchange"}

        try:
            # 1. Obter preço atual para calibração de quantidade
            ticker = self.exchange.fetch_ticker(symbol)
            price = ticker['last']
            
            # 2. Calcular quantidade baseada em USDT
            amount_raw = amount_usdt / price
            amount = self.exchange.amount_to_precision(symbol, amount_raw)

            # --- PROTEÇÃO MIN NOTIONAL ---
            cost = float(amount) * price
            if cost < 5.5: # Margem segura acima dos $5
                 return {"success": False, "message": f"Valor muito baixo (${cost:.2f}). Mínimo $6."}

            log_exec.info(f"🔫 SNIPER MARKET BUY: {amount} {symbol} (~${cost:.2f})")

            # 3. Envia Ordem a Mercado
            try:
                # Na Binance Spot, create_order 'market' usa a quantidade da moeda, não USDT
                order = self.exchange.create_order(symbol, 'market', 'buy', amount)
            except Exception as e:
                msg = str(e)
                if "Insufficient funds" in msg:
                    return {"success": False, "message": "Erro Binance: Saldo Insuficiente."}
                raise e

            # 4. Captura Preço Médio de Execução Real
            # Ordens a mercado geralmente retornam preenchidas imediatamente, 
            # mas vamos garantir buscando os detalhes.
            fill_price = price # Fallback
            filled_qty = float(amount)

            if 'average' in order and order['average']:
                fill_price = float(order['average'])
            else:
                # Busca trade recente da ordem para saber preço exato
                time.sleep(1) # Breve delay para a exchange processar
                try:
                    trades = self.exchange.fetch_my_trades(symbol, limit=1, params={'orderId': order['id']})
                    if trades:
                        fill_price = trades[0]['price']
                except:
                    pass # Mantém o preço do ticker como estimativa se falhar

            log_exec.info(f"✅ EXECUTADO (MARKET) a ${fill_price}")
            
            return {
                "success": True, 
                "price": float(fill_price), 
                "amount": float(amount),
                "cost": float(amount) * float(fill_price)
            }

        except Exception as e:
            log_error.error(f"❌ Falha Market Buy: {e}")
            return {"success": False, "message": str(e)}

    def place_hard_stop(self, symbol, amount, stop_price):
        """
        SEGURANÇA DE REDUNDÂNCIA:
        Coloca uma ordem STOP-LOSS LIMIT na Binance imediatamente após a compra.
        Isso protege o capital caso o servidor/bot trave ou perca conexão.
        """
        try:
            # O preço limite de venda deve ser ligeiramente abaixo do gatilho para garantir execução
            limit_price = stop_price * 0.998 
            
            amount_prec = self.exchange.amount_to_precision(symbol, amount)
            stop_price_prec = self.exchange.price_to_precision(symbol, stop_price)
            limit_price_prec = self.exchange.price_to_precision(symbol, limit_price)

            log_exec.info(f"🛡️ Enviando HARD STOP para Binance: Gatilho ${stop_price_prec}")

            # Parâmetros para Binance (Stop Limit)
            params = {'stopPrice': stop_price_prec}
            
            order = self.exchange.create_order(
                symbol, 
                'limit', 
                'sell', 
                amount_prec, 
                limit_price_prec, 
                params=params
            )
            return {"success": True, "id": order['id']}
        except Exception as e:
            log_error.error(f"⚠️ FALHA AO CRIAR HARD STOP NA BINANCE: {e}")
            return {"success": False, "message": str(e)}

    def place_market_sell(self, symbol, amount_coin):
        """
        Venda a Mercado (Market) para garantir saída rápida.
        """
        try:
            # Tenta cancelar ordens abertas (Hard Stop) antes de vender
            try:
                self.exchange.cancel_all_orders(symbol)
            except: pass

            amount = self.exchange.amount_to_precision(symbol, amount_coin)
            log_exec.info(f"🔻 VENDENDO {amount} {symbol} (Market)")
            
            order = self.exchange.create_order(symbol, 'market', 'sell', amount)
            
            if 'average' in order and order['average']:
                return {"success": True, "price": float(order['average'])}
            
            time.sleep(1)
            updated = self.exchange.fetch_order(order['id'], symbol)
            return {"success": True, "price": float(updated.get('average', 0))}
            
        except Exception as e:
            log_error.error(f"Erro na venda: {e}")
            return {"success": False, "message": str(e)}