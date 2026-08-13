import React, { useEffect, useRef, useState } from 'react';
import { SocketMessage } from '../services/websocket';

interface Props {
  messages: SocketMessage[];
}

const LiveTerminal: React.FC<Props> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Enhanced Digital Rain Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let frameCount = 0;

    // Character set: Katakana + Numbers + Symbols
    const chars = "アカサタナハマヤラワガザダバパイウエオカキクケコ0123456789$+-*/=%\"'#&_(),.;:?!\\|{}<>[]";
    const fontSize = 12;
    let columns = 0;
    let drops: number[] = [];

    const init = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;

      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(1).map(() => Math.random() * -100);
    };

    const draw = () => {
      frameCount++;

      // Slow down the animation drastically (update every 5th frame)
      if (frameCount % 5 === 0) {
        // Semi-transparent black to create trailing effect
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = `bold ${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
          // Random character
          const char = chars.charAt(Math.floor(Math.random() * chars.length));

          // Character gradient: Bright head, Fluorescent Green tail
          ctx.fillStyle = Math.random() > 0.99 ? "#fff" : "#00ff41";

          const x = i * fontSize;
          const y = drops[i] * fontSize;

          ctx.fillText(char, x, y);

          // Reset drop to top randomly
          if (y > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          }

          // Increment drop position
          drops[i]++;
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    init();
    draw();

    // Resize listener
    const handleResize = () => init();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="holo-card p-0 rounded-none clip-corner border border-proyecto-brand/30 h-full flex flex-col relative overflow-hidden group">
      {/* Header */}
      <div className="bg-black/80 px-4 py-2 border-b border-proyecto-brand/20 flex justify-between items-center relative z-20 backdrop-blur-sm">
        <div className="flex gap-1.5 items-center">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-proyecto-gold opacity-50"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-proyecto-green opacity-50"></div>
          <span className="ml-2 text-[8px] font-mono-tech font-bold text-proyecto-brand uppercase tracking-[0.2em]">LIVE_FEED_V.2.0</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full border border-proyecto-green/50 flex items-center justify-center">
            <div className="w-0.5 h-0.5 bg-proyecto-green rounded-full animate-ping"></div>
          </span>
          <span className="text-[8px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest">CONNECTED</span>
        </div>
      </div>

      {/* Enhanced Digital Rain / Matrix Effect */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none z-0 mix-blend-screen"
      ></canvas>

      <div
        ref={scrollRef}
        className="flex-grow p-4 font-mono-tech text-[10px] overflow-y-auto custom-scrollbar space-y-1.5 select-none relative z-10"
      >
        <div className="text-proyecto-brand/60 mb-4 italic border-b border-proyecto-brand/10 pb-2">
          <span className="text-proyecto-brand">sys_init</span> :: <span className="text-slate-400">Encrypted WebSocket session established...</span><br />
          <span className="text-proyecto-brand">auth_verify</span> :: <span className="text-slate-400">Access node verified. Streaming real-time telemetry...</span>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className="animate-fade-in flex items-start gap-2 hover:bg-white/5 p-1 rounded transition-colors group/msg">
            <span className="text-slate-600 shrink-0 opacity-50">[{msg.timestamp.toLocaleTimeString([], { hour12: false })}]</span>
            <div className="flex-grow break-all">
              <span className={`font-bold uppercase tracking-tighter mr-2 ${msg.type === 'PROFIT_TICK' ? 'text-proyecto-green text-glow-green' :
                msg.type === 'NETWORK_EVENT' ? 'text-proyecto-accent text-glow-cyan' :
                  'text-slate-500'
                }`}>
                {msg.type.replace('_', ' ')}
              </span>
              <span className="text-proyecto-brand/40 mr-2">»</span>
              <span className="text-slate-300 font-medium group-hover/msg:text-white transition-colors">{msg.payload.description}</span>
              {msg.payload.amount && (
                <span className="ml-2 text-proyecto-green font-bold bg-proyecto-green/10 px-1 rounded">
                  (+${msg.payload.amount.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 mt-4 opacity-50">
          <span className="text-proyecto-accent animate-pulse font-black text-xs">_</span>
        </div>
      </div>

      {/* Scan line effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-proyecto-accent/5 to-transparent h-[10%] w-full animate-scan pointer-events-none z-20"></div>
    </div>
  );
};

export default LiveTerminal;
