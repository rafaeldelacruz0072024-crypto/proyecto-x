import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

const MULTIPLIERS: Record<number, Record<string, number[]>> = {
  8: {
    Low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    Medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    High: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
  },
  9: {
    Low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    Medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    High: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43]
  },
  10: {
    Low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    Medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    High: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76]
  },
  11: {
    Low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    Medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    High: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120]
  },
  12: {
    Low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    Medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    High: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170]
  },
  13: {
    Low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    Medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    High: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260]
  },
  14: {
    Low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    Medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    High: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420]
  },
  15: {
    Low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    Medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    High: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620]
  },
  16: {
    Low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    Medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    High: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]
  }
};

function getPegPos(r: number, c: number, rows: number, width: number, height: number) {
  const paddingX = 40;
  const paddingY = 60;
  
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  
  const spacingX = usableWidth / (rows + 2);
  const spacingY = usableHeight / (rows + 1);
  
  const startY = paddingY;
  const centerX = width / 2;
  
  const x = centerX + (c - (r + 2) / 2) * spacingX;
  const y = startY + r * spacingY;
  
  return { x, y };
}

function getBucketColor(mult: number) {
  if (mult >= 10) return '#ef4444'; // Red
  if (mult >= 3) return '#f97316';  // Orange
  if (mult >= 1) return '#eab308';  // Yellow
  return '#84cc16';                 // Green
}

class Ball {
  id: number;
  rows: number;
  width: number;
  height: number;
  value: number;
  
  path: number[];
  currentRow: number;
  progress: number;
  currentC: number;
  isDone: boolean;
  
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;

  constructor(id: number, rows: number, width: number, height: number, value: number) {
    this.id = id;
    this.rows = rows;
    this.width = width;
    this.height = height;
    this.value = value;
    
    this.path = [];
    for (let i = 0; i < rows; i++) {
      this.path.push(Math.random() > 0.5 ? 1 : 0);
    }
    
    this.currentRow = 0;
    this.progress = 0;
    this.currentC = 1;
    this.isDone = false;
    
    const startPos = getPegPos(0, 1, rows, width, height);
    this.x = startPos.x;
    this.y = startPos.y - 40;
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = startPos.x;
    this.targetY = startPos.y;
  }

  update(speed: number) {
    if (this.isDone) return;
    
    this.progress += speed;
    if (this.progress >= 1) {
      this.progress = 0;
      this.currentRow++;
      
      if (this.currentRow > this.rows) {
        this.isDone = true;
        return;
      }
      
      if (this.currentRow <= this.rows) {
        const dir = this.path[this.currentRow - 1];
        if (dir === 1) this.currentC++;
      }
      
      this.startX = this.targetX;
      this.startY = this.targetY;
      
      if (this.currentRow === this.rows) {
        const targetPos = getPegPos(this.rows, this.currentC, this.rows, this.width, this.height);
        this.targetX = targetPos.x;
        this.targetY = targetPos.y + 20;
      } else {
        const targetPos = getPegPos(this.currentRow, this.currentC, this.rows, this.width, this.height);
        this.targetX = targetPos.x;
        this.targetY = targetPos.y;
      }
    }
    
    const bounce = this.currentRow === 0 ? 0 : Math.sin(this.progress * Math.PI) * 15;
    this.x = this.startX + (this.targetX - this.startX) * this.progress;
    this.y = this.startY + (this.targetY - this.startY) * this.progress - bounce;
  }
}

export interface PlinkoBoardRef {
  dropBall: (betAmount: number) => void;
}

interface PlinkoBoardProps {
  rows: number;
  risk: 'Low' | 'Medium' | 'High';
  onWin: (winAmount: number, multiplier: number) => void;
}

export const PlinkoBoard = forwardRef<PlinkoBoardRef, PlinkoBoardProps>(({ rows, risk, onWin }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animationRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    dropBall: (betAmount: number) => {
      if (canvasRef.current) {
        ballsRef.current.push(new Ball(Date.now() + Math.random(), rows, canvasRef.current.width, canvasRef.current.height, betAmount));
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw pegs
      ctx.fillStyle = '#cbd5e1'; // slate-300
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < r + 3; c++) {
          const pos = getPegPos(r, c, rows, canvas.width, canvas.height);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // Draw buckets
      const multipliers = MULTIPLIERS[rows][risk];
      for (let c = 1; c <= rows + 1; c++) {
        const pos = getPegPos(rows, c, rows, canvas.width, canvas.height);
        const mult = multipliers[c - 1];
        const color = getBucketColor(mult);
        
        ctx.fillStyle = color;
        
        // Draw rounded rectangle
        const rectWidth = 36;
        const rectHeight = 24;
        const rectX = pos.x - rectWidth / 2;
        const rectY = pos.y;
        
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectWidth, rectHeight, 4);
        ctx.fill();
        
        // Draw text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${mult}x`, pos.x, pos.y + rectHeight / 2);
      }
      
      // Update and draw balls
      const speed = 0.08;
      for (let i = ballsRef.current.length - 1; i >= 0; i--) {
        const ball = ballsRef.current[i];
        ball.update(speed);
        
        if (ball.isDone) {
          const mult = MULTIPLIERS[rows][risk][ball.currentC - 1];
          const winAmount = ball.value * mult;
          onWin(winAmount, mult);
          ballsRef.current.splice(i, 1);
          continue;
        }
        
        // Draw ball
        ctx.fillStyle = '#a855f7'; // purple-500
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#d946ef'; // fuchsia-500
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    return () => cancelAnimationFrame(animationRef.current);
  }, [rows, risk, onWin]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );
});

PlinkoBoard.displayName = 'PlinkoBoard';
