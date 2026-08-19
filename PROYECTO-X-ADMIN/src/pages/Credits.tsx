import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, CreditLog } from '../types';
import {
    Wallet, Coins, ArrowRightLeft, Users, Search, Plus, Minus, RefreshCw,
    History, Check, X, Loader2, TrendingUp, ArrowUpRight,
    ArrowDownLeft, ShieldCheck, Filter, Activity, Clock,
    Download, Calendar, Eye, DollarSign, Ban, CheckCircle2, KeyRound, AlertTriangle
} from 'lucide-react';

type FilterType = 'ALL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADMIN_ADJUSTMENT' | 'CONVERSION'
    | 'DAILY_ROI' | 'DAILY_RETURN' | 'REFERRAL_COMMISSION' | 'WEEKLY_BONUS' | 'bonus_weekly' | 'BONUS' | 'DEPOSIT';

interface EnrichedLog extends Omit<CreditLog, 'profiles'> {
    profiles?: { full_name: string | null; email: string };
}

// ── ALL possible log types fully mapped ──────────────────────────────────────
const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
    TRANSFER_IN:          { label: 'Recibido',       icon: <ArrowDownLeft size={13} />,  color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  border: 'border-emerald-500/30'  },
    TRANSFER_OUT:         { label: 'Enviado',         icon: <ArrowUpRight size={13} />,   color: 'text-rose-400',     bg: 'bg-rose-500/10',     border: 'border-rose-500/30'     },
    ADMIN_ADJUSTMENT:     { label: 'Ajuste Admin',    icon: <ShieldCheck size={13} />,    color: 'text-indigo-400',   bg: 'bg-indigo-500/10',   border: 'border-indigo-500/30'   },
    CONVERSION:           { label: 'Conversión',      icon: <ArrowRightLeft size={13} />, color: 'text-amber-400',    bg: 'bg-amber-500/10',    border: 'border-amber-500/30'    },
    DAILY_ROI:            { label: 'ROI Diario',      icon: <TrendingUp size={13} />,     color: 'text-cyan-400',     bg: 'bg-cyan-500/10',     border: 'border-cyan-500/30'     },
    DAILY_RETURN:         { label: 'ROI Diario',      icon: <TrendingUp size={13} />,     color: 'text-cyan-400',     bg: 'bg-cyan-500/10',     border: 'border-cyan-500/30'     },
    REFERRAL_COMMISSION:  { label: 'Comisión Red',    icon: <Users size={13} />,          color: 'text-purple-400',   bg: 'bg-purple-500/10',   border: 'border-purple-500/30'   },
    WEEKLY_BONUS:         { label: 'Bono Semanal',    icon: <DollarSign size={13} />,     color: 'text-yellow-400',   bg: 'bg-yellow-500/10',   border: 'border-yellow-500/30'   },
    bonus_weekly:         { label: 'Bono Semanal',    icon: <DollarSign size={13} />,     color: 'text-yellow-400',   bg: 'bg-yellow-500/10',   border: 'border-yellow-500/30'   },
    BONUS:                { label: 'Bono',            icon: <DollarSign size={13} />,     color: 'text-yellow-400',   bg: 'bg-yellow-500/10',   border: 'border-yellow-500/30'   },
    DEPOSIT:              { label: 'Depósito',        icon: <ArrowDownLeft size={13} />,  color: 'text-green-400',    bg: 'bg-green-500/10',    border: 'border-green-500/30'    },
};
const DEFAULT_META = { label: 'Sistema', icon: <Activity size={13} />, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' };

const PAGE_SIZE = 50;

const Credits: React.FC = () => {
    const [users, setUsers]           = useState<Profile[]>([]);
    const [logs, setLogs]             = useState<EnrichedLog[]>([]);
    const [loading, setLoading]       = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [historySearch, setHistorySearch] = useState('');
    const [activeFilter, setActiveFilter]   = useState<FilterType>('ALL');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [page, setPage]             = useState(1);
    const [totalLogs, setTotalLogs]   = useState(0);

    // Date range filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo]     = useState('');

    // Modal
    const [selectedUser, setSelectedUser]     = useState<Profile | null>(null);
    const [amount, setAmount]                 = useState('');
    const [actionType, setActionType]         = useState<'ADD' | 'SUBTRACT'>('ADD');
    const [targetBalance, setTargetBalance]   = useState<'wallet_balance' | 'credit_balance'>('wallet_balance');
    const [description, setDescription]       = useState('');

    // Password confirmation step for credit adjustments
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [adminPassword, setAdminPassword]             = useState('');
    const [pinError, setPinError]                       = useState('');

    // Per-user history modal
    const [userHistoryModal, setUserHistoryModal] = useState<Profile | null>(null);
    const [userLogs, setUserLogs]                 = useState<EnrichedLog[]>([]);
    const [userLogsLoading, setUserLogsLoading]   = useState(false);

    const MAX_ADJUSTMENT = 5000;

    useEffect(() => { fetchData(); }, [page, activeFilter, dateFrom, dateTo]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            ]);
            if (usersRes.error) throw usersRes.error;
            setUsers(usersRes.data || []);

            // Build logs query with filters
            let q = supabase
                .from('credit_logs')
                .select('*, profiles:user_id ( full_name, email )', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

            if (activeFilter !== 'ALL') q = q.eq('type', activeFilter);
            if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
            if (dateTo)   q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());

            const logsRes = await q;
            if (logsRes.error && logsRes.error.code !== '42P01') console.error(logsRes.error);

            setLogs(logsRes.data || []);
            setTotalLogs(logsRes.count || 0);
        } catch (err) {
            console.error('Error fetching credit data:', err);
        } finally {
            setLoading(false);
        }
    }, [page, activeFilter, dateFrom, dateTo]);

    const openUserHistory = async (user: Profile) => {
        setUserHistoryModal(user);
        setUserLogsLoading(true);
        const { data } = await supabase
            .from('credit_logs')
            .select('*, profiles:user_id ( full_name, email )')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(100);
        setUserLogs(data || []);
        setUserLogsLoading(false);
    };

    // Step 1: validate inputs and open password confirmation step
    const handleTransaction = () => {
        if (!selectedUser || !amount || parseFloat(amount) <= 0) return;
        const numAmount = parseFloat(amount);
        if (numAmount > MAX_ADJUSTMENT) {
            setPinError(`El monto máximo por ajuste manual es $${MAX_ADJUSTMENT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Realiza múltiples operaciones si es necesario.`);
            return;
        }
        setPinError('');
        setAdminPassword('');
        setShowPasswordConfirm(true);
    };

    // Step 2: verify admin password via Supabase auth, then execute
    const verifyAndExecute = async () => {
        if (!adminPassword) { setPinError('Ingresa tu contraseña para confirmar.'); return; }
        setActionLoading('transaction');
        setPinError('');
        try {
            // Re-authenticate with current admin credentials
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser?.email) throw new Error('No se pudo obtener el usuario activo.');

            const { error: authError } = await supabase.auth.signInWithPassword({
                email:    authUser.email,
                password: adminPassword,
            });
            if (authError) {
                setPinError('Contraseña incorrecta. Operación cancelada.');
                setActionLoading(null);
                return;
            }

            // Password verified — proceed with adjustment
            const numAmount    = parseFloat(amount);
            const finalAmount  = actionType === 'ADD' ? numAmount : -numAmount;
            const balanceLabel = targetBalance === 'wallet_balance' ? 'Wallet Bank' : 'Credit Balance';

            // El ajuste, el ledger y la transacción se ejecutan en una sola
            // operación SECURITY DEFINER. Así no queda el balance actualizado
            // si falta credit_logs o falla cualquiera de los registros.
            const { data: adjustment, error: adjustmentError } = await supabase.rpc('admin_adjust_balance', {
                p_user_id: selectedUser!.id,
                p_balance_column: targetBalance,
                p_amount: finalAmount,
                p_description: description || `Ajuste admin — ${balanceLabel}`,
            });
            if (adjustmentError) throw adjustmentError;
            if (!adjustment?.success) {
                throw new Error(adjustment?.error || 'No se pudo completar el ajuste de balance.');
            }

            // Reset all modal state
            setSelectedUser(null);
            setAmount('');
            setDescription('');
            setTargetBalance('wallet_balance');
            setShowPasswordConfirm(false);
            setAdminPassword('');
            setPage(1);
            fetchData();
        } catch (err: any) {
            setPinError('Error: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // ── Toggle Transfer Block ─────────────────────────────────────────────────
    const handleToggleTransferBlock = async (user: Profile) => {
        const newState = !user.transfer_blocked;
        const action = newState ? 'BLOQUEAR' : 'DESBLOQUEAR';
        if (!window.confirm(`¿${action} las transferencias de crédito de "${user.full_name || user.email}"?`)) return;
        setActionLoading(user.id);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ transfer_blocked: newState })
                .eq('id', user.id);
            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, transfer_blocked: newState } : u));
            const adminId = (await supabase.auth.getUser()).data.user?.id;
            await supabase.from('credit_logs').insert({
                user_id:      user.id,
                amount:       0,
                type:         'ADMIN_ADJUSTMENT',
                description:  `Admin ${newState ? 'bloqueó' : 'desbloqueó'} transferencias de crédito`,
                performed_by: adminId,
            });
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    // ── Export CSV ───────────────────────────────────────────────────────────
    const exportCSV = async () => {
        // Fetch ALL logs (no pagination) for export
        let q = supabase
            .from('credit_logs')
            .select('*, profiles:user_id ( full_name, email )')
            .order('created_at', { ascending: false })
            .limit(10000);

        if (activeFilter !== 'ALL') q = q.eq('type', activeFilter);
        if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString());
        if (dateTo)   q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());

        const { data } = await q;
        if (!data || data.length === 0) return alert('No hay datos para exportar');

        const rows = [
            ['ID', 'Usuario', 'Email', 'Tipo', 'Monto', 'Descripción', 'Fecha'],
            ...data.map((l: any) => [
                l.id,
                l.profiles?.full_name || '',
                l.profiles?.email || '',
                l.type,
                l.amount,
                l.description || '',
                new Date(l.created_at).toLocaleString('en-US'),
            ])
        ];
        const csv = rows.map(r => r.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `nova-digital-creditos-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Stats (from loaded page) ─────────────────────────────────────────────
    const today = new Date().toDateString();
    const stats = useMemo(() => {
        const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today);
        const totalIn   = logs.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
        const totalOut  = logs.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
        const todayVol  = todayLogs.reduce((s, l) => s + Math.abs(l.amount), 0);
        const adminAdj  = logs.filter(l => l.type === 'ADMIN_ADJUSTMENT').length;
        return { totalIn, totalOut, todayVol, adminAdj, todayCount: todayLogs.length };
    }, [logs]);

    const totalSystemCredit  = users.reduce((s, u) => s + (u.credit_balance  || 0), 0);
    const totalSystemWallet  = users.reduce((s, u) => s + (u.wallet_balance   || 0), 0);

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(totalLogs / PAGE_SIZE);

    const FILTERS: { key: FilterType; label: string }[] = [
        { key: 'ALL',                 label: 'Todos'          },
        { key: 'ADMIN_ADJUSTMENT',    label: 'Admin'          },
        { key: 'DAILY_ROI',           label: 'ROI Diario'     },
        { key: 'REFERRAL_COMMISSION', label: 'Comisiones'     },
        { key: 'WEEKLY_BONUS',        label: 'Bono Semanal'   },
        { key: 'TRANSFER_IN',         label: 'Recibidos'      },
        { key: 'TRANSFER_OUT',        label: 'Enviados'       },
        { key: 'DEPOSIT',             label: 'Depósitos'      },
        { key: 'BONUS',               label: 'Bonos'          },
        { key: 'CONVERSION',          label: 'Conversiones'   },
    ];

    return (
        <div className="p-4 sm:p-8 space-y-8 max-w-[1600px] mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                            <Coins className="text-amber-500" size={28} />
                        </div>
                        Credit Manager
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Historial completo · Ajustes · Exportación</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                        <Download size={14} /> Exportar CSV
                    </button>
                    <button onClick={() => { setPage(1); fetchData(); }} className="p-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
                <div className="bg-[#111114] border border-amber-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Créditos Totales</p>
                    <p className="text-xl font-black text-amber-400">${totalSystemCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#111114] border border-emerald-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Wallet Total</p>
                    <p className="text-xl font-black text-emerald-400">${totalSystemWallet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#111114] border border-blue-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Entradas (pág)</p>
                    <p className="text-xl font-black text-blue-400">+${stats.totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#111114] border border-rose-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Salidas (pág)</p>
                    <p className="text-xl font-black text-rose-400">-${stats.totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-[#111114] border border-cyan-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Vol. Hoy</p>
                    <p className="text-xl font-black text-cyan-400">${stats.todayVol.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-slate-600">{stats.todayCount} mov.</p>
                </div>
                <div className="bg-[#111114] border border-indigo-500/20 p-5 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Registros</p>
                    <p className="text-xl font-black text-indigo-400">{totalLogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-[9px] text-slate-600">{users.length} usuarios</p>
                </div>
                <div className="bg-[#111114] border border-rose-500/20 p-5 rounded-2xl col-span-2 lg:col-span-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><Ban size={10} /> Tranf. Bloqueadas</p>
                    <p className="text-xl font-black text-rose-400">{users.filter(u => u.transfer_blocked).length}</p>
                    <p className="text-[9px] text-slate-600">usuarios bloqueados</p>
                </div>
            </div>

            {/* ── Two column: Users + Recent ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* User Directory */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <h2 className="text-lg font-black text-white flex items-center gap-2">
                            <Users size={20} className="text-indigo-400" /> Usuarios
                        </h2>
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-white text-sm focus:ring-1 focus:ring-amber-500 outline-none" />
                        </div>
                    </div>

                    <div className="bg-[#111114] border border-slate-800/50 rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                <tr>
                                    <th className="px-5 py-4">Usuario</th>
                                    <th className="px-5 py-4 text-right">Wallet</th>
                                    <th className="px-5 py-4 text-right">Crédito</th>
                                    <th className="px-5 py-4 text-center">Tranf.</th>
                                    <th className="px-5 py-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className={`hover:bg-white/[0.02] transition-colors group ${user.transfer_blocked ? 'bg-rose-500/[0.03]' : ''}`}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${user.transfer_blocked ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                                                    {user.transfer_blocked ? <Ban size={13} /> : (user.full_name?.[0]?.toUpperCase() || 'U')}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-white text-sm truncate">{user.full_name || 'Sin Nombre'}</p>
                                                        {user.transfer_blocked && (
                                                            <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-md whitespace-nowrap">
                                                                Tranf. Bloqueada
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <span className="text-sm font-bold text-emerald-400 tabular-nums">${(user.wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <span className="text-sm font-bold text-amber-400 tabular-nums">${(user.credit_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                onClick={() => handleToggleTransferBlock(user)}
                                                disabled={actionLoading === user.id}
                                                title={user.transfer_blocked ? 'Desbloquear transferencias' : 'Bloquear transferencias'}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all disabled:opacity-50 ${
                                                    user.transfer_blocked
                                                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30'
                                                }`}
                                            >
                                                {actionLoading === user.id
                                                    ? <Loader2 size={11} className="animate-spin" />
                                                    : user.transfer_blocked
                                                        ? <><Ban size={11} /> Bloq.</>
                                                        : <><CheckCircle2 size={11} /> Libre</>
                                                }
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => openUserHistory(user)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded-lg transition-all" title="Ver historial">
                                                    <Eye size={13} />
                                                </button>
                                                <button onClick={() => setSelectedUser(user)} className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-500/20 text-white hover:text-indigo-400 rounded-lg text-xs font-bold transition-all border border-slate-700 hover:border-indigo-500/40">
                                                    Gestionar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent movements sidebar */}
                <div className="space-y-3">
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                        <Clock size={18} className="text-slate-500" /> Recientes
                    </h2>
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {logs.slice(0, 15).map(log => {
                            const meta = TYPE_META[log.type] || DEFAULT_META;
                            return (
                                <div key={log.id} className="bg-[#111114] border border-slate-800/50 p-3.5 rounded-xl hover:border-slate-700 transition-all">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`p-1.5 rounded-lg shrink-0 ${meta.bg} ${meta.color} border ${meta.border}`}>{meta.icon}</div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-white text-xs truncate">{(log.profiles as any)?.full_name || 'Usuario'}</p>
                                                <p className="text-[9px] text-slate-600 truncate">{(log.profiles as any)?.email}</p>
                                                {log.description && <p className="text-[9px] text-slate-500 mt-0.5 truncate">{log.description}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-black tabular-nums ${log.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-slate-700 mt-1.5 text-right">
                                        {new Date(log.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            );
                        })}
                        {logs.length === 0 && (
                            <div className="text-center py-10 bg-[#111114] rounded-2xl border border-slate-800">
                                <History className="mx-auto text-slate-800 mb-2" size={32} />
                                <p className="text-slate-600 text-xs">Sin registros</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Full History Table ── */}
            <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <History size={22} className="text-amber-500" />
                        Historial Completo
                        <span className="text-sm font-normal text-slate-500">({totalLogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} registros totales)</span>
                    </h2>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input type="text" placeholder="Buscar en historial..." value={historySearch}
                            onChange={e => { setHistorySearch(e.target.value); }}
                            className="w-full bg-[#111114] border border-slate-800 rounded-xl py-2.5 pl-9 pr-4 text-white text-sm focus:ring-1 focus:ring-amber-500 outline-none" />
                    </div>
                </div>

                {/* Date range + Filter tabs */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                        <Calendar size={13} className="text-slate-500 shrink-0" />
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                            className="bg-transparent text-slate-300 text-xs outline-none" />
                        <span className="text-slate-600 text-xs">—</span>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                            className="bg-transparent text-slate-300 text-xs outline-none" />
                        {(dateFrom || dateTo) && (
                            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} className="text-slate-500 hover:text-white transition-colors">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Filter size={13} className="text-slate-600" />
                    {FILTERS.map(f => (
                        <button key={f.key} onClick={() => { setActiveFilter(f.key); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                                activeFilter === f.key
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                    : 'bg-[#111114] border-slate-800 text-slate-500 hover:text-slate-300'
                            }`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="bg-[#111114] border border-slate-800/50 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/60 text-slate-500 text-[9px] font-black uppercase tracking-widest">
                                <tr>
                                    <th className="px-5 py-4">Usuario</th>
                                    <th className="px-5 py-4">Tipo</th>
                                    <th className="px-5 py-4">Descripción</th>
                                    <th className="px-5 py-4 text-right">Monto</th>
                                    <th className="px-5 py-4 text-right">Fecha</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-12">
                                        <Loader2 className="animate-spin mx-auto text-slate-600" size={24} />
                                    </td></tr>
                                ) : logs.filter(l =>
                                    !historySearch || (
                                        (l.profiles as any)?.full_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        (l.profiles as any)?.email?.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        l.description?.toLowerCase().includes(historySearch.toLowerCase()) ||
                                        l.type.toLowerCase().includes(historySearch.toLowerCase())
                                    )
                                ).map(log => {
                                    const meta = TYPE_META[log.type] || DEFAULT_META;
                                    return (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                                                        {((log.profiles as any)?.full_name?.[0] || 'U').toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white text-xs">{(log.profiles as any)?.full_name || 'Usuario'}</p>
                                                        <p className="text-[9px] text-slate-500">{(log.profiles as any)?.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${meta.bg} ${meta.color} ${meta.border}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs text-slate-400 max-w-xs truncate">{log.description || '—'}</p>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <p className={`text-sm font-black tabular-nums ${log.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                </p>
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <p className="text-[10px] text-slate-500 tabular-nums whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {!loading && logs.length === 0 && (
                                    <tr><td colSpan={5} className="px-5 py-14 text-center">
                                        <History className="mx-auto text-slate-800 mb-3" size={32} />
                                        <p className="text-slate-600 text-sm">No hay registros para este filtro</p>
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="border-t border-slate-800/50 px-5 py-3 flex items-center justify-between">
                            <p className="text-[10px] text-slate-500">
                                Página {page} de {totalPages} · {totalLogs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} registros
                            </p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-xs rounded-lg transition-all">
                                    ← Ant.
                                </button>
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                    return (
                                        <button key={p} onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === page ? 'bg-amber-500 text-black' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                                            {p}
                                        </button>
                                    );
                                })}
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-xs rounded-lg transition-all">
                                    Sig. →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Management Modal ── */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#16161a] w-full max-w-md rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    {showPasswordConfirm ? <><KeyRound size={18} className="text-amber-400" /> Verificar Identidad</> : 'Ajustar Balance'}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedUser.email}</p>
                            </div>
                            <button onClick={() => { setSelectedUser(null); setShowPasswordConfirm(false); setAdminPassword(''); setPinError(''); }}
                                className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>

                        {!showPasswordConfirm ? (
                            /* ── Step 1: Adjustment form ── */
                            <div className="p-6 space-y-5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-emerald-500/20">
                                        <p className="text-[9px] text-slate-400 uppercase font-black mb-1">Wallet Bank</p>
                                        <p className="text-lg font-black text-emerald-400">${(selectedUser.wallet_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-amber-500/20">
                                        <p className="text-[9px] text-slate-400 uppercase font-black mb-1">Credit Balance</p>
                                        <p className="text-lg font-black text-amber-400">${(selectedUser.credit_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setTargetBalance('wallet_balance')}
                                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1 border ${targetBalance === 'wallet_balance' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                        <Wallet size={15} /> Wallet Bank
                                    </button>
                                    <button onClick={() => setTargetBalance('credit_balance')}
                                        className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex flex-col items-center gap-1 border ${targetBalance === 'credit_balance' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                        <Coins size={15} /> Credit
                                    </button>
                                </div>
                                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
                                    <button onClick={() => setActionType('ADD')}
                                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${actionType === 'ADD' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                                        <Plus size={13} /> Incrementar
                                    </button>
                                    <button onClick={() => setActionType('SUBTRACT')}
                                        className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${actionType === 'SUBTRACT' ? 'bg-rose-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                                        <Minus size={13} /> Decrementar
                                    </button>
                                </div>
                                <div>
                                    <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setPinError(''); }}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white font-mono text-lg focus:border-amber-500 outline-none"
                                        placeholder="0.00" max={MAX_ADJUSTMENT} />
                                    <p className="text-[9px] text-slate-600 mt-1.5 text-right">Máx. ${MAX_ADJUSTMENT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por operación</p>
                                </div>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-white text-sm focus:border-amber-500 outline-none"
                                    placeholder="Motivo / descripción..." />
                                {pinError && (
                                    <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                                        <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-rose-400">{pinError}</p>
                                    </div>
                                )}
                                <button onClick={handleTransaction} disabled={!amount || parseFloat(amount) <= 0 || !!actionLoading}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3.5 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                    <KeyRound size={15} /> Continuar →
                                </button>
                            </div>
                        ) : (
                            /* ── Step 2: Password confirmation ── */
                            <div className="p-6 space-y-5">
                                {/* Summary of what will be executed */}
                                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Resumen de la operación</p>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Usuario</span>
                                        <span className="text-white font-bold truncate max-w-[180px]">{selectedUser.full_name || selectedUser.email}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Balance</span>
                                        <span className="text-white font-bold">{targetBalance === 'wallet_balance' ? 'Wallet Bank' : 'Credit Balance'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Operación</span>
                                        <span className={`font-black ${actionType === 'ADD' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {actionType === 'ADD' ? '+' : '−'}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    {description && (
                                        <div className="flex justify-between text-sm gap-4">
                                            <span className="text-slate-400 shrink-0">Motivo</span>
                                            <span className="text-slate-300 text-right text-xs">{description}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-2">
                                        Confirma tu contraseña de administrador
                                    </label>
                                    <input
                                        type="password"
                                        value={adminPassword}
                                        onChange={e => { setAdminPassword(e.target.value); setPinError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && !actionLoading && verifyAndExecute()}
                                        autoFocus
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white font-mono text-base focus:border-amber-500 outline-none placeholder:text-slate-600"
                                        placeholder="••••••••"
                                    />
                                </div>

                                {pinError && (
                                    <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3">
                                        <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-rose-400">{pinError}</p>
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button onClick={() => { setShowPasswordConfirm(false); setPinError(''); setAdminPassword(''); }}
                                        disabled={!!actionLoading}
                                        className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40">
                                        ← Volver
                                    </button>
                                    <button onClick={verifyAndExecute} disabled={!adminPassword || !!actionLoading}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                        {actionLoading ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                                        Ejecutar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Per-User History Modal ── */}
            {userHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#16161a] w-full max-w-2xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
                        <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-base font-black text-white">Historial — {userHistoryModal.full_name || 'Usuario'}</h3>
                                <p className="text-xs text-slate-500">{userHistoryModal.email}</p>
                            </div>
                            <button onClick={() => setUserHistoryModal(null)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-2">
                            {userLogsLoading ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-600" size={24} /></div>
                            ) : userLogs.length === 0 ? (
                                <p className="text-center text-slate-600 py-10 text-sm">Sin movimientos registrados</p>
                            ) : userLogs.map(log => {
                                const meta = TYPE_META[log.type] || DEFAULT_META;
                                return (
                                    <div key={log.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${meta.bg} ${meta.color} border ${meta.border}`}>{meta.icon}</div>
                                            <div>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${meta.bg} ${meta.color}`}>{meta.label}</span>
                                                {log.description && <p className="text-[10px] text-slate-500 mt-0.5">{log.description}</p>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black tabular-nums ${log.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-[9px] text-slate-600">
                                                {new Date(log.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Credits;
