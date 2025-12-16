import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts';

export default function TVChart({ data, levels, trades = [], activeTrade = null, panorama = false, symbol }) {
    const chartContainerRef = useRef();
    const chartInstance = useRef(null);
    const seriesRef = useRef(null);
    const priceLinesRef = useRef([]); 
    const isFittedRef = useRef(false);

    // 1. Inicialização do Gráfico
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
             layout: { 
                 background: { type: ColorType.Solid, color: 'transparent' }, 
                 textColor: '#64748b', // Slate-500 (Mais suave que o branco)
                 fontFamily: 'Inter, system-ui, sans-serif', 
                 fontSize: 10 
             },
             grid: { 
                 vertLines: { color: '#1e293b', style: LineStyle.Dotted, visible: false }, // Grade vertical oculta para limpeza
                 horzLines: { color: '#1e293b', style: LineStyle.Dotted } 
             },
             crosshair: {
                 mode: CrosshairMode.Normal,
                 vertLine: { labelBackgroundColor: '#334155' },
                 horzLine: { labelBackgroundColor: '#334155' },
             },
             width: chartContainerRef.current.clientWidth,
             height: chartContainerRef.current.clientHeight,
             timeScale: { timeVisible: true, secondsVisible: false, rightOffset: 12, barSpacing: 6, borderColor: '#1e293b' },
             rightPriceScale: { borderColor: '#1e293b', autoScale: true, scaleMargins: { top: 0.1, bottom: 0.1 } },
        });
        
        // A. Candles Principais (Estilo Cyberpunk Clean)
        const candleSeries = chart.addCandlestickSeries({ 
            upColor: '#10b981', downColor: '#ef4444', 
            borderVisible: false, 
            wickUpColor: '#10b981', wickDownColor: '#ef4444' 
        });

        // B. EMA 200 (O "JUIZ" - Destaque Visual)
        const emaSeries = chart.addLineSeries({ 
            color: '#f59e0b', // Amber-500 (Laranja Neon)
            lineWidth: 3, 
            lineStyle: LineStyle.Solid, 
            crosshairMarkerVisible: false, 
            lastValueVisible: false, 
            priceLineVisible: false,
            title: 'EMA 200'
        });

        // C. Bollinger Bands (Sutis, para não poluir)
        const bbUpper = chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1, lineStyle: LineStyle.Solid, lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false });
        const bbLower = chart.addLineSeries({ color: 'rgba(56, 189, 248, 0.3)', lineWidth: 1, lineStyle: LineStyle.Solid, lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false });

        // D. ZONA FIBONACCI (GOLDEN ZONE 0.5 - 0.618)
        // Truque visual: Usamos Histogramas ou Linhas preenchidas se a biblioteca suportar, 
        // mas aqui vamos usar linhas tracejadas com cor de destaque para delimitar a "Zona de Tiro".
        const fibo50 = chart.addLineSeries({ color: 'rgba(16, 185, 129, 0.6)', lineWidth: 1, lineStyle: LineStyle.Dashed, lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false, title: 'FIB 50%' });
        const fibo618 = chart.addLineSeries({ color: 'rgba(16, 185, 129, 0.6)', lineWidth: 2, lineStyle: LineStyle.Dashed, lastValueVisible: false, crosshairMarkerVisible: false, priceLineVisible: false, title: 'FIB 61.8%' });

        seriesRef.current = { candle: candleSeries, ema: emaSeries, bbUpper, bbLower, fibo50, fibo618 };
        chartInstance.current = chart;

        const handleResize = () => { if (chartInstance.current && chartContainerRef.current) { chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight }); } };
        window.addEventListener('resize', handleResize);
        return () => { window.removeEventListener('resize', handleResize); if (chartInstance.current) { chartInstance.current.remove(); chartInstance.current = null; } };

    }, []); 

    // 2. Atualização de Dados
    useEffect(() => {
        if (!chartInstance.current || !seriesRef.current || !data) return;

        const candlesList = Array.isArray(data) ? data : data.candles;
        if (!candlesList || candlesList.length === 0) return;
        const formatTime = (tStr) => new Date(tStr).getTime() / 1000;
        
        const candlesData = []; const emaData = []; const bbU = []; const bbL = []; const fibo50Data = []; const fibo618Data = [];
        let fiboHigh = levels?.fibo_high ? parseFloat(levels.fibo_high) : 0;
        let fiboLow = levels?.fibo_low ? parseFloat(levels.fibo_low) : 0;
        const dataMap = new Map();

        candlesList.forEach(d => {
            if(!d.open) return;
            const time = formatTime(d.timestamp);
            if(dataMap.has(time)) return;
            dataMap.set(time, true);
            candlesData.push({ time, open: parseFloat(d.open), high: parseFloat(d.high), low: parseFloat(d.low), close: parseFloat(d.close) });
            if (d.bb_upper) bbU.push({ time, value: parseFloat(d.bb_upper) });
            if (d.bb_lower) bbL.push({ time, value: parseFloat(d.bb_lower) });
            if (d.ema200) emaData.push({ time, value: parseFloat(d.ema200) });
            
            // Lógica Fibbo: Só desenha se houver um topo/fundo válido detectado nos ultimos 50 candles
            if(fiboHigh > 0 && fiboLow > 0 && fiboHigh > fiboLow) {
                const range = fiboHigh - fiboLow;
                fibo50Data.push({ time, value: fiboHigh - (range * 0.5) });
                fibo618Data.push({ time, value: fiboHigh - (range * 0.618) });
            }
        });

        const sortByTime = (arr) => arr.sort((a, b) => a.time - b.time);
        sortByTime(candlesData); sortByTime(emaData); sortByTime(bbU); sortByTime(bbL);

        seriesRef.current.candle.setData(candlesData);
        seriesRef.current.ema.setData(emaData);
        seriesRef.current.bbUpper.setData(bbU);
        seriesRef.current.bbLower.setData(bbL);
        
        // Só atualiza Fibonacci se houver dados, senão limpa para não mostrar lixo
        if(fibo50Data.length > 0) {
            seriesRef.current.fibo50.setData(fibo50Data);
            seriesRef.current.fibo618.setData(fibo618Data);
        } else {
            seriesRef.current.fibo50.setData([]);
            seriesRef.current.fibo618.setData([]);
        }

        // --- GESTÃO DE MARKERS (ICONES NO GRÁFICO) ---
        const markers = [];
        
        // A. Histórico de Trades
        trades
            .filter(t => t.symbol === symbol) 
            .forEach(trade => {
                markers.push({
                    time: formatTime(trade.entry_time),
                    position: 'belowBar',
                    color: '#fbbf24',
                    shape: 'arrowUp',
                    text: 'CP', // Texto curto para não poluir
                    size: 1
                });

                if (trade.exit_time) {
                    const isWin = trade.profit_usd > 0;
                    markers.push({
                        time: formatTime(trade.exit_time),
                        position: 'aboveBar',
                        color: isWin ? '#10b981' : '#f43f5e',
                        shape: 'arrowDown',
                        text: isWin ? 'WIN' : 'LOSS',
                        size: 1
                    });
                }
            });

        // B. Trade Ativo (Linha de Preço Médio)
        priceLinesRef.current.forEach(line => seriesRef.current.candle.removePriceLine(line));
        priceLinesRef.current = [];

        if (activeTrade && activeTrade.symbol === symbol) { 
            const entryTime = formatTime(activeTrade.entry_time);
            
            // Marker de entrada atual
            markers.push({
                time: entryTime,
                position: 'belowBar',
                color: '#3b82f6',
                shape: 'arrowUp',
                text: 'OPEN',
                size: 2
            });

            // Linha Horizontal de Preço de Entrada
            const priceLine = seriesRef.current.candle.createPriceLine({
                price: parseFloat(activeTrade.entry_price),
                color: '#3b82f6',
                lineWidth: 1,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: true,
                title: 'ENTRADA',
            });
            priceLinesRef.current.push(priceLine);
            
            // (Opcional) Linha de Stop Loss Visual
            if(activeTrade.sl_price) {
                 const slLine = seriesRef.current.candle.createPriceLine({
                    price: parseFloat(activeTrade.sl_price),
                    color: '#f43f5e',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: true,
                    title: 'STOP',
                });
                priceLinesRef.current.push(slLine);
            }
            
            // (Opcional) Linha de Take Profit Visual
            if(activeTrade.tp_price) {
                 const tpLine = seriesRef.current.candle.createPriceLine({
                    price: parseFloat(activeTrade.tp_price),
                    color: '#10b981',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dotted,
                    axisLabelVisible: true,
                    title: 'ALVO',
                });
                priceLinesRef.current.push(tpLine);
            }
        }

        markers.sort((a,b) => a.time - b.time);
        seriesRef.current.candle.setMarkers(markers);

        if (panorama && !isFittedRef.current) {
            chartInstance.current.timeScale().fitContent();
            isFittedRef.current = true;
        }

    }, [data, levels, panorama, trades, activeTrade, symbol]);

    return (
        <div className="w-full h-full relative group">
            {/* Fundo Gradiente Sutil para dar Profundidade */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 to-slate-950/80 pointer-events-none" />
            
            <div ref={chartContainerRef} className="w-full h-full relative z-10" />
            
            {/* Marca D'água */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.05] pointer-events-none select-none z-0">
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-widest">SNIPER</h1>
            </div>
            
            {/* Legenda Flutuante Inteligente */}
            <div className="absolute top-2 left-2 z-20 flex gap-4 pointer-events-none">
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                    <div className="w-2.5 h-0.5 bg-[#f59e0b]"></div>
                    <span className="text-[9px] text-slate-400 font-bold">EMA 200 (Tendência)</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-800">
                     <div className="w-2.5 h-2.5 border border-dashed border-emerald-500 bg-emerald-500/10"></div>
                    <span className="text-[9px] text-slate-400 font-bold">Golden Zone (Fibo)</span>
                </div>
            </div>
        </div>
    );
}