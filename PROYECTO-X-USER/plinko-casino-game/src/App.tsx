import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlinkoBoard, PlinkoBoardRef } from './components/PlinkoBoard';
import { Coins, Play, Square, Zap, DollarSign, History } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(1);
  const [risk, setRisk] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [rows, setRows] = useState(8);
  const [mode, setMode] = useState<'Manual' | 'Auto'>('Manual');
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  
  const boardRef = useRef<PlinkoBoardRef>(null);

  const handleBet = useCallback(() => {
    setBalance(b => {
      if (b >= betAmount && betAmount > 0) {
        boardRef.current?.dropBall(betAmount);
        return Number((b - betAmount).toFixed(2));
      } else {
        setIsAutoPlaying(false);
        return b;
      }
    });
  }, [betAmount]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (mode === 'Auto' && isAutoPlaying) {
      interval = setInterval(() => {
        handleBet();
      }, 500);
    }
    return () => clearInterval(interval);
  }, [mode, isAutoPlaying, handleBet]);

  const handleWin = useCallback((winAmount: number, multiplier: number) => {
    setBalance(b => Number((b + winAmount).toFixed(2)));
    setHistory(h => [multiplier, ...h].slice(0, 10));
  }, []);

  const getMultiplierColor = (mult: number) => {
    if (mult >= 10) return 'bg-red-500 text-white';
    if (mult >= 3) return 'bg-orange-500 text-white';
    if (mult >= 1) return 'bg-yellow-500 text-black';
    return 'bg-lime-500 text-black';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-purple-500" />
          <span className="text-xl font-bold tracking-tight text-white">Shuffle Plinko</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-medium text-emerald-400">{balance.toFixed(2)}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Controls */}
        <aside className="w-full lg:w-80 bg-slate-900 border-r border-slate-800 p-6 flex flex-col gap-6 overflow-y-auto">
          {/* Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => { setMode('Manual'); setIsAutoPlaying(false); }}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                mode === 'Manual' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Manual
            </button>
            <button
              onClick={() => setMode('Auto')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                mode === 'Auto' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Auto
            </button>
          </div>

          {/* Bet Amount */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Bet Amount</label>
              <span className="text-xs text-slate-500">USD</span>
            </div>
            <div className="flex bg-slate-950 rounded-lg border border-slate-800 p-1">
              <div className="flex items-center pl-3 pr-2">
                <Coins className="w-4 h-4 text-slate-500" />
              </div>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                className="flex-1 bg-transparent text-white font-mono outline-none min-w-0"
                step="0.1"
                min="0"
              />
              <div className="flex gap-1">
                <button 
                  onClick={() => setBetAmount(b => Math.max(0.1, b / 2))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded transition-colors"
                >
                  ½
                </button>
                <button 
                  onClick={() => setBetAmount(b => b * 2)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded transition-colors"
                >
                  2x
                </button>
              </div>
            </div>
          </div>

          {/* Risk Level */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Risk</label>
            <div className="flex gap-2">
              {(['Low', 'Medium', 'High'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRisk(r)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg border transition-all",
                    risk === r 
                      ? r === 'Low' ? "bg-lime-500/10 border-lime-500 text-lime-400"
                        : r === 'Medium' ? "bg-orange-500/10 border-orange-500 text-orange-400"
                        : "bg-red-500/10 border-red-500 text-red-400"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Rows</label>
              <span className="text-sm font-mono text-white bg-slate-800 px-2 py-0.5 rounded">{rows}</span>
            </div>
            <input
              type="range"
              min="8"
              max="16"
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-slate-500 font-mono">
              <span>8</span>
              <span>16</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-auto pt-6">
            {mode === 'Manual' ? (
              <button
                onClick={handleBet}
                disabled={balance < betAmount || betAmount <= 0}
                className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] active:scale-[0.98]"
              >
                Bet
              </button>
            ) : (
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                disabled={balance < betAmount || betAmount <= 0}
                className={cn(
                  "w-full py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
                  isAutoPlaying 
                    ? "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20" 
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]"
                )}
              >
                {isAutoPlaying ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    Stop Auto
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    Start Auto
                  </>
                )}
              </button>
            )}
          </div>
        </aside>

        {/* Game Area */}
        <section className="flex-1 p-4 lg:p-8 flex flex-col gap-6 bg-slate-950 relative">
          {/* History */}
          <div className="flex items-center gap-2 h-10 overflow-hidden">
            <History className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex gap-2 flex-1 overflow-x-auto pb-2 scrollbar-hide">
              {history.map((mult, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "px-3 py-1 rounded text-xs font-bold shrink-0 animate-in fade-in slide-in-from-right-4",
                    getMultiplierColor(mult)
                  )}
                >
                  {mult}x
                </div>
              ))}
              {history.length === 0 && (
                <span className="text-sm text-slate-600 italic">No recent plays</span>
              )}
            </div>
          </div>

          {/* Board Container */}
          <div className="flex-1 relative min-h-[400px]">
            <PlinkoBoard 
              ref={boardRef}
              rows={rows}
              risk={risk}
              onWin={handleWin}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
