import json
import os
import time

STATS_FILE = "trade_stats.json"

class StatsManager:
    def __init__(self):
        self.start_time = time.time()
        self.load_stats()

    def load_stats(self):
        if os.path.exists(STATS_FILE):
            try:
                with open(STATS_FILE, 'r') as f:
                    self.data = json.load(f)
            except:
                self.reset_data()
        else:
            self.reset_data()

    def reset_data(self):
        self.data = {
            "total_trades": 0,
            "wins": 0,
            "losses": 0,
            "accumulated_uptime": 0  # Segundos acumulados de sessões anteriores
        }
        self.save_stats()
        self.start_time = time.time() # Reinicia contagem de tempo da sessão

    def save_stats(self):
        with open(STATS_FILE, 'w') as f:
            json.dump(self.data, f)

    def update_trades(self, trade_result):
        # trade_result deve ser > 0 para win, < 0 para loss
        self.data["total_trades"] += 1
        if trade_result > 0:
            self.data["wins"] += 1
        else:
            self.data["losses"] += 1
        self.save_stats()

    def get_stats(self):
        current_session_time = time.time() - self.start_time
        total_time = self.data.get("accumulated_uptime", 0) + current_session_time
        
        total = self.data["total_trades"]
        wins = self.data["wins"]
        winrate = (wins / total * 100) if total > 0 else 0

        return {
            "total_trades": total,
            "win_rate": round(winrate, 1),
            "uptime_seconds": int(total_time),
            "wins": wins,
            "losses": self.data["losses"]
        }
    
    def persist_uptime(self):
        # Chama isso ao desligar ou periodicamente para salvar o tempo
        current_session_time = time.time() - self.start_time
        self.data["accumulated_uptime"] += current_session_time
        self.start_time = time.time() # Reseta o marco para não duplicar
        self.save_stats()

# Instância global
stats_manager = StatsManager()