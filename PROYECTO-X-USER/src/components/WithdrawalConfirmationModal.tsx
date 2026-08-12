
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  txId: string;
  amount: number;
}

const WithdrawalConfirmationModal: React.FC<Props> = ({ isOpen, onClose, txId, amount }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="blue-glass border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative translate-y-[-5%] sm:translate-y-0">
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-geminix-green/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-geminix-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{t('withdrawal.modal.title')}</h2>
          <p className="text-slate-400 text-sm mb-6 px-4">
            {t('withdrawal.modal.success_text', { amount: amount.toFixed(2) })}
          </p>

          <div className="bg-slate-900/50 rounded-xl p-4 mb-6 border border-slate-800 text-left space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 uppercase tracking-widest font-bold">{t('withdrawal.modal.tx_id')}</span>
              <span className="text-geminix-accent font-mono">#{txId.slice(-8)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 uppercase tracking-widest font-bold">{t('withdrawal.modal.status')}</span>
              <span className="flex items-center text-geminix-gold font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-geminix-gold mr-2 animate-pulse"></span>
                {t('withdrawal.modal.pending')}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 leading-relaxed mb-8">
            {t('withdrawal.modal.compliance_note')}
            <br />
            {t('withdrawal.modal.eta')}
            <br />
            {t('withdrawal.modal.notification_note')}
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 gold-gradient text-slate-950 font-bold rounded-xl hover:opacity-90 transition-all shadow-lg"
          >
            {t('withdrawal.modal.back_button')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WithdrawalConfirmationModal;
