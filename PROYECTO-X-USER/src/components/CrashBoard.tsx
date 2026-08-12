import React, { useEffect, useRef } from 'react';

type GameState = 'idle' | 'starting' | 'playing' | 'crashed';

interface CrashBoardProps {
    gameState: GameState;
    currentMultiplier: number;
    crashPoint: number;
}

const GROWTH_RATE = 0.0693; // Takes ~10s to reach 2x

const CrashBoard: React.FC<CrashBoardProps> = ({ gameState, currentMultiplier, crashPoint }) => {
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

            const maxTime = Math.log(Math.max(1.01, currentMultiplier)) / GROWTH_RATE;
            // Add a 15% margin on the right so the rocket is never cut off
            const timeScale = Math.max(10, maxTime * 1.15);
            // Add a 15% margin on the top
            const multScale = Math.max(2.0, currentMultiplier * 1.15);

            // Draw Grid and Labels
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '12px Outfit, sans-serif';

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
                ctx.lineTo(x, height - 5);
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

                if (gameState === 'crashed') {
                    ctx.strokeStyle = '#EF4444'; // Red if crashed
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#EF4444';
                } else {
                    ctx.strokeStyle = '#10B981'; // Green if playing
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
                }

                ctx.lineWidth = 4;
                ctx.stroke();
                ctx.shadowBlur = 0; // Reset shadow

                // Fill under curve
                ctx.lineTo(lastX, height);
                ctx.lineTo(0, height);
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                gradient.addColorStop(0, gameState === 'crashed' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)');
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.fill();

                // Draw Rocket at the end
                if (gameState === 'playing') {
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

                    // Draw a glow dot
                    ctx.beginPath();
                    ctx.arc(0, 0, 8, 0, Math.PI * 2);
                    ctx.fillStyle = '#10B981';
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = '#10B981';
                    ctx.fill();

                    // Draw Rocket Emoji
                    ctx.rotate(angle + Math.PI / 4);
                    ctx.font = '32px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('🚀', 0, 0);

                    ctx.restore();
                } else if (gameState === 'crashed') {
                    ctx.save();
                    ctx.translate(lastX, lastY);

                    ctx.font = '48px Arial';
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
        <div className="relative w-full h-full bg-[#0a0a0c]/40 rounded-3xl overflow-hidden border border-white/5">
            {/* Visual Grid Layer (CSS based for crispness) */}
            <div className="absolute inset-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

            <canvas
                ref={canvasRef}
                width={1000}
                height={600}
                className="w-full h-full object-contain"
            />

            {/* Central HUD */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-gradient-to-t from-black/40 via-transparent to-transparent">
                {gameState === 'starting' && (
                    <div className="text-center animate-in fade-in zoom-in duration-500">
                        <p className="text-blue-400 font-black uppercase tracking-[0.3em] text-xs mb-2 drop-shadow-neon-blue">PREPARANDO MOTOR</p>
                        <p className="text-6xl font-black text-white italic tracking-tighter">
                            {(5 - currentMultiplier).toFixed(1)}s
                        </p>
                    </div>
                )}

                {(gameState === 'playing' || gameState === 'crashed') && (
                    <div className="text-center">
                        <p className={`text-7xl md:text-9xl font-black tracking-tighter italic ${gameState === 'crashed' ? 'text-red-500' : 'text-geminix-green'} transition-colors duration-300 drop-shadow-neon`}>
                            {(gameState === 'crashed' ? crashPoint : currentMultiplier).toFixed(2)}x
                        </p>
                        {gameState === 'crashed' && (
                            <div className="mt-4 px-8 py-2 bg-red-500/20 border border-red-500/40 text-red-500 rounded-full font-black uppercase tracking-[0.2em] text-[10px] animate-bounce">
                                EXPLOSIÓN DETECTADA
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CrashBoard;
