import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'blue' | 'white' | 'icon';
  glow?: boolean;
}

const Logo: React.FC<Props> = ({ size = 'md', className = '', glow = false }) => {
  const dimensions = {
    sm:  { img: 'w-12 h-12 md:w-14 md:h-14', glow: 'w-14 h-14 md:w-16 md:h-16' },
    md:  { img: 'w-28 h-28 md:w-36 md:h-36', glow: 'w-32 h-32 md:w-40 md:h-40' },
    lg:  { img: 'w-40 h-40 md:w-52 md:h-52', glow: 'w-44 h-44 md:w-56 md:h-56' },
    xl:  { img: 'w-56 h-56 md:w-72 md:h-72', glow: 'w-60 h-60 md:w-80 md:h-80' },
  };

  return (
    <div className={`relative flex-shrink-0 flex items-center justify-center group select-none ${dimensions[size].glow} ${className}`}>
      {/* Glow halo */}
      {glow && (
        <div className="absolute inset-0 rounded-full bg-white blur-2xl opacity-10 animate-pulse-slow group-hover:opacity-25 transition-opacity duration-700 pointer-events-none" />
      )}

      <img
        src="/logo-new.png.png"
        alt="PROYECTO X"
        className={`${dimensions[size].img} object-contain relative z-10 transition-transform duration-700 group-hover:scale-105 drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]`}
      />
    </div>
  );
};

export default Logo;
