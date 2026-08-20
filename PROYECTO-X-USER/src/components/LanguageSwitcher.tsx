import React from 'react';
import { useTranslation } from 'react-i18next';

interface LanguageSwitcherProps {
    className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = "" }) => {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('i18nextLng', lng);
    };

    const currentLang = i18n.language?.startsWith('es') ? 'es' : 'en';

    return (
        <div className={`flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-0.5 sm:gap-1 sm:p-1 ${className}`}>
            <button
                type="button"
                onClick={() => changeLanguage('es')}
                className={`flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all duration-300 sm:gap-1.5 sm:px-3 ${
                    currentLang === 'es'
                        ? 'bg-phyzer-gold/15 text-phyzer-gold border border-phyzer-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
            >
                <span className="hidden text-[11px] sm:inline">🇪🇸</span> ES
            </button>
            <button
                type="button"
                onClick={() => changeLanguage('en')}
                className={`flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all duration-300 sm:gap-1.5 sm:px-3 ${
                    currentLang === 'en'
                        ? 'bg-phyzer-gold/15 text-phyzer-gold border border-phyzer-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
            >
                <span className="hidden text-[11px] sm:inline">🇺🇸</span> EN
            </button>
        </div>
    );
};

export default LanguageSwitcher;
