import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface Props {
  profile: Profile | null;
}

const EVENT_START = '2026-04-22T00:00:00-04:00';
const EVENT_DEADLINE = new Date('2026-05-20T23:59:59-04:00');
const EVENT_GOAL = 10000; // PV (comisiones de referidos)
const SPOTS_TOTAL = 10;

interface LeaderEntry {
  user_id: string;
  full_name: string | null;
  username: string | null;
  rank: string;
  event_volume: number;
}

const maskName = (name: string | null, username: string | null): string => {
  const raw = name || username || 'Socio';
  const parts = raw.trim().split(' ');
  if (parts.length >= 2) return `${parts[0]} ${parts[1][0]}.`;
  if (raw.length > 3) return raw.slice(0, 3) + '***';
  return raw;
};

const RANK_COLORS: Record<string, string> = {
  Starter: 'text-slate-400',
  Bronze: 'text-amber-600',
  Silver: 'text-slate-300',
  Gold: 'text-yellow-400',
  Platinum: 'text-cyan-300',
  Diamond: 'text-blue-400',
  'Black Crown': 'text-purple-400',
};

const BootCampEvent: React.FC<Props> = ({ profile }) => {
  const [countdown, setCountdown] = useState('');
  const [userEventVolume, setUserEventVolume] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loadingLeader, setLoadingLeader] = useState(true);

  const progressPct = Math.min((userEventVolume / EVENT_GOAL) * 100, 100);
  const isQualified = userEventVolume >= EVENT_GOAL;
  const spotsUsed = leaderboard.filter(e => e.event_volume >= EVENT_GOAL).length;
  const spotsLeft = Math.max(SPOTS_TOTAL - spotsUsed, 0);
  const isEventActive = Date.now() >= new Date(EVENT_START).getTime() && Date.now() <= EVENT_DEADLINE.getTime();

  // Countdown timer
  useEffect(() => {
    const tick = () => {
      const diff = EVENT_DEADLINE.getTime() - Date.now();
      if (diff <= 0) { setCountdown('FINALIZADO'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load event commissions from transactions table (from event start date)
  useEffect(() => {
    (async () => {
      setLoadingLeader(true);

      // Fetch all REFERRAL_COMMISSION transactions since event start
      const { data: txData, error } = await supabase
        .from('transactions')
        .select('user_id, amount')
        .eq('type', 'REFERRAL_COMMISSION')
        .in('status', ['COMPLETED', 'CONFIRMED', 'completed', 'confirmed'])
        .gte('created_at', EVENT_START)
        .gt('amount', 0);

      if (error || !txData) {
        setLoadingLeader(false);
        return;
      }

      // Aggregate by user_id
      const volumeMap: Record<string, number> = {};
      for (const tx of txData) {
        volumeMap[tx.user_id] = (volumeMap[tx.user_id] ?? 0) + Number(tx.amount);
      }

      // Set logged-in user's event volume
      if (profile?.id) {
        setUserEventVolume(volumeMap[profile.id] ?? 0);
      }

      // Sort and take top 10
      const sorted = Object.entries(volumeMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (sorted.length === 0) {
        setLeaderboard([]);
        setLoadingLeader(false);
        return;
      }

      const topIds = sorted.map(([uid]) => uid);

      // Fetch profile names for top users
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, rank')
        .in('id', topIds);

      const profileMap: Record<string, { full_name: string | null; username: string | null; rank: string }> = {};
      for (const p of profileData ?? []) {
        profileMap[p.id] = { full_name: p.full_name, username: p.username, rank: p.rank };
      }

      const entries: LeaderEntry[] = sorted.map(([uid, vol]) => ({
        user_id: uid,
        full_name: profileMap[uid]?.full_name ?? null,
        username: profileMap[uid]?.username ?? null,
        rank: profileMap[uid]?.rank ?? 'Starter',
        event_volume: vol,
      }));

      setLeaderboard(entries);
      setLoadingLeader(false);
    })();
  }, [profile?.id]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-yellow-500/20 mb-8 shadow-2xl">

      {/* ═══ BACKGROUND ═══ */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0d14] via-[#0d1520] to-[#080c10]" />
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-cyan-500/4 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10">

        {/* ═══ HEADER ═══ */}
        <div className="relative overflow-hidden px-8 pt-8 pb-6 border-b border-yellow-500/15">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.26 9.71 2 12 2c2.291 0 4.545.26 6.75.721v1.515m0 0A7.502 7.502 0 0118.75 9.75m-13.5-5.514A7.502 7.502 0 005.25 9.75" />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded-full text-[9px] font-black text-yellow-400 tracking-widest uppercase">
                    EVENTO EXCLUSIVO
                  </span>
                  {isEventActive && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-green-500/15 border border-green-500/30 rounded-full text-[9px] font-black text-green-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      ACTIVO
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                  BootCamp <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-300">Cap Cana</span>
                </h2>
                <p className="text-slate-400 text-sm font-medium mt-0.5">
                  Viaje Todo Incluido · Ida y Vuelta · 3 Días
                </p>
              </div>
            </div>

            {/* Countdown */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tiempo restante</span>
              <div className="px-4 py-2 bg-black/40 border border-yellow-500/20 rounded-xl">
                <span className="text-xl font-black text-yellow-400 font-mono tabular-nums tracking-tight">{countdown}</span>
              </div>
              <span className="text-[9px] text-slate-600 font-bold">Cierre: 20 Mayo 2026</span>
            </div>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT: Event Info */}
          <div className="lg:col-span-1 space-y-5">

            {/* Prize card */}
            <div className="rounded-2xl bg-gradient-to-br from-yellow-500/8 to-amber-500/4 border border-yellow-500/20 p-5">
              <p className="text-[9px] font-black text-yellow-500/70 uppercase tracking-widest mb-3">Premio</p>
              <div className="space-y-2.5">
                {[
                  { icon: '✈️', text: 'Vuelo Redondo Ida y Vuelta' },
                  { icon: '🏨', text: 'Hotel Todo Incluido' },
                  { icon: '📅', text: '3 Días · 2 Noches' },
                  { icon: '📍', text: 'Cap Cana, R. Dominicana' },
                  { icon: '🗓️', text: '22 de Mayo del 2026' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <span className="text-base">{icon}</span>
                    <span className="text-sm font-bold text-slate-200">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Spots counter */}
            <div className="rounded-2xl bg-black/30 border border-slate-800 p-5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Cupos Disponibles</p>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-4xl font-black text-white">{spotsLeft}</span>
                <span className="text-slate-500 font-bold mb-1">/ {SPOTS_TOTAL} cupos</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: SPOTS_TOTAL }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all ${
                      i < spotsUsed
                        ? 'bg-yellow-500/20 border-yellow-500/50'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {i < spotsUsed && (
                      <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                      </svg>
                    )}
                  </div>
                ))}
              </div>
              {spotsLeft === 0 && (
                <p className="mt-3 text-[10px] font-black text-red-400 uppercase tracking-widest">Cupos agotados</p>
              )}
            </div>

            {/* Requirements */}
            <div className="rounded-2xl bg-black/30 border border-slate-800 p-5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Requisito de Clasificación</p>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-black text-white">Todos los Rangos</p>
                  <p className="text-[10px] text-cyan-400 font-bold">10,000 PV en Comisiones de Equipo</p>
                </div>
              </div>
              <p className="mt-3 text-[9px] text-slate-600 font-bold leading-relaxed">
                Periodo oficial: 22 Abril – 20 Mayo 2026. Solo los primeros 10 socios en alcanzar el objetivo califican.
              </p>
              <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/15">
                <svg className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <p className="text-[9px] text-amber-400/80 font-bold">
                  Basado en comisiones reales generadas desde el 22 Abr
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Progress + Leaderboard */}
          <div className="lg:col-span-2 space-y-6">

            {/* MY PROGRESS */}
            <div className={`rounded-2xl p-6 border ${isQualified ? 'bg-green-500/8 border-green-500/25' : 'bg-black/30 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tu Progreso · Evento</p>
                  <p className="text-sm font-black text-white mt-0.5">
                    {profile?.full_name || profile?.username || 'Mi Equipo'}
                    <span className={`ml-2 text-[10px] font-bold ${RANK_COLORS[profile?.rank ?? 'Starter']}`}>
                      {profile?.rank ?? '—'}
                    </span>
                  </p>
                </div>
                {isQualified ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/15 border border-green-500/30 rounded-xl">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-wider">CLASIFICADO</span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="text-2xl font-black text-white">{progressPct.toFixed(1)}%</span>
                    <p className="text-[9px] text-slate-600 font-bold">completado</p>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div className="relative h-5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80 mb-3">
                {[25, 50, 75].map(mark => (
                  <div key={mark} className="absolute top-0 bottom-0 w-px bg-slate-700/60 z-10" style={{ left: `${mark}%` }} />
                ))}
                <div
                  className={`h-full rounded-full transition-all duration-1000 relative ${isQualified ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-yellow-600 to-amber-400'}`}
                  style={{ width: `${progressPct}%` }}
                >
                  {progressPct > 8 && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-900">
                      {progressPct.toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className={isQualified ? 'text-green-400' : 'text-slate-400'}>
                  {userEventVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })} PV acumulados
                </span>
                <span className="text-slate-600">
                  Meta: {EVENT_GOAL.toLocaleString('en-US')} PV
                </span>
              </div>

              {!isQualified && (
                <div className="mt-3 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-xl flex items-center gap-3">
                  <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-[10px] font-bold text-yellow-400/80">
                    Te faltan <span className="font-black text-yellow-400">{Math.max(EVENT_GOAL - userEventVolume, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} PV</span> en comisiones para clasificar. ¡Refiere más socios!
                  </p>
                </div>
              )}
            </div>

            {/* LEADERBOARD */}
            <div className="rounded-2xl bg-black/30 border border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Clasificados · Comisiones del Evento</p>
                <span className="text-[9px] font-bold text-slate-600">{leaderboard.length} participantes</span>
              </div>

              {loadingLeader ? (
                <div className="flex justify-center items-center h-32">
                  <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-32 gap-2">
                  <p className="text-slate-600 text-sm font-bold">Sin comisiones registradas aún</p>
                  <p className="text-slate-700 text-[10px]">El evento comenzó el 22 de Abril · ¡Sé el primero!</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {leaderboard.map((entry, i) => {
                    const entryPct = Math.min((entry.event_volume / EVENT_GOAL) * 100, 100);
                    const qualified = entry.event_volume >= EVENT_GOAL;
                    const isMe = entry.user_id === profile?.id;
                    return (
                      <div key={entry.user_id} className={`flex items-center gap-4 px-6 py-3 transition-colors ${qualified ? 'bg-yellow-500/4' : ''} ${isMe ? 'ring-1 ring-inset ring-cyan-500/20' : ''}`}>
                        {/* Position */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                          i === 1 ? 'bg-slate-400/15 text-slate-300 border border-slate-500/30' :
                          i === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                          'bg-slate-900 text-slate-600 border border-slate-800'
                        }`}>
                          {i + 1}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white truncate">
                              {isMe ? (profile?.full_name || profile?.username || 'Tú') : maskName(entry.full_name, entry.username)}
                            </span>
                            <span className={`text-[9px] font-black ${RANK_COLORS[entry.rank] ?? 'text-slate-500'}`}>{entry.rank}</span>
                            {isMe && <span className="px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 rounded text-[8px] font-black text-cyan-400">TÚ</span>}
                            {qualified && (
                              <span className="px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/30 rounded text-[8px] font-black text-yellow-400">✓</span>
                            )}
                          </div>
                          <div className="mt-1 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${qualified ? 'bg-gradient-to-r from-yellow-500 to-amber-400' : 'bg-gradient-to-r from-cyan-600 to-cyan-400'}`}
                              style={{ width: `${entryPct}%`, transition: 'width 0.8s ease' }}
                            />
                          </div>
                        </div>

                        {/* Volume */}
                        <div className="text-right flex-shrink-0">
                          <span className={`text-sm font-black ${qualified ? 'text-yellow-400' : 'text-slate-300'}`}>
                            {entry.event_volume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <p className="text-[8px] text-slate-600 font-bold">PV</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ═══ FOOTER CTA ═══ */}
        <div className="px-8 pb-8">
          <div className="rounded-2xl bg-gradient-to-r from-yellow-500/8 via-amber-500/5 to-transparent border border-yellow-500/15 p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-white">¿Listo para Cap Cana?</p>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                Genera comisiones referiendo socios del 22 Abr al 20 May y asegura tu cupo.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-center px-4 py-2 bg-black/40 border border-slate-800 rounded-xl">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Periodo</span>
                <span className="text-xs font-black text-white">22 Abr – 20 May</span>
              </div>
              <div className="text-center px-4 py-2 bg-black/40 border border-slate-800 rounded-xl">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Cupos</span>
                <span className="text-xs font-black text-yellow-400">{spotsLeft}/{SPOTS_TOTAL}</span>
              </div>
              <div className="text-center px-4 py-2 bg-black/40 border border-slate-800 rounded-xl">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Meta</span>
                <span className="text-xs font-black text-cyan-400">10K PV</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BootCampEvent;
