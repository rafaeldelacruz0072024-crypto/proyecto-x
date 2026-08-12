import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeInvestments: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, investments, deposits, withdrawals, pendingDep, pendingWith] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('investments').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('deposits').select('amount').in('status', ['approved', 'APPROVED', 'completed', 'COMPLETED']),
        supabase.from('withdrawals').select('amount').in('status', ['approved', 'APPROVED', 'completed', 'COMPLETED']),
        supabase.from('deposits').select('*', { count: 'exact', head: true }).in('status', ['pending', 'PENDING']),
        supabase.from('withdrawals').select('*', { count: 'exact', head: true }).in('status', ['pending', 'PENDING']),
      ]);

      if (users.error) throw users.error;
      if (investments.error) throw investments.error;

      const depSum = (deposits.data || []).reduce((acc, d) => acc + Number(d.amount), 0);
      const withSum = (withdrawals.data || []).reduce((acc, w) => acc + Number(w.amount), 0);

      setStats({
        totalUsers: users.count || 0,
        activeInvestments: investments.count || 0,
        totalDeposits: depSum,
        totalWithdrawals: withSum,
        pendingDeposits: pendingDep.count || 0,
        pendingWithdrawals: pendingWith.count || 0,
      });
    } catch (error: any) {
      console.error('Error loading stats:', error);
      setError('Error al conectar con la base de datos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const cards = [
    { label: 'Usuarios Totales', value: stats.totalUsers, color: 'blue', icon: '👥' },
    { label: 'Inversiones Activas', value: stats.activeInvestments, color: 'green', icon: '📈' },
    { label: 'Depósitos Totales', value: `$${stats.totalDeposits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'purple', icon: '💰' },
    { label: 'Retiros Totales', value: `$${stats.totalWithdrawals.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: 'red', icon: '💸' },
  ];

  const actions = [
    { label: 'Aprobar Depósitos', count: stats.pendingDeposits, path: '/deposits', color: 'green' },
    { label: 'Aprobar Retiros', count: stats.pendingWithdrawals, path: '/withdrawals', color: 'red' },
    { label: 'Ver Usuarios', path: '/users', color: 'blue' },
    { label: 'Ejecutar ROI', path: '/roi-engine', color: 'purple' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  const downloadCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, status, created_at, role');

      if (error) throw error;
      downloadCSV(data, 'Usuarios_Globales');
    } catch (err: any) {
      alert('Error exportando usuarios: ' + err.message);
    }
  };

  const handleExportDeposits = async () => {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('id, user_id, amount, method, status, created_at, approved_at, blockchain_tx_hash')
        .order('created_at', { ascending: false });

      if (error) throw error;
      downloadCSV(data, 'Depositos_Globales');
    } catch (err: any) {
      alert('Error exportando depósitos: ' + err.message);
    }
  };

  const handleExportWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('id, user_id, amount, method, wallet_address, status, created_at, approved_at, completed_at, blockchain_tx_hash')
        .order('created_at', { ascending: false });

      if (error) throw error;
      downloadCSV(data, 'Retiros_Globales');
    } catch (err: any) {
      alert('Error exportando retiros: ' + err.message);
    }
  };

  const handleFixDB = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const sqlQuery = `
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
        `;
      // Execute via RPC if possible
      const { error } = await supabase.rpc('execute_sql_query', { query: sqlQuery });
      if (error) {
        console.error("RPC failed, trying raw post:", error);
        alert("Falló por RPC, avisa a soporte.");
      } else {
        alert("Fix completado con éxito. Columnas de seguridad añadidas.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-black text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Panel de control administrativo</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 font-bold mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">{card.icon}</span>
            </div>
            <p className="text-slate-400 text-sm mb-1">{card.label}</p>
            <p className="text-3xl font-black text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Export Section */}
      <div className="bg-[#111114] border border-slate-800 rounded-[2rem] p-8">
        <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3">
          <span className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">📊</span>
          Centro de Reportes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleExportUsers}
            className="p-6 bg-slate-900 hover:bg-indigo-600/20 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition-all group text-left"
          >
            <p className="text-slate-500 group-hover:text-indigo-400 text-xs font-black uppercase tracking-widest mb-2">Base de Datos</p>
            <p className="text-white text-lg font-bold group-hover:translate-x-1 transition-transform">Exportar Usuarios</p>
          </button>

          <button
            onClick={handleExportDeposits}
            className="p-6 bg-slate-900 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/50 rounded-2xl transition-all group text-left"
          >
            <p className="text-slate-500 group-hover:text-emerald-400 text-xs font-black uppercase tracking-widest mb-2">Ingresos</p>
            <p className="text-white text-lg font-bold group-hover:translate-x-1 transition-transform">Exportar Depósitos</p>
          </button>

          <button
            onClick={handleExportWithdrawals}
            className="p-6 bg-slate-900 hover:bg-rose-600/20 border border-slate-800 hover:border-rose-500/50 rounded-2xl transition-all group text-left"
          >
            <p className="text-slate-500 group-hover:text-rose-400 text-xs font-black uppercase tracking-widest mb-2">Egresos</p>
            <p className="text-white text-lg font-bold group-hover:translate-x-1 transition-transform">Exportar Retiros</p>
          </button>
        </div>
      </div>

      {/* Actions Grid */}
      <div>
        <h2 className="text-2xl font-black text-white mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => navigate(action.path)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl p-6 text-left transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-white">{action.label}</p>
                  {action.count !== undefined && (
                    <p className="text-sm text-slate-400 mt-1">{action.count} pendientes</p>
                  )}
                </div>
                <span className="text-2xl">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
