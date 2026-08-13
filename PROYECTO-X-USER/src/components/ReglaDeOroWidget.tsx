import React, { useState } from 'react';
import { Crown, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { withdrawReglaDeOro } from '../services/database';
import { Profile } from '../types';

interface Props {
  userId: string;
  referralCommissionBalance: number;
  profile: Profile;
  onSuccess: () => void;
  addNotification: (msg: string, type?: string) => void;
}

const FEE_USDT = 0.10;
const FEE_CARD = 0.03;
const MIN_AMOUNT = 10;

export default function ReglaDeOroWidget({
  userId,
  referralCommissionBalance,
  profile,
  onSuccess,
  addNotification,
}: Props) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('USDT');
  const [loading, setLoading] = useState(false);

  const hasCard = !!profile?.proyecto_x_card_address;
  const address = method === 'PROYECTO X CARD'
    ? (profile?.proyecto_x_card_address || '')
    : (profile?.withdrawal_wallet || '');

  const parsed = parseFloat(amount) || 0;
  const feeRate = method === 'PROYECTO X CARD' ? FEE_CARD : FEE_USDT;
  const fee = parsed * feeRate;
  const net = parsed - fee;

  const isInsufficient = parsed > referralCommissionBalance;
  const isBelowMin = parsed > 0 && parsed < MIN_AMOUNT;
  const noAddress = !address;
  const canSubmit = parsed >= MIN_AMOUNT && !isInsufficient && !noAddress && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    const result = await withdrawReglaDeOro(userId, parsed, method, address);
    setLoading(false);

    if (result.success) {
      addNotification('Retiro Regla de Oro enviado. En proceso de aprobación.', 'success');
      setAmount('');
      onSuccess();
    } else {
      addNotification(result.error || 'Error al procesar el retiro.', 'error');
    }
  };

  return (
    <div className="holo-card clip-corner border border-amber-500/30 bg-[#0a0f1a] shadow-[0_0_20px_rgba(251,191,36,0.08)]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-amber-500/20">
        <div className="w-9 h-9 clip-corner-sm bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Crown size={16} className="text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-orbitron font-black text-amber-400 uppercase tracking-widest">
            Regla de Oro
          </h3>
          <p className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">
            Retiro inmediato · Comisión directa Nivel 1
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Zap size={10} className="text-amber-400" />
          <span className="text-[9px] font-mono-tech text-amber-400 uppercase tracking-widest">Sin ventana</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Balance disponible */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 flex items-center justify-between">
          <span className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-widest">
            Comisión disponible
          </span>
          <span className="text-lg font-orbitron font-black text-amber-300">
            ${referralCommissionBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {referralCommissionBalance <= 0 ? (
          <div className="flex items-center gap-2 p-3 bg-slate-900/60 border border-slate-700/40 rounded">
            <AlertCircle size={14} className="text-slate-500 shrink-0" />
            <p className="text-[10px] font-mono-tech text-slate-500">
              Sin comisión directa disponible. Se acredita cuando tus indicados activan un plan.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Método */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMethod('USDT')}
                className={`flex-1 py-2 text-[10px] font-orbitron font-black uppercase tracking-widest clip-corner-sm border transition-all ${
                  method === 'USDT'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                    : 'bg-black/30 border-slate-700/40 text-slate-500 hover:border-slate-600'
                }`}
              >
                USDT · 10%
              </button>
              {hasCard && (
                <button
                  type="button"
                  onClick={() => setMethod('PROYECTO X CARD')}
                  className={`flex-1 py-2 text-[10px] font-orbitron font-black uppercase tracking-widest clip-corner-sm border transition-all ${
                    method === 'PROYECTO X CARD'
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-black/30 border-slate-700/40 text-slate-500 hover:border-slate-600'
                  }`}
                >
                  CARD · 3%
                </button>
              )}
            </div>

            {/* Monto */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-orbitron font-black text-sm">$</span>
              <input
                type="number"
                min={MIN_AMOUNT}
                max={referralCommissionBalance}
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Mín. $${MIN_AMOUNT}`}
                className="w-full bg-black/40 border border-slate-700/50 focus:border-amber-500/50 text-white font-orbitron text-sm pl-7 pr-4 py-2.5 outline-none transition-colors placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setAmount(referralCommissionBalance.toFixed(2))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-orbitron text-amber-500 hover:text-amber-300 uppercase tracking-widest transition-colors"
              >
                MAX
              </button>
            </div>

            {/* Validaciones */}
            {isBelowMin && (
              <p className="text-[9px] font-mono-tech text-rose-400 flex items-center gap-1">
                <AlertCircle size={10} /> Monto mínimo: ${MIN_AMOUNT} USD
              </p>
            )}
            {isInsufficient && !isBelowMin && (
              <p className="text-[9px] font-mono-tech text-rose-400 flex items-center gap-1">
                <AlertCircle size={10} /> Supera tu comisión disponible
              </p>
            )}
            {noAddress && (
              <p className="text-[9px] font-mono-tech text-rose-400 flex items-center gap-1">
                <AlertCircle size={10} /> Configura tu dirección de retiro en el perfil
              </p>
            )}

            {/* Desglose */}
            {parsed >= MIN_AMOUNT && !isInsufficient && (
              <div className="bg-black/30 border border-slate-800/60 p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[9px] font-mono-tech text-slate-500 uppercase">Monto bruto</span>
                  <span className="text-[9px] font-mono-tech text-white">${parsed.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-mono-tech text-slate-500 uppercase">
                    Tarifa ({(feeRate * 100).toFixed(0)}%)
                  </span>
                  <span className="text-[9px] font-mono-tech text-rose-400">-${fee.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-800 pt-1.5 flex justify-between">
                  <span className="text-[9px] font-orbitron font-black text-slate-300 uppercase tracking-widest">Recibes</span>
                  <span className="text-[11px] font-orbitron font-black text-amber-300">${net.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3 clip-corner-sm text-[11px] font-orbitron font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                canSubmit
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                  : 'bg-slate-800/60 border border-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  Retirar Comisión Directa
                </>
              )}
            </button>

            <p className="text-[9px] font-mono-tech text-slate-600 text-center leading-relaxed">
              Retiro disponible 24/7 · Sin restricción de horario · Solo comisión Nivel 1
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
