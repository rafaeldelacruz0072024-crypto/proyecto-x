import React from 'react';

interface Props {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    variant?: 'blue' | 'white' | 'icon';
    glow?: boolean;
}

const Logo: React.FC<Props> = ({ size = 'md', className = '', variant = 'white', glow = false }) => {
    const dimensions = {
        sm: 'w-16 h-16 md:w-20 md:h-20',
        md: 'w-32 h-32 md:w-40 md:h-40',
        lg: 'w-48 h-48 md:w-60 md:h-60',
        xl: 'w-64 h-64 md:w-80 md:h-80'
    };

    const isBlue = variant === 'blue';

    return (
        <div className={`${dimensions[size]} ${className} relative flex flex-col items-center justify-center flex-shrink-0 group perspective-1000 select-none`}>
            {/* Background Glows */}
            <div className={`absolute inset-0 rounded-full blur-[40px] mix-blend-screen transition-all duration-700 ${glow || isBlue ? 'opacity-40 animate-pulse-slow' : 'opacity-0'} bg-[#ffffff]`}></div>
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full blur-[20px] mix-blend-screen transition-all duration-500 bg-[#ffffff] opacity-0 group-hover:opacity-40`}></div>

            {/* Ultra Premium SVG Logo (Isometric GK based on user image) */}
            <svg
                viewBox="0 0 400 300"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto relative z-10 transition-transform duration-700 group-hover:scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
            >
                <defs>
                    <linearGradient id="gkIsometricGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="70%" stopColor="#f8fafc" />
                        <stop offset="100%" stopColor="#cbd5e1" />
                    </linearGradient>
                    {/* Inner Shadow Filter for 3D effect */}
                    <filter id="insetShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset dx="2" dy="4" />
                        <feGaussianBlur stdDeviation="3" result="offset-blur" />
                        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                        <feFlood floodColor="black" floodOpacity="0.5" result="color" />
                        <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                        <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                    </filter>
                </defs>

                <g transform="translate(60, 20) scale(1.1)">
                    {/* G Layer */}
                    <path
                        d="M 120 180 
               L 50 180 
               L 15 130 
               L 15 80 
               L 70 20 
               L 170 20 
               L 150 50 
               L 80 50 
               L 45 90 
               L 45 120 
               L 70 150 
               L 110 150 
               L 140 120 
               L 95 120 
               L 105 100 
               L 175 100 
               L 190 120
               Z"
                        fill="url(#gkIsometricGrad)"
                        filter="url(#insetShadow)"
                    />

                    {/* K Layer */}
                    <path
                        d="M 160 85 
               L 200 25 
               L 245 25 
               L 190 90
               Z"
                        fill="url(#gkIsometricGrad)"
                        filter="url(#insetShadow)"
                    />

                    <path
                        d="M 170 125 
               L 200 125 
               L 245 190 
               L 205 190
               Z"
                        fill="url(#gkIsometricGrad)"
                        filter="url(#insetShadow)"
                    />
                </g>

                {/* Text Area */}
                <text
                    x="200"
                    y="280"
                    fontFamily="Orbitron, Arial, sans-serif"
                    fontSize="48"
                    fontWeight="900"
                    fill="url(#gkIsometricGrad)"
                    textAnchor="middle"
                    letterSpacing="0.1em"
                    className="drop-shadow-[0_4px_10px_rgba(255,255,255,0.3)]"
                >
                    NOVA DIGITAL
                </text>
            </svg>
        </div>
    );
};
export default Logo;
