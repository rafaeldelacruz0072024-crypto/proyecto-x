import React, { useEffect, useState } from 'react';
import { Award, Gift, History, Loader2, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CAREER_TIERS = [
  { volume: 10000, rank: 'Bronze', reward: 'Reconocimiento NOVA', color: 'text-cyan-300' },
  { volume: 25000, rank: 'Silver', reward: 'Tablet', color: 'text-slate-300' },
  { volume: 40000, rank: 'Gold', reward: 'Teléfono móvil', color: 'text-amber-300' },
  { volume: 65000, rank: 'Gold II', reward: 'Acceso a evento NOVA', color: 'text-amber-400' },
  { volume: 100000, rank: 'Platinum', reward: 'Laptop', color: 'text-cyan-300' },
  { volume: 200000, rank: 'Diamond', reward: 'Viaje a evento NOVA', color: 'text-violet-300' },
  { volume: 400000, rank: 'Diamond II', reward: 'Viaje internacional a evento', color: 'text-violet-400' },
  { volume: 800000, rank: 'Black Crown', reward: 'Experiencia NOVA Black Crown', color: 'text-fuchsia-400' },
  { volume: 1000000, rank: 'Legend', reward: 'Experiencia NOVA Legend', color: 'text-yellow-300' },
];

const WeeklyBonuses: React.FC = () => {
  const [legacyCount, setLegacyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLegacyHistory = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'bonus_weekly');
    setLegacyCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { loadLegacyHistory(); }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-violet-950/60 via-slate-950 to-cyan-950/40 border border-violet-500/25 rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-violet-500/15 border border-violet-400/30 text-violet-200"><Award size={28} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">NOVA Digital</p>
            <h1 className="mt-1 text-3xl font-black text-white uppercase tracking-tight">Plan de Carrera</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              El salario quincenal y los bonos monetarios fueron retirados. Este módulo administra únicamente reconocimientos no monetarios: tecnología y experiencias en eventos.
            </p>
          </div>
        </div>
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-[11px] font-black uppercase tracking-widest text-emerald-300">
          <Gift size={15} /> Sin comisiones ni acreditaciones a Wallet Bank
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CAREER_TIERS.map((tier) => (
          <div key={tier.rank} className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-violet-500/10 blur-2xl" />
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${tier.color}`}>{tier.rank}</p>
            <p className="mt-3 text-lg font-black text-white">{tier.reward}</p>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Meta de equipo</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-slate-200">${tier.volume.toLocaleString('en-US')}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 text-slate-400" size={20} />
          <div>
            <h2 className="font-black text-white">Historial legado protegido</h2>
            <p className="mt-1 text-sm text-slate-500">Los registros de salarios anteriores se conservan para auditoría, pero no se crean ni se pagan nuevos.</p>
          </div>
        </div>
        <button onClick={loadLegacyHistory} disabled={loading || !isSupabaseConfigured()} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-xs font-black uppercase tracking-widest text-slate-300 hover:border-cyan-400/40 disabled:opacity-40">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          {legacyCount === null ? 'Consultar historial' : `${legacyCount} registros legados`}
        </button>
      </div>
    </div>
  );
};

export default WeeklyBonuses;
