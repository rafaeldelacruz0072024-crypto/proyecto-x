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
        <div className={`flex items-center gap-1 bg-slate-950/60 p-1 border border-slate-800/80 rounded-xl ${className}`}>
            <button
                type="button"
                onClick={() => changeLanguage('es')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-[9px] tracking-wider uppercase transition-all duration-300 ${
                    currentLang === 'es'
                        ? 'bg-phyzer-gold/15 text-phyzer-gold border border-phyzer-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
            >
                <span className="text-[11px]">🇪🇸</span> ES
            </button>
            <button
                type="button"
                onClick={() => changeLanguage('en')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-[9px] tracking-wider uppercase transition-all duration-300 ${
                    currentLang === 'en'
                        ? 'bg-phyzer-gold/15 text-phyzer-gold border border-phyzer-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.15)]'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
            >
                <span className="text-[11px]">🇺🇸</span> EN
            </button>
        </div>
    );
};

export default LanguageSwitcher;
