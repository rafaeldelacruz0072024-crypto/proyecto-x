import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CreditLog } from '../types';
import {
    History,
    RefreshCw,
    Search,
    FileText,
    ArrowUpRight,
    Filter,
    TrendingUp,
    Zap,
    Target,
    Activity,
    Calendar,
    ChevronRight
} from 'lucide-react';

const Commissions: React.FC = () => {
    const [logs, setLogs] = useState<CreditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterLevel, setFilterLevel] = useState<string>('all');

    useEffect(() => {
        fetchCommissions();
    }, []);

    const fetchCommissions = async () => {
        setLoading(true);
        try {
            // 1. Fetch from transactions (fuente principal — sin JOIN para evitar RLS)
            const { data: txLogs } = await supabase
                .from('transactions')
                .select('*')
                .in('type', ['REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'BONUS', 'DAILY_RETURN', 'DEPOSIT', 'ADMIN_ADJUSTMENT'])
                .order('created_at', { ascending: false })
                .limit(500);

            // 2. Fetch from credit_logs si existe (no lanzar error si no existe)
            const { data: creditLogs } = await supabase
                .from('credit_logs')
                .select('*')
                .in('type', ['ADMIN_ADJUSTMENT', 'BONUS', 'REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'DEPOSIT'])
                .order('created_at', { ascending: false })
                .limit(200);

            // 3. Unificar
            const combined = [
                ...(txLogs || []),
                ...(creditLogs || [])
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // 4. Enriquecer con profiles manualmente (más confiable que JOIN con RLS)
            if (combined.length > 0) {
                const uniqueIds = [...new Set(combined.map((r: any) => r.user_id).filter(Boolean))];
                const { data: profRows } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, email')
                    .in('id', uniqueIds as string[]);
                const profMap: Record<string, any> = {};
                (profRows || []).forEach((p: any) => { profMap[p.id] = p; });
                const enriched = combined.map((r: any) => ({ ...r, profiles: profMap[r.user_id] || null }));
                setLogs(enriched as any);
            } else {
                setLogs([]);
            }
        } catch (err) {
            console.error('Error fetching commission logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                (log.profiles as any)?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.profiles as any)?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.profiles as any)?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.description?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesType = filterType === 'all' ||
                (filterType === 'WEEKLY_BONUS' ? (log.type === 'WEEKLY_BONUS' || log.type === 'bonus_weekly') :
                    filterType === 'ADMIN_ADJUSTMENTS' ? (log.type === 'ADMIN_ADJUSTMENT' || log.type === 'BONUS') :
                        log.type === filterType);
            const matchesLevel = filterLevel === 'all' ||
                log.description?.toLowerCase().includes(`level ${filterLevel}`) ||
                log.description?.toLowerCase().includes(`nivel ${filterLevel}`);

            return matchesSearch && matchesType && matchesLevel;
        });
    }, [logs, searchTerm, filterType, filterLevel]);

    const stats = useMemo(() => {
        // Total includes all earnings and adjustments
        const total = logs
            .filter(l => ['REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'BONUS', 'ADMIN_ADJUSTMENT', 'DAILY_RETURN'].includes(l.type))
            .reduce((sum, log) => sum + (Number(log.amount) || 0), 0);

        const today = logs
            .filter(log =>
                new Date(log.created_at).toLocaleDateString() === new Date().toLocaleDateString() &&
                ['REFERRAL_COMMISSION', 'WEEKLY_BONUS', 'bonus_weekly', 'BONUS', 'ADMIN_ADJUSTMENT', 'DAILY_RETURN'].includes(log.type)
            )
            .reduce((sum, log) => sum + (Number(log.amount) || 0), 0);

        const types = {
            referral: logs.filter(l => l.type === 'REFERRAL_COMMISSION').length,
            weekly: logs.filter(l => l.type === 'WEEKLY_BONUS' || l.type === 'bonus_weekly').length,
            roi: logs.filter(l => l.type === 'DAILY_RETURN').length,
            adjustments: logs.filter(l => l.type === 'ADMIN_ADJUSTMENT' || l.type === 'BONUS').length
        };

        return { total, today, types };
    }, [logs]);

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700 bg-[#0c0c0e] min-h-screen text-slate-300">
            {/* Header Maestro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h1 className="text-5xl font-black text-white tracking-tighter flex items-center gap-5 uppercase italic">
                        <div className="p-4 bg-yellow-500/10 rounded-[2rem] border border-yellow-500/20 shadow-[0_0_30px_#eab30811]">
                            <History className="text-yellow-500" size={36} />
                        </div>
                        Commission Logs
                    </h1>
                    <div className="flex items-center gap-3 mt-4">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#eab308]" />
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Auditoría Financiera en Tiempo Real</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-[#111114] border border-slate-800 p-2 rounded-2xl flex gap-2 shadow-2xl">
                        <button
                            onClick={fetchCommissions}
                            className="p-4 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition-all border border-transparent hover:border-slate-700 active:scale-95"
                            title="Recargar Datos"
                        >
                            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Panel de Métricas Premium */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#111114] border border-slate-800/50 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingUp size={80} className="text-yellow-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Total Ganancias Distribuidas</p>
                    <div className="space-y-4">
                        <p className="text-4xl font-black text-white tracking-tighter italic">
                            ${stats.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 bg-emerald-500/10 w-fit px-3 py-1 rounded-full border border-emerald-500/20">
                            <ArrowUpRight size={12} />
                            TODAY: +${stats.today.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                <div className="bg-[#111114] border border-slate-800/50 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Zap size={80} className="text-indigo-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Referral Bonuses (L1-L30)</p>
                    <p className="text-4xl font-black text-white tracking-tighter italic tabular-nums">{stats.types.referral}</p>
                    <p className="text-[9px] font-black text-indigo-500/60 mt-2 uppercase tracking-widest">Network Growth Events</p>
                </div>

                <div className="bg-[#111114] border border-slate-800/50 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Activity size={80} className="text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">ROI Diario Pagado</p>
                    <p className="text-4xl font-black text-white tracking-tighter italic tabular-nums">{stats.types.roi}</p>
                    <p className="text-[9px] font-black text-emerald-500/60 mt-2 uppercase tracking-widest">Passive Income Logs</p>
                </div>

                <div className="bg-[#111114] border border-slate-800/50 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
                        <Activity size={80} className="text-rose-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Weekly & Adjustments</p>
                    <p className="text-4xl font-black text-white tracking-tighter italic tabular-nums">{stats.types.weekly + stats.types.adjustments}</p>
                    <p className="text-[9px] font-black text-rose-500/60 mt-2 uppercase tracking-widest">Leadership & Manual Logs</p>
                </div>

            </div>

            {/* Centro de Control de Auditoría */}
            <div className="bg-[#111114] border border-slate-800/50 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                {/* Herramientas de Filtrado */}
                <div className="p-8 border-b border-slate-800/50 flex flex-col lg:flex-row gap-6 items-center">
                    <div className="relative flex-1 group w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-yellow-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por usuario, email o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#0c0c0e] border border-slate-800 rounded-2xl py-4 pl-14 pr-6 text-white text-sm font-bold focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all placeholder:text-slate-700"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                        <div className="flex items-center gap-3 bg-[#0c0c0e] border border-slate-800 p-2 rounded-2xl">
                            <Filter size={18} className="text-slate-600 ml-3" />
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="bg-transparent text-slate-400 text-[10px] font-black uppercase tracking-widest p-2 outline-none cursor-pointer border-r border-slate-800 pr-4"
                            >
                                <option value="all">TODOS LOS TIPOS</option>
                                <option value="REFERRAL_COMMISSION">REFERRAL COMMS</option>
                                <option value="WEEKLY_BONUS">WEEKLY SALARY</option>
                                <option value="ADMIN_ADJUSTMENTS">ADMIN ADJUSTS</option>
                            </select>
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="bg-transparent text-slate-400 text-[10px] font-black uppercase tracking-widest p-2 outline-none cursor-pointer pr-4"
                            >
                                <option value="all">TODOS LOS NIVELES</option>
                                {[...Array(30)].map((_, i) => (
                                    <option key={i + 1} value={(i + 1).toString()}>NIVEL {i + 1}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tabla de Auditoría */}
                <div className="overflow-x-auto scrollbar-none">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead className="bg-[#0c0c0e] text-slate-600 text-[9px] font-black uppercase tracking-[0.4em]">
                            <tr>
                                <th className="px-10 py-6 border-b border-slate-800 font-black">Identidad del Receptor</th>
                                <th className="px-10 py-6 border-b border-slate-800 font-black">Detalle Contable</th>
                                <th className="px-10 py-6 border-b border-slate-800 font-black text-right">Crédito Dispersado</th>
                                <th className="px-10 py-6 border-b border-slate-800 font-black text-right">Cierre Fiscal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 relative">
                            {loading && (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_#eab308]" />
                                            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] animate-pulse">Consultando Registros...</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-10 py-7 border-b border-slate-800/20">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-2xl bg-[#0c0c0e] border border-slate-800 flex items-center justify-center font-black text-xl text-yellow-500 shadow-xl group-hover:scale-105 transition-transform group-hover:border-yellow-500/30">
                                                {((log.profiles as any)?.full_name || (log.profiles as any)?.username || (log.profiles as any)?.email || 'U')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-white text-base tracking-tight uppercase group-hover:text-yellow-500 transition-colors">
                                                    {(log.profiles as any)?.full_name || (log.profiles as any)?.username || 'Usuario'}
                                                </p>
                                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1">{(log.profiles as any)?.email || '—'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7 border-b border-slate-800/20">
                                        <div className="space-y-1.5 max-w-sm">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${log.type === 'REFERRAL_COMMISSION' ? 'bg-indigo-500' : log.type === 'ADMIN_ADJUSTMENT' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                    {log.type.replace('_', ' ')}
                                                </p>
                                            </div>
                                            <p className="text-xs text-slate-400 font-bold leading-relaxed italic">
                                                {log.description}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7 border-b border-slate-800/20 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-2xl font-black text-white flex items-center gap-1 italic tracking-tighter">
                                                <ArrowUpRight size={18} className="text-yellow-500" />
                                                ${Number(log.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">Comisiones distribuidas</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7 border-b border-slate-800/20 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-2 text-slate-300 font-black text-[11px] uppercase tracking-tight">
                                                <Calendar size={12} className="text-slate-600" />
                                                {new Date(log.created_at).toLocaleDateString()}
                                            </div>
                                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!loading && filteredLogs.length === 0 && (
                        <div className="py-32 text-center space-y-6">
                            <div className="w-24 h-24 bg-slate-900 border border-slate-800 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                                <FileText size={48} className="text-slate-700" />
                            </div>
                            <div>
                                <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.5em]">No Audit Entries Found</p>
                                <p className="text-[9px] text-slate-700 font-bold mt-2">Adjust your filters to scan broader financial sectors</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer del Centro de Control */}
                <div className="p-8 bg-[#0c0c0e] border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-6">
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
                        Showing <span className="text-yellow-500">{filteredLogs.length}</span> entries of <span className="text-white">{logs.length}</span> total logs
                    </p>
                    <div className="flex gap-3">
                        <button className="px-6 py-3 bg-[#111114] border border-slate-800 rounded-xl text-[9px] font-black text-white uppercase tracking-widest hover:border-yellow-500/20 hover:bg-yellow-500/5 transition-all active:scale-95 shadow-xl">
                            Export Ledger
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Commissions;
