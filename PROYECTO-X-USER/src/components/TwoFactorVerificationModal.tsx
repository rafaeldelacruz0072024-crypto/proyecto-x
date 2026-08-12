
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => void;
  isLoading?: boolean;
}

const TwoFactorVerificationModal: React.FC<Props> = ({ isOpen, onClose, onVerify, isLoading }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onVerify(code.join(''));
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="blue-glass border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden animate-fade-in shadow-2xl">
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-geminix-accent/10 border border-geminix-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-xl font-black text-white mb-2 uppercase tracking-widest">{t('auth.2fa_modal.title')}</h2>
          <p className="text-slate-500 text-[10px] mb-8 uppercase font-bold tracking-tighter">
            {t('auth.2fa_modal.desc')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex justify-between gap-2">
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  // Added curly braces to ensure the ref callback returns void
                  ref={el => { inputs.current[idx] = el; }}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(idx, e.target.value)}
                  onKeyDown={e => handleKeyDown(idx, e)}
                  disabled={isLoading}
                  className="w-10 h-14 bg-slate-950 border border-slate-800 rounded-xl text-center text-xl font-black text-geminix-accent focus:outline-none focus:border-geminix-accent focus:ring-1 focus:ring-geminix-accent/20 transition-all"
                />
              ))}
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || code.some(d => !d)}
                className="w-full py-4 blue-brand-gradient text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-geminix-brand/20 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isLoading ? t('auth.2fa_modal.verifying') : t('auth.2fa_modal.button')}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-[9px] font-black text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-colors"
              >
                {t('auth.2fa_modal.cancel')}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info line */}
        <div className="bg-slate-950/50 py-3 px-8 border-t border-slate-900 text-center">
          <p className="text-[8px] text-slate-700 font-bold uppercase tracking-widest">{t('auth.2fa_modal.footer')}</p>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerificationModal;
