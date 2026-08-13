import { useState, useEffect, useRef, useCallback } from 'react';
import { Rocket, Wallet, History, Trophy, Settings, Info, Volume2, VolumeX, User, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CryptoJS from 'crypto-js';

// --- Types ---
type GameState = 'idle' | 'starting' | 'playing' | 'crashed';
type BetState = 'idle' | 'betting' | 'cashed_out';

interface Player {
  id: string;
  name: string;
  bet: number;
  cashOutTarget?: number;
  cashedOutAt?: number;
  profit?: number;
}

interface RoundHistory {
  crashPoint: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

// --- Constants ---
const HOUSE_EDGE = 0.01; // 1% house edge (99% RTP)
const GROWTH_RATE = 0.0693; // Takes ~10s to reach 2x

// --- Audio Utils ---
let audioCtx: AudioContext | null = null;

const playSound = (type: 'start' | 'tick' | 'crash' | 'cashout', enabled: boolean) => {
  if (!enabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'start') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'tick') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'crash') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'cashout') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    console.error('Audio error', e);
  }
};

// --- Utils ---
const generateCrashPoint = (serverSeed: string, clientSeed: string, nonce: number) => {
  const hash = CryptoJS.HmacSHA256(`${clientSeed}-${nonce}`, serverSeed).toString(CryptoJS.enc.Hex);
  // Take first 8 characters (32 bits)
  const h = parseInt(hash.slice(0, 8), 16);
  const e = 2 ** 32;
  if (h % 100 === 0) return 1.00; // Instant crash 1% of the time
  const p = (e - h) / e;
  const result = (1 - HOUSE_EDGE) / p;
  return Math.max(1.00, Math.min(result, 1000000));
};

const calcMultiplier = (timeMs: number) => Math.max(1.00, Math.exp(GROWTH_RATE * (timeMs / 1000)));

const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
const formatMultiplier = (val: number) => `${val.toFixed(2)}x`;

// --- Components ---

