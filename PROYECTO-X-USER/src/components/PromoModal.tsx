import React, { useEffect, useState } from 'react';

interface PromoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PromoModal: React.FC<PromoModalProps> = ({ isOpen, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Pequeno delay para animacion de entrada
      const timer = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-all duration-500 ${isVisible ? 'bg-black/80 backdrop-blur-md opacity-100' : 'bg-transparent opacity-0 pointer-events-none'}`}>
      <div className={`relative max-w-md w-full bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-proyecto-accent/30 transition-all duration-500 transform ${isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-10 opacity-0'}`}>
        
        {/* Boton Cerrar Superior */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500/80 hover:text-white backdrop-blur-sm transition-colors border border-white/10"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Contenido de la Imagen Promocional */}
        <div className="relative aspect-[4/5] w-full bg-slate-900 flex items-center justify-center overflow-hidden group">
          <img 
            src="/promo-special-edition.jpg" 
            alt="NOVA Digital Special Edition Promo"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              // Fallback visual en caso de que no se haya subido la imagen
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('fallback-promo');
            }}
          />
          
          {/* Fallback si la imagen no existe */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 hidden [.fallback-promo_&]:flex bg-gradient-to-br from-purple-900/40 to-blue-900/40">
            <div className="w-16 h-16 rounded-full bg-proyecto-accent/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
            <h3 className="text-2xl font-orbitron font-black text-white uppercase tracking-widest mb-2">NOVA DIGITAL<br/><span className="text-proyecto-accent">SPECIAL EDITION</span></h3>
            <p className="text-xs text-slate-300 font-mono-tech">¡Por favor guarda tu imagen como "promo-special-edition.jpg" en la carpeta public!</p>
          </div>
        </div>

        {/* Panel inferior con boton */}
        <div className="p-4 bg-slate-950 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromoModal;
