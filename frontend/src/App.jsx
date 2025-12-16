import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Activity, FlaskConical, Play, Wallet, TrendingUp, TrendingDown, Power, Crosshair, AlertTriangle, History, 
  DollarSign, Terminal, CheckCircle2, XCircle, RotateCcw, Sunrise, Settings, Percent,
  Github, Linkedin, Globe, Lock, ToggleLeft, ToggleRight, Shield, ShieldAlert, Key, Save, X, User, 
  ChevronDown, ChevronUp, RefreshCw, Siren, Hand, FileWarning, Radar, MessageSquare, AlertOctagon, 
  LogOut, Smartphone, Ban, ChevronLeft, ChevronRight, Send, Radio, Trash2 
} from 'lucide-react';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

import TVChart from './components/TVChart';
import TradeStats from './components/TradeStats';
import Auth from './components/Auth';

// --- UTILITÁRIOS ---
const playAudio = (type) => {
    const sounds = { ENTRY: "/trading_buy.wav", PROFIT: "/trading_profit.wav", LOSS: "/trading_loss.wav" };
    const file = sounds[type]; if (file) { const audio = new Audio(file); audio.volume = 0.8; audio.play().catch(e=>{}); }
};

const formatMoney = (v, isTicker = false) => {
    if (v === null || v === undefined || v === '---') return '$ 0,00';
    const num = parseFloat(v);
    if (isNaN(num)) return '$ 0,00';
    if (isTicker && Math.abs(num) < 1.0 && num !== 0) {
        return '$ ' + num.toFixed(8).replace('.', ',');
    }
    return '$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (v) => { if (v === null || v === undefined) return '--'; const num = parseFloat(v); return isNaN(num) ? '--' : num.toLocaleString('pt-BR', {minimumFractionDigits:1}); };
const formatTime = (timeStr) => { if (!timeStr || typeof timeStr !== 'string') return '--:--'; try { return timeStr.length > 16 ? timeStr.substring(11, 16) : timeStr; } catch (e) { return '--:--'; } };

const AVAILABLE_PAIRS = [ "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT", "LINK/USDT", "LTC/USDT", "UNI/USDT", "NEAR/USDT", "MATIC/USDT", "ATOM/USDT", "ARB/USDT", "SUI/USDT", "OP/USDT", "APT/USDT", "INJ/USDT", "RNDR/USDT", "FET/USDT", "DOGE/USDT", "SHIB/USDT", "PEPE/USDT", "FLOKI/USDT" ];
const getCoinIcon = (symbol) => { if(!symbol) return "https://assets.coingecko.com/coins/images/1/small/bitcoin.png"; const base = symbol.split('/')[0]; const icons = { "BTC": "https://cryptologos.cc/logos/bitcoin-btc-logo.png", "ETH": "https://cryptologos.cc/logos/ethereum-eth-logo.png", "BNB": "https://cryptologos.cc/logos/bnb-bnb-logo.png", "SOL": "https://cryptologos.cc/logos/solana-sol-logo.png", "XRP": "https://cryptologos.cc/logos/xrp-xrp-logo.png", "ADA": "https://cryptologos.cc/logos/cardano-ada-logo.png", "AVAX": "https://cryptologos.cc/logos/avalanche-avax-logo.png", "DOT": "https://cryptologos.cc/logos/polkadot-new-dot-logo.png", "LINK": "https://cryptologos.cc/logos/chainlink-link-logo.png", "LTC": "https://cryptologos.cc/logos/litecoin-ltc-logo.png", "UNI": "https://cryptologos.cc/logos/uniswap-uni-logo.png", "NEAR": "https://cryptologos.cc/logos/near-protocol-near-logo.png", "MATIC": "https://cryptologos.cc/logos/polygon-matic-logo.png", "ATOM": "https://cryptologos.cc/logos/cosmos-atom-logo.png", "ARB": "https://cryptologos.cc/logos/arbitrum-arb-logo.png", "SUI": "https://cryptologos.cc/logos/sui-sui-logo.png", "OP": "https://cryptologos.cc/logos/optimism-ethereum-op-logo.png", "APT": "https://cryptologos.cc/logos/aptos-apt-logo.png", "INJ": "https://cryptologos.cc/logos/injective-inj-logo.png", "RNDR": "https://cryptologos.cc/logos/render-token-rndr-logo.png", "FET": "https://cryptologos.cc/logos/fetch-ai-fet-logo.png", "DOGE": "https://cryptologos.cc/logos/dogecoin-doge-logo.png", "SHIB": "https://cryptologos.cc/logos/shiba-inu-shib-logo.png", "PEPE": "https://cryptologos.cc/logos/pepe-pepe-logo.png", "FLOKI": "https://cryptologos.cc/logos/floki-inu-floki-logo.png" }; return icons[base] || `https://bin.bnbstatic.com/static/assets/logos/${base}.png`; };

// --- COMPONENTES UI (MANTIDOS) ---
const CurrencySelect = ({ currentSymbol, onSymbolChange, isLocked }) => { 
    const [isOpen, setIsOpen] = useState(false); 
    const dropdownRef = useRef(null); 
    useEffect(() => { const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []); 
    const currentIcon = getCoinIcon(currentSymbol); 
    return ( 
        <div className="relative" ref={dropdownRef}> 
            <button onClick={() => !isLocked && setIsOpen(!isOpen)} disabled={isLocked} className={`flex items-center gap-2 bg-slate-900 border ${isOpen ? 'border-emerald-500/50' : 'border-slate-800'} ${isLocked ? 'opacity-50 cursor-not-allowed border-rose-900/30' : 'hover:border-slate-700'} px-3 py-1.5 rounded-lg transition-all duration-200 group`}> 
                <img src={currentIcon} alt="coin" className="w-5 h-5 rounded-full" /> 
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLocked ? 'text-rose-400' : 'text-slate-300 group-hover:text-white'}`}>{currentSymbol}</span> 
                {isLocked ? <Lock className="w-3 h-3 text-rose-500" /> : (isOpen ? <ChevronUp className="w-4 h-4 text-emerald-500" /> : <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-400" />)} 
            </button> 
            {isOpen && !isLocked && ( <div className="absolute z-[999] mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"> <div className="py-1 max-h-[400px] overflow-y-auto custom-scrollbar"> {AVAILABLE_PAIRS.map((pair) => { const icon = getCoinIcon(pair); const isSelected = pair === currentSymbol; return ( <div key={pair} onClick={() => { onSymbolChange(pair); setIsOpen(false); }} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/10' : 'hover:bg-slate-800'}`}> <img src={icon} alt={pair} className="w-6 h-6 rounded-full" /> <div> <p className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-slate-200'}`}>{pair}</p> </div> {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />} </div> ); })} </div> </div> )} 
        </div> 
    ); 
};