// 1. Crash Chart (Canvas)
const CrashChart = ({ gameState, currentMultiplier, crashPoint }: { gameState: GameState, currentMultiplier: number, crashPoint: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const maxTime = Math.log(currentMultiplier) / GROWTH_RATE;
      // Add a 15% margin on the right so the rocket is never cut off
      const timeScale = Math.max(10, maxTime * 1.15); 
      // Add a 15% margin on the top
      const multScale = Math.max(2.0, currentMultiplier * 1.15); 

      // Draw Grid and Labels
      ctx.strokeStyle = '#2A2E39';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#6B7280'; // text-gray-500
      ctx.font = '12px Inter, sans-serif';
      
      // Horizontal grid lines (Y-axis)
      ctx.beginPath();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      for (let i = 1; i <= 4; i++) {
        const m = 1 + (multScale - 1) * (i / 4);
        const y = height - (i / 4) * height * 0.8;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.fillText(`${m.toFixed(1)}x`, 10, y - 5);
      }
      ctx.stroke();

      // Vertical grid lines (X-axis)
      ctx.beginPath();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 1; i <= 4; i++) {
        const t = timeScale * (i / 4);
        const x = (i / 4) * width;
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 5); // Just a small tick
        ctx.fillText(`${t.toFixed(0)}s`, x, height - 20);
      }
      ctx.stroke();

      // Draw Curve
      if (gameState === 'playing' || gameState === 'crashed') {
        ctx.beginPath();
        
        const startY = height;
        ctx.moveTo(0, startY);
        
        const points = 100;
        let lastX = 0;
        let lastY = startY;
        
        for (let i = 0; i <= points; i++) {
          const t = (i / points) * maxTime;
          const m = Math.exp(GROWTH_RATE * t);
          
          const x = (t / timeScale) * width;
          const y = height - ((m - 1) / (multScale - 1)) * height * 0.8; 
          
          ctx.lineTo(x, y);
          lastX = x;
          lastY = y;
        }

        ctx.strokeStyle = gameState === 'crashed' ? '#EF4444' : '#10B981'; // Red if crashed, Green if playing
        ctx.lineWidth = 4;
        ctx.stroke();

        // Fill under curve
        ctx.lineTo(lastX, height);
        ctx.lineTo(0, height);
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, gameState === 'crashed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // Draw Rocket/Dot at the end
        if (gameState === 'playing') {
          // Calculate angle for the rocket
          const tPrev = ((points - 1) / points) * maxTime;
          const mPrev = Math.exp(GROWTH_RATE * tPrev);
          const xPrev = (tPrev / timeScale) * width;
          const yPrev = height - ((mPrev - 1) / (multScale - 1)) * height * 0.8;
          
          let angle = 0;
          if (lastX - xPrev !== 0 || lastY - yPrev !== 0) {
            angle = Math.atan2(lastY - yPrev, lastX - xPrev);
          }

          ctx.save();
          ctx.translate(lastX, lastY);
          
          // Draw a dot
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#10B981';
          ctx.fill();
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#10B981';
          
          // Draw Rocket Emoji
          ctx.rotate(angle + Math.PI / 4); // Adjust rotation so rocket points along the line
          ctx.font = '32px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🚀', 0, 0);
          
          ctx.restore();
        } else if (gameState === 'crashed') {
          // Draw explosion or crashed state
          ctx.save();
          ctx.translate(lastX, lastY);
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#EF4444';
          ctx.fill();
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#EF4444';
          
          ctx.font = '32px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥', 0, 0);
          ctx.restore();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, currentMultiplier]);

  return (
    <div className="relative w-full h-[400px] md:h-[600px] bg-[#1A1D24] rounded-xl overflow-hidden border border-[#2A2E39] flex-1">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-full object-cover"
      />
      
      {/* Center Display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {gameState === 'starting' && (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="text-gray-400 text-lg mb-2">Starting in</div>
            <div className="text-5xl font-bold text-white">{(5 - currentMultiplier).toFixed(1)}s</div>
          </motion.div>
        )}
        
        {(gameState === 'playing' || gameState === 'crashed') && (
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: gameState === 'crashed' ? 1.2 : 1 }}
            className={`text-6xl md:text-8xl font-black tracking-tighter ${gameState === 'crashed' ? 'text-red-500' : 'text-emerald-500'}`}
            style={{ textShadow: gameState === 'playing' ? '0 0 40px rgba(16, 185, 129, 0.5)' : 'none' }}
          >
            {formatMultiplier(gameState === 'crashed' ? crashPoint : currentMultiplier)}
          </motion.div>
        )}
        
        {gameState === 'crashed' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 px-6 py-2 bg-red-500/20 text-red-500 rounded-full font-bold uppercase tracking-widest"
          >
            Crashed
          </motion.div>
        )}
      </div>
    </div>
  );
};

// 2. Provably Fair Modal
const ProvablyFairModal = ({ 
  isOpen, 
  onClose, 
  serverSeed, 
  clientSeed, 
  nonce,
  onUpdateClientSeed
}: { 
  isOpen: boolean, 
  onClose: () => void,
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  onUpdateClientSeed: (seed: string) => void
}) => {
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState('');
  const [verifyNonce, setVerifyNonce] = useState<number | ''>('');
  const [verifyResult, setVerifyResult] = useState<number | null>(null);
  const [newClientSeed, setNewClientSeed] = useState(clientSeed);
  const [activeTab, setActiveTab] = useState<'current' | 'verify'>('current');

  const serverSeedHash = CryptoJS.SHA256(serverSeed).toString(CryptoJS.enc.Hex);

  const handleVerify = () => {
    if (verifyServerSeed && verifyClientSeed && verifyNonce !== '') {
      const result = generateCrashPoint(verifyServerSeed, verifyClientSeed, Number(verifyNonce));
      setVerifyResult(result);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1A1D24] border border-[#2A2E39] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#2A2E39] bg-[#0F1115]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            Provably Fair
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex border-b border-[#2A2E39]">
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'current' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-[#2A2E39]/30' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('current')}
          >
            Current Round
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'verify' ? 'text-emerald-400 border-b-2 border-emerald-400 bg-[#2A2E39]/30' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('verify')}
          >
            Verify Past Round
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'current' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Server Seed (Hash)</label>
                <div className="bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-gray-300 break-all">
                  {serverSeedHash}
                </div>
                <p className="text-xs text-gray-500 mt-1">The actual server seed is hidden until the round ends to prevent predicting the crash point.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Client Seed</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newClientSeed}
                    onChange={(e) => setNewClientSeed(e.target.value)}
                    className="flex-1 bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button 
                    onClick={() => onUpdateClientSeed(newClientSeed)}
                    disabled={newClientSeed === clientSeed}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-lg font-bold transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nonce</label>
                <div className="bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-gray-300">
                  {nonce}
                </div>
                <p className="text-xs text-gray-500 mt-1">Increments by 1 for each round played with the current client seed.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Server Seed (UnHashed)</label>
                <input 
                  type="text" 
                  value={verifyServerSeed}
                  onChange={(e) => setVerifyServerSeed(e.target.value)}
                  placeholder="Enter the revealed server seed"
                  className="w-full bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Client Seed</label>
                <input 
                  type="text" 
                  value={verifyClientSeed}
                  onChange={(e) => setVerifyClientSeed(e.target.value)}
                  placeholder="Enter the client seed"
                  className="w-full bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nonce</label>
                <input 
                  type="number" 
                  value={verifyNonce}
                  onChange={(e) => setVerifyNonce(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Enter the nonce"
                  className="w-full bg-[#0F1115] border border-[#2A2E39] rounded-lg p-3 text-sm font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              
              <button 
                onClick={handleVerify}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors mt-2"
              >
                Verify Crash Point
              </button>
              
              {verifyResult !== null && (
                <div className="mt-4 p-4 bg-[#0F1115] border border-[#2A2E39] rounded-lg text-center">
                  <div className="text-sm text-gray-400 mb-1">Calculated Crash Point</div>
                  <div className={`text-3xl font-black ${verifyResult >= 2 ? 'text-emerald-400' : 'text-white'}`}>
                    {verifyResult.toFixed(2)}x
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [balance, setBalance] = useState(10000);
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashOut, setAutoCashOut] = useState(2.0);
  const [stopOnProfit, setStopOnProfit] = useState<number | ''>('');
  const [stopOnLoss, setStopOnLoss] = useState<number | ''>('');
  const [sessionProfit, setSessionProfit] = useState(0);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>('idle');
  const [betState, setBetState] = useState<BetState>('idle');
  
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [startTime, setStartTime] = useState(0);
  
  const serverSeedRef = useRef(CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex));
  const clientSeedRef = useRef('0000000000000000000fa3b65e43e4240d71762a5bf397d5304b2596d116859c');
  const nonceRef = useRef(1);

  const [serverSeed, setServerSeed] = useState(serverSeedRef.current);
  const [clientSeed, setClientSeed] = useState(clientSeedRef.current);
  const [nonce, setNonce] = useState(nonceRef.current);
  const [showProvablyFair, setShowProvablyFair] = useState(false);
  
  const [history, setHistory] = useState<RoundHistory[]>([
    { crashPoint: 1.24, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 2.50, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 1.05, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 10.42, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 1.88, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 3.12, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 1.00, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
    { crashPoint: 5.55, serverSeed: 'hidden', clientSeed: 'hidden', nonce: 0 },
  ]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Game Loop
  useEffect(() => {
    let animationFrame: number;
    let lastTickSec = -1;
    
    const tick = () => {
      if (gameState === 'starting') {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSec = Math.floor(elapsed);
        if (currentSec > lastTickSec) {
          playSound('tick', soundEnabled);
          lastTickSec = currentSec;
        }

        if (elapsed >= 5) {
          setGameState('playing');
          playSound('start', soundEnabled);
          setStartTime(Date.now());
          setCurrentMultiplier(1.0);
        } else {
          setCurrentMultiplier(elapsed); // Use multiplier state for countdown timer temporarily
        }
      } else if (gameState === 'playing') {
        const elapsed = Date.now() - startTime;
        const currentM = calcMultiplier(elapsed);
        
        if (currentM >= crashPoint) {
          // Crash!
          setGameState('crashed');
          playSound('crash', soundEnabled);
          setCurrentMultiplier(crashPoint);
          
          const roundRecord: RoundHistory = {
            crashPoint,
            serverSeed: serverSeedRef.current,
            clientSeed: clientSeedRef.current,
            nonce: nonceRef.current
          };
          
          setHistory(prev => [roundRecord, ...prev].slice(0, 20));
          
          // Prepare next round
          const nextServerSeed = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
          serverSeedRef.current = nextServerSeed;
          setServerSeed(nextServerSeed);
          
          nonceRef.current += 1;
          setNonce(nonceRef.current);
          
          if (betState === 'betting') {
            setBetState('idle'); // Lost
          }
          
          // Schedule next round
          setTimeout(() => {
            startRound();
          }, 3000);
          
        } else {
          setCurrentMultiplier(currentM);
          
          // Check Auto Cash Out
          if (betState === 'betting' && autoCashOut > 1.0 && currentM >= autoCashOut) {
            handleCashOut(autoCashOut);
          }
          
          // Simulate other players cashing out
          setPlayers(prev => prev.map(p => {
            if (!p.cashedOutAt && p.cashOutTarget && currentM >= p.cashOutTarget) {
              return { ...p, cashedOutAt: p.cashOutTarget, profit: p.bet * p.cashOutTarget };
            }
            return p;
          }));
        }
      }
      
      animationFrame = requestAnimationFrame(tick);
    };

    if (gameState === 'starting' || gameState === 'playing') {
      animationFrame = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, startTime, crashPoint, betState, autoCashOut, soundEnabled]);

  const placeBet = useCallback(() => {
    setBalance(prevBalance => {
      if (prevBalance < betAmount) return prevBalance;
      setBetState('betting');
      setSessionProfit(prev => prev - betAmount);
      return prevBalance - betAmount;
    });
  }, [betAmount]);

  const startRound = useCallback(() => {
    const newCrashPoint = generateCrashPoint(serverSeedRef.current, clientSeedRef.current, nonceRef.current);
    setCrashPoint(newCrashPoint);
    setGameState('starting');
    setStartTime(Date.now());
    setCurrentMultiplier(0);
    
    // Generate fake players
    const fakePlayers: Player[] = Array.from({ length: 15 }).map((_, i) => {
      const target = 1.1 + Math.random() * 5;
      return {
        id: `player-${i}`,
        name: `User${Math.floor(Math.random() * 9999)}`,
        bet: Math.floor(Math.random() * 1000) + 10,
        cashOutTarget: Math.random() > 0.3 ? target : undefined, // Some don't have auto
      };
    });
    
    // Reset bet state if needed
    if (betState === 'cashed_out') {
      setBetState('idle');
    }
    
    // Add self if betting next round
    if (isAutoRunning) {
      // Check limits
      if (stopOnProfit !== '' && sessionProfit >= stopOnProfit) {
        setIsAutoRunning(false);
      } else if (stopOnLoss !== '' && sessionProfit <= -stopOnLoss) {
        setIsAutoRunning(false);
      } else {
        // Need to use a timeout to allow state to settle if it was cashed_out
        setTimeout(() => {
          placeBet();
        }, 0);
      }
    }
    
    setPlayers(fakePlayers.sort((a, b) => b.bet - a.bet));
  }, [isAutoMode, betState, placeBet]);

  // Initial start
  useEffect(() => {
    // Only start if idle
    if (gameState === 'idle') {
      startRound();
    }
  }, [gameState, startRound]);

  const handleCashOut = (multiplierToUse = currentMultiplier) => {
    if (betState !== 'betting') return;
    if (gameState === 'starting') {
      // Cancel bet
      setBalance(prev => prev + betAmount);
      setSessionProfit(prev => prev + betAmount);
      setBetState('idle');
      return;
    }
    const winAmount = betAmount * multiplierToUse;
    setBalance(prev => prev + winAmount);
    setSessionProfit(prev => prev + winAmount);
    setBetState('cashed_out');
    playSound('cashout', soundEnabled);
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-gray-300 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-[#1A1D24] border-b border-[#2A2E39]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">NOVA DIGITAL <span className="text-purple-500">CRASH</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setShowProvablyFair(true)} className="p-2 hover:bg-[#2A2E39] rounded-full transition-colors" title="Provably Fair">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 hover:bg-[#2A2E39] rounded-full transition-colors">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 bg-[#0F1115] px-4 py-2 rounded-lg border border-[#2A2E39]">
            <Wallet className="w-4 h-4 text-purple-500" />
            <span className="font-mono font-bold text-white">{formatCurrency(balance)}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 border-2 border-[#2A2E39] overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Provably Fair Modal */}
        <ProvablyFairModal 
          isOpen={showProvablyFair} 
          onClose={() => setShowProvablyFair(false)} 
          serverSeed={serverSeed}
          clientSeed={clientSeed}
          nonce={nonce}
          onUpdateClientSeed={(newSeed) => {
            clientSeedRef.current = newSeed;
            setClientSeed(newSeed);
            nonceRef.current = 1;
            setNonce(1);
          }}
        />

        {/* Left Column: Controls & Leaderboard */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="bg-[#1A1D24] rounded-xl border border-[#2A2E39] p-4">
            {/* Tabs */}
            <div className="flex rounded-lg bg-[#0F1115] p-1 mb-6">
              <button 
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isAutoMode ? 'bg-[#2A2E39] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setIsAutoMode(false)}
              >
                Manual
              </button>
              <button 
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isAutoMode ? 'bg-[#2A2E39] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                onClick={() => setIsAutoMode(true)}
              >
                Auto
              </button>
            </div>

            {/* Bet Amount */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Bet Amount</span>
                <span className="text-gray-400 font-mono">{formatCurrency(betAmount)}</span>
              </div>
              <div className="flex items-center bg-[#0F1115] border border-[#2A2E39] rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                <div className="pl-3 pr-2 text-gray-500">$</div>
                <input 
                  type="number" 
                  value={betAmount}
                  disabled={isAutoRunning}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  className="w-full bg-transparent py-3 outline-none text-white font-mono disabled:opacity-50"
                  min={1}
                />
                <div className="flex border-l border-[#2A2E39]">
                  <button disabled={isAutoRunning} onClick={() => setBetAmount(prev => Math.max(1, prev / 2))} className="px-3 py-3 hover:bg-[#2A2E39] text-xs font-bold transition-colors disabled:opacity-50">1/2</button>
                  <button disabled={isAutoRunning} onClick={() => setBetAmount(prev => prev * 2)} className="px-3 py-3 hover:bg-[#2A2E39] border-l border-[#2A2E39] text-xs font-bold transition-colors disabled:opacity-50">2x</button>
                </div>
              </div>
            </div>

            {/* Auto Cashout */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Auto Cashout</span>
              </div>
              <div className="flex items-center bg-[#0F1115] border border-[#2A2E39] rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                <input 
                  type="number" 
                  value={autoCashOut}
                  disabled={isAutoRunning}
                  onChange={(e) => setAutoCashOut(Number(e.target.value))}
                  className="w-full bg-transparent py-3 px-3 outline-none text-white font-mono disabled:opacity-50"
                  step={0.01}
                  min={1.01}
                />
                <div className="pr-3 text-gray-500 font-mono">x</div>
              </div>
            </div>

            {/* Auto Settings (Only in Auto Mode) */}
            {isAutoMode && (
              <div className="mb-6 space-y-4 border-t border-[#2A2E39] pt-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Stop on Profit</span>
                  </div>
                  <div className="flex items-center bg-[#0F1115] border border-[#2A2E39] rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                    <div className="pl-3 pr-2 text-gray-500">$</div>
                    <input 
                      type="number" 
                      value={stopOnProfit}
                      disabled={isAutoRunning}
                      onChange={(e) => setStopOnProfit(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-transparent py-2 outline-none text-white font-mono text-sm disabled:opacity-50"
                      min={0}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Stop on Loss</span>
                  </div>
                  <div className="flex items-center bg-[#0F1115] border border-[#2A2E39] rounded-lg overflow-hidden focus-within:border-purple-500 transition-colors">
                    <div className="pl-3 pr-2 text-gray-500">$</div>
                    <input 
                      type="number" 
                      value={stopOnLoss}
                      disabled={isAutoRunning}
                      onChange={(e) => setStopOnLoss(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-transparent py-2 outline-none text-white font-mono text-sm disabled:opacity-50"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            {!isAutoMode ? (
              // Manual Mode Button
              betState === 'idle' ? (
                <button 
                  onClick={placeBet}
                  disabled={gameState === 'playing' || balance < betAmount}
                  className="w-full py-4 rounded-lg font-bold text-lg bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)]"
                >
                  {gameState === 'playing' ? 'Bet (Next Round)' : 'Place Bet'}
                </button>
              ) : betState === 'betting' ? (
                <button 
                  onClick={() => handleCashOut()}
                  disabled={gameState === 'crashed'}
                  className="w-full py-4 rounded-lg font-bold text-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {gameState === 'starting' ? 'Cancel Bet' : `Cash Out (${formatCurrency(betAmount * currentMultiplier)})`}
                </button>
              ) : (
                <button 
                  disabled
                  className="w-full py-4 rounded-lg font-bold text-lg bg-[#2A2E39] text-emerald-400 transition-all"
                >
                  Cashed Out!
                </button>
              )
            ) : (
              // Auto Mode Button
              <button 
                onClick={() => {
                  if (isAutoRunning) {
                    setIsAutoRunning(false);
                  } else {
                    setSessionProfit(0);
                    setIsAutoRunning(true);
                    if (betState === 'idle' && gameState !== 'playing') {
                      placeBet();
                    }
                  }
                }}
                className={`w-full py-4 rounded-lg font-bold text-lg text-white transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] ${
                  isAutoRunning 
                    ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                    : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {isAutoRunning ? 'Stop Auto Bet' : 'Start Auto Bet'}
              </button>
            )}
          </div>

          {/* Leaderboard (Moved to left column) */}
          <div className="bg-[#1A1D24] rounded-xl border border-[#2A2E39] overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-[#2A2E39] flex justify-between items-center bg-[#1A1D24]">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h3 className="font-bold text-white text-sm">Active Bets</h3>
              </div>
              <div className="text-xs text-gray-400">
                {players.length} Players
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 max-h-[400px] scrollbar-hide">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0F1115] text-gray-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium text-right">Bet</th>
                    <th className="px-3 py-2 font-medium text-right">Mult</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2E39]">
                  {/* Self */}
                  {(betState === 'betting' || betState === 'cashed_out') && (
                    <tr className="bg-purple-500/10">
                      <td className="px-3 py-2 flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white font-bold">Y</div>
                        <span className="text-white font-medium truncate max-w-[60px]">You</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-white">{formatCurrency(betAmount)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {betState === 'cashed_out' ? (
                          <span className="text-emerald-400 font-bold">{formatMultiplier(currentMultiplier)}</span>
                        ) : gameState === 'playing' ? (
                          <span className="text-purple-400">{formatMultiplier(currentMultiplier)}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  )}
                  
                  {/* Others */}
                  {players.map(p => (
                    <tr key={p.id} className="hover:bg-[#2A2E39]/30 transition-colors">
                      <td className="px-3 py-2 flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-400 truncate max-w-[60px]">{p.name}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-400">{formatCurrency(p.bet)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {p.cashedOutAt ? (
                           <span className="text-emerald-400 font-bold">{formatMultiplier(p.cashedOutAt)}</span>
                        ) : gameState === 'crashed' ? (
                           <span className="text-red-500">-</span>
                        ) : gameState === 'playing' ? (
                           <span className="text-purple-400">{formatMultiplier(currentMultiplier)}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Game */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          
          {/* History Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center justify-center p-2 bg-[#1A1D24] rounded-lg border border-[#2A2E39]">
              <History className="w-4 h-4 text-gray-400" />
            </div>
            {history.map((round, i) => (
              <div 
                key={i} 
                className={`px-3 py-1.5 rounded-lg text-sm font-mono font-bold whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${
                  round.crashPoint >= 10 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                  round.crashPoint >= 2 ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 
                  'bg-[#1A1D24] text-gray-400 border border-[#2A2E39]'
                }`}
                title={`Server Seed: ${round.serverSeed}\nClient Seed: ${round.clientSeed}\nNonce: ${round.nonce}`}
              >
                {round.crashPoint.toFixed(2)}x
              </div>
            ))}
          </div>

          {/* Game Canvas */}
          <CrashChart gameState={gameState} currentMultiplier={currentMultiplier} crashPoint={crashPoint} />
        </div>
      </main>
    </div>
  );
}
