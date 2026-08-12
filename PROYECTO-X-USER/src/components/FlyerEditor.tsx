import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Download, RefreshCw, Sparkles, ImageIcon } from 'lucide-react';

// ─── Deterministic stars (same every render) ────────────────────────────────
const STARS = Array.from({ length: 240 }, (_, i) => ({
    x: ((i * 1103515245 + 12345) >>> 0) % 1080,
    y: ((i * 6364136 + 1442695) >>> 0) % 1080,
    r: [1.6, 1.1, 0.7, 0.4][i % 4],
    op: 0.15 + (i % 9) * 0.085,
}));

// ─── Color themes ───────────────────────────────────────────────────────────
const THEMES = [
    {
        id: 'purple',
        name: 'Púrpura Espacial',
        swatch: '#bc13fe',
        bg0: '#0a0018', bg1: '#16003a', bg2: '#050010',
        ring: '#bc13fe', ring2: '#6600cc',
        glow: '#00f3ff',
        accent: '#ff69b4',
        badge: '#00d4c8', badgeText: '#002220',
        logo: '#bc13fe',
    },
    {
        id: 'blue',
        name: 'Azul Neon',
        swatch: '#0077ff',
        bg0: '#000c20', bg1: '#001840', bg2: '#000510',
        ring: '#0077ff', ring2: '#003399',
        glow: '#00f3ff',
        accent: '#00c8ff',
        badge: '#0055ff', badgeText: '#ffffff',
        logo: '#00aaff',
    },
    {
        id: 'gold',
        name: 'Dorado Premium',
        swatch: '#ffd700',
        bg0: '#0e0800', bg1: '#1c1000', bg2: '#080400',
        ring: '#ffd700', ring2: '#cc7700',
        glow: '#ffdd44',
        accent: '#ff9900',
        badge: '#ffd700', badgeText: '#0a0400',
        logo: '#ffd700',
    },
    {
        id: 'green',
        name: 'Verde Matrix',
        swatch: '#00ff9d',
        bg0: '#000e08', bg1: '#001a10', bg2: '#000805',
        ring: '#00ff9d', ring2: '#009944',
        glow: '#00ff9d',
        accent: '#00ffcc',
        badge: '#00cc77', badgeText: '#001508',
        logo: '#00ff9d',
    },
];

const W = 1080;

// ─── Common flag emojis ──────────────────────────────────────────────────────
const FLAGS = [
    { code: '🇩🇴', name: 'Rep. Dominicana' },
    { code: '🇺🇸', name: 'Estados Unidos' },
    { code: '🇲🇽', name: 'México' },
    { code: '🇨🇴', name: 'Colombia' },
    { code: '🇻🇪', name: 'Venezuela' },
    { code: '🇵🇪', name: 'Perú' },
    { code: '🇦🇷', name: 'Argentina' },
    { code: '🇨🇱', name: 'Chile' },
    { code: '🇪🇨', name: 'Ecuador' },
    { code: '🇧🇴', name: 'Bolivia' },
    { code: '🇵🇾', name: 'Paraguay' },
    { code: '🇺🇾', name: 'Uruguay' },
    { code: '🇵🇦', name: 'Panamá' },
    { code: '🇨🇷', name: 'Costa Rica' },
    { code: '🇬🇹', name: 'Guatemala' },
    { code: '🇭🇳', name: 'Honduras' },
    { code: '🇸🇻', name: 'El Salvador' },
    { code: '🇳🇮', name: 'Nicaragua' },
    { code: '🇨🇺', name: 'Cuba' },
    { code: '🇵🇷', name: 'Puerto Rico' },
    { code: '🇭🇹', name: 'Haití' },
    { code: '🇧🇷', name: 'Brasil' },
    { code: '🇪🇸', name: 'España' },
    { code: '🇵🇹', name: 'Portugal' },
    { code: '🇫🇷', name: 'Francia' },
    { code: '🇩🇪', name: 'Alemania' },
    { code: '🇮🇹', name: 'Italia' },
    { code: '🇬🇧', name: 'Reino Unido' },
    { code: '🇷🇴', name: 'Rumanía' },
    { code: '🇨🇦', name: 'Canadá' },
];

