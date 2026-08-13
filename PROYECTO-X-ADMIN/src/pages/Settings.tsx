
import React, { useState, useMemo, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Globe,
  Percent,
  Layers,
  Info,
  ListTree,
  Target,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Zap,
  Edit3,
  LockKeyhole,
  Clock,
  Unlock,
  Timer
} from 'lucide-react';

/**
 * Premium numeric input for the residual plan.
 * Manages its own local state to allow typing decimals without "jumping".
 * Includes focus-aware synchronization to prevent text resetting while typing.
 */
const ResidualInput: React.FC<{
  value: number;
  onChange: (val: string) => void;
  title: string;
}> = ({ value, onChange, title }) => {
  const [localVal, setLocalVal] = useState(value.toString());
  const isFocused = React.useRef(false);

  useEffect(() => {
    if (!isFocused.current && parseFloat(localVal) !== value) {
      setLocalVal(value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value.replace(/[^0-9.]/g, '');
    setLocalVal(newVal);
    if (newVal !== '' && !newVal.endsWith('.') && !isNaN(parseFloat(newVal))) {
      onChange(newVal);
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    if (localVal === '' || localVal === '.') {
      setLocalVal('0');
      onChange('0');
    } else {
      onChange(localVal);
    }
  };

  const handleFocus = () => {
    isFocused.current = true;
  };

  return (
    <div className="relative group/input flex items-center gap-2">
      <div className="flex items-center bg-[#05070a] border border-slate-800 group-hover/input:border-indigo-500/60 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/20 rounded-2xl px-4 py-3 transition-all duration-300 shadow-2xl backdrop-blur-3xl min-w-[100px] justify-center">
        <input
          type="text"
          inputMode="decimal"
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="w-14 bg-transparent border-none p-0 text-white font-black text-2xl focus:ring-0 outline-none tabular-nums text-center placeholder:text-slate-800"
          placeholder="0.0"
        />
        <span className="ml-1.5 text-indigo-500 font-black text-sm">%</span>
      </div>
      <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/50 opacity-0 group-hover/input:opacity-100 transition-opacity">
        <Edit3 size={10} className="text-indigo-400" />
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'fees' | 'residual' | 'salary' | 'landing'>('general');

  // Override manual de ventana de retiros
  const [overrideUntil, setOverrideUntil] = useState<Date | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideHours, setOverrideHours] = useState(3);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    if (!overrideUntil) { setCountdown(''); return; }
    const tick = () => {
      const diff = overrideUntil.getTime() - Date.now();
      if (diff <= 0) { setOverrideUntil(null); setCountdown(''); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [overrideUntil]);

  // Landing Stats
  const [landingStats, setLandingStats] = useState({
    active_investors: 0,
    countries: 0,
    total_payouts: 0,
    years_in_market: 0
  });
  const [landingStatsLoading, setLandingStatsLoading] = useState(false);

  // Estado del Salary Config (9 rangos por defecto)
  const [salarySettings, setSalarySettings] = useState([
    { teamVolume: 10000, bonus: 100 },
    { teamVolume: 25000, bonus: 300 },
    { teamVolume: 40000, bonus: 500 },
    { teamVolume: 65000, bonus: 800 },
    { teamVolume: 100000, bonus: 1500 },
    { teamVolume: 200000, bonus: 4000 },
    { teamVolume: 400000, bonus: 7500 },
    { teamVolume: 800000, bonus: 20000 },
    { teamVolume: 1000000, bonus: 30000 }
  ]);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados controlados para configuración general
  const [settings, setSettings] = useState({
    id: '', // Para upsert
    min_investment: 10,
    max_investment: 10000,
    daily_roi: 2.2,
    roi_cap: 200,
    min_withdrawal: 25,
    withdrawal_fee: 5,
    credit_transfer_fee: 5,
    support_whatsapp: '',
    instagram_link: '',
    youtube_link: '',
    // Ventana de retiros
    withdrawal_global_blocked: false,
    withdrawal_window_enabled: true,
    withdrawal_open_day: 0 as number | null,
    withdrawal_open_hour: 9,
    withdrawal_close_hour: 14,
  });

  // Estado del Plan Residual (30 Niveles Individuales)
  const [residualSettings, setResidualSettings] = useState(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const level = i + 1;
      let percent = 0;
      let detail = 'Liderazgo Global';
      let color = 'text-rose-400';

      if (level === 1) {
        percent = 10;
        detail = 'Compensación Directa';
        color = 'text-indigo-400';
      } else if (level === 2) {
        percent = 5;
        detail = 'Crecimiento de Red';
        color = 'text-indigo-400';
      } else if (level === 3) {
        percent = 3;
        detail = 'Crecimiento de Red';
        color = 'text-indigo-400';
      } else if (level >= 4 && level <= 10) {
        percent = 2;
        detail = 'Crecimiento de Red';
        color = 'text-emerald-400';
      } else if (level >= 11 && level <= 20) {
        percent = 1;
        detail = 'Liderazgo Global';
        color = 'text-amber-400';
      } else if (level >= 21 && level <= 30) {
        percent = 0.8;
        detail = 'Liderazgo Global';
        color = 'text-rose-400';
      }

      return {
        id: level,
        range: `Nivel ${level}`,
        percent,
        detail,
        levels: 1,
        color
      };
    });
  });

  // Estado para actualización masiva (Modo Experto)
  const [bulkConfig, setBulkConfig] = useState({
    startLevel: 1,
    endLevel: 30,
    percentage: 1
  });

  useEffect(() => {
    fetchSettings();
    fetchLandingStats();
  }, []);

  const fetchSettings = async () => {
    setFetching(true);
    if (!isSupabaseConfigured()) {
      setFetching(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          id: data.id,
          min_investment: data.min_investment,
          max_investment: data.max_investment,
          daily_roi: data.daily_roi,
          roi_cap: data.roi_cap,
          min_withdrawal: data.min_withdrawal,
          withdrawal_fee: data.withdrawal_fee,
          credit_transfer_fee: data.credit_transfer_fee,
          support_whatsapp: data.support_whatsapp || '',
          instagram_link: data.instagram_link || '',
          youtube_link: data.youtube_link || '',
          // Ventana de retiros
          withdrawal_global_blocked: data.withdrawal_global_blocked ?? false,
          withdrawal_window_enabled: data.withdrawal_window_enabled ?? true,
          withdrawal_open_day: data.withdrawal_open_day ?? 6,
          withdrawal_open_hour: data.withdrawal_open_hour ?? 9,
          withdrawal_close_hour: data.withdrawal_close_hour ?? 14,
        });

        // Cargar override si existe
        if (data.withdrawal_override_until) {
          const until = new Date(data.withdrawal_override_until);
          if (until > new Date()) setOverrideUntil(until);
        }

        if (data.residual_config && Array.isArray(data.residual_config)) {
          if (data.residual_config.length < 30) {
            console.log("Migrating residual config to 30 levels...");
          } else {
            setResidualSettings(data.residual_config);
          }
        }

        // Cargar salary_config
        if (data.salary_config && Array.isArray(data.salary_config)) {
          setSalarySettings(data.salary_config);
        }
      }
    } catch (err: any) {
      console.error("Error fetching settings:", err);
    } finally {
      setFetching(false);
    }
  };

  const fetchLandingStats = async () => {
    try {
      const { data } = await supabase.from('site_stats').select('*').limit(1).single();
      if (data) {
        setLandingStats({
          active_investors: data.active_investors ?? 0,
          countries: data.countries ?? 0,
          total_payouts: data.total_payouts ?? 0,
          years_in_market: data.years_in_market ?? 0
        });
      }
    } catch (_) {}
  };

  const saveLandingStats = async () => {
    setLandingStatsLoading(true);
    try {
      const { data: existing } = await supabase.from('site_stats').select('id').limit(1).single();
      if (existing?.id) {
        await supabase.from('site_stats').update(landingStats).eq('id', existing.id);
      } else {
        await supabase.from('site_stats').insert(landingStats);
      }
      setSuccess('Estadísticas del landing actualizadas.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Error al guardar estadísticas: ' + err.message);
    } finally {
      setLandingStatsLoading(false);
    }
  };

  // Cálculo del total residual (ahora es la suma simple de los 30 niveles)
  const totalResidualPercent = useMemo(() => {
    return residualSettings.reduce((acc, curr) => acc + curr.percent, 0);
  }, [residualSettings]);

  const handleUpdateResidual = (id: number, newValue: string) => {
    const val = parseFloat(newValue) || 0;
    setResidualSettings(prev => prev.map(item =>
      item.id === id ? { ...item, percent: val } : item
    ));
  };

  const handleBulkUpdate = () => {
    const start = Math.max(1, Math.min(30, bulkConfig.startLevel));
    const end = Math.max(1, Math.min(30, bulkConfig.endLevel));

    setResidualSettings(prev => prev.map(item => {
      if (item.id >= start && item.id <= end) {
        return { ...item, percent: bulkConfig.percentage };
      }
      return item;
    }));

    setSuccess(`Sincronización masiva: Niveles ${start} al ${end} ajustados al ${bulkConfig.percentage}%`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const resetResidual = () => {
    if (window.confirm("¿Restablecer el plan residual a los valores por defecto?")) {
      setResidualSettings(Array.from({ length: 30 }, (_, i) => {
        const level = i + 1;
        let percent = 0;
        let detail = 'Liderazgo Global';
        let color = 'text-rose-400';

        if (level === 1) {
          percent = 10;
          detail = 'Compensación Directa';
          color = 'text-indigo-400';
        } else if (level === 2) {
          percent = 5;
          detail = 'Crecimiento de Red';
          color = 'text-indigo-400';
        } else if (level === 3) {
          percent = 3;
          detail = 'Crecimiento de Red';
          color = 'text-indigo-400';
        } else if (level >= 4 && level <= 10) {
          percent = 2;
          detail = 'Crecimiento de Red';
          color = 'text-emerald-400';
        } else if (level >= 11 && level <= 20) {
          percent = 1;
          detail = 'Liderazgo Global';
          color = 'text-amber-400';
        } else if (level >= 21 && level <= 30) {
          percent = 0.8;
          detail = 'Liderazgo Global';
          color = 'text-rose-400';
        }

        return {
          id: level,
          range: `Nivel ${level}`,
          percent,
          detail,
          levels: 1,
          color
        };
      }));
    }
  };

  const activateOverride = async (hours: number) => {
    setOverrideLoading(true);
    try {
      const until = new Date(Date.now() + hours * 3600 * 1000);
      const { error } = await supabase
        .from('system_settings')
        .update({
          withdrawal_override_until: until.toISOString(),
          withdrawal_global_blocked: false
        })
        .eq('id', settings.id);
      if (error) throw error;
      setOverrideUntil(until);
      setSettings(prev => ({ ...prev, withdrawal_global_blocked: false }));
      setSuccess(`Retiros desbloqueados por ${hours} hora${hours !== 1 ? 's' : ''}. Se cerrarán automáticamente.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError('Error al activar override: ' + err.message);
    } finally {
      setOverrideLoading(false);
    }
  };

  const cancelOverride = async () => {
    setOverrideLoading(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ withdrawal_override_until: null })
        .eq('id', settings.id);
      if (error) throw error;
      setOverrideUntil(null);
      setSuccess('Override cancelado. La ventana horaria normal está activa.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Error al cancelar override: ' + err.message);
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleApplySettings = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Build payload with only columns that exist in system_settings table
    const payload: Record<string, any> = {
      min_investment: settings.min_investment,
      max_investment: settings.max_investment,
      daily_roi: settings.daily_roi,
      roi_cap: settings.roi_cap,
      min_withdrawal: settings.min_withdrawal,
      withdrawal_fee: settings.withdrawal_fee,
      credit_transfer_fee: settings.credit_transfer_fee,
      support_whatsapp: settings.support_whatsapp,
      withdrawal_global_blocked: settings.withdrawal_global_blocked,
      withdrawal_window_enabled: settings.withdrawal_window_enabled,
      withdrawal_open_day: settings.withdrawal_open_day,
      withdrawal_open_hour: settings.withdrawal_open_hour,
      withdrawal_close_hour: settings.withdrawal_close_hour,
      residual_config: residualSettings,
      salary_config: salarySettings,
      updated_at: new Date().toISOString(),
    };

    const finalPayload = settings.id ? { ...payload, id: settings.id } : payload;

    if (totalResidualPercent > 100) {
      const confirmSave = window.confirm(
        `🚨 LEY MASTER (GOLDEN RULE): La carga total del plan residual es del ${totalResidualPercent}%. 
        Superar el 100% implica que la empresa pagará más en comisiones de lo que ingresa por inversión.
        
        ¿Deseas sincronizar este ecosistema de alto riesgo?`
      );
      if (!confirmSave) {
        setLoading(false);
        return;
      }
    }

    try {
      const { data, error: upsertError } = await supabase
        .from('system_settings')
        .upsert(finalPayload)
        .select()
        .single();

      if (upsertError) throw upsertError;

      if (data) {
        setSettings(prev => ({ ...prev, id: data.id }));
        setSuccess("Configuración del sistema sincronizada correctamente.");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      console.error("Settings Save Error:", err);
      setError("Error al guardar configuración: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <style>{`
        /* Hide spin-buttons for Chrome, Safari, Edge, Opera */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Hide spin-buttons for Firefox */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-50 tracking-tight">System Configuration</h1>
          <p className="text-slate-400 font-medium">Parámetros maestros de NOVA DIGITAL: Retiros, Límites y Plan de Compensación.</p>
        </div>
        <div className={`transition-all duration-700 border-2 px-8 py-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center min-w-[200px] backdrop-blur-xl relative overflow-hidden group ${totalResidualPercent > 100
          ? 'bg-rose-500/10 border-rose-500/20 shadow-rose-900/20'
          : 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-900/20'
          }`}>
          {/* Animated Background Pulse */}
          <div className={`absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity animate-pulse ${totalResidualPercent > 100 ? 'bg-rose-500' : 'bg-emerald-500'
            }`}></div>

          <p className={`relative z-10 text-[10px] font-black uppercase tracking-[0.3em] text-center mb-1.5 ${totalResidualPercent > 100 ? 'text-rose-400' : 'text-emerald-500'
            }`}>Residual Master Yield</p>
          <div className="relative z-10 flex items-baseline gap-1">
            <p className="text-4xl font-black text-white tracking-tighter drop-shadow-lg">{totalResidualPercent}%</p>
            <span className="text-xs font-bold opacity-40 uppercase tracking-widest text-white">Load</span>
          </div>

          {/* Sustainability Bar Indicator */}
          <div className="relative z-10 w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden border border-white/5">
            <div
              className={`h-full transition-all duration-1000 shadow-[0_0_15px_rgba(255,255,255,0.5)] ${totalResidualPercent > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              style={{ width: `${Math.min((totalResidualPercent / 200) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center space-x-3 text-emerald-500 animate-in slide-in-from-top-2 shadow-xl">
          <CheckCircle2 size={20} />
          <span className="font-bold">{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center space-x-3 text-rose-500 animate-in slide-in-from-top-2 shadow-xl">
          <AlertCircle size={20} />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {fetching ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-2">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'general' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <Globe size={18} />
              <span>General & Límites</span>
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'fees' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <Percent size={18} />
              <span>Retiros & Tasas</span>
            </button>
            <button
              onClick={() => setActiveTab('residual')}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'residual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <ListTree size={18} />
              <span>Plan Residual (30L)</span>
            </button>
            <button
              onClick={() => setActiveTab('salary')}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'salary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <Target size={18} />
              <span>Salary Semanal</span>
            </button>
            <button
              onClick={() => setActiveTab('landing')}
              className={`w-full flex items-center space-x-3 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${activeTab === 'landing' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900'}`}
            >
              <Globe size={18} />
              <span>Landing Stats</span>
            </button>
          </div>

          <div className="lg:col-span-3 space-y-6">
            {activeTab === 'general' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center space-x-4 pb-6 border-b border-slate-800">
                  <SettingsIcon className="text-indigo-400" size={24} />
                  <h3 className="text-xl font-black text-slate-100">Parámetros Operativos</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Inversión Mínima (US$)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.min_investment}
                        onChange={(e) => setSettings({ ...settings, min_investment: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-indigo-500/50 rounded-2xl py-5 pl-10 pr-6 text-white font-black text-xl outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Inversión Máxima (US$)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.max_investment}
                        onChange={(e) => setSettings({ ...settings, max_investment: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-indigo-500/50 rounded-2xl py-5 pl-10 pr-6 text-white font-black text-xl outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Daily ROI (Lunes a Lunes)</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        step="0.1"
                        value={settings.daily_roi}
                        onChange={(e) => setSettings({ ...settings, daily_roi: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-indigo-500/50 rounded-2xl py-5 px-6 text-indigo-400 font-black text-xl outline-none transition-all shadow-inner"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-indigo-500 font-black">%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hito de Duplicación (Progress Cap)</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.roi_cap}
                        onChange={(e) => setSettings({ ...settings, roi_cap: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-indigo-500/50 rounded-2xl py-5 px-6 text-emerald-400 font-black text-xl outline-none transition-all shadow-inner"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 font-black">%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Soporte Directo (WhatsApp)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">+</span>
                      <input
                        type="text"
                        placeholder="573001234567"
                        value={settings.support_whatsapp}
                        onChange={(e) => setSettings({ ...settings, support_whatsapp: e.target.value.replace(/\D/g, '') })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-indigo-500/50 rounded-2xl py-5 pl-10 pr-6 text-white font-black text-xl outline-none transition-all shadow-inner"
                      />
                    </div>
                    <p className="text-[8px] text-slate-600 font-bold uppercase ml-1 italic">Ingresa el número con código de país, sin el símbolo "+".</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fees' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center space-x-4 pb-6 border-b border-slate-800">
                  <Percent className="text-rose-400" size={24} />
                  <h3 className="text-xl font-black text-slate-100">Retiros & Tasas</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Retiro Mínimo (US$)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.min_withdrawal}
                        onChange={(e) => setSettings({ ...settings, min_withdrawal: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-rose-500/50 rounded-2xl py-5 pl-10 pr-6 text-white font-black text-xl outline-none transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Comisión por Retiro (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.withdrawal_fee}
                        onChange={(e) => setSettings({ ...settings, withdrawal_fee: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-rose-500/50 rounded-2xl py-5 px-6 text-rose-400 font-black text-xl outline-none transition-all shadow-inner"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-rose-500 font-black">%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fee por Transferencia de Crédito (%)</label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={settings.credit_transfer_fee || 0}
                        onChange={(e) => setSettings({ ...settings, credit_transfer_fee: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-black/40 border-2 border-slate-800 focus:border-amber-500/50 rounded-2xl py-5 px-6 text-amber-400 font-black text-xl outline-none transition-all shadow-inner"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-amber-500 font-black">%</span>
                    </div>
                  </div>
                </div>
                {/* ═══ VENTANA HORARIA DE RETIROS ═══ */}
                <div className="pt-6 border-t border-slate-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest">Ventana Horaria de Retiros</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">Controla cuándo los usuarios pueden retirar fondos</p>
                    </div>
                  </div>

                  {/* BLOQUEO GLOBAL */}
                  <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${settings.withdrawal_global_blocked ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-900/50 border-slate-800'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${settings.withdrawal_global_blocked ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                        <LockKeyhole size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">Bloquear TODOS los Retiros</p>
                        <p className="text-[10px] text-slate-500 font-bold">Kill switch de emergencia — anula cualquier otra configuración</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, withdrawal_global_blocked: !settings.withdrawal_global_blocked })}
                      className={`w-14 h-8 rounded-full transition-all relative flex-shrink-0 ${settings.withdrawal_global_blocked ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${settings.withdrawal_global_blocked ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* RESTRICCIÓN DE VENTANA HORARIA */}
                  <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${settings.withdrawal_window_enabled ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                    <div>
                      <p className="text-sm font-black text-white">Restricción de Ventana Horaria</p>
                      <p className="text-[10px] text-slate-500 font-bold">
                        {settings.withdrawal_window_enabled ? 'ACTIVA — Solo en el día/hora configurados' : 'INACTIVA — Retiros abiertos 24/7'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSettings({ ...settings, withdrawal_window_enabled: !settings.withdrawal_window_enabled })}
                      className={`w-14 h-8 rounded-full transition-all relative flex-shrink-0 ${settings.withdrawal_window_enabled ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${settings.withdrawal_window_enabled ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* CONFIGURACIÓN DE DÍA Y HORA (visible solo si la ventana está activa) */}
                  {settings.withdrawal_window_enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-2">
                      {/* DÍA */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Día de la Semana</label>
                        <select
                          value={settings.withdrawal_open_day === null ? 'null' : settings.withdrawal_open_day}
                          onChange={(e) => setSettings({ ...settings, withdrawal_open_day: e.target.value === 'null' ? null : parseInt(e.target.value) })}
                          className="w-full bg-black/40 border-2 border-slate-800 focus:border-amber-500/50 rounded-2xl py-4 px-5 text-white font-bold text-sm outline-none transition-all"
                        >
                          <option value="null">Todos los días</option>
                          <option value="0">Domingo</option>
                          <option value="1">Lunes</option>
                          <option value="2">Martes</option>
                          <option value="3">Miércoles</option>
                          <option value="4">Jueves</option>
                          <option value="5">Viernes</option>
                          <option value="6">Sábado</option>
                        </select>
                      </div>

                      {/* HORA APERTURA */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora Apertura (UTC-4)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={0} max={23}
                            value={settings.withdrawal_open_hour}
                            onChange={(e) => setSettings({ ...settings, withdrawal_open_hour: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })}
                            className="w-full bg-black/40 border-2 border-slate-800 focus:border-emerald-500/50 rounded-2xl py-4 px-5 text-emerald-400 font-black text-xl outline-none transition-all"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-bold">h</span>
                        </div>
                      </div>

                      {/* HORA CIERRE */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora Cierre (UTC-4)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min={1} max={24}
                            value={settings.withdrawal_close_hour}
                            onChange={(e) => setSettings({ ...settings, withdrawal_close_hour: Math.max(1, Math.min(24, parseInt(e.target.value) || 14)) })}
                            className="w-full bg-black/40 border-2 border-slate-800 focus:border-red-500/50 rounded-2xl py-4 px-5 text-red-400 font-black text-xl outline-none transition-all"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-bold">h</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW */}
                  <div className="bg-slate-950/60 border border-slate-800/60 rounded-2xl p-4 text-center">
                    {settings.withdrawal_global_blocked ? (
                      <p className="text-sm font-black text-red-400">🔴 RETIROS BLOQUEADOS GLOBALMENTE</p>
                    ) : overrideUntil ? (
                      <p className="text-sm font-black text-emerald-400">🟢 OVERRIDE ACTIVO — Retiros abiertos hasta las {overrideUntil.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</p>
                    ) : !settings.withdrawal_window_enabled ? (
                      <p className="text-sm font-black text-emerald-400">🟢 Retiros disponibles 24/7</p>
                    ) : (
                      <p className="text-sm font-bold text-amber-400">
                        🕐 Ventana: {settings.withdrawal_open_day === null ? 'Todos los días' : ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][settings.withdrawal_open_day as number]} · {String(settings.withdrawal_open_hour).padStart(2,'0')}:00 – {String(settings.withdrawal_close_hour).padStart(2,'0')}:00 UTC-4
                      </p>
                    )}
                  </div>

                  {/* ═══ OVERRIDE MANUAL ═══ */}
                  <div className={`rounded-[2rem] border p-6 space-y-5 transition-all ${overrideUntil ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-950/40 border-slate-800/60'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${overrideUntil ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                        <Timer size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-widest">Override Manual de Retiros</p>
                        <p className="text-[10px] text-slate-500 font-bold">Desbloquea temporalmente sin afectar la configuración permanente</p>
                      </div>
                      {overrideUntil && (
                        <div className="ml-auto flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2">
                          <Clock size={12} className="text-emerald-400" />
                          <span className="text-emerald-400 font-black text-sm font-mono">{countdown}</span>
                        </div>
                      )}
                    </div>

                    {!overrideUntil ? (
                      <>
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Duración del desbloqueo</p>
                          <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 6, 12, 24].map(h => (
                              <button
                                key={h}
                                onClick={() => setOverrideHours(h)}
                                className={`px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${overrideHours === h ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-emerald-500/40 hover:text-white'}`}
                              >
                                {h}h
                              </button>
                            ))}
                            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3">
                              <input
                                type="number"
                                min={1}
                                max={72}
                                value={overrideHours}
                                onChange={e => setOverrideHours(Math.max(1, Math.min(72, parseInt(e.target.value) || 1)))}
                                className="w-12 bg-transparent text-white font-black text-sm text-center outline-none py-2"
                              />
                              <span className="text-slate-500 text-xs font-bold">h</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => activateOverride(overrideHours)}
                          disabled={overrideLoading || settings.withdrawal_global_blocked}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                        >
                          {overrideLoading ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                          Desbloquear retiros por {overrideHours} hora{overrideHours !== 1 ? 's' : ''} ahora
                        </button>
                        {settings.withdrawal_global_blocked && (
                          <p className="text-[10px] text-red-400 font-bold text-center">Desactiva el bloqueo global primero para usar el override.</p>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-1">
                          <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Override activo hasta</p>
                          <p className="text-lg font-black text-white">{overrideUntil.toLocaleString('es', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="text-[10px] text-slate-500 font-bold">Los retiros se bloquearán automáticamente al vencer</p>
                        </div>
                        <button
                          onClick={cancelOverride}
                          disabled={overrideLoading}
                          className="w-full flex items-center justify-center gap-3 py-4 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                        >
                          {overrideLoading ? <Loader2 size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
                          Cancelar Override y Cerrar Ahora
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'residual' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-400">
                      <Layers size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-100 tracking-tight">Estructura Residual</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">30 Niveles de Profundidad</p>
                    </div>
                  </div>
                  <button
                    onClick={resetResidual}
                    className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-2xl transition-all"
                    title="Restablecer Valores"
                  >
                    <RotateCcw size={20} />
                  </button>
                </div>

                <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-3xl flex items-start gap-4 mb-4">
                  <Zap className="text-indigo-400 shrink-0 mt-1" size={18} />
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
                    "Ajusta el porcentaje pagado por cada nivel dentro del rango. El sistema calculará la carga total sobre el capital invertido."
                  </p>
                </div>

                {/* Herramienta de Actualización Masiva (Simplificación) */}
                <div className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Zap size={60} className="text-indigo-400" />
                  </div>

                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-shrink-0">
                      <h4 className="text-indigo-400 font-black text-xs uppercase tracking-[0.3em] mb-1">Editor Inteligente</h4>
                      <p className="text-white font-black text-xl">Ajuste por Bloques</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 flex-grow">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Del Nivel</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={bulkConfig.startLevel}
                          onChange={(e) => setBulkConfig({ ...bulkConfig, startLevel: parseInt(e.target.value) || 1 })}
                          className="w-20 bg-black/60 border border-slate-800 rounded-xl py-3 px-4 text-white font-black text-center outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Al Nivel</label>
                        <input
                          type="number"
                          min="1"
                          max="30"
                          value={bulkConfig.endLevel}
                          onChange={(e) => setBulkConfig({ ...bulkConfig, endLevel: parseInt(e.target.value) || 1 })}
                          className="w-20 bg-black/60 border border-slate-800 rounded-xl py-3 px-4 text-white font-black text-center outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block ml-1">Nuevo %</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={bulkConfig.percentage}
                            onChange={(e) => setBulkConfig({ ...bulkConfig, percentage: parseFloat(e.target.value) || 0 })}
                            className="w-24 bg-black/60 border border-slate-800 rounded-xl py-3 px-4 text-indigo-400 font-black text-center outline-none focus:border-indigo-500/50"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 font-black text-xs">%</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleBulkUpdate}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-3"
                    >
                      <Save size={16} />
                      <span>Aplicar Bloque</span>
                    </button>
                  </div>
                </div>

                <div className="pt-4 pb-2">
                  <h4 className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <Edit3 size={12} className="text-indigo-400" />
                    Edición Individual por Nivel
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-h-[700px] overflow-y-auto pr-3 custom-scrollbar p-1">
                  {residualSettings.map((level) => (
                    <div
                      key={level.id}
                      className="bg-[#090b11] border border-slate-800/60 p-6 rounded-[2.5rem] flex items-center justify-between gap-6 group hover:border-indigo-500/30 hover:bg-[#0d0f17] transition-all duration-500 relative overflow-hidden shadow-2xl"
                    >
                      {/* Background Gradient Detail */}
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                      <div className="flex items-center space-x-5 relative z-10">
                        <div className={`w-14 h-14 rounded-3xl bg-slate-900 border border-slate-800/80 flex items-center justify-center font-black text-xl transition-all duration-500 group-hover:scale-110 group-hover:border-indigo-500/40 shadow-xl ${level.color}`}>
                          L{level.id}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-white uppercase tracking-wider group-hover:text-indigo-100 transition-colors">
                            {level.range}
                          </p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] opacity-80">
                            {level.detail}
                          </p>
                        </div>
                      </div>

                      <div className="relative z-10">
                        <ResidualInput
                          value={level.percent}
                          onChange={(val) => handleUpdateResidual(level.id, val)}
                          title={`Editar porcentaje para ${level.range}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {totalResidualPercent > 200 && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-center space-x-4 text-rose-500 animate-pulse">
                    <AlertCircle size={24} className="shrink-0" />
                    <p className="text-xs font-black uppercase tracking-widest leading-relaxed">
                      Alerta de Sostenibilidad: El plan residual supera el 200%. El ecosistema puede ser insolvente.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'salary' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-amber-600/10 rounded-2xl text-amber-400">
                      <Target size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-100 tracking-tight">Salary Semanal</h3>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tabla de Bonos por Volumen de Equipo</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSalarySettings(prev => [...prev, { teamVolume: 0, bonus: 0 }]);
                    }}
                    className="px-6 py-3 bg-amber-600/10 border border-amber-500/30 text-amber-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600/20 transition-all"
                  >
                    + Agregar Rango
                  </button>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-3xl flex items-start gap-4">
                  <Zap className="text-amber-400 shrink-0 mt-1" size={18} />
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
                    "Configura los rangos de volumen de equipo y sus bonos semanales correspondientes. El bono se paga cada domingo."
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 px-6 py-3">
                    <div className="col-span-1 text-[9px] font-black text-slate-600 uppercase tracking-widest">#</div>
                    <div className="col-span-5 text-[9px] font-black text-slate-600 uppercase tracking-widest">Volumen de Equipo (US$)</div>
                    <div className="col-span-4 text-[9px] font-black text-slate-600 uppercase tracking-widest">Bono Semanal (US$)</div>
                    <div className="col-span-2"></div>
                  </div>

                  {salarySettings
                    .sort((a, b) => a.teamVolume - b.teamVolume)
                    .map((tier, index) => (
                      <div key={index} className="grid grid-cols-12 gap-4 items-center bg-[#090b11] border border-slate-800/60 p-4 rounded-2xl group hover:border-amber-500/30 transition-all">
                        <div className="col-span-1">
                          <span className="text-amber-400 font-black text-lg">R{index + 1}</span>
                        </div>
                        <div className="col-span-5">
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={tier.teamVolume}
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                setSalarySettings(prev => prev.map((t, i) => i === index ? { ...t, teamVolume: val } : t));
                              }}
                              className="w-full bg-black/60 border border-slate-800 rounded-xl py-3 pl-9 pr-4 text-white font-black text-base outline-none focus:border-amber-500/50 transition-all"
                            />
                          </div>
                        </div>
                        <div className="col-span-4">
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500 font-bold text-sm">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={tier.bonus}
                              onChange={(e) => {
                                const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                setSalarySettings(prev => prev.map((t, i) => i === index ? { ...t, bonus: val } : t));
                              }}
                              className="w-full bg-black/60 border border-slate-800 rounded-xl py-3 pl-9 pr-4 text-amber-400 font-black text-base outline-none focus:border-amber-500/50 transition-all"
                            />
                          </div>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <button
                            onClick={() => setSalarySettings(prev => prev.filter((_, i) => i !== index))}
                            className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Eliminar rango"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Info size={18} className="text-amber-500" />
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{salarySettings.length} rangos configurados</span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-black">Bono máx: ${Math.max(...salarySettings.map(s => s.bonus)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            {activeTab === 'landing' && (
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 space-y-8 shadow-2xl animate-in fade-in duration-300">
                <div className="flex items-center space-x-4 pb-6 border-b border-slate-800">
                  <Globe className="text-indigo-400" size={24} />
                  <h3 className="text-xl font-black text-slate-100">Estadísticas Landing Page</h3>
                </div>
                <p className="text-slate-400 text-sm">Estos valores se muestran en la sección de estadísticas del landing page público.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { key: 'active_investors', label: 'Active Investors', suffix: '+' },
                    { key: 'countries', label: 'Countries', suffix: '+' },
                    { key: 'total_payouts', label: 'Total Payouts ($)', suffix: '+' },
                    { key: 'years_in_market', label: 'Years in Market', suffix: '' }
                  ].map(({ key, label, suffix }) => (
                    <div key={key} className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</label>
                      <div className="flex items-center gap-2 bg-[#05070a] border border-slate-800 rounded-2xl px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          value={landingStats[key as keyof typeof landingStats]}
                          onChange={e => setLandingStats(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="flex-1 bg-transparent border-none p-0 text-white font-black text-xl focus:ring-0 outline-none tabular-nums"
                        />
                        {suffix && <span className="text-indigo-400 font-black text-sm">{suffix}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={saveLandingStats}
                    disabled={landingStatsLoading}
                    className="flex items-center space-x-3 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.75rem] shadow-2xl shadow-indigo-600/30 transition-all font-black uppercase text-xs tracking-[0.2em] active:scale-95 disabled:opacity-50"
                  >
                    {landingStatsLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span>Guardar Estadísticas</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab !== 'landing' && (
            <div className="flex justify-end pt-4">

              <button
                onClick={handleApplySettings}
                disabled={loading}
                className="flex items-center space-x-3 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.75rem] shadow-2xl shadow-indigo-600/30 transition-all font-black uppercase text-xs tracking-[0.2em] active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>Sincronizar Ecosistema</span>
              </button>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
