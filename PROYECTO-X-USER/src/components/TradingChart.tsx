import React, { useEffect, useRef } from 'react';

interface PricePoint {
    time: number;
    price: number;
}

interface TradingChartProps {
    data: PricePoint[];
    startPrice: number;
    strikePrice: number | null;
    isUp: boolean;
    currentPrice: number;
    timeLeft: number;
    phase: 'BETTING' | 'LOCKED';
}

export default function TradingChart({ data, startPrice, strikePrice, isUp, currentPrice, timeLeft, phase }: TradingChartProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const lastDataRef = useRef<PricePoint[]>(data);

    // Smooth transition state
    const currentPriceRef = useRef(data.length > 0 ? data[data.length - 1].price : startPrice);
    const targetPriceRef = useRef(currentPriceRef.current);

    useEffect(() => {
        if (data.length > 0) {
            targetPriceRef.current = data[data.length - 1].price;
        }
    }, [data]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Particle system
        const particles: { x: number, y: number, alpha: number, size: number, vx: number, vy: number }[] = [];
        const MAX_PARTICLES = 30;

        const render = () => {
            // Smooth price interpolation
            const diff = targetPriceRef.current - currentPriceRef.current;
            currentPriceRef.current += diff * 0.12; // Slightly faster for responsiveness

            const width = canvas.width;
            const height = canvas.height;
            const padding = 60; // More padding for labels

            ctx.clearRect(0, 0, width, height);

            if (data.length < 2) {
                animationRef.current = requestAnimationFrame(render);
                return;
            }

            // Calculate scales
            const prices = data.map(d => d.price);
            const minP = Math.min(...prices, startPrice) * 0.9997;
            const maxP = Math.max(...prices, startPrice) * 1.0003;
            const range = maxP - minP;

            const getX = (i: number) => (i / (data.length - 1)) * width;
            const getY = (p: number) => height - padding - ((p - minP) / range) * (height - padding * 2);

            const lastX = getX(data.length - 1);
            const lastY = getY(currentPriceRef.current);

            // 1. Draw Background Grid with Depth
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 10; i++) {
                const y = padding + (i / 9) * (height - padding * 2);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            for (let i = 0; i < 15; i++) {
                const x = (i / 14) * width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            // 2. Draw Start Price Reference (Neon Glow) - THE "STAR" LINE
            const startY = getY(startPrice);
            const starPulse = (Math.sin(Date.now() / 500) + 1) / 2;

            // Neon Glow underneath (Pulsing)
            ctx.shadowBlur = 10 + starPulse * 15;
            ctx.shadowColor = isUp ? 'rgba(0, 243, 255, 0.4)' : 'rgba(255, 255, 255, 0.4)';
            ctx.strokeStyle = isUp ? `rgba(0, 243, 255, ${0.2 + starPulse * 0.2})` : `rgba(255, 255, 255, ${0.2 + starPulse * 0.2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, startY);
            // Pulsing color with more visibility
            const starColor = `rgba(0, 243, 255, ${0.4 + starPulse * 0.5})`;

            // 2. Reference Line (STAR)
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00f3ff';
            ctx.strokeStyle = starColor;
            ctx.lineWidth = 2; // Thicker line
            ctx.beginPath();
            ctx.moveTo(0, startY);
            ctx.lineTo(width, startY);
            ctx.stroke();

            // Dotted reference line (more opaque)
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(0, startY);
            ctx.lineTo(width, startY);
            ctx.stroke();
            ctx.setLineDash([]);

            // "STAR" Label - More visible
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(15, startY - 12, 55, 24);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(15, startY - 12, 55, 24);

            ctx.font = 'bold 12px "Orbitron"'; // Larger font
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('STAR', 42, startY + 6);

            const mainColor = isUp ? '#00f3ff' : '#ef4444';
            const headColor = isUp ? '#a5f3fc' : '#fecaca';

            // 3. Layered Area Gradients (Flowing effect)
            const time = Date.now() / 1500;

            // Sub-layer 1 (Deep)
            const grad1 = ctx.createLinearGradient(0, 0, 0, height);
            grad1.addColorStop(0, `${mainColor}22`);
            grad1.addColorStop(0.5, `${mainColor}08`);
            grad1.addColorStop(1, 'transparent');

            ctx.fillStyle = grad1;
            ctx.beginPath();
            ctx.moveTo(0, height);
            for (let i = 0; i < data.length - 1; i++) {
                ctx.lineTo(getX(i), getY(data[i].price));
            }
            ctx.lineTo(lastX, lastY);
            ctx.lineTo(width, height);
            ctx.fill();

            // 4. Draw Particles (Trailing)
            if (particles.length < MAX_PARTICLES && Math.random() > 0.5) {
                particles.push({
                    x: lastX,
                    y: lastY,
                    alpha: 1,
                    size: Math.random() * 3 + 1,
                    vx: -Math.random() * 2 - 1,
                    vy: (Math.random() - 0.5) * 2
                });
            }

            ctx.shadowBlur = 5;
            ctx.shadowColor = mainColor;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.alpha -= 0.02;
                if (p.alpha <= 0) {
                    particles.splice(i, 1);
                    continue;
                }
                ctx.fillStyle = `${mainColor}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // 5. Main Path with Glowing Tip
            ctx.shadowBlur = 20;
            ctx.shadowColor = mainColor;
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.beginPath();
            ctx.moveTo(getX(0), getY(data[0].price));
            for (let i = 1; i < data.length - 1; i++) {
                ctx.lineTo(getX(i), getY(data[i].price));
            }
            ctx.lineTo(lastX, lastY);
            ctx.stroke();

            // Tip Highlight
            ctx.shadowBlur = 30;
            ctx.strokeStyle = headColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(getX(data.length - 2), getY(data[data.length - 2].price));
            ctx.lineTo(lastX, lastY);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 6. Holographic Price Label
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(lastX - 70, lastY - 40, 60, 24);
            ctx.strokeStyle = mainColor;
            ctx.lineWidth = 1;
            ctx.strokeRect(lastX - 70, lastY - 40, 60, 24);

            ctx.font = 'bold 12px "Orbitron"';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(currentPriceRef.current.toFixed(0), lastX - 40, lastY - 24);

            // Connect indicator
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(lastX - 10, lastY - 16);
            ctx.stroke();

            // 7. Dynamic Price Glow (Head)
            const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
            ctx.shadowBlur = 15 + pulse * 10;
            ctx.shadowColor = headColor;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = `${mainColor}${Math.floor((1 - pulse) * 200).toString(16).padStart(2, '0')}`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(lastX, lastY, 6 + pulse * 12, 0, Math.PI * 2);
            ctx.stroke();

            animationRef.current = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationRef.current);
    }, [data, startPrice, isUp]);

    return (
        <div className="w-full h-full relative overflow-hidden rounded-2xl">
            <canvas
                ref={canvasRef}
                width={1200}
                height={600}
                className="w-full h-full object-cover"
            />

            {/* Overlay scanlines effect */}
            <div className="absolute inset-0 pointer-events-none bg-scanlines opacity-[0.03]" />
        </div>
    );
}
