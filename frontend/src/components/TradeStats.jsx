import React, { useState, useEffect } from 'react';
import { Trophy, Ban, BarChart3, Clock, Zap } from 'lucide-react';

export default function TradeStats({ globalStats, trades = [] }) {
    const [uptime, setUptime] = useState("00:00:00");

    // Relógio de Sessão (Persistente)
    useEffect(() => {
        // Tenta recuperar o início da sessão do armazenamento local
        let savedStart = localStorage.getItem('sniper_session_start');
        
        // Se não existir, define o agora como início e salva
        if (!savedStart) {
            savedStart = Date.now().toString();
            localStorage.setItem('sniper_session_start', savedStart);
        }

        const start = parseInt(savedStart, 10);

        const timer = setInterval(() => {
            const now = Date.now();
            const totalSeconds = Math.floor((now - start) / 1000);
            
            const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const s = (totalSeconds % 60).toString().padStart(2, '0');
            
            setUptime(`${h}:${m}:${s}`);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Usa dados globais se disponíveis, senão calcula da sessão
    const totalTrades = globalStats?.total_trades ?? trades.length;
    const wins = globalStats?.wins ?? trades.filter(t => t.profit_usd > 0).length;
    const losses = globalStats?.losses ?? trades.filter(t => t.profit_usd <= 0).length;
    const winRate = globalStats?.win_rate ?? (totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0");
    
    const sessionProfit = trades.reduce((acc, curr) => acc + curr.profit_usd, 0);
    const isProfit = sessionProfit >= 0;

    return (
        <div className="w-full bg-slate-950 border-t border-slate-800 p-2 lg:p-4 shadow-2xl z-40">
            <div className="max-w-[1600px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
                
                {/* Stats Items */}
                <StatItem label="TOTAL TRADES" value={totalTrades} icon={BarChart3} color="text-blue-400" bg="bg-blue-500/10" />
                <StatItem label="WIN RATE" value={`${winRate}%`} icon={Trophy} color={parseFloat(winRate) >= 50 ? "text-emerald-400" : "text-rose-400"} bg={parseFloat(winRate) >= 50 ? "bg-emerald-500/10" : "bg-rose-500/10"} />
                <StatItem label="PNL SESSÃO" value={`${isProfit ? '+' : ''}$${sessionProfit.toFixed(2)}`} icon={Zap} color={isProfit ? "text-emerald-400" : "text-rose-400"} bg={isProfit ? "bg-emerald-500/10" : "bg-rose-500/10"} />
                <StatItem label="LOSSES" value={losses} icon={Ban} color="text-rose-400" bg="bg-rose-500/10" hideMobile />
                <StatItem label="SESSÃO" value={uptime} icon={Clock} color="text-purple-400" bg="bg-purple-500/10" />

            </div>
        </div>
    );
}

const StatItem = ({ label, value, icon: Icon, color, bg, hideMobile }) => (
    <div className={`flex items-center justify-between p-2 rounded-lg border border-slate-800/50 bg-slate-900 ${hideMobile ? 'hidden md:flex' : 'flex'}`}>
        <div>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
            <p className={`text-sm md:text-lg font-bold font-mono ${color}`}>{value}</p>
        </div>
        <div className={`p-1.5 md:p-2 rounded-md ${bg}`}>
            <Icon className={`w-3 h-3 md:w-4 md:h-4 ${color}`} />
        </div>
    </div>
);