
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createNowPayment, PaymentResponse } from '../services/nowpayments';
import { createStripeCheckout } from '../services/stripe';

interface Props {
  onDeposit: (amount: number, hash?: string) => void;
  userId?: string;
  activePromotion?: any;
  onClearPromo?: () => void;
}

const DepositForm: React.FC<Props> = ({ onDeposit, userId, activePromotion, onClearPromo }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<string>('');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isStripeLoading, setIsStripeLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'card'>('crypto');

  const handleCopy = () => {
    if (!paymentData?.pay_address) return;
    navigator.clipboard.writeText(paymentData.pay_address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // --- STRIPE HANDLER ---
  const handleStripePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError(t('deposit.user_unauthorized'));
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 5) {
      setError('El monto mínimo para pago con tarjeta es $5.');
      return;
    }
    if (numAmount > 50000) {
      setError('El monto máximo por depósito es $50,000.');
      return;
    }

    setIsStripeLoading(true);
    setError(null);

    const result = await createStripeCheckout(numAmount, userId);

    if (result.url) {
      onDeposit(numAmount, 'STRIPE_INITIATED');
      if (onClearPromo) onClearPromo();
      // Redirigir a Stripe Checkout
      window.location.href = result.url;
    } else {
      setError(result.error || 'No se pudo generar el link de pago con tarjeta.');
      setIsStripeLoading(false);
    }
  };
  // --- FIN STRIPE HANDLER ---

  const handleGeneratePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setError(t('deposit.user_unauthorized'));
      return;
    }

    const numAmount = parseFloat(amount);
    if (numAmount > 50000) {
      setError('El monto máximo por depósito es $50,000.');
      return;
    }
    if (numAmount >= 25) {
      setIsVerifying(true);
      setError(null);

      const { data, error: apiError } = await createNowPayment(numAmount, userId);

      if (data) {
        setPaymentData(data);
        // notify parent to refetch so the pending transaction appears in history
        onDeposit(numAmount, 'INITIATED');
        if (onClearPromo) onClearPromo();
      } else {
        setError(apiError || t('deposit.api_error'));
      }
      setIsVerifying(false);
    }
  };

  const handleConfirmFinal = () => {
    if (paymentData) {
      // The deposit record was already created by the proxy.
      // We just notify the user that we are waiting for blockchain confirmation.
      setPaymentData(null);
      setAmount('');
      setTransactionHash('');
      // We can call onDeposit as a callback to refetch data or show a success toast in the parent
      // but we should pass a flag or handle it differently if it creates a record.
      // For now, let's just reset and let the user know.
    }
  };

  const resetForm = () => {
    setPaymentData(null);
    setAmount('');
    setError(null);
  };

  return (
    <div className="blue-glass rounded-2xl p-6 border border-slate-800 shadow-2xl animate-fade-in relative overflow-hidden">
      {/* Glow decorativo */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-proyecto-green/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center mb-6">
        <div className="w-10 h-10 rounded-lg bg-proyecto-green/10 flex items-center justify-center mr-3 border border-proyecto-green/20">
          <svg className="w-6 h-6 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white uppercase tracking-tighter">{t('deposit.title')}</h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('deposit.network')}</p>
        </div>
      </div>

      {activePromotion && !paymentData && (
        <div className="mb-6 animate-fade-in">
          <div className="bg-proyecto-accent/10 border border-proyecto-accent/30 rounded-xl p-4 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-20">
              <svg className="w-8 h-8 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2z" />
              </svg>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-proyecto-accent animate-pulse"></span>
                  <span className="text-[10px] font-black text-proyecto-accent uppercase tracking-widest">Promoción Aplicada</span>
                </div>
                <h4 className="text-sm font-bold text-white tracking-tight">{activePromotion.title}</h4>
                <p className="text-[10px] text-slate-400 font-medium">Beneficio: <span className="text-proyecto-gold font-bold">{activePromotion.type === 'CASHBACK' || activePromotion.type === 'DISCOUNT' ? `${activePromotion.reward_value}%` : `$${activePromotion.reward_value}`}</span></p>
                {activePromotion.min_investment > 0 && (
                  <p className="text-[10px] text-slate-500 mt-0.5 italic">Requiere inversión mínima de ${activePromotion.min_investment}</p>
                )}
              </div>
              <button
                onClick={onClearPromo}
                className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                title="Eliminar Promoción"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {!paymentData ? (
        /* STEP 1: AMOUNT INPUT + MÉTODO DE PAGO */
        <form onSubmit={paymentMethod === 'card' ? handleStripePayment : handleGeneratePayment} className="space-y-6">

          {/* SELECTOR DE MÉTODO DE PAGO */}
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Método de Pago</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setPaymentMethod('crypto'); setError(null); }}
                className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                  paymentMethod === 'crypto'
                    ? 'bg-proyecto-accent/10 border-proyecto-accent text-proyecto-accent'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                }`}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
                </svg>
                Cripto (USDT)
              </button>
              <button
                type="button"
                onClick={() => { setPaymentMethod('card'); setError(null); }}
                className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                  paymentMethod === 'card'
                    ? 'bg-violet-500/10 border-violet-500 text-violet-400'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Tarjeta / Card
              </button>
            </div>
          </div>

          {/* MONTO */}
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('deposit.amount_label')}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-proyecto-green font-black">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-900 rounded-xl py-4 pl-8 pr-4 text-white text-lg font-black focus:outline-none focus:border-proyecto-green transition-all placeholder:text-slate-800"
                required
                min={paymentMethod === 'card' ? '5' : '25'}
              />
            </div>
            <p className="text-[9px] text-slate-600 mt-1 ml-1">
              {paymentMethod === 'card' ? 'Mínimo: $5 USD · Acepta Visa, Mastercard, Amex' : 'Mínimo: $25 USD · Red BSC (USDT)'}
            </p>
          </div>

          {error && (
            <p className="text-[10px] text-red-500 font-bold uppercase text-center">{error}</p>
          )}

          {/* BOTÓN DINÁMICO SEGÚN MÉTODO */}
          {paymentMethod === 'card' ? (
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) < 5 || isStripeLoading}
              className="w-full py-4 bg-violet-600 text-white font-black text-xs uppercase tracking-[0.3em] rounded-xl shadow-xl shadow-violet-500/20 hover:brightness-110 active:scale-95 disabled:opacity-20 disabled:grayscale transition-all flex items-center justify-center gap-2"
            >
              {isStripeLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Redirigiendo a Stripe...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Pagar con Tarjeta
                </>
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!amount || parseFloat(amount) < 25 || isVerifying}
              className="w-full py-4 bg-proyecto-green text-slate-950 font-black text-xs uppercase tracking-[0.3em] rounded-xl shadow-xl shadow-proyecto-green/10 hover:brightness-110 active:scale-95 disabled:opacity-20 disabled:grayscale transition-all"
            >
              {isVerifying ? t('deposit.generating') : t('deposit.generate_button')}
            </button>
          )}

          <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10">
            <p className="text-[9px] text-red-400/80 leading-relaxed text-center font-bold uppercase tracking-tighter">
              {paymentMethod === 'card'
                ? 'Serás redirigido a la página segura de Stripe. Tu saldo se acreditará automáticamente al completar el pago.'
                : t('deposit.attention')}
            </p>
          </div>
        </form>
      ) : (
        /* STEP 2: SHOW PAYMENT ADDRESS & QR */
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex flex-col items-center">
            <div className="relative p-6 bg-white rounded-[2.5rem] shadow-[0_0_60px_rgba(0,243,255,0.15)] border-4 border-slate-900/10 mb-2">
              <div className="absolute -inset-1 bg-gradient-to-tr from-proyecto-accent/20 to-proyecto-green/20 rounded-[2.6rem] blur-xl opacity-50 -z-10 animate-pulse"></div>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${paymentData.pay_address}`}
                alt="Payment QR"
                className="w-48 h-48 rounded-2xl"
              />
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">{t('deposit.payment_id', { defaultValue: 'PAYMENT ID / REFERENCE' })}</p>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-900 rounded-full px-4 py-1.5">
                <span className="text-[10px] font-mono text-proyecto-accent uppercase tracking-tighter">{paymentData.payment_id}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentData.payment_id);
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="text-slate-600 hover:text-white transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <p className="text-[11px] text-proyecto-green font-black uppercase tracking-widest mb-1">{t('deposit.send_exactly')}</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl text-white font-black tracking-tighter text-glow-white">
                  {paymentData.pay_amount} <span className="text-proyecto-accent">{paymentData.pay_currency.toUpperCase()}</span>
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(paymentData.pay_amount.toString());
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 2000);
                  }}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-all active:scale-95"
                  title="Copy Amount"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('deposit.address_label')}</label>
              <div className="flex gap-2">
                <div className="flex-grow bg-slate-950 border border-slate-900 rounded-xl px-4 py-3.5 text-[10px] font-mono text-proyecto-accent break-all flex items-center border-dashed relative group">
                  <div className="absolute inset-0 bg-proyecto-accent/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                  {paymentData.pay_address}
                </div>
                <button
                  onClick={handleCopy}
                  className={`p-3.5 rounded-xl transition-all shadow-xl ${isCopied ? 'bg-proyecto-green text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-proyecto-accent hover:text-white'}`}
                >
                  {isCopied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-proyecto-brand/5 p-5 rounded-2xl border border-proyecto-brand/20 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-proyecto-brand/10 rounded-full blur-2xl group-hover:bg-proyecto-brand/20 transition-all"></div>
              <p className="text-[10px] text-proyecto-accent leading-relaxed text-center font-bold uppercase tracking-tight relative z-10">
                {t('deposit.automatic_process_notice', { defaultValue: 'El sistema detectará tu pago automáticamente. Una vez confirmado en la blockchain, tu saldo se acreditará en segundos.' })}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleConfirmFinal}
                className="w-full py-4.5 bg-proyecto-brand text-white font-black text-xs uppercase tracking-[0.3em] rounded-xl shadow-[0_10px_30px_rgba(0,114,255,0.3)] hover:brightness-110 active:scale-[0.98] transition-all font-orbitron border border-proyecto-brand/50"
              >
                {t('deposit.done_button', { defaultValue: 'ENTENDIDO, VOLVER AL PANEL' })}
              </button>

              <button
                onClick={resetForm}
                className="w-full py-3 text-slate-600 font-bold text-[9px] uppercase tracking-[0.2em] hover:text-white transition-colors"
              >
                {t('deposit.cancel_button')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepositForm;
