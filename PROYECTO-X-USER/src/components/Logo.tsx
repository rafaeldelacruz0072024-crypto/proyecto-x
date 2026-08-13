import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'blue' | 'white' | 'icon';
  glow?: boolean;
}

const Logo: React.FC<Props> = ({ size = 'md', className = '', glow = false }) => {
  const dimensions = {
    sm:  { mark: 'w-10 h-10', name: 'text-sm tracking-[0.18em]', glow: 'w-14 h-14 md:w-16 md:h-16' },
    md:  { mark: 'w-14 h-14', name: 'text-xl tracking-[0.2em]', glow: 'w-40 h-14' },
    lg:  { mark: 'w-20 h-20', name: 'text-3xl tracking-[0.22em]', glow: 'w-56 h-20' },
    xl:  { mark: 'w-28 h-28', name: 'text-5xl tracking-[0.24em]', glow: 'w-80 h-28' },
  };

  return (
    <div className={`relative flex-shrink-0 flex items-center justify-center group select-none ${dimensions[size].glow} ${className}`}>
      {/* Glow halo */}
      {glow && (
        <div className="absolute inset-0 rounded-full bg-white blur-2xl opacity-10 animate-pulse-slow group-hover:opacity-25 transition-opacity duration-700 pointer-events-none" />
      )}

      <div className="relative z-10 flex items-center gap-3 text-white transition-transform duration-700 group-hover:scale-105">
        <svg viewBox="0 0 64 64" aria-hidden="true" className={`${dimensions[size].mark} shrink-0 drop-shadow-[0_0_18px_rgba(0,243,255,0.5)]`}>
          <path d="M12 52V12l40 40V12" fill="none" stroke="url(#nova-gradient)" strokeWidth="7" strokeLinecap="square" strokeLinejoin="round" />
          <path d="M17 47V20l30 27V20" fill="none" stroke="rgba(255,255,255,.92)" strokeWidth="2.5" strokeLinejoin="round" />
          <defs>
            <linearGradient id="nova-gradient" x1="10" y1="12" x2="54" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e0f2fe" />
              <stop offset=".45" stopColor="#00f3ff" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="leading-none text-left">
          <div className={`${dimensions[size].name} font-black uppercase text-white`}>NOVA</div>
          <div className="mt-1 text-[0.42rem] font-bold uppercase tracking-[0.38em] text-cyan-200/80">Digital</div>
        </div>
      </div>
    </div>
  );
};

export default Logo;
