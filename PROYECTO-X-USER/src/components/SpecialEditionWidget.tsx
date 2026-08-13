import React, { useState, useEffect } from 'react';
import { Crown, Zap, AlertCircle, Check, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Profile, Investment } from '../types';

interface Props {
  user: Profile;
  investments: Investment[];
  walletBalance: number;
  creditBalance: number;
  onInvest: (amount: number, planId?: string) => void;
  addNotification: (msg: string, type?: string) => void;
  refetch: () => void;
}

const PLAN_ID = 'c5b33040-bafa-4ec5-9d10-087a3d7a94b9';
const MIN_INVESTMENT = 2000;

export default function SpecialEditionWidget({
  user,
  investments,
  walletBalance,
  creditBalance,
  onInvest,
  addNotification,
  refetch,
}: Props) {
  const [amount, setAmount] = useState<string>('2000');
  const [unitsUsed, setUnitsUsed] = useState<number>(0);
  const [unitsLoading, setUnitsLoading] = useState<boolean>(true);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [withdrawnToday, setWithdrawnToday] = useState<boolean>(false);
  const [checkingWithdrawal, setCheckingWithdrawal] = useState<boolean>(true);

  // Filter active investments for this plan
  const activeSpecialInvestments = investments.filter(
    (inv) => inv.plan_id === PLAN_ID && inv.status === 'ACTIVE'
  );

  const totalSpecialActiveAmount = activeSpecialInvestments.reduce(
    (sum, inv) => sum + (Number(inv.amount) || 0),
    0
  );

  const dailyRoiAmount = activeSpecialInvestments.reduce(
    (sum, investment) => sum + Number(investment.amount) * Number(investment.assigned_roi_percentage || 0) / 100,
    0
  );
  const withdrawableAmount = Math.min(dailyRoiAmount, walletBalance);
  const feeAmount = withdrawableAmount * 0.05; // 5% fee
  const netAmount = withdrawableAmount - feeAmount;

  // Load global units count
  useEffect(() => {
    async function loadUnits() {
      try {
        const { count, error } = await supabase
          .from('investments')
          .select('id', { count: 'exact', head: true })
          .eq('plan_id', PLAN_ID)
          .neq('status', 'CANCELLED');

        if (!error && count !== null) {
          setUnitsUsed(count);
        }
      } catch (err) {
        console.error('Error loading units count:', err);
      } finally {
        setUnitsLoading(false);
      }
    }
    loadUnits();
  }, [investments]);

  // Check if user has withdrawn today
  useEffect(() => {
    if (!user?.id || totalSpecialActiveAmount <= 0) {
      setCheckingWithdrawal(false);
      return;
    }

    async function checkWithdrawalToday() {
      try {
        const todayStr = new Date(Date.now() - 4 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]; // UTC-4

        const { data, error } = await supabase
          .from('withdrawals')
          .select('id')
          .eq('user_id', user.id)
          .eq('method', 'SPECIAL PASSIVE')
          .gte('created_at', todayStr)
          .neq('status', 'REJECTED')
          .limit(1);

        if (!error && data && data.length > 0) {
          setWithdrawnToday(true);
        } else {
          setWithdrawnToday(false);
        }
      } catch (err) {
        console.error('Error checking daily withdrawal:', err);
      } finally {
        setCheckingWithdrawal(false);
      }
    }
    checkWithdrawalToday();
  }, [user?.id, totalSpecialActiveAmount]);

  const numAmount = parseFloat(amount) || 0;
  const isOverBalance = numAmount > creditBalance;
  const isBelowMin = numAmount < MIN_INVESTMENT;

  const handleActivate = () => {
    if (isBelowMin) {
      addNotification(`La inversión mínima para SPECIAL EDITION es $${MIN_INVESTMENT} USDT.`, 'error');
      return;
    }
    if (isOverBalance) {
      addNotification('Saldo de crédito insuficiente para activar.', 'error');
      return;
    }
    if (unitsUsed >= 50) {
      addNotification('Esta edición exclusiva ya no tiene unidades disponibles.', 'error');
      return;
    }

    onInvest(numAmount, PLAN_ID);
  };

  const handleWithdrawPassive = async () => {
    if (withdrawnToday) {
      addNotification('Ya retiraste tu pasivo de SPECIAL EDITION hoy.', 'error');
      return;
    }
    if (walletBalance <= 0) {
      addNotification('No tienes saldo disponible en tu wallet balance.', 'error');
      return;
    }
    if (!user.withdrawal_wallet) {
      addNotification('Configura tu dirección de retiro USDT en tu perfil antes de continuar.', 'error');
      return;
    }
    if (withdrawableAmount <= 0) {
      addNotification('El monto a retirar debe ser mayor a 0.', 'error');
      return;
    }

    setWithdrawing(true);
    try {
      // 1. Deduct balance from profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ wallet_balance: walletBalance - withdrawableAmount })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Insert into withdrawals
      const { error: withdrawError } = await supabase.from('withdrawals').insert([
        {
          user_id: user.id,
          amount: withdrawableAmount,
          fee: feeAmount,
          net_amount: netAmount,
          wallet_address: user.withdrawal_wallet,
          method: 'SPECIAL PASSIVE',
          status: 'PENDING',
          created_at: new Date().toISOString(),
        },
      ]);

      if (withdrawError) throw withdrawError;

      addNotification('Retiro de pasivo SPECIAL EDITION enviado con éxito. Comisión 5%.', 'success');
      setWithdrawnToday(true);
      refetch();
    } catch (err: any) {
      console.error('Error executing special withdrawal:', err);
      addNotification(err.message || 'Error al procesar el retiro.', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const unitsRemaining = Math.max(0, 50 - unitsUsed);

  return (
    <div className="relative overflow-hidden border border-amber-500/50 bg-gradient-to-br from-[#0c0d0a] via-[#1c180a] to-[#0c0d0a] p-5 clip-corner shadow-[0_0_40px_rgba(245,158,11,0.2)] group transition-all duration-500">
      {/* Laser Scanning Line Effect */}
      <div className="absolute inset-x-0 h-[1px] bg-amber-500/30 -translate-y-full group-hover:animate-scanline pointer-events-none" />

      {/* Gold sparkles background */}
      <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
        <Sparkles size={64} className="text-amber-400" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 clip-corner-sm bg-gradient-to-r from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
            <Crown size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-orbitron font-black text-amber-400 uppercase tracking-[0.25em]">
                EDICIÓN LIMITADA
              </span>
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-[7px] font-orbitron font-black text-amber-300 uppercase tracking-widest animate-pulse">
                50/50 GOLD
              </span>
            </div>
            <h3 className="text-sm font-orbitron font-black text-white uppercase tracking-wider mt-0.5">
              SPECIAL EDITION
            </h3>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-[7px] font-mono-tech text-slate-500 uppercase tracking-widest">Estado</p>
          {unitsLoading ? (
            <Loader2 size={12} className="animate-spin text-amber-400 ml-auto mt-1" />
          ) : unitsRemaining === 0 ? (
            <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/30 text-[8px] font-orbitron font-black text-rose-400 uppercase tracking-widest">
              AGOTADO
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-[8px] font-orbitron font-black text-amber-400 uppercase tracking-widest">
              {unitsRemaining} / 50 DISPONIBLES
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      {totalSpecialActiveAmount <= 0 ? (
        // NO ACTIVE INVESTMENT
        <div className="space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/10 rounded p-3 text-center">
            <p className="text-[10px] font-mono-tech text-slate-400 uppercase tracking-wider">
              Rentabilidad según ciclo asignado
            </p>
            <p className="text-2xl font-orbitron font-black text-amber-300 mt-1">
              ROI variable · activación diaria
            </p>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
              Bypass de ventana de retiros · Retiro diario de Pasivo (Fee 5%)
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-[8px] font-mono-tech text-slate-400 uppercase tracking-widest">
                Monto de Inversión (Min. $2,000)
              </label>
              <span className="text-[8px] font-mono-tech text-amber-400 uppercase">
                Crédito: ${creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-orbitron font-black text-sm">$</span>
              <input
                type="number"
                min={MIN_INVESTMENT}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2000"
                className={`w-full bg-black/60 border rounded py-2.5 pl-7 pr-16 text-sm font-orbitron font-bold text-white outline-none transition-colors ${
                  isOverBalance || isBelowMin
                    ? 'border-rose-500/50 focus:border-rose-500/80'
                    : 'border-amber-500/20 focus:border-amber-500/50'
                }`}
              />
              <button
                type="button"
                onClick={() => setAmount(Math.max(MIN_INVESTMENT, creditBalance).toString())}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-orbitron font-bold text-amber-500 hover:text-amber-300 uppercase tracking-widest"
              >
                MAX
              </button>
            </div>

            {isBelowMin && (
              <p className="text-[8px] font-mono-tech text-rose-400 flex items-center gap-1">
                <AlertCircle size={10} /> La inversión mínima es de $2,000 USDT.
              </p>
            )}
            {isOverBalance && !isBelowMin && (
              <p className="text-[8px] font-mono-tech text-rose-400 flex items-center gap-1">
                <AlertCircle size={10} /> Saldo de crédito insuficiente.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleActivate}
            disabled={isOverBalance || isBelowMin || unitsRemaining === 0}
            className={`w-full py-3.5 clip-corner-sm text-[10px] font-orbitron font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-2 ${
              isOverBalance || isBelowMin || unitsRemaining === 0
                ? 'bg-slate-800 border border-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-600 to-amber-400 hover:brightness-110 text-slate-950 font-black shadow-[0_0_20px_rgba(245,158,11,0.3)]'
            }`}
          >
            Activar SPECIAL EDITION
          </button>
        </div>
      ) : (
        // HAS ACTIVE INVESTMENT
        <div className="space-y-4">
          {/* Active stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 border border-amber-500/10 rounded p-3 space-y-1">
              <span className="text-[7px] font-mono-tech text-slate-500 uppercase tracking-widest block">Capital Activo</span>
              <span className="text-base font-orbitron font-black text-white">
                ${totalSpecialActiveAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-black/40 border border-amber-500/10 rounded p-3 space-y-1">
              <span className="text-[7px] font-mono-tech text-slate-500 uppercase tracking-widest block">Retorno diario asignado</span>
              <span className="text-base font-orbitron font-black text-amber-300">
                +${dailyRoiAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Golden withdrawal form */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={12} className="text-amber-400 animate-pulse" />
                <span className="text-[9px] font-orbitron font-black text-amber-400 uppercase tracking-wider">
                  RETIRO DE PASIVO DIARIO
                </span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-[7px] font-orbitron font-black text-emerald-400 uppercase tracking-widest">
                FEE 5%
              </span>
            </div>

            <div className="space-y-1.5 text-[9px] font-mono-tech">
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Monto Bruto a retirar</span>
                <span className="text-white font-bold">${withdrawableAmount.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 uppercase">Fee de Retiro (5%)</span>
                <span className="text-rose-400">-${feeAmount.toFixed(2)} USDT</span>
              </div>
              <div className="border-t border-amber-500/20 pt-1.5 flex justify-between font-orbitron font-black text-xs">
                <span className="text-slate-300 uppercase tracking-widest">Recibes Neto</span>
                <span className="text-amber-300">${netAmount.toFixed(2)} USDT</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[7px] font-mono-tech text-slate-500 uppercase tracking-widest">Dirección de Destino</span>
              <input
                type="text"
                readOnly
                value={user.withdrawal_wallet || 'No has configurado tu wallet en el perfil'}
                className={`w-full bg-black/60 border rounded py-2 px-3 text-[10px] font-mono outline-none text-slate-400 ${
                  !user.withdrawal_wallet ? 'border-rose-500/30' : 'border-amber-500/10'
                }`}
              />
            </div>

            <button
              type="button"
              onClick={handleWithdrawPassive}
              disabled={withdrawnToday || checkingWithdrawal || withdrawing || withdrawableAmount <= 0 || !user.withdrawal_wallet}
              className={`w-full py-3 clip-corner-sm text-[10px] font-orbitron font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                withdrawnToday || checkingWithdrawal || withdrawing || withdrawableAmount <= 0 || !user.withdrawal_wallet
                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.2)]'
              }`}
            >
              {withdrawing ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Procesando...
                </>
              ) : checkingWithdrawal ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Verificando...
                </>
              ) : withdrawnToday ? (
                <>
                  <Check size={12} />
                  ✓ Retirado Hoy (Pasivo Diario)
                </>
              ) : withdrawableAmount <= 0 ? (
                'Sin Fondos en Wallet Balance'
              ) : (
                'Retirar Pasivo Diario'
              )}
            </button>
          </div>

          <p className="text-[7px] font-mono-tech text-slate-500 uppercase text-center tracking-wider">
            Límite de retiro: equivalente al ROI diario (${dailyRoiAmount.toFixed(2)} USDT) por día.
          </p>
        </div>
      )}
    </div>
  );
}
