
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionStatus } from '../types';

export interface MockEmail {
  id: string;
  type: 'WITHDRAWAL' | 'DEPOSIT';
  subject: string;
  amount: number;
  method: string;
  address: string;
  txId: string;
  date: Date;
  isConfirmed: boolean;
}

interface Props {
  emails: MockEmail[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (txId: string, emailId: string) => void;
}

const MockEmailInbox: React.FC<Props> = ({ emails, isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-proyecto-gold" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{t('mock_email.title')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-950/50 custom-scrollbar">
          {emails.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500">
              <p className="text-xs font-black uppercase tracking-widest">{t('mock_email.empty')}</p>
            </div>
          ) : (
            [...emails].sort((a, b) => b.date.getTime() - a.date.getTime()).map((email) => (
              <div key={email.id} className={`border rounded-xl transition-all ${email.isConfirmed ? 'bg-slate-900/30 border-slate-800 opacity-80' : 'bg-slate-900 border-slate-700 shadow-lg'}`}>
                <div className="p-6">
                  {/* Email Header Info */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${email.type === 'DEPOSIT' ? 'bg-proyecto-green/10 border-proyecto-green/20 text-proyecto-green' : 'bg-proyecto-gold/10 border-proyecto-gold/20 text-proyecto-gold'}`}>
                        {email.type === 'DEPOSIT' ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </div>
                      <div>
                        <h4 className={`font-bold text-lg leading-tight ${email.type === 'DEPOSIT' ? 'text-proyecto-green' : 'text-proyecto-gold'}`}>{email.subject}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{t('mock_email.received')}: {email.date.toLocaleString('en-US')}</p>
                      </div>
                    </div>
                    {email.isConfirmed ? (
                      <span className="bg-proyecto-green/10 text-proyecto-green text-[9px] font-black px-2.5 py-1 rounded-full border border-proyecto-green/20 uppercase tracking-tighter">{t('mock_email.status.confirmed')}</span>
                    ) : (
                      <span className="bg-proyecto-gold/10 text-proyecto-gold text-[9px] font-black px-2.5 py-1 rounded-full border border-proyecto-gold/20 uppercase tracking-tighter animate-pulse">{t('mock_email.status.pending')}</span>
                    )}
                  </div>

                  {/* Email Body */}
                  <div className="space-y-4 mb-6">
                    <p className="text-sm text-slate-300 font-medium">{t('mock_email.greeting', { name: 'Alex Sterling' })}</p>

                    {email.type === 'WITHDRAWAL' ? (
                      <>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {t('mock_email.withdrawal.desc')}
                        </p>
                        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">{t('mock_email.withdrawal.amount_label')}</span>
                            <span className="text-white font-black">${email.amount.toFixed(2)} USDT</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">{t('mock_email.withdrawal.status_label')}</span>
                            <span className={`font-black ${email.isConfirmed ? 'text-proyecto-green' : 'text-proyecto-gold'}`}>
                              {email.isConfirmed ? t('mock_email.status.confirmed') : t('mock_email.status.pending_review')}
                            </span>
                          </div>
                        </div>
                        {!email.isConfirmed ? (
                          <button
                            onClick={() => onConfirm(email.txId, email.id)}
                            className="w-full py-4 gold-gradient text-slate-900 font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-proyecto-gold/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                          >
                            {t('mock_email.withdrawal.button')}
                          </button>
                        ) : (
                          <div className="text-center py-3 border border-dashed border-slate-700 rounded-xl text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
                            {t('mock_email.withdrawal.authorized')}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-slate-400 leading-relaxed">
                          {t('mock_email.deposit.desc')}
                        </p>
                        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">{t('mock_email.deposit.amount_label')}</span>
                            <span className="text-proyecto-green font-black">+${email.amount.toFixed(2)} USDT</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">{t('mock_email.deposit.wallet_label')}</span>
                            <span className="text-white font-black">{t('mock_email.deposit.vault_name')}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-black uppercase tracking-widest">{t('mock_email.deposit.sync_label')}</span>
                            <span className={email.isConfirmed ? 'text-proyecto-green font-black' : 'text-proyecto-gold font-black'}>
                              {email.isConfirmed ? t('mock_email.status.successful') : t('mock_email.status.awaiting')}
                            </span>
                          </div>
                        </div>
                        {!email.isConfirmed ? (
                          <button
                            onClick={() => onConfirm(email.txId, email.id)}
                            className="w-full py-4 blue-brand-gradient text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-proyecto-brand/20 hover:scale-[1.01] active:scale-[0.98] transition-all"
                          >
                            {t('mock_email.deposit.button')}
                          </button>
                        ) : (
                          <div className="bg-proyecto-green/5 border border-proyecto-green/10 rounded-xl p-4 text-center">
                            <p className="text-[10px] text-proyecto-green font-black uppercase tracking-widest">
                              {t('mock_email.deposit.success')}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    <p className="text-[11px] text-slate-500 leading-relaxed italic">
                      {t('mock_email.footer_note')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="bg-slate-900/80 p-3 text-center border-t border-slate-700">
          <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.5em]">{t('mock_email.footer_encryption')}</p>
        </div>
      </div>
    </div>
  );
};

export default MockEmailInbox;