const LogicTerminal = ({ data, isRunning, activeTrade }) => { 
  const { rsi = 50, price = 0, open_price = 0, bb_lower = 0, bb_upper = 0, fibo_high = 0, fibo_low = 0, ema200 = 0, ema_slope = 0 } = data || {}; 

  // --- MODO 1: MONITOR DE OPERAÇÃO (QUANDO ESTÁ POSICIONADO) ---
  if (activeTrade) {
      const entryPrice = activeTrade.entry_price;
      const currentPrice = price || entryPrice;
      const tpPrice = activeTrade.tp_price;
      const slPrice = activeTrade.sl_price;
      
      // Cálculos de Progresso
      const totalRange = tpPrice - slPrice;
      const progress = totalRange === 0 ? 0 : ((currentPrice - slPrice) / totalRange) * 100;
      const clampedProgress = Math.min(Math.max(progress, 0), 100);
      
      const profitPct = ((currentPrice - entryPrice) / entryPrice) * 100;
      const isProfit = profitPct >= 0;

      // Lógica de Saída Dinâmica (Simulação Visual do Backend)
      const minProfitSecure = profitPct > 0.5; // Já pagou taxas + lucro mínimo?
      const rsiPeak = rsi > 75; // RSI Estourado?
      const bbTouch = currentPrice >= bb_upper; // Tocou no teto?
      const smartExitReady = minProfitSecure && (rsiPeak || bbTouch);

      return (
        <div className="bg-slate-900/80 px-3 py-2 rounded-xl border border-emerald-500/30 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)] h-full font-mono text-[10px] flex flex-col justify-between relative overflow-hidden">
            
            {/* HEADER: STATUS TÁTICO */}
            <div className="flex justify-between items-center mb-2 border-b border-emerald-500/20 pb-1">
                <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                    OPERAÇÃO EM CURSO
                </span>
                <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>{profitPct > 0 ? '+' : ''}{profitPct.toFixed(2)}%</span>
            </div>

            {/* BARRA DE PROGRESSO VISUAL (SL vs TP) */}
            <div className="space-y-1 mb-2">
                <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                    <span className="text-rose-500">STOP</span>
                    <span className="text-slate-400">ENTRADA</span>
                    <span className="text-emerald-500">ALVO</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full relative overflow-visible mt-1">
                    {/* Marcador de Entrada (Neutro) */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10" style={{ left: `${((entryPrice - slPrice) / totalRange) * 100}%` }}></div>
                    
                    {/* Barra de Progresso Atual */}
                    <div className={`absolute top-0 bottom-0 rounded-full transition-all duration-500 ${isProfit ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`} 
                         style={{ left: `${((entryPrice - slPrice) / totalRange) * 100}%`, width: `${Math.abs(progress - ((entryPrice - slPrice) / totalRange) * 100)}%`, transform: isProfit ? 'none' : 'translateX(-100%)' }}>
                    </div>
                    
                    {/* O "Puck" (Preço Atual) */}
                    <div className="absolute top-1/2 -mt-1.5 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-900 transition-all duration-500 z-20" style={{ left: `${clampedProgress}%`, marginLeft: '-6px' }}></div>
                </div>
            </div>

            {/* CHECKLIST DE SAÍDA INTELIGENTE */}
            <div className="bg-slate-950/50 p-1.5 rounded border border-slate-800 space-y-1">
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-1 text-center">Condições de Saída Antecipada</p>
                
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">1. Lucro Mínimo ({'>'}0.5%)</span>
                    {minProfitSecure ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <span className="text-slate-600 text-[9px]">{profitPct.toFixed(2)}%</span>}
                </div>
                
                <div className="flex justify-between items-center">
                    <span className="text-slate-400">2. Exaustão (RSI {'>'}75)</span>
                    <span className={rsiPeak ? "text-emerald-400 font-bold" : "text-slate-600"}>{formatNumber(rsi)}</span>
                </div>

                <div className="flex justify-between items-center">
                    <span className="text-slate-400">3. Teto (Bollinger Top)</span>
                    <span className={bbTouch ? "text-emerald-400 font-bold" : "text-slate-600"}>{bbTouch ? "TOCOU" : "LONGE"}</span>
                </div>
            </div>

            {/* STATUS FINAL DA AÇÃO */}
            <div className="mt-1 text-center">
                {smartExitReady ? 
                    <span className="text-emerald-400 font-bold animate-pulse text-[10px]">⚠️ FECHANDO: LUCRO NO BOLSO!</span> :
                    <span className="text-slate-500 text-[9px]">SEGURANDO POSIÇÃO...</span>
                }
            </div>
        </div>
      );
  }

  // --- MODO 2: SCANNER (QUANDO ESTÁ PROCURANDO) - MANTIDO COMPACTO ---
  const isTrendUp = price > ema200;
  const isSlopeGood = ema_slope > -0.5;
  const trendStatus = isTrendUp ? (isSlopeGood ? "ALTA" : "ALTA(F)") : "BAIXA";
  
  const isRsiOk = rsi < 30; 
  const goldenTop = fibo_high - ((fibo_high - fibo_low) * 0.5); 
  const goldenBot = fibo_high - ((fibo_high - fibo_low) * 0.618); 
  const isFiboOk = price > 0 && price <= goldenTop * 1.002 && price >= goldenBot * 0.998; 
  const isBbOk = price > 0 && price <= bb_lower * 1.005; 
  const isConfluence = isFiboOk || isBbOk;
  const isGreenCandle = price >= open_price; 
  
  let statusMsg = "AGUARDANDO";
  let statusColor = "text-slate-500";
  
  if (!isRunning) { statusMsg = "PAUSADO"; } 
  else if (!isTrendUp) { statusMsg = "BLOQUEIO MACRO"; statusColor = "text-rose-500"; } 
  else if (!isSlopeGood) { statusMsg = "MÉDIA FLAT"; statusColor = "text-amber-500"; } 
  else if (isRsiOk && isConfluence) {
      if (!isGreenCandle) { statusMsg = "REQ. CANDLE VERDE"; statusColor = "text-yellow-400 animate-pulse"; } 
      else { statusMsg = "GATILHO PRONTO"; statusColor = "text-emerald-400 font-bold"; }
  }

  if (!isRunning) return (<div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shadow-lg h-full flex items-center justify-center opacity-70"><div className="text-center flex items-center gap-2"><Power className="w-4 h-4 text-slate-600" /><p className="text-slate-500 text-[10px] font-mono font-bold">OFFLINE</p></div></div>); 

  return ( 
    <div className="bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shadow-inner h-full font-mono text-[10px] flex flex-col justify-between relative overflow-hidden group"> 
      {/* HEADER COMPACTO */}
      <div className="flex items-center gap-2 text-slate-400 mb-1 border-b border-slate-800/50 pb-1">
          <Terminal className="w-3 h-3 text-emerald-500" />
          <span className="font-bold uppercase tracking-wider text-slate-200 text-[10px]">CÓRTEX v6.3</span>
          <div className="ml-auto flex gap-1">
             <div className={`w-1 h-1 rounded-full ${isTrendUp ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
             <div className={`w-1 h-1 rounded-full ${isRsiOk ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
             <div className={`w-1 h-1 rounded-full ${isGreenCandle ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
          </div>
      </div> 

      {/* BLOCO CENTRAL UNIFICADO */}
      <div className="space-y-1">
          <div className="flex justify-between items-center bg-slate-900/30 px-1.5 py-0.5 rounded">
              <span className="text-slate-500">H1 Trend</span>
              <div className="flex items-center gap-1">
                  <span className={`font-bold ${isTrendUp ? "text-emerald-400" : "text-rose-400"}`}>{trendStatus}</span>
                  {ema_slope !== 0 && (<span className={`text-[9px] ${ema_slope > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>({ema_slope > 0 ? '↗' : '↘'}{Math.abs(ema_slope).toFixed(1)})</span>)}
              </div>
          </div>

          <div className="flex justify-between items-center px-1.5">
              <span className="text-slate-500">RSI (14)</span>
              <div className="flex items-center gap-2">
                  <span className={`font-bold ${isRsiOk ? "text-emerald-400" : "text-slate-300"}`}>{formatNumber(rsi)}</span>
                  <div className="w-10 h-1 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${isRsiOk ? 'bg-emerald-500' : 'bg-slate-600'}`} style={{ width: `${Math.min(rsi, 100)}%` }}></div></div>
              </div>
          </div>

          <div className="flex justify-between items-center px-1.5">
              <span className="text-slate-500">Zona Fibo</span>
              <span className={`font-bold ${isConfluence ? "text-emerald-400" : "text-slate-600"}`}>{isConfluence ? "DENTRO" : "FORA"}</span>
          </div>
      </div>

      {/* FOOTER */}
      <div className="mt-1 pt-1 border-t border-slate-800/50 flex justify-between items-center">
           <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${isGreenCandle ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
               {isGreenCandle ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
               {isGreenCandle ? "COMPRA" : "VENDA"}
           </div>
           <span className={`text-[9px] font-bold tracking-wider ${statusColor}`}>{statusMsg}</span>
      </div>
    </div> 
  ); 
};

// --- COMPONENTE RISK CONTROL (LIMPO - SEM MARTINGALE) ---
const RiskControl = ({ value, onChange }) => { 
    const MIN_RISK = 1; // Ajustei para 1% para dar mais liberdade, se quiser manter 6, altere aqui.
    const MAX_RISK = 100; 

    const adjustValue = (delta) => { 
        const newValue = Math.min(MAX_RISK, Math.max(MIN_RISK, value + delta)); 
        onChange(newValue); 
    }; 
    
    const handleInputChange = (e) => { 
        let val = parseInt(e.target.value); 
        if (isNaN(val)) val = MIN_RISK; 
        if (val > MAX_RISK) val = MAX_RISK; 
        onChange(val); 
    }; 
    
    const handleBlur = () => { 
        if (value < MIN_RISK) onChange(MIN_RISK); 
    }; 

    return ( 
        <div className="w-full space-y-3"> 
            {/* Header com Input Numérico */}
            <div className="flex justify-between items-center mb-2"> 
                <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-slate-300 font-bold uppercase tracking-wide">Gestão de Risco</span>
                </div> 
                <div className="flex items-center bg-slate-950 rounded border border-slate-700 overflow-hidden">
                    <button onClick={() => adjustValue(-1)} disabled={value <= MIN_RISK} className="px-2 py-1 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft className="w-3 h-3" />
                    </button>
                    <div className="flex items-center px-1 border-x border-slate-800 bg-slate-900/50">
                        <input type="number" value={value} onChange={handleInputChange} onBlur={handleBlur} min={MIN_RISK} max={MAX_RISK} className="w-8 bg-transparent text-center text-emerald-400 font-mono text-xs font-bold outline-none appearance-none"/>
                        <Percent className="w-2.5 h-2.5 text-emerald-500/50 ml-0.5" />
                    </div>
                    <button onClick={() => adjustValue(1)} disabled={value >= MAX_RISK} className="px-2 py-1 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight className="w-3 h-3" />
                    </button>
                </div> 
            </div> 
            
            {/* Slider Visual */}
            <div className="flex items-center gap-3 px-1">
                <span className="text-[10px] text-slate-500 font-mono font-bold">{MIN_RISK}%</span>
                <input type="range" min={MIN_RISK} max={MAX_RISK} value={value < MIN_RISK ? MIN_RISK : value} onChange={(e) => onChange(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"/>
                <span className="text-[10px] text-slate-500 font-mono font-bold">ALL-IN</span>
            </div> 

            {/* Rodapé Informativo */}
            <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex items-center gap-2">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] text-slate-400">
                    Stop Loss fixo calculado via volatilidade (ATR).
                </span>
            </div>
        </div> 
    ); 
};

const DisclaimerModal = ({ isOpen, onClose, onConfirm, title, content }) => { if (!isOpen) return null; return ( <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[110]"> <div className="bg-slate-900 border border-rose-500/50 p-6 rounded-2xl w-full max-w-md shadow-2xl shadow-rose-900/20 transform scale-100 transition-all"> <div className="flex items-center gap-3 mb-4 text-rose-500"> <div className="p-3 bg-rose-500/10 rounded-full"><FileWarning className="w-8 h-8" /></div> <h2 className="text-xl font-bold text-white">{title || "Termo de Responsabilidade"}</h2> </div> <div className="space-y-4 text-slate-300 text-xs leading-relaxed bg-slate-950/50 p-4 rounded-lg border border-slate-800"> {content} </div> <div className="flex gap-3 mt-6"> <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">CANCELAR</button> <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold text-xs bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-lg shadow-rose-900/20">CONCORDO E ASSUMO O RISCO</button> </div> </div> </div> ); };
const ManualTrading = ({ isBotRunning, onManualOrder }) => { const [unlocked, setUnlocked] = useState(false); const [showDisclaimer, setShowDisclaimer] = useState(false); useEffect(() => { if (isBotRunning) setUnlocked(false); }, [isBotRunning]); const handleCheckbox = (e) => { if (e.target.checked) { setShowDisclaimer(true); } else { setUnlocked(false); } }; const confirmUnlock = () => { setUnlocked(true); setShowDisclaimer(false); }; const manualContent = ( <> <p>Você está prestes a ativar o <strong>Modo de Negociação Manual</strong>.</p> <ul className="list-disc pl-4 space-y-2 text-slate-400"> <li>Operações manuais ignoram os filtros de segurança do algoritmo.</li> <li>Você assume <strong>total responsabilidade</strong> por perdas.</li> <li className="text-amber-400 font-semibold">Ferramenta em BETA. Recomendado uso em SIMULADOR.</li> </ul> </> ); return ( <> <DisclaimerModal isOpen={showDisclaimer} onClose={() => setShowDisclaimer(false)} onConfirm={confirmUnlock} title="Termo de Responsabilidade" content={manualContent} /> <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-4"> <div className="flex justify-between items-center mb-3"> <div className="flex items-center gap-2"><Hand className="w-4 h-4 text-slate-400" /><span className="text-xs text-slate-300 font-bold uppercase tracking-wide">Trader Manual</span><span className="bg-amber-500/10 text-amber-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/20 tracking-wide">BETA</span></div> <label className="flex items-center gap-2 cursor-pointer"> <input type="checkbox" checked={unlocked} onChange={handleCheckbox} disabled={isBotRunning} className="accent-emerald-500 w-3 h-3 cursor-pointer disabled:opacity-50"/> <span className={`text-[10px] font-medium ${unlocked ? 'text-emerald-400' : 'text-slate-500'}`}>{isBotRunning ? 'Bloqueado' : 'Concordo'}</span> </label> </div> <div className="grid grid-cols-2 gap-3"> <button onClick={() => onManualOrder('BUY')} disabled={!unlocked} className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${unlocked ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)] active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>COMPRAR</button> <button onClick={() => onManualOrder('SELL')} disabled={!unlocked} className={`py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${unlocked ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)] active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'}`}>VENDER</button> </div> </div> </> ); };
const StatCard = ({ title, value, subtext, icon: Icon, colorClass }) => { 
    const renderValue = () => { 
        if (React.isValidElement(value)) return value; 
        let displayValue = value; 
        if (title.includes("Preço Atual")) { displayValue = formatMoney(value, true); } 
        else if (title.includes("Lucro") || title.includes("Banca")) { 
            displayValue = formatMoney(value || 0); 
            if (title.includes("Lucro") && parseFloat(value) > 0) displayValue = "+" + displayValue; 
        } else if (typeof value === 'string' || typeof value === 'number') { displayValue = value || "---"; } 
        return <h3 className={`text-lg md:text-xl font-bold tracking-tight ${colorClass?.includes("text-") ? colorClass : "text-white"}`}>{displayValue}</h3>; 
    }; 

    return ( 
        // Adicionado 'min-h-[110px]' para garantir altura mínima uniforme
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 shadow-lg flex flex-col justify-between h-full min-h-[100px] hover:border-slate-700 transition-all relative overflow-hidden"> 
            <div className="flex justify-between items-start z-10"> 
                <div> 
                    <div className="flex items-center gap-1.5 mb-0.5"> 
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{title}</p> 
                    </div> 
                    {renderValue()} 
                </div> 
                <div className={`p-1.5 rounded-lg bg-opacity-10 ${colorClass?.replace('text-', 'bg-')}`}> 
                    <Icon className={`w-4 h-4 ${colorClass}`} /> 
                </div> 
            </div> 
            {subtext && <p className={`text-[10px] mt-1 font-medium opacity-80 z-10 ${colorClass}`}>{subtext}</p>} 
            
            {/* Efeito visual de fundo sutil */}
            <div className={`absolute -bottom-4 -right-4 w-16 h-16 rounded-full opacity-5 blur-xl ${colorClass?.replace('text-', 'bg-')}`}></div>
        </div> 
    ); 
};

// --- MODAL DE CONFIGURAÇÕES (SECURE - V6.4 - STRICT MODE) ---
const SettingsModal = ({ isOpen, onClose, authStatus, authFetch, currentUserUsername }) => { 
    const [formData, setFormData] = useState({ 
        telegram_chat_id: '', 
        real_key: '', 
        real_secret: '',
        new_password: '',
        confirm_new_password: '', // Novo campo de confirmação
        current_password: '' 
    }); 
    
    // Estados visuais e de segurança
    const [deleteMode, setDeleteMode] = useState(false);
    const [deletePhrase, setDeletePhrase] = useState("");
    const [deletePassword, setDeletePassword] = useState("");
    
    // Travas de segurança da exclusão
    const [isDeleteUnlocked, setIsDeleteUnlocked] = useState(false);
    const [showDeleteWarning, setShowDeleteWarning] = useState(false);

    // Validador de Força de Senha
    const [passStrength, setPassStrength] = useState({ 
        length: false, hasUpper: false, hasLower: false, hasNumber: false, hasSpecial: false 
    });

    useEffect(() => {
        const p = formData.new_password;
        setPassStrength({
            length: p.length >= 8,
            hasUpper: /[A-Z]/.test(p),
            hasLower: /[a-z]/.test(p),
            hasNumber: /[0-9]/.test(p),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(p)
        });
    }, [formData.new_password]);

    const isPasswordStrong = Object.values(passStrength).every(Boolean);

    useEffect(() => { 
        if (isOpen) { 
            authFetch('http://127.0.0.1:5000/market').then(res => res.json()).then(data => {
                setFormData(prev => ({ 
                    ...prev, 
                    telegram_chat_id: authStatus.has_telegram ? ' (Oculto) ' : '', 
                })); 
            });
            // Resetar estados ao abrir
            setDeleteMode(false);
            setIsDeleteUnlocked(false);
            setShowDeleteWarning(false);
            setDeletePhrase("");
            setDeletePassword("");
        } 
    }, [isOpen]); 

    if (!isOpen) return null; 

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value }); 

    const handleSave = async () => { 
        // 1. Validações de Senha Nova (se houver tentativa de troca)
        if (formData.new_password) {
            if (!isPasswordStrong) { toast.error("A nova senha não é forte o suficiente."); return; }
            if (formData.new_password !== formData.confirm_new_password) { toast.error("A confirmação da senha não confere."); return; }
        }

        if(!formData.current_password) { toast.error("Digite sua senha atual para salvar."); return; } 
        
        const payload = { ...formData };
        if (payload.telegram_chat_id === ' (Oculto) ') delete payload.telegram_chat_id;
        delete payload.confirm_new_password; // Não envia a confirmação pro back
        
        toast.promise( 
            authFetch('http://127.0.0.1:5000/profile/update', { 
                method: 'POST', 
                body: JSON.stringify(payload) 
            }).then(async (res) => { 
                const data = await res.json(); 
                if (!data.success) throw new Error(data.message); 
                
                if(data.new_token) {
                    localStorage.setItem('sniper_token', data.new_token);
                    window.location.reload(); 
                }
                setTimeout(onClose, 1000); 
                return "Perfil Atualizado!"; 
            }), 
            { loading: 'Salvando...', success: (msg) => msg, error: (err) => `Erro: ${err.toString().replace("Error:", "")}` } 
        ); 
    }; 
    
    const handleUnlockAttempt = (e) => {
        if (e.target.checked) {
            setShowDeleteWarning(true); // Abre o modal de aviso
        } else {
            setIsDeleteUnlocked(false); // Bloqueia novamente se desmarcar
        }
    };

    const confirmUnlock = () => {
        setIsDeleteUnlocked(true);
        setShowDeleteWarning(false);
    };

    const handleDeleteAccount = async () => {
        const expected = `EXCLUIRSNIPER${currentUserUsername || "USER"}`; 
        
        // Validação Estrita: Se o usuário digitou minúsculo, vai falhar aqui ou no back
        if (deletePhrase !== expected) { toast.error(`Frase incorreta. Respeite as letras MAIÚSCULAS.`); return; }
        if (!deletePassword) { toast.error("Senha necessária."); return; }

        toast.promise(
             authFetch('http://127.0.0.1:5000/profile/delete', {
                 method: 'POST',
                 body: JSON.stringify({ password: deletePassword, confirm_phrase: deletePhrase })
             }).then(async res => {
                 const d = await res.json();
                 if(!d.success) throw new Error(d.message);
                 localStorage.clear();
                 window.location.reload();
                 return "Conta Excluída.";
             }),
             { loading: 'EXCLUINDO...', success: 'Adeus.', error: (e) => `Erro: ${e}` }
        );
    }
    
    return ( 
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4"> 
            
            {/* --- SUB-MODAL DE ALERTA (WARNING) --- */}
            {showDeleteWarning && (
                <div className="absolute inset-0 z-[110] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-rose-500 w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="p-4 bg-rose-500/20 rounded-full animate-pulse">
                                <AlertTriangle className="w-12 h-12 text-rose-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Ponto de Não Retorno</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Você está prestes a desbloquear a exclusão da sua conta. 
                                <br/><br/>
                                <strong>Isso apagará seu saldo, histórico de operações e licença de uso permanentemente.</strong> 
                                <br/>Não há como desfazer esta ação.
                            </p>
                            <div className="flex gap-3 w-full mt-4">
                                <button onClick={() => setShowDeleteWarning(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors">CANCELAR</button>
                                <button onClick={confirmUnlock} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-colors shadow-lg shadow-rose-900/20">ESTOU CIENTE</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl shadow-2xl rounded-2xl flex overflow-hidden max-h-[90vh] relative">
                
                {/* SIDEBAR */}
                <div className="w-1/4 bg-slate-950 border-r border-slate-800 p-6 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><User className="w-5 h-5 text-emerald-500" /> Perfil</h2>
                        <nav className="space-y-2">
                            <button onClick={() => setDeleteMode(false)} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all ${!deleteMode ? 'bg-slate-800 text-emerald-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>
                                DADOS & SENHA
                            </button>
                            <button onClick={() => setDeleteMode(true)} className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all ${deleteMode ? 'bg-rose-900/20 text-rose-500 border border-rose-500/30' : 'text-slate-500 hover:text-rose-400'}`}>
                                ZONA DE PERIGO
                            </button>
                        </nav>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white text-xs flex items-center gap-2 px-2"><ChevronLeft className="w-3 h-3"/> Voltar</button>
                </div>

                {/* CONTEÚDO */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-slate-900">
                    {!deleteMode ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            
                            {/* BLOCO 1: SEGURANÇA DA CONTA (SENHA) */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2"><Lock className="w-4 h-4 text-blue-500"/> Alterar Senha de Acesso</h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Nova Senha</label>
                                        <input type="password" name="new_password" value={formData.new_password} onChange={handleChange} placeholder="Mínimo 8 caracteres..." className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-white focus:border-blue-500 outline-none"/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Repetir Nova Senha</label>
                                        <input type="password" name="confirm_new_password" value={formData.confirm_new_password} onChange={handleChange} placeholder="Confirme a senha..." className={`w-full bg-slate-950 border rounded p-2.5 text-xs text-white outline-none ${formData.confirm_new_password && formData.new_password !== formData.confirm_new_password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-blue-500'}`}/>
                                    </div>
                                </div>

                                {/* Checklist Visual de Força da Senha */}
                                {formData.new_password && (
                                    <div className="bg-slate-950 p-3 rounded border border-slate-800 grid grid-cols-2 md:grid-cols-3 gap-2">
                                        <span className={`text-[10px] flex items-center gap-1 ${passStrength.length ? 'text-emerald-400' : 'text-slate-600'}`}>{passStrength.length ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} Mínimo 8 chars</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${passStrength.hasUpper ? 'text-emerald-400' : 'text-slate-600'}`}>{passStrength.hasUpper ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} Maiúscula</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${passStrength.hasLower ? 'text-emerald-400' : 'text-slate-600'}`}>{passStrength.hasLower ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} Minúscula</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${passStrength.hasNumber ? 'text-emerald-400' : 'text-slate-600'}`}>{passStrength.hasNumber ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} Número</span>
                                        <span className={`text-[10px] flex items-center gap-1 ${passStrength.hasSpecial ? 'text-emerald-400' : 'text-slate-600'}`}>{passStrength.hasSpecial ? <CheckCircle2 className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>} Símbolo (!@#$)</span>
                                    </div>
                                )}
                            </div>

                            {/* BLOCO 2: INTEGRAÇÕES */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2"><Radio className="w-4 h-4 text-emerald-500"/> Integrações</h3>
                                
                                <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase">
                                        <Send className="w-4 h-4" /> Configurar Telegram
                                    </div>
                                    <ol className="text-[11px] text-slate-300 space-y-2 list-decimal list-inside bg-slate-950/50 p-3 rounded border border-slate-800">
                                        <li>Clique no botão abaixo <strong>"Abrir Bot"</strong>.</li>
                                        <li>No Telegram, clique em <strong>COMEÇAR</strong> (/start).</li>
                                        <li>Copie o ID numérico recebido e cole abaixo.</li>
                                    </ol>
                                    <div className="flex gap-3">
                                        <a href="https://t.me/SniperShotAlertBot?start=v6_client_setup" target="_blank" rel="noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2 transition-colors"><Send className="w-3 h-3" /> 1. ABRIR BOT</a>
                                        <div className="flex-[2]"><input type="text" name="telegram_chat_id" value={formData.telegram_chat_id} onChange={handleChange} placeholder="2. Cole o Chat ID aqui..." className="w-full h-full bg-slate-950 border border-slate-700 rounded px-3 text-xs text-white font-mono focus:border-blue-500 outline-none"/></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Binance API Key</label>
                                        <input type="password" name="real_key" value={formData.real_key} onChange={handleChange} placeholder="Atualizar API Key..." className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-white focus:border-emerald-500 outline-none"/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Binance Secret Key</label>
                                        <input type="password" name="real_secret" value={formData.real_secret} onChange={handleChange} placeholder="Atualizar Secret..." className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-white focus:border-emerald-500 outline-none"/>
                                    </div>
                                </div>
                            </div>

                            {/* RODAPÉ DE CONFIRMAÇÃO */}
                            <div className="bg-slate-950/50 p-4 rounded-xl border border-blue-500/20 mt-6">
                                <div className="flex items-end gap-4">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-blue-400 font-bold uppercase mb-1 block flex items-center gap-1"><Key className="w-3 h-3"/> Senha Atual (Obrigatória para Salvar)</label>
                                        <input type="password" name="current_password" value={formData.current_password} onChange={handleChange} placeholder="Confirme sua senha atual..." className="w-full bg-slate-900 border border-blue-500/30 rounded p-3 text-sm text-white focus:border-blue-500 outline-none shadow-inner"/>
                                    </div>
                                    <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2">
                                        <Save className="w-4 h-4" /> SALVAR
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ZONA DE PERIGO (DELETE) */
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-xl flex items-start gap-4">
                                <AlertTriangle className="w-10 h-10 text-rose-500 shrink-0" />
                                <div>
                                    <h3 className="text-lg font-bold text-rose-500 mb-1">Exclusão Definitiva</h3>
                                    <p className="text-xs text-rose-200/80 leading-relaxed">
                                        Para sua segurança, esta área é bloqueada. Marque a caixa abaixo para liberar os campos de exclusão.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isDeleteUnlocked ? 'bg-rose-500 border-rose-500' : 'bg-slate-950 border-slate-600 group-hover:border-rose-400'}`}>
                                        {isDeleteUnlocked && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={isDeleteUnlocked} onChange={handleUnlockAttempt} className="hidden" />
                                    <span className={`text-xs font-bold ${isDeleteUnlocked ? 'text-rose-400' : 'text-slate-400 group-hover:text-slate-300'}`}>Desbloquear campos de exclusão</span>
                                </label>
                            </div>

                            {/* CAMPOS (SÓ APARECEM SE DESBLOQUEADO) */}
                            <div className={`space-y-4 transition-all duration-300 ${isDeleteUnlocked ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">1. Digite sua Senha</label>
                                    <input type="password" value={deletePassword} disabled={!isDeleteUnlocked} onChange={(e) => setDeletePassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-sm text-white focus:border-rose-500 outline-none"/>
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">
                                        2. Digite MANUALMENTE a frase abaixo (Maiúsculas Importam):
                                    </label>
                                    
                                    <div className="bg-slate-950 border border-rose-900/40 rounded p-4 mb-2 text-center select-none">
                                        <code className="text-rose-500 font-mono font-bold text-lg tracking-wider">
                                            EXCLUIRSNIPER{currentUserUsername || "USER"}
                                        </code>
                                    </div>

                                    {/* SEM MÁSCARA UPPERCASE. O USUÁRIO DEVE DIGITAR MAIÚSCULO SOZINHO. */}
                                    <input 
                                        type="text" 
                                        value={deletePhrase} 
                                        disabled={!isDeleteUnlocked}
                                        onChange={(e) => setDeletePhrase(e.target.value)} 
                                        placeholder="Digite a frase EXATAMENTE igual..." 
                                        className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-sm text-rose-500 font-bold focus:border-rose-500 outline-none placeholder:text-rose-900/50" 
                                        onPaste={(e) => {
                                            e.preventDefault();
                                            toast.error("Digitação manual obrigatória.");
                                        }}
                                    />
                                </div>

                                <button 
                                    onClick={handleDeleteAccount}
                                    disabled={!isDeleteUnlocked || !deletePassword || !deletePhrase}
                                    className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2 mt-4"
                                >
                                    <Trash2 className="w-5 h-5" /> CONFIRMAR EXCLUSÃO PERMANENTE
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div> 
        </div> 
    ); 
};

// --- MAIN APP (SECURE WRAPPER) ---
export default function App() {
  // 1. Inicialização segura do Token (evita strings "null" ou "undefined")
  const [token, setToken] = useState(() => {
    const t = localStorage.getItem('sniper_token');
    return (t && t !== "null" && t !== "undefined") ? t : null;
  });
  
  // 2. Função de Logout Centralizada
  const handleLogout = () => { 
      
      localStorage.removeItem('sniper_token'); 
      localStorage.removeItem('sniper_last_market_data'); 
      setToken(null); 
      toast.error("Sessão expirada. Faça login novamente.");
  };

  // 3. Wrapper seguro para Fetch (Intercepta 401 e 422)
  const authFetch = async (url, options = {}) => {
      if (!token) {
          handleLogout();
          throw new Error("Sem token");
      }

      const headers = { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`, // Garante o formato Bearer
          ...options.headers 
      };

      try {
          const res = await fetch(url, { ...options, headers });
          
          // O PULO DO GATO: Se der 401 (Não autorizado) ou 422 (Token podre), desloga!
          if (res.status === 401 || res.status === 422) {
              handleLogout();
              throw new Error("Sessão inválida");
          }
          return res;
      } catch (err) {
          // Se for erro de rede, não desloga, só avisa
          if (err.message !== "Sessão inválida") {
            // console.error("Erro de rede:", err); 
          }
          throw err;
      }
  };

  if (!token) {
      return ( <> <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff' } }} /> <Auth onLoginSuccess={(t) => setToken(t)} /> </> );
  }

  return <Dashboard authFetch={authFetch} onLogout={handleLogout} />;
}


// --- COMPONENTE: SNIPER LAB MODAL (BACKTEST PREMIUM - V6.7 ASYNC) ---
const BacktestModal = ({ isOpen, onClose, authFetch }) => {
    const [config, setConfig] = useState({ 
        symbol: 'BTC/USDT', mode: 'single', timeframe: '5m', period_days: 7, 
        balance: 1000, risk: 10, ignore_trend: false 
    });
    
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    
    // Estados do Polling
    const [progress, setProgress] = useState(0);
    const [loadingText, setLoadingText] = useState("PRONTO");

    const PERIOD_OPTIONS = [
        { label: "1 Semana (Teste Rápido)", value: 7 },
        { label: "1 Mês (Curto Prazo)", value: 30 },
        { label: "3 Meses (Trimestre)", value: 90 },
        { label: "6 Meses (Semestre)", value: 180 },
        { label: "1 Ano (Hold Longo - Lento)", value: 365 },
    ];

    if (!isOpen) return null;

    const runBacktest = async () => {
        setLoading(true);
        setResults(null);
        setProgress(0);
        setLoadingText("SOLICITANDO SERVIDOR...");

        try {
            // 1. INICIA O JOB
            const payload = { ...config, days: config.period_days };
            const startRes = await authFetch('http://127.0.0.1:5000/backtest/run', {
                method: 'POST', body: JSON.stringify(payload)
            });
            const startData = await startRes.json();

            if (!startData.success || !startData.job_id) {
                throw new Error("Falha ao iniciar Job.");
            }

            const jobId = startData.job_id;

            // 2. POLLING LOOP (Pergunta a cada 1s)
            const intervalId = setInterval(async () => {
                try {
                    const statusRes = await authFetch(`http://127.0.0.1:5000/backtest/status/${jobId}`);
                    const statusData = await statusRes.json();

                    if (statusData.error) {
                        clearInterval(intervalId);
                        toast.error(`Erro no Backtest: ${statusData.error}`);
                        setLoading(false);
                        return;
                    }

                    // Atualiza Visual
                    setProgress(statusData.progress);
                    setLoadingText(statusData.message || "PROCESSANDO...");

                    // Verifica se acabou
                    if (statusData.progress >= 100 && statusData.result) {
                        clearInterval(intervalId);
                        setResults(statusData.result); // Carrega o resultado final
                        toast.success("Backtest Concluído!");
                        setLoading(false);
                    }
                } catch (pollErr) {
                    // Se falhar o poll, não para tudo, tenta de novo
                    console.error("Poll error", pollErr);
                }
            }, 1000); // 1 segundo de intervalo

        } catch (e) { 
            toast.error("Erro de conexão."); 
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-500/20 rounded-lg"><FlaskConical className="w-6 h-6 text-purple-400" /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Sniper Lab <span className="text-xs bg-purple-500 text-white px-1.5 py-0.5 rounded ml-2">V6.7</span></h2>
                            <p className="text-[10px] text-slate-400">Simulação de Juros Compostos & Longo Prazo</p>
                        </div>
                    </div>
                    <button onClick={onClose} disabled={loading} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors disabled:opacity-30"><X className="w-5 h-5"/></button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* SIDEBAR CONFIGURAÇÃO */}
                    <div className="w-1/4 bg-slate-950 border-r border-slate-800 p-5 flex flex-col gap-5 overflow-y-auto">
                        {/* [CONTEÚDO DA SIDEBAR MANTIDO IDÊNTICO AO ANTERIOR - SEM MUDANÇAS AQUI] */}
                        {/* ... Copie os inputs do código anterior ou mantenha o que você já tem ... */}
                        
                        {/* SELETOR DE MODO */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Modo de Operação</label>
                            <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
                                <button onClick={()=>setConfig({...config, mode: 'single'})} disabled={loading} className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${config.mode === 'single' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>ATIVO ÚNICO</button>
                                <button onClick={()=>setConfig({...config, mode: 'portfolio'})} disabled={loading} className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${config.mode === 'portfolio' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}>PORTFOLIO</button>
                            </div>
                        </div>

                        {/* ATIVO */}
                        {config.mode === 'single' ? (
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Ativo Alvo</label>
                                <select value={config.symbol} disabled={loading} onChange={e=>setConfig({...config, symbol: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white mt-1 outline-none focus:border-purple-500 disabled:opacity-50">
                                    {AVAILABLE_PAIRS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded text-center"><p className="text-[10px] text-emerald-400 font-bold mb-1">SCANNER MULTI-ATIVO</p><p className="text-[9px] text-slate-400 leading-relaxed">Simulação em 25 ativos.</p></div>
                        )}

                        {/* PERÍODO */}
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Período de Análise</label>
                            <select value={config.period_days} disabled={loading} onChange={e=>setConfig({...config, period_days: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white mt-1 outline-none focus:border-purple-500 disabled:opacity-50">
                                {PERIOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>

                        {/* INPUTS DE VALOR */}
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Risco %</label><input type="number" disabled={loading} value={config.risk} onChange={e=>setConfig({...config, risk: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white mt-1 outline-none focus:border-purple-500 disabled:opacity-50"/></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Banca Inicial</label><input type="number" disabled={loading} value={config.balance} onChange={e=>setConfig({...config, balance: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white mt-1 outline-none focus:border-purple-500 disabled:opacity-50"/></div>
                        </div>

                        <button onClick={runBacktest} disabled={loading} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all mt-auto">
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4 fill-current"/>}
                            {loading ? "PROCESSANDO..." : "RODAR SIMULAÇÃO"}
                        </button>
                    </div>

                    {/* ÁREA DE RESULTADOS OU LOADING */}
                    <div className="flex-1 p-6 bg-slate-900 overflow-y-auto custom-scrollbar relative">
                        
                        {/* --- TELA DE LOADING REAL COM DADOS DO BACKEND --- */}
                        {loading && (
                            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-10 animate-in fade-in duration-300">
                                <div className="w-full max-w-md space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-bold text-purple-400 font-mono animate-pulse">{loadingText.toUpperCase()}</span>
                                        <span className="text-2xl font-black text-white">{progress}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                                        <div 
                                            className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-purple-400 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(168,85,247,0.6)]"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1s_infinite]"></div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 text-center mt-2">
                                        Isso pode demorar alguns minutos dependendo do período.<br/>
                                        Não feche a janela.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!results ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                                <FlaskConical className="w-16 h-16 mb-4"/>
                                <p className="text-sm font-bold">Defina o período (até 1 Ano) e execute.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    
    {/* 1. CABEÇALHO DE RESULTADOS (ROI e Datas) */}
    <div className="bg-slate-950 rounded-xl border border-slate-800 p-5 flex flex-col md:flex-row justify-between items-center gap-6 shadow-lg relative overflow-hidden">
        {/* Efeitos de Fundo */}
        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
        <div className="absolute right-0 top-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl"></div>

        {/* Datas */}
        <div className="flex flex-col gap-1 w-full md:w-auto">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <History className="w-3 h-3 text-purple-400" /> Período Analisado ({results.stats.duration})
            </div>
            <div className="flex items-center gap-3 text-sm font-mono text-slate-200">
                <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">{results.stats.start_date}</span>
                <span className="text-slate-600">➜</span>
                <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800">{results.stats.end_date}</span>
            </div>
        </div>

        {/* Comparativo de Saldo */}
        <div className="flex items-center gap-6 w-full md:w-auto bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
            <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Saldo Inicial</p>
                <p className="text-sm font-mono text-slate-300 font-bold">{formatMoney(results.stats.initial_balance)}</p>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div>
                <p className="text-[9px] text-slate-500 uppercase font-bold mb-0.5">Saldo Final</p>
                <p className={`text-xl font-mono font-bold ${results.stats.profit_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatMoney(results.stats.final_balance)}
                </p>
            </div>
        </div>

        {/* ROI Total */}
        <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Crescimento Total</p>
            <div className={`text-2xl font-black tracking-tight flex items-center justify-end gap-2 ${results.stats.roi_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {results.stats.roi_pct >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {results.stats.roi_pct > 0 ? '+' : ''}{results.stats.roi_pct.toFixed(2)}%
            </div>
        </div>
    </div>

    {/* 2. GRID DE CARDS (Lucro, WinRate, Trades, Drawdown) */}
    <div className="grid grid-cols-4 gap-4">
        {/* Card Lucro */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><DollarSign className="w-8 h-8 text-white"/></div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Lucro Líquido</p>
            <h3 className={`text-xl font-bold ${results.stats.profit_total >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(results.stats.profit_total)}
            </h3>
            <p className={`text-[10px] ${results.stats.profit_total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{results.stats.roi_pct.toFixed(2)}% ROI</p>
        </div>

        {/* Card Win Rate */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-bold">Win Rate</p>
            <h3 className="text-xl font-bold text-blue-400">{results.stats.win_rate.toFixed(1)}%</h3>
            <p className="text-[10px] text-slate-500">{results.stats.wins} Wins / {results.stats.losses} Losses</p>
        </div>

        {/* Card Total Trades */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-bold">Total Trades</p>
            <h3 className="text-xl font-bold text-slate-200">{results.stats.total_trades}</h3>
            <p className="text-[10px] text-slate-500">Execuções</p>
        </div>

        {/* Card Max Drawdown */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert className="w-8 h-8 text-rose-500"/></div>
            <p className="text-[10px] text-slate-500 uppercase font-bold">Risco Máximo (MDD)</p>
            <h3 className="text-xl font-bold text-rose-500">
                {results.stats.max_drawdown.toFixed(2)}%
            </h3>
            <p className="text-[10px] text-slate-500">Pior queda do topo</p>
        </div>
    </div>

    {/* 3. GRÁFICO DE CURVA DE PATRIMÔNIO (Equity Curve) */}
    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 h-[300px]">
        <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Curva de Crescimento da Banca</h3>
        
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={results.equity_curve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                    dataKey="time" 
                    hide={false} 
                    tick={{fontSize: 10, fill: '#64748b'}} 
                    tickFormatter={(time) => new Date(time).toLocaleDateString()}
                    minTickGap={50}
                />
                <YAxis 
                    domain={['auto', 'auto']} 
                    stroke="#475569" 
                    fontSize={10} 
                    tickFormatter={(v)=>`$${v}`} 
                    width={40}
                />
                <Tooltip 
                    contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155'}} 
                    itemStyle={{color: '#fff'}} 
                    formatter={(v) => [`$${v.toFixed(2)}`, 'Saldo']}
                    labelFormatter={(time) => new Date(time).toLocaleString()} 
                />
                <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#a855f7" 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{r: 4, fill: '#a855f7'}}
                />
            </LineChart>
        </ResponsiveContainer>
    </div>

    {/* 4. LISTA DE TRADES (Tabela Detalhada) */}
    <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-3 border-b border-slate-800"><h4 className="text-xs font-bold text-slate-400">Histórico de Operações (Últimas 50)</h4></div>
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-[10px] text-slate-500 uppercase font-bold">
                <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Resultado</th>
                    <th className="p-3 text-right">PnL</th>
                </tr>
            </thead>
            <tbody className="text-xs text-slate-300">
                {[...results.trades].reverse().slice(0, 50).map((t, i) => (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-mono text-[10px] opacity-70 whitespace-nowrap">
                            {t.time}
                        </td>
                        <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${t.side === 'BUY' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : t.side === 'PARTIAL' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                {t.side}
                            </span>
                            {config.mode === 'portfolio' && t.symbol && (
                                <span className="ml-2 text-[9px] text-slate-500 border border-slate-800 px-1 rounded">{t.symbol}</span>
                            )}
                        </td>
                        <td className="p-3 font-bold">{t.res === 'WIN' ? <span className="text-emerald-400">WIN</span> : t.res === 'LOSS' ? <span className="text-rose-400">LOSS</span> : t.res === 'ENTRY' ? 'ENTRADA' : 'PARCIAL'}</td>
                        <td className={`p-3 text-right font-mono font-bold ${t.pnl > 0 ? 'text-emerald-400' : t.pnl < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                            {t.pnl !== 0 ? formatMoney(t.pnl) : '-'}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


function Dashboard({ authFetch, onLogout }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isTestnet, setIsTestnet] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [riskPct, setRiskPct] = useState(10); 
  const [traderName, setTraderName] = useState("Trader");
  const [currentSymbol, setCurrentSymbol] = useState("BTC/USDT"); 
  const [showSettings, setShowSettings] = useState(false);
  // --- NOVO ESTADO PARA O BACKTEST ---
  const [showBacktest, setShowBacktest] = useState(false); 
  const [authStatus, setAuthStatus] = useState({ has_name: false, has_real: false, has_telegram: false });
  const isFirstLoad = useRef(true);

  const [marketData, setMarketData] = useState(() => {
    const saved = localStorage.getItem('sniper_last_market_data');
    if (saved) { 
        try { 
            const parsed = JSON.parse(saved);
            return { ...parsed, connectionStatus: 'connecting' };
        } catch (e) { console.error("Erro cache", e); } 
    }
    return {
      balance: 0.00, paperBalance: 100.00, accumulatedPnl: 0.00, activeTrade: null, tradeHistory: [],
      status_display: 'Aguardando Conexão...', connectionStatus: 'connecting',
      is_scanning: false,
      m1: { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 }, 
      m5: { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 },
      h1: { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 },
      wins: 0, losses: 0, win_rate: 0, total_trades: 0, scanning_look: '...'
    };
  });

  useEffect(() => { localStorage.setItem('sniper_last_market_data', JSON.stringify(marketData)); }, [marketData]);

  useEffect(() => {
      authFetch('http://127.0.0.1:5000/config', { 
          method: 'POST', body: JSON.stringify({ risk_percentage: 10 }) 
      }).catch(e => console.log("Boot config sync failed", e));
  }, []);

  const prevActiveTrade = useRef(null);
  const prevHistoryLength = useRef(0);
  const isCommandPending = useRef(false);
  const lastToggleTime = useRef(0);

  useEffect(() => {
    if (marketData.connectionStatus === 'connected' && !authStatus.has_telegram) {
        toast((t) => (
          <div className="flex items-center gap-3">
              <Send className="w-8 h-8 text-blue-500" />
              <div>
                  <p className="font-bold text-slate-200 text-xs">Telegram Não Configurado</p>
                  <p className="text-[10px] text-slate-400">Alertas de operações desativados.</p>
              </div>
              <button onClick={() => { toast.dismiss(t.id); setShowSettings(true); }} className="bg-blue-500/20 text-blue-500 px-2 py-1 rounded text-xs font-bold border border-blue-500/50">Configurar</button>
          </div>
        ), { id: 'telegram-missing-alert', duration: 6000, position: 'bottom-right', style: { border: '1px solid #3b82f6', background: '#0f172a' } });
    }
  }, [marketData.connectionStatus, authStatus.has_telegram]);

  const handleManualTrade = async (side) => { playAudio(side === 'BUY' ? 'ENTRY' : 'PROFIT'); isCommandPending.current = true; toast.promise( authFetch('http://127.0.0.1:5000/manual_trade', { method: 'POST', body: JSON.stringify({ side }) }).then(async res => { const data = await res.json(); if(!data.success) throw new Error(data.message); await fetchMarketData(true); return `Ordem ${side} executada!`; }), { loading: 'Enviando ordem...', success: (msg) => msg, error: (e) => `Erro: ${e}` } ).finally(() => setTimeout(() => { isCommandPending.current = false; }, 1500)); };
  
  const toggleBot = async () => { 
      if (!authStatus.has_telegram) { toast.error("Configure o Telegram antes de iniciar!"); setShowSettings(true); return; }
      const newState = !isRunning; setIsRunning(newState); isCommandPending.current = true; lastToggleTime.current = Date.now(); toast.promise( authFetch(`http://127.0.0.1:5000/${isRunning ? 'stop' : 'start'}`, { method: 'POST' }).then(r=>r.json()), { loading: isRunning ? 'Parando...' : 'Iniciando...', success: isRunning ? 'Bot Pausado' : 'Bot Iniciado!', error: 'Erro ao alterar estado' } ).finally(() => setTimeout(() => { isCommandPending.current = false; }, 2000)); 
  };

  const changeSymbol = async (newSymbol) => { if (newSymbol === currentSymbol) return; if (marketData.activeTrade) { toast.error("Ativo bloqueado durante operação!"); return; } setCurrentSymbol(newSymbol); isCommandPending.current = true; toast.loading(`Trocando para ${newSymbol}...`, { duration: 1500 }); try { const res = await authFetch('http://127.0.0.1:5000/set_symbol', { method: 'POST', body: JSON.stringify({ symbol: newSymbol }) }); if(!res.ok) throw new Error("Erro troca"); setMarketData(prev => ({...prev, m5: { price: 0, rsi: 50, candles: [] }, h1: { price: 0, rsi: 50, candles: [] }})); await fetchMarketData(true); } catch (err) { toast.error("Falha na troca de moeda"); } finally { setTimeout(() => { isCommandPending.current = false; }, 2000); } };
  const resetAccount = async () => { toast((t) => ( <div className="flex flex-col gap-3"> <span className="text-slate-200 font-bold">Resetar Banca para $100?</span> <div className="flex gap-2"> <button onClick={async () => { toast.dismiss(t.id); const loadingId = toast.loading("Resetando..."); try { const res = await authFetch('http://127.0.0.1:5000/reset', { method: 'POST' }); const data = await res.json(); if (data.success) { setMarketData(prev => ({ ...prev, balance: data.new_balance, paperBalance: data.new_balance })); toast.success(data.message || `Saldo: ${formatMoney(data.new_balance)}`, { id: loadingId }); await fetchMarketData(true); } else { toast.error(data.message || "Erro ao resetar", { id: loadingId }); } } catch (e) { toast.error("Erro de conexão", { id: loadingId }); } }} className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Confirmar Reset</button> <button onClick={() => toast.dismiss(t.id)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors">Cancelar</button> </div> </div> ), { style: { background: '#0f172a', border: '1px solid #1e293b' }, duration: 5000 }); };
  const handleLiquidation = async () => { toast((t) => ( <div className="flex flex-col gap-2"> <span className="text-slate-200 font-bold text-xs">Isso zerará a posição atual. Continuar?</span> <div className="flex gap-2"> <button onClick={() => { toast.dismiss(t.id); toast.promise(authFetch('http://127.0.0.1:5000/liquidate', { method: 'POST' }).then(r=>r.json()), { loading: 'Liquidando...', success: 'Posição zerada!', error: 'Erro ao liquidar' }); }} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">Sim</button> <button onClick={() => toast.dismiss(t.id)} className="bg-slate-700 text-white px-2 py-1 rounded text-xs">Não</button> </div> </div> ), { style: { background: '#0f172a', border: '1px solid #1e293b' } }); };
  const handlePanic = async () => { toast((t) => ( <div className="flex flex-col gap-2"> <span className="text-rose-500 font-bold">PÂNICO: Vender tudo agora?</span> <div className="flex gap-2"> <button onClick={() => { toast.dismiss(t.id); toast.promise( authFetch('http://127.0.0.1:5000/panic', { method: 'POST' }).then(r=>r.json()), { loading: 'Zerando posição...', success: 'Posição ZERADA!', error: 'Erro no pânico' }).then(() => { playAudio('LOSS'); setIsRunning(false); }); }} className="bg-rose-600 text-white px-2 py-1 rounded text-xs">VENDER AGORA</button> <button onClick={() => toast.dismiss(t.id)} className="bg-slate-700 text-white px-2 py-1 rounded text-xs">Cancelar</button> </div> </div> ), { style: { background: '#0f172a', border: '1px solid #e11d48' } }); };
  
 const toggleEnvironment = async () => { 
      toast((t) => ( 
      <div className="flex flex-col gap-2"> 
          <span className="text-slate-200 font-bold">Alternar Ambiente?</span> 
          <span className="text-[10px] text-slate-400">Mudança entre Simulador e Conta Real.</span> 
          <div className="flex gap-2"> 
            <button onClick={() => { 
                toast.dismiss(t.id); 
                let incomingBalance = 0;
                toast.promise( 
                    authFetch('http://127.0.0.1:5000/switch_mode', { 
                        method: 'POST', 
                        body: JSON.stringify({ testnet: !isTestnet }) 
                    }).then(async r => {
                        const d = await r.json();
                        if(!d.success) throw new Error(d.message);
                        if (d.new_balance !== undefined) incomingBalance = d.new_balance;
                        return d.message; 
                    }), 
                    { 
                        loading: 'Validando chaves...', 
                        success: (msg) => {
                            setIsTestnet(!isTestnet);
                            setMarketData(prev => ({ ...prev, balance: incomingBalance, real_balance: !isTestnet ? incomingBalance : 0, paperBalance: isTestnet ? incomingBalance : prev.paperBalance }));
                            if (!isTestnet) return "Modo Simulador Ativo"; 
                            return ( <div className="flex flex-col"> <span className="font-bold">Hora do Show! 🚀</span> <span className="text-xs">Conta Real Conectada.</span> </div> );
                        }, 
                        error: (err) => `Erro: ${err.toString()}` 
                    }
                ).then(() => { fetchMarketData(true); }); 
            }} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs">Confirmar</button> 
            <button onClick={() => toast.dismiss(t.id)} className="bg-slate-700 text-white px-2 py-1 rounded text-xs">Cancelar</button> 
          </div> 
      </div> ), { style: { background: '#0f172a', border: '1px solid #1e293b' } }); 
  };

  const handleRiskChange = (newVal) => { setRiskPct(newVal); authFetch('http://127.0.0.1:5000/config', { method: 'POST', body: JSON.stringify({ risk_percentage: newVal }) }).catch(console.error); };

  const fetchMarketData = async (forceUpdate = false) => {
    try {
      // AGORA USAMOS authFetch
      const response = await authFetch('http://127.0.0.1:5000/market');
      if (!response.ok) throw new Error('Falha');
      const data = await response.json();
      
      const isImmune = (Date.now() - lastToggleTime.current) < 5000; 
      if (!isImmune || forceUpdate) { if (data.is_running !== undefined) setIsRunning(data.is_running); }
      if (data.symbol && data.symbol !== "" && !isCommandPending.current) { setCurrentSymbol(data.symbol); }
      if (data.is_testnet !== undefined) setIsTestnet(data.is_testnet);
      if (data.trader_name) setTraderName(data.trader_name || "Trader");
      if (data.auth_status) setAuthStatus(data.auth_status);

      const displayedBalance = data.is_testnet ? data.paper_balance : (data.real_balance || 0.00);

      setMarketData({
        balance: displayedBalance,
        paperBalance: data.paper_balance || 100.00, accumulatedPnl: data.accumulated_pnl || 0.00, activeTrade: data.active_trade, tradeHistory: data.trade_history || [], 
        status_display: data.status_display || 'Aguardando...', connectionStatus: data.connectionStatus || 'connected', is_scanning: data.is_scanning || false,
        m1: data.data_5m || { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 }, m5: data.data_5m || { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 }, h1: data.data_1h || { price: 0, rsi: 50, candles: [], fibo_level: 0, ema200: 0 },
        wins: data.wins || 0, losses: data.losses || 0, win_rate: data.win_rate || 0, total_trades: data.total_trades || 0,
        scanning_look: data.scanning_look
      });
      if(isFirstLoad.current) {
          isFirstLoad.current = false;
      }
      setError(null);
    } catch (err) { if(!error) setError("Backend Offline"); setMarketData(prev => ({...prev, connectionStatus: 'offline'})); }
  };

  useEffect(() => {
      if (!prevActiveTrade.current && marketData.activeTrade) { playAudio('ENTRY'); toast.success(`Entrada: ${marketData.activeTrade.symbol}`, { style: { background: '#064e3b', color: '#fff' } }); }
      if (prevActiveTrade.current && !marketData.activeTrade && marketData.tradeHistory.length > prevHistoryLength.current) {
          const lastTrade = marketData.tradeHistory[marketData.tradeHistory.length - 1];
          if (lastTrade && lastTrade.profit_usd > 0) { playAudio('PROFIT'); toast.success(`Lucro: +${formatMoney(lastTrade.profit_usd)}`, { icon: '🤑', style: { background: '#064e3b', color: '#fff' } }); }
          else { playAudio('LOSS'); toast.error(`Stop Loss: -${formatMoney(Math.abs(lastTrade.profit_usd))}`, { style: { background: '#7f1d1d', color: '#fff' } }); }
      }
      prevActiveTrade.current = marketData.activeTrade;
      prevHistoryLength.current = marketData.tradeHistory.length;
  }, [marketData.activeTrade, marketData.tradeHistory]);
  
useEffect(() => {
    let isMounted = true; // Flag para saber se o componente ainda existe

    const loop = async () => {
        if (!isMounted) return; // Se desmontou (logout), para tudo
        
        await fetchMarketData();
        
        // Só agenda o próximo se ainda estiver montado e autenticado
        if (isMounted) {
            setTimeout(loop, 2000);
        }
    };

    loop();

    // Função de limpeza: roda quando o componente é destruído (ex: ao fazer logout)
    return () => { isMounted = false; };
}, []);
  const getStatusCardProps = () => {
    if (marketData.activeTrade) {
        const currentPrice = marketData.m5.price || marketData.activeTrade.entry_price;
        const entryPrice = marketData.activeTrade.entry_price;
        const pnlPct = ((currentPrice / entryPrice) - 1) * 100;
        const isProfit = pnlPct >= 0;
        return {
            title: `Operando ${marketData.activeTrade.symbol}`,
            value: (<div className="flex flex-col"><span className={`text-xl font-bold animate-pulse ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>{pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%</span><span className="text-[10px] text-slate-400 font-mono mt-1">PNL EM TEMPO REAL</span></div>),
            subtext: isProfit ? "Lucro em andamento..." : "Drawdown momentâneo...", icon: isProfit ? TrendingUp : TrendingDown, colorClass: isProfit ? "text-emerald-400" : "text-rose-400"
        };
    }
    if (marketData.is_scanning) {
        return {
            title: "Scanner de Oportunidades",
            value: (<div className="flex items-center gap-2"><span className="text-yellow-400 font-bold animate-pulse tracking-widest text-sm">RASTREANDO</span>{marketData.scanning_look && marketData.scanning_look !== "..." && (<img src={getCoinIcon(marketData.scanning_look)} className="w-6 h-6 rounded-full grayscale opacity-80" alt="scan" />)}</div>),
            subtext: `Analisando: ${marketData.scanning_look}`, icon: Radar, colorClass: "text-yellow-400"
        };
    }
    return {
        title: "Status do Sistema", value: marketData.status_display, subtext: isRunning ? "Aguardando Gatilho..." : "Sistema Pausado", icon: isRunning ? AlertTriangle : Power, colorClass: isRunning ? "text-blue-400" : "text-slate-500"
    };
  };

  const statusProps = getStatusCardProps();
  const estimatedInitialBalance = marketData.paperBalance - marketData.accumulatedPnl;
  const roiPercent = estimatedInitialBalance > 0 ? (marketData.accumulatedPnl / estimatedInitialBalance) * 100 : 0.0;
  const isProfit = marketData.accumulatedPnl >= 0;
  const isReadyToStart = authStatus.has_name && authStatus.has_telegram;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-hidden">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' } }} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} authStatus={authStatus} authFetch={authFetch} currentUserUsername={traderName}/>
      
      {/* --- MODAL DO SNIPER LAB (NOVO) --- */}
      <BacktestModal isOpen={showBacktest} onClose={() => setShowBacktest(false)} authFetch={authFetch} />

      <header className="w-full bg-slate-950/50 backdrop-blur-sm border-b border-slate-800 px-4 md:px-6 py-4 flex-none z-50 relative">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className={`p-2.5 rounded-xl transition-colors ${error ? 'bg-rose-500/10' : !isReadyToStart ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}><Crosshair className={`w-6 h-6 ${error ? 'text-rose-500' : !isReadyToStart ? 'text-amber-500' : 'text-emerald-500'}`} /></div>
              <div>
                <div className="flex items-center gap-3"><h1 className="text-2xl font-bold tracking-tight leading-none">SniperBot <span className="text-emerald-500">Pro</span></h1>
                    {(() => { let dotColor = 'bg-emerald-500'; let pingColor = 'bg-emerald-400'; 
                              if (error) { dotColor = 'bg-rose-600'; pingColor = 'bg-rose-500'; } 
                              else if (!isReadyToStart) { dotColor = 'bg-amber-500'; pingColor = 'bg-amber-400'; } 
                              return ( <div className="relative flex h-3 w-3 items-center justify-center"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pingColor}`}></span><span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span></div> ); })()}
                </div>
                <div className="flex items-center gap-3 mt-1">
                    <CurrencySelect currentSymbol={currentSymbol} onSymbolChange={changeSymbol} isLocked={!!marketData.activeTrade} />
                    <span className="text-slate-700 mx-2">|</span>
                    <button onClick={toggleEnvironment} className="flex items-center gap-1.5 group cursor-pointer hover:opacity-80 transition-opacity">
                        {isTestnet ? <Smartphone className="w-3 h-3 text-emerald-500" /> : <ShieldAlert className="w-3 h-3 text-rose-500" />}
                        {(() => { if (error) return <span className="text-[10px] font-bold text-rose-500 tracking-widest">OFFLINE</span>; if (!isReadyToStart) return <span className="text-[10px] font-bold text-amber-500 tracking-widest">PERFIL INCOMPLETO</span>; return <span className={`text-[10px] uppercase tracking-widest font-bold ${isTestnet ? 'text-emerald-500' : 'text-rose-500'}`}>{isTestnet ? 'SIMULADOR' : 'REAL'}</span>; })()}
                        {isTestnet ? <ToggleLeft className="w-4 h-4 text-slate-600 group-hover:text-slate-400" /> : <ToggleRight className="w-4 h-4 text-rose-500" />}
                    </button>
                    
                    {/* --- BOTÃO SNIPER LAB (NOVO) --- */}
                    <button onClick={() => setShowBacktest(true)} className="text-slate-500 hover:text-purple-400 transition-colors ml-2 relative" title="Sniper Lab (Backtest)">
                        <FlaskConical className="w-4 h-4" />
                    </button>

                    <button onClick={() => setShowSettings(true)} className="text-slate-500 hover:text-white transition-colors ml-2 relative" title="Configurações">
                        <Settings className="w-3 h-3" />
                        {!isReadyToStart && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
                    </button>
                    <button onClick={onLogout} className="text-slate-500 hover:text-rose-500 transition-colors ml-2" title="Logout Seguro">
                        <LogOut className="w-3 h-3" />
                    </button>
                </div>
              </div>
            </div>
            
            {/* BLOCO DA DIREITA: SALDO E CONTROLES */}
            <div className="flex items-center gap-4 bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto justify-between">
                
                {/* SALDO (Sem Nome, Sem Botão Zerar) */}
                <div className="flex items-center gap-3 px-4 border-r border-slate-700">
                    <div className="text-right">
                        {/* Agora mostramos apenas o ícone da carteira e o valor, sem o nome */}
                        <p className="text-sm font-mono text-slate-300 flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-emerald-500" />
                            {formatMoney(marketData.balance)}
                        </p>
                    </div>
                    
                    <div className="flex gap-1">
                        {/* Botão RESETAR BANCA (Mantido) */}
                        <button 
                            onClick={resetAccount} 
                            className="p-2 bg-slate-800 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-all border border-slate-700" 
                            title="Resetar Banca e Histórico"
                        >
                            <Sunrise className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* BOTÃO POWER (INICIAR/PARAR) - Mantido igual */}
                <button 
                    onClick={toggleBot} 
                    disabled={isLoading || error || !isReadyToStart} 
                    title={!isReadyToStart ? "Preencha Nome e Telegram para iniciar" : ""} 
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all ${!isReadyToStart ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-50' : isRunning ? 'bg-rose-500/10 text-rose-500 border border-rose-500/50 hover:bg-rose-500 hover:text-white' : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}
                > 
                    { !isReadyToStart ? <Lock className="w-4 h-4" /> : <Power className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> } 
                    { isLoading ? '...' : (isRunning ? 'PARAR' : 'INICIAR') } 
                </button>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 z-0 relative">
        <div className="max-w-[1600px] mx-auto space-y-4 flex flex-col pb-20"> 
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 flex-none">
                <StatCard title={`Preço Atual (${currentSymbol})`} value={marketData.m5.price} subtext="Binance Spot" icon={Activity} colorClass="text-blue-400" />
                <StatCard title="Lucro Acumulado" value={marketData.accumulatedPnl} subtext={`${isProfit ? '▲' : '▼'} ${formatNumber(roiPercent)}% ROI`} icon={DollarSign} colorClass={isProfit ? "text-emerald-400" : "text-rose-400"} />
                <StatCard title={statusProps.title} value={statusProps.value} subtext={statusProps.subtext} icon={statusProps.icon} colorClass={statusProps.colorClass} />
                <LogicTerminal data={marketData.m5} isRunning={isRunning} activeTrade={marketData.activeTrade} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">

                <div className="lg:col-span-2 flex flex-col gap-4 h-full min-h-[500px]">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col relative overflow-hidden group flex-1 min-h-0">
                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                        <div className="flex justify-between items-center mb-2 pl-4 shrink-0">
                            <h2 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                                <Crosshair className="w-4 h-4" /> {currentSymbol} - GATILHO (M5)
                            </h2>
                            <div className="flex gap-4 text-xs font-mono text-slate-400">
                                <span>RSI: {formatNumber(marketData.m5.rsi)}</span>
                            </div>
                        </div>
                        <div className="flex-1 w-full bg-slate-950/30 rounded border border-slate-800/50 relative min-h-0">
                            {currentSymbol && (
                                <TVChart 
                                    key={`m5-${currentSymbol}`} 
                                    data={marketData.m5.candles} 
                                    levels={marketData.m5} 
                                    trades={marketData.tradeHistory} 
                                    activeTrade={marketData.activeTrade} 
                                    symbol={currentSymbol} 
                                />
                            )}
                        </div>
                    </div>
                    
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col relative overflow-hidden flex-1 min-h-0">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50"></div>
                        <div className="flex justify-between items-center mb-2 pl-4 shrink-0">
                            <h2 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                                <TrendingUp className="w-4 h-4" /> H1 - TENDÊNCIA MACRO
                            </h2>
                            <div className="flex gap-4 text-xs font-mono text-slate-400">
                                <span>RSI: {formatNumber(marketData.h1.rsi)}</span>
                            </div>
                        </div>
                        <div className="flex-1 w-full bg-slate-950/30 rounded border border-slate-800/50 relative min-h-0">
                            {currentSymbol && (
                                <TVChart 
                                    key={`h1-${currentSymbol}`} 
                                    data={marketData.h1.candles} 
                                    levels={marketData.h1} 
                                    panorama={true} 
                                    symbol={currentSymbol}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
<div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shrink-0">
    <RiskControl value={riskPct} onChange={handleRiskChange} />
</div>
                    <ManualTrading isBotRunning={isRunning} onManualOrder={handleManualTrade} />
                    
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col min-h-0 flex-1 overflow-hidden">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 shrink-0"><History className="w-5 h-5 text-slate-400" /> Livro de Ofertas</h2>
                        
                        {marketData.activeTrade ? (
                        <div className="bg-slate-800/50 border border-emerald-500/30 p-4 rounded-lg mb-4 animate-pulse shrink-0 relative">
                            <button onClick={handlePanic} className="absolute top-3 right-3 bg-rose-600 hover:bg-rose-500 text-white p-1.5 rounded shadow-lg border border-rose-400 transition-all flex items-center gap-1 z-20" title="ZERAR TUDO AGORA"><Siren className="w-3.5 h-3.5 animate-bounce" /><span className="text-[10px] font-bold uppercase">ZERAR</span></button>
                            <div className="flex justify-between items-center mb-2"><span className="text-emerald-400 font-bold text-sm">● COMPRADO</span><span className="text-xs text-slate-400 mr-16">{formatTime(marketData.activeTrade.entry_time)}</span></div>
                            <div className="flex justify-between text-xs text-slate-400 mb-1"><span>Investido:</span><span className="text-white font-mono">{formatMoney(marketData.activeTrade.invested_value)}</span></div>
                            <div className="flex justify-between text-xs text-slate-400"><span>Alvo:</span><span className="text-emerald-400 font-mono">{formatMoney(marketData.activeTrade.entry_price * 1.015)}</span></div>
                        </div>
                        ) : ( <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-lg mb-4 text-center shrink-0"><span className="text-slate-500 text-xs">Aguardando oportunidade...</span></div> )}
                        
                        <div className="overflow-y-auto custom-scrollbar flex-1 max-h-[300px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-900 text-[10px] text-slate-500 border-b border-slate-800 uppercase tracking-wider z-10">
                                    <tr>
                                        <th className="pb-2 pl-2">Ativo</th>
                                        <th className="pb-2">Inv.</th>
                                        <th className="pb-2 text-right pr-2">PnL</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {marketData.tradeHistory.length === 0 ? ( <tr><td colSpan="3" className="text-center py-8 text-slate-600 italic">Sem histórico</td></tr> ) : (
                                        [...marketData.tradeHistory].reverse().map((trade) => {
                                            const assetIcon = getCoinIcon(trade.symbol);
                                            return (
                                            <tr key={trade.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                                                <td className="py-3 pl-2 flex items-center gap-2">
                                                    <img src={assetIcon} className="w-5 h-5 rounded-full" alt="coin" />
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-300">{trade.symbol?.split('/')[0]}</span>
                                                        <span className="text-[9px] font-mono text-slate-500">{formatTime(trade.entry_time)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-slate-300 font-mono">{formatMoney(trade.invested)}</td>
                                                <td className="py-3 text-right pr-2">
                                                    <div className={`font-bold ${trade.profit_usd > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.profit_usd > 0 ? '+' : ''}{formatMoney(Math.abs(trade.profit_usd))}</div>
                                                    <div className={`text-[10px] ${trade.profit_usd > 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>{trade.profit_usd > 0 ? '▲' : '▼'} {formatNumber(Math.abs(trade.profit_pct))}%</div>
                                                </td>
                                            </tr>
                                        )})
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>

      <TradeStats globalStats={{ win_rate: marketData.win_rate, total_trades: marketData.total_trades, wins: marketData.wins, losses: marketData.losses }} trades={marketData.tradeHistory} />

      <footer className="w-full border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-md flex-none z-50 relative shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
              <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6 order-2 md:order-1">
                  <div className="group flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/5 border border-rose-500/20 hover:bg-rose-500/10 hover:border-rose-500/30 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] transition-all duration-300 cursor-help" title="Licença de Uso Restrito">
                      <Lock className="w-3 h-3 text-rose-500/80 group-hover:text-rose-400" />
                      <span className="text-[9px] font-bold text-rose-500/80 group-hover:text-rose-400 uppercase tracking-widest">Software Proprietário</span>
                  </div>
                  <p className="text-slate-500 font-medium tracking-wide text-[10px] md:text-xs">
                      &copy; 2025 <span className="text-slate-300 font-bold">SniperBot Pro</span>. <span className="hidden sm:inline">Todos os direitos reservados.</span>
                  </p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 order-1 md:order-2 w-full md:w-auto border-b md:border-b-0 border-slate-800/50 pb-3 md:pb-0">
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest font-bold group">
                      <span>Engineered by</span>
                      <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-black text-xs tracking-wider group-hover:opacity-80 transition-opacity">
                          OTÁVIO HENRIQUE
                      </span>
                  </div>
                  <div className="flex items-center gap-5">
                      <a href="https://www.linkedin.com/in/otavio-henrique-filgueiras-dos-santos/" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-400 transition-all hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" title="LinkedIn"><Linkedin className="w-4 h-4" /></a>
                      <a href="https://github.com/ResoluteJax" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-white transition-all hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" title="GitHub"><Github className="w-4 h-4" /></a>
                      <a href="#" className="text-slate-500 hover:text-emerald-400 transition-all hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" title="Portfólio"><Globe className="w-4 h-4" /></a>
                  </div>
              </div>
          </div>
      </footer>
    </div>
  );
}