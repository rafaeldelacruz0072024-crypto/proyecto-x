import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  txId: string;
  hash?: string;
}

const DepositConfirmationModal: React.FC<Props> = ({ isOpen, onClose, amount, txId, hash }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="blue-glass border border-slate-800 rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.2)] relative translate-y-[-5%] sm:translate-y-0">
        <div className="p-8 text-center">
          {/* Animated Success Icon */}
          <div className="w-20 h-20 bg-proyecto-green/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-proyecto-green/30 relative">
            <div className="absolute inset-0 rounded-full bg-proyecto-green/20 animate-ping opacity-20"></div>
            <svg className="w-10 h-10 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">{t('deposit.success_modal.title')}</h2>
          <p className="text-slate-400 text-[10px] mb-8 uppercase font-bold tracking-widest leading-relaxed">
            {t('deposit.success_modal.amount_text', { amount: amount.toLocaleString('en-US') })} <br /> <span className="text-white">{t('deposit.success_modal.ledger_name')}</span>.
          </p>

          <div className="bg-slate-950/80 rounded-2xl p-5 mb-8 border border-slate-900 text-left space-y-4">
            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t('deposit.success_modal.ledger_id')}</span>
              <span className="text-proyecto-accent font-mono text-[10px] font-black tracking-tighter">TX-{txId.slice(-8).toUpperCase()}</span>
            </div>

            {hash && (
              <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t('deposit.success_modal.hash_id')}</span>
                <span className="text-white font-mono text-[8px] font-black tracking-tighter truncate ml-4 max-w-[150px]">{hash}</span>
              </div>
            )}

            <div className="flex justify-between items-center border-b border-slate-900 pb-3">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t('deposit.success_modal.node_status')}</span>
              <span className="flex items-center text-proyecto-green text-[9px] font-black uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-proyecto-green mr-2 animate-pulse"></span>
                {t('deposit.success_modal.synced')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black">{t('deposit.success_modal.asset')}</span>
              <span className="text-white text-[9px] font-black uppercase tracking-tighter">USDT (BEP-20)</span>
            </div>
          </div>

          <div className="text-[9px] text-slate-600 leading-relaxed mb-8 uppercase font-bold tracking-tighter">
            {t('deposit.success_modal.footer_text')}
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 blue-brand-gradient text-white font-black text-xs uppercase tracking-[0.3em] rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-proyecto-brand/20"
          >
            {t('deposit.success_modal.back_button')}
          </button>
        </div>

        <div className="bg-slate-950/50 py-3 text-center border-t border-slate-900/50">
          <span className="text-[7px] font-black text-slate-800 uppercase tracking-[0.5em]">Proyecto X Network Infrastructure • Security Verified</span>
        </div>
      </div>
    </div>
  );
};

export default DepositConfirmationModal;