// ─── Core draw function ─────────────────────────────────────────────────────
function drawFlyer(
    canvas: HTMLCanvasElement,
    photo: HTMLImageElement | null,
    name: string,
    t: typeof THEMES[0],
    logo: HTMLImageElement | null,
    country: string,
) {
    const ctx = canvas.getContext('2d')!;
    canvas.width = W;
    canvas.height = W;

    // — Background ————————————————————————————————
    const bg = ctx.createRadialGradient(W * 0.55, W * 0.38, 0, W * 0.5, W * 0.5, W * 0.9);
    bg.addColorStop(0, t.bg1);
    bg.addColorStop(0.55, t.bg0);
    bg.addColorStop(1, t.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, W);

    // — Stars ——————————————————————————————————————
    STARS.forEach(s => {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.op})`;
        ctx.fill();
    });

    // — Big glowing ring (right) ——————————————————
    const rx = W * 0.62, ry = W * 0.39, rr = 310;
    // halo layers
    [50, 30, 18, 10].forEach((blur, i) => {
        ctx.beginPath();
        ctx.arc(rx, ry, rr + i * 4, 0, Math.PI * 2);
        ctx.strokeStyle = t.ring;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.12 / (i + 1);
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.strokeStyle = t.ring;
    ctx.lineWidth = 10;
    ctx.shadowColor = t.ring;
    ctx.shadowBlur = 35;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // inner ring
    ctx.beginPath();
    ctx.arc(rx, ry, rr - 52, 0, Math.PI * 2);
    ctx.strokeStyle = t.ring2 + '55';
    ctx.lineWidth = 3;
    ctx.stroke();

    // — Small decorative ring (bottom right) ——————
    ctx.beginPath();
    ctx.arc(W * 0.66, W * 0.79, 115, 0, Math.PI * 2);
    ctx.strokeStyle = t.ring + '38';
    ctx.lineWidth = 5;
    ctx.stroke();

    // — Diamonds ——————————————————————————————————
    const diamond = (x: number, y: number, sz: number, color: string) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = color;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        ctx.restore();
    };
    diamond(72, 690, 18, t.glow + '80');
    diamond(W - 72, 610, 14, t.ring + '80');
    diamond(W - 110, 860, 11, t.accent + '60');
    diamond(100, 910, 16, t.ring2 + '60');
    diamond(W * 0.5, 980, 8, t.glow + '40');

    // — GK GEMINIX Logo (top right, drawn via Canvas) ————————————
    ctx.save();
    const lx = W - 30;
    // "GK" large
    ctx.textAlign = 'right';
    ctx.font = `900 72px 'Arial Black', Arial, sans-serif`;
    ctx.shadowColor = t.logo;
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GK', lx, 88);
    // "GEMINIX" smaller, spaced
    ctx.shadowBlur = 10;
    ctx.font = `800 18px 'Arial Black', Arial, sans-serif`;
    ctx.fillStyle = t.logo;
    ctx.letterSpacing = '4px';
    ctx.fillText('G E M I N I X', lx, 112);
    ctx.letterSpacing = '0px';
    // decorative line
    ctx.shadowBlur = 0;
    ctx.strokeStyle = t.logo + 'aa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx - 162, 122);
    ctx.lineTo(lx, 122);
    ctx.stroke();
    ctx.restore();

    // — Photo circle (left) ————————————————————————
    const px = W * 0.285, py = W * 0.385, pr = 200;
    // glow halo
    [8, 5, 3].forEach((extra, i) => {
        ctx.beginPath();
        ctx.arc(px, py, pr + extra + i * 5, 0, Math.PI * 2);
        ctx.strokeStyle = t.glow + ['25', '40', '60'][i];
        ctx.lineWidth = 3;
        ctx.stroke();
    });
    // border ring
    ctx.beginPath();
    ctx.arc(px, py, pr + 6, 0, Math.PI * 2);
    ctx.strokeStyle = t.glow;
    ctx.lineWidth = 5;
    ctx.shadowColor = t.glow;
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // clip + fill photo
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.clip();
    if (photo) {
        // Cover-fit: scale to fill circle
        const s = (pr * 2) / Math.min(photo.naturalWidth, photo.naturalHeight);
        const dw = photo.naturalWidth * s;
        const dh = photo.naturalHeight * s;
        ctx.drawImage(photo, px - dw / 2, py - dh / 2, dw, dh);
    } else {
        const ph = ctx.createRadialGradient(px, py, 0, px, py, pr);
        ph.addColorStop(0, '#2a1545');
        ph.addColorStop(1, '#10082a');
        ctx.fillStyle = ph;
        ctx.fill();
        ctx.font = 'bold 70px serif';
        ctx.fillStyle = t.ring + '88';
        ctx.textAlign = 'center';
        ctx.fillText('📷', px, py + 24);
        ctx.font = 'bold 20px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText('Subir foto', px, py + 80);
    }
    ctx.restore();

    // — Country flag badge (over photo, bottom-right) —————————
    if (country) {
        const fx = px + pr * 0.68, fy = py + pr * 0.70;
        ctx.beginPath();
        ctx.arc(fx, fy, 44, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = '50px serif';
        ctx.textAlign = 'center';
        ctx.fillText(country, fx, fy + 17);
    }

    // — BIENVENIDOS ————————————————————————————————
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 18;
    ctx.font = `900 92px Orbitron, 'Arial Black', Impact, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BIENVENIDOS', W / 2, W * 0.665);
    ctx.shadowBlur = 0;

    // — al equipo ——————————————————————————————————
    ctx.font = `italic bold 62px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = t.accent;
    ctx.shadowColor = t.accent + '88';
    ctx.shadowBlur = 14;
    ctx.fillText('al equipo', W / 2 + 50, W * 0.748);
    ctx.shadowBlur = 0;

    // — Name badge pill ————————————————————————————
    const label = name.trim() || 'Nombre del Socio';
    // Auto-scale font based on length
    const nameFontSize = Math.min(52, Math.max(28, Math.floor(480 / Math.max(label.length, 8))));
    ctx.font = `900 ${nameFontSize}px Orbitron, 'Arial Black', sans-serif`;
    const tw = ctx.measureText(label).width;
    const bw = Math.max(420, tw + 110);
    const bh = 80, bx = W / 2 - bw / 2, by = W * 0.820, brad = 40;
    ctx.shadowColor = t.badge + '70';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    ctx.moveTo(bx + brad, by);
    ctx.lineTo(bx + bw - brad, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + brad);
    ctx.lineTo(bx + bw, by + bh - brad);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - brad, by + bh);
    ctx.lineTo(bx + brad, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - brad);
    ctx.lineTo(bx, by + brad);
    ctx.quadraticCurveTo(bx, by, bx + brad, by);
    ctx.closePath();
    ctx.fillStyle = t.badge;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = t.badgeText;
    ctx.font = `900 ${nameFontSize}px Orbitron, 'Arial Black', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, W / 2, by + nameFontSize * 0.72 + (bh - nameFontSize) / 2);

    // — Stats bar (bottom) ————————————————————————
    const statsY = W * 0.910;
    const barH = W - statsY;
    // Background
    const barBg = ctx.createLinearGradient(0, statsY, 0, W);
    barBg.addColorStop(0, 'rgba(0,0,0,0.75)');
    barBg.addColorStop(1, 'rgba(0,0,0,0.92)');
    ctx.fillStyle = barBg;
    ctx.fillRect(0, statsY, W, barH);
    // Top border line
    ctx.strokeStyle = t.ring + '60';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, statsY);
    ctx.lineTo(W, statsY);
    ctx.stroke();

    const stats = [
        { value: '2.2%',  label: 'DAILY RETURNS',     color: t.glow },
        { value: '200%',  label: 'MAX CAP',            color: t.ring },
        { value: '30',    label: 'REFERRAL LEVELS',    color: t.accent },
        { value: '$30K',  label: 'MAX WEEKLY SALARY',  color: t.badge },
    ];
    const colW = W / 4;
    stats.forEach((stat, i) => {
        const cx = colW * i + colW / 2;
        // Divider
        if (i > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colW * i, statsY + 14);
            ctx.lineTo(colW * i, W - 14);
            ctx.stroke();
        }
        // Value
        ctx.textAlign = 'center';
        ctx.font = `900 48px Orbitron, 'Arial Black', sans-serif`;
        ctx.fillStyle = stat.color;
        ctx.shadowColor = stat.color;
        ctx.shadowBlur = 14;
        ctx.fillText(stat.value, cx, statsY + 60);
        ctx.shadowBlur = 0;
        // Label
        ctx.font = `700 12px Orbitron, Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(stat.label, cx, statsY + 82);
    });

}

// ═══════════════════════════════════════════════════════════════════════════
export default function FlyerEditor() {
    const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [country, setCountry] = useState('');
    const [themeIdx, setThemeIdx] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const theme = THEMES[themeIdx];

    const redraw = useCallback(() => {
        if (!canvasRef.current) return;
        document.fonts.ready.then(() => {
            drawFlyer(canvasRef.current!, photoImg, name, theme, null, country);
        });
    }, [photoImg, name, theme, country]);

    useEffect(() => { redraw(); }, [redraw]);

    function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setPhotoUrl(url);
        const img = new Image();
        img.onload = () => setPhotoImg(img);
        img.src = url;
    }

    function handleDownload() {
        if (!canvasRef.current) return;
        setDownloading(true);
        setTimeout(() => {
            const link = document.createElement('a');
            link.download = `Bienvenido_${name.trim() || 'Geminix'}.png`;
            link.href = canvasRef.current!.toDataURL('image/png', 1.0);
            link.click();
            setDownloading(false);
        }, 80);
    }

    function handleReset() {
        setPhotoImg(null);
        setPhotoUrl(null);
        setName('');
        setCountry('');
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-geminix-accent/10 border border-geminix-accent/20 flex items-center justify-center">
                    <Sparkles size={18} className="text-geminix-accent" />
                </div>
                <div>
                    <h2 className="text-sm font-orbitron font-black text-white uppercase tracking-widest">
                        Generador de Flyer · Bienvenida al Equipo
                    </h2>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                        Personaliza · Descarga en HD 1080×1080 px · Comparte en redes sociales
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ── Left: controls ── */}
                <div className="space-y-5">

                    {/* Photo upload */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            1. Foto del Socio
                        </label>
                        <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-white/10 hover:border-geminix-accent/40 clip-corner cursor-pointer transition-all group bg-black/20 min-h-[140px]">
                            {photoUrl ? (
                                <>
                                    <img src={photoUrl} alt="" className="w-24 h-24 object-cover rounded-full border-2 border-geminix-accent shadow-[0_0_16px_rgba(0,243,255,0.3)]" />
                                    <span className="text-[9px] text-geminix-accent font-black uppercase tracking-widest">
                                        ✅ Foto cargada · Click para cambiar
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-geminix-accent/30 transition-all">
                                        <Upload size={22} className="text-slate-600 group-hover:text-geminix-accent transition-colors" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-slate-400 font-bold">Click para subir foto</p>
                                        <p className="text-[9px] text-slate-600">JPG · PNG · WEBP · HEIC</p>
                                    </div>
                                </>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                        </label>
                    </div>

                    {/* Country Flag */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            2. País / Bandera del Socio
                        </label>
                        <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                            <button
                                onClick={() => setCountry('')}
                                className={`flex items-center gap-2 px-3 py-2 clip-corner-sm border text-[9px] font-black uppercase transition-all ${
                                    country === '' ? 'border-geminix-accent bg-geminix-accent/10 text-white' : 'border-white/8 bg-black/20 text-slate-500 hover:text-white'
                                }`}
                            >
                                <span className="text-base">🌐</span> Sin bandera
                            </button>
                            {FLAGS.map(f => (
                                <button
                                    key={f.code}
                                    onClick={() => setCountry(f.code)}
                                    className={`flex items-center gap-2 px-3 py-2 clip-corner-sm border text-[9px] font-black transition-all ${
                                        country === f.code ? 'border-geminix-accent bg-geminix-accent/10 text-white' : 'border-white/8 bg-black/20 text-slate-500 hover:text-white'
                                    }`}
                                >
                                    <span className="text-base">{f.code}</span>
                                    <span className="truncate">{f.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            3. Nombre del Socio
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Ej: Cristian Marmolejos"
                            maxLength={36}
                            className="w-full bg-black/40 border border-white/10 clip-corner-sm px-4 py-4 text-white text-sm font-bold outline-none focus:border-geminix-accent/50 transition-all placeholder:text-slate-700 font-mono"
                        />
                        <p className="text-[8px] text-slate-700 font-mono text-right">{name.length}/36</p>
                    </div>

                    {/* Theme */}
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                            4. Tema de Color
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {THEMES.map((th, i) => (
                                <button
                                    key={th.id}
                                    onClick={() => setThemeIdx(i)}
                                    className={`p-3 text-center clip-corner-sm border transition-all ${
                                        themeIdx === i
                                            ? 'border-geminix-accent bg-geminix-accent/10'
                                            : 'border-white/8 bg-black/20 hover:border-white/20'
                                    }`}
                                >
                                    <div
                                        className="w-7 h-7 rounded-full mx-auto mb-1.5 border border-black/30"
                                        style={{
                                            background: `radial-gradient(circle at 40% 40%, ${th.ring}cc, ${th.ring2})`,
                                            boxShadow: themeIdx === i ? `0 0 12px ${th.ring}` : 'none',
                                        }}
                                    />
                                    <p className={`text-[8px] font-black uppercase leading-tight ${themeIdx === i ? 'text-white' : 'text-slate-600'}`}>
                                        {th.name}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            onClick={handleReset}
                            className="py-4 bg-white/5 hover:bg-white/8 border border-white/8 clip-corner-sm text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={12} /> Limpiar
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="py-4 blue-brand-gradient text-white clip-corner-sm shadow-neon-cyan text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40"
                        >
                            {downloading
                                ? <><RefreshCw size={12} className="animate-spin" /> Exportando...</>
                                : <><Download size={12} /> Descargar HD</>
                            }
                        </button>
                    </div>

                    {/* Tips */}
                    <div className="p-4 bg-black/30 border border-white/5 clip-corner-sm">
                        <p className="text-[9px] font-black text-geminix-accent uppercase tracking-widest mb-2">💡 Consejos</p>
                        <ul className="space-y-1 text-[9px] text-slate-500 leading-relaxed font-mono">
                            <li>· Usa fotos con el socio centrado y con buena luz</li>
                            <li>· Funciona mejor con fotos de perfil o retrato</li>
                            <li>· El flyer es 1080×1080 px — perfecto para Instagram y WhatsApp</li>
                            <li>· Comparte con el hashtag <span className="text-geminix-accent">#GeminixTeam</span></li>
                        </ul>
                    </div>
                </div>

                {/* ── Right: canvas preview ── */}
                <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center justify-between w-full">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                            <ImageIcon size={10} /> Vista previa en vivo
                        </p>
                        <p className="text-[8px] text-slate-700 font-mono">1080 × 1080 px</p>
                    </div>
                    <div className="w-full max-w-[480px] border border-white/10 clip-corner overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)]">
                        <canvas
                            ref={canvasRef}
                            style={{ width: '100%', aspectRatio: '1 / 1', display: 'block' }}
                        />
                    </div>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="w-full max-w-[480px] py-3.5 blue-brand-gradient text-white clip-corner shadow-neon-cyan text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                        {downloading
                            ? <><RefreshCw size={12} className="animate-spin" /> Exportando PNG...</>
                            : <><Download size={12} /> Descargar Flyer HD</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
