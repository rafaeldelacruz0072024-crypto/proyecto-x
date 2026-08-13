import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { fmt, fmtInt } from '../lib/format';
import { Profile } from '../types';
import {
  Search,
  Fingerprint,
  Settings2,
  X,
  Save,
  ShieldCheck,
  Wallet,
  Loader2,
  AlertCircle,
  Key,
  Shield,
  LogIn,
  ChevronLeft,
  ChevronRight,
  Tag
} from 'lucide-react';

const ACCOUNT_TAGS = [
  {
    value: 'REAL_CRYPTO',
    label: 'REAL CRYPTO',
    desc: 'Activación con Criptomoneda',
    style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500'
  },
  {
    value: 'REAL_CREDIT',
    label: 'REAL CREDIT',
    desc: 'Activación con Crédito',
    style: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    dot: 'bg-cyan-500'
  },
  {
    value: 'ADM',
    label: 'ADM',
    desc: 'Activación desde Admin',
    style: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    dot: 'bg-purple-500'
  },
  {
    value: 'LIDER',
    label: 'LIDER',
    desc: 'Usuario Líder de Red',
    style: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500'
  },
] as const;

const getTagInfo = (tag?: string) =>
  ACCOUNT_TAGS.find(t => t.value === tag?.toUpperCase()) ?? ACCOUNT_TAGS[0];

const Users: React.FC = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const USERS_PER_PAGE = 10;
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'wallet'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New state for password change
  const [newPassword, setNewPassword] = useState('');
  const [resetingPassword, setResetingPassword] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>('ALL');

  const handleImpersonate = async (user: Profile) => {
    if (!user.email) {
      alert('Este usuario no tiene email registrado.');
      return;
    }

    if (!confirm(`¿Entrar al dashboard de ${user.full_name || user.email}?`)) return;

    try {
      setImpersonating(user.id);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // 1. Guardar hash original y poner contraseña temporal
      const tempPassword = `GK_ADMIN_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_impersonate_user', {
        target_user_id: user.id,
        temp_password: tempPassword
      });

      if (rpcError) throw new Error(rpcError.message);

      // 2. Sign in como el usuario usando el token endpoint
      const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          password: tempPassword
        })
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(tokenData?.msg || tokenData?.error_description || 'Error al obtener sesión');
      }

      // 3. Restaurar la contraseña original
      await supabase.rpc('admin_restore_user_password', {
        target_user_id: user.id,
        original_hash: rpcData?.original_hash
      });

      // 4. Abrir user app con los tokens de sesión
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      // URL de la app del usuario - Forced domain update
      const userAppBaseUrl = 'https://proyecto-x-user.vercel.app/login';
      const userAppUrl = `${userAppBaseUrl}#access_token=${accessToken}&refresh_token=${refreshToken}&token_type=bearer&type=magiclink`;

      window.open(userAppUrl, '_blank');

    } catch (error: any) {
      console.error('Error impersonating user:', error);
      alert('❌ Error al acceder: ' + error.message);
    } finally {
      setImpersonating(null);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true }); // Admin first usually

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: Profile) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setActiveTab('general');
    setNewPassword(''); // Reset password input
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try {
      setSaving(true);

      // Si el email fue modificado, actualizamos en la tabla segura auth.users usando el RPC
      const originalUser = users.find(u => u.id === selectedUser.id);
      if (originalUser && originalUser.email !== selectedUser.email && selectedUser.email) {
        const { error: emailError } = await supabase.rpc('admin_update_user_email', {
          target_user_id: selectedUser.id,
          new_email: selectedUser.email.trim()
        });
        if (emailError) throw new Error('Error cambiando correo: ' + emailError.message);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: selectedUser.full_name,
          username: selectedUser.username,
          role: selectedUser.role,
          status: selectedUser.status,
          organizational_rank: selectedUser.organizational_rank,
          rank: selectedUser.rank,
          team_volume: selectedUser.team_volume,
          is_2fa_enabled: selectedUser.is_2fa_enabled,
          wallet_address: selectedUser.wallet_address,
          user_tag: selectedUser.user_tag || 'REAL',
          withdrawals_blocked: selectedUser.withdrawals_blocked,
          roi_blocked: selectedUser.roi_blocked,
          transfer_blocked: selectedUser.transfer_blocked
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      await loadUsers();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert('Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      alert('Por favor introduce una nueva contraseña.');
      return;
    }

    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!confirm(`¿Estás seguro de cambiar la contraseña para ${selectedUser.email}?`)) return;

    try {
      setResetingPassword(true);
      const { data, error } = await supabase.rpc('admin_reset_user_password', {
        target_user_id: selectedUser.id,
        new_password: newPassword
      });

      if (error) throw error;

      alert(`✅ ${data?.message || 'Contraseña actualizada correctamente.'}`);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error reseting password:', error);
      alert('❌ Error al cambiar contraseña: ' + error.message);
    } finally {
      setResetingPassword(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchSearch =
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTag = tagFilter === 'ALL' || (user.user_tag || 'REAL_CRYPTO') === tagFilter;
      return matchSearch && matchTag;
    });
  }, [users, searchTerm, tagFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * USERS_PER_PAGE;
    return filteredUsers.slice(start, start + USERS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Identity & Roles</h1>
          <p className="text-slate-500 font-medium mt-1">Control jerárquico de inversores y personal administrativo.</p>
        </div>

        <div className="relative group w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-500 transition-colors" />
          <input
            type="text"
            placeholder="Nombre, username o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#16161a] border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-2xl"
          />
        </div>
      </div>

      {/* Tag Filter Bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTagFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
            tagFilter === 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
              : 'bg-[#16161a] text-slate-500 border-slate-800 hover:text-white'
          }`}
        >
          Todos
        </button>
        {ACCOUNT_TAGS.map(tag => (
          <button
            key={tag.value}
            onClick={() => setTagFilter(tag.value)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${
              tagFilter === tag.value
                ? `${tag.style} scale-105 shadow-lg`
                : 'bg-[#16161a] text-slate-500 border-slate-800 hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${tagFilter === tag.value ? tag.dot : 'bg-slate-600'}`} />
            {tag.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-500">
          <AlertCircle className="w-5 h-5" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* User Table */}
      <div className="bg-[#111114] border border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/50 bg-slate-900/40">
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Perfil de Usuario</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Security</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Jerarquía</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Rango Elite</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Volumen Red</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">W. Bank</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Credit</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Estatus</th>
                <th className="px-8 py-6 text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/30">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-32 text-center text-slate-600 font-bold italic">
                    Sin resultados en la red...
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-slate-900/40 transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-xl font-black text-slate-400 border border-slate-700/50 shadow-xl group-hover:scale-105 transition-transform duration-500">
                          {user.full_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-base font-black text-slate-100">{user.full_name || user.username || 'Usuario Sin Nombre'}</p>
                            {(() => {
                              const tagInfo = getTagInfo(user.user_tag);
                              return (
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border uppercase tracking-widest flex items-center gap-1 ${tagInfo.style}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${tagInfo.dot}`} />
                                  {tagInfo.label}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs font-bold text-slate-500 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center">
                        <Fingerprint className={`w-8 h-8 ${user.is_2fa_enabled ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'text-slate-800'}`} />
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 bg-indigo-500/5 text-indigo-400`}>
                          {user.rank || 'Starter'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-sm font-black text-slate-300">
                        <span className="text-[10px] opacity-50 mr-1">$</span>
                        {fmtInt(user.team_volume)}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-base font-black text-emerald-500 tracking-tight">
                        <span className="text-[10px] opacity-50 mr-1">$</span>
                        {fmt(user.wallet_balance)}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <p className="text-base font-black text-amber-500 tracking-tight">
                        <span className="text-[10px] opacity-50 mr-1">$</span>
                        {fmt(user.credit_balance)}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${user.status === 'active' || !user.status
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-rose-500/10 text-rose-500'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' || !user.status ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {user.status || 'Active'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleImpersonate(user)}
                          disabled={impersonating === user.id}
                          title="Entrar al dashboard de este usuario"
                          className="w-12 h-12 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-2xl transition-all duration-300 flex items-center justify-center border border-slate-700/50 hover:border-emerald-400 shadow-lg group/imp disabled:opacity-50"
                        >
                          {impersonating === user.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <LogIn className="w-5 h-5 group-hover/imp:translate-x-0.5 transition-transform duration-300" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEditUser(user)}
                          className="w-12 h-12 bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white rounded-2xl transition-all duration-300 flex items-center justify-center border border-slate-700/50 hover:border-indigo-400 shadow-lg group/btn"
                        >
                          <Settings2 className="w-6 h-6 group-hover/btn:rotate-90 transition-transform duration-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-8 py-5 border-t border-slate-800/50">
            <p className="text-[11px] text-slate-500 font-bold">
              Mostrando {((currentPage - 1) * USERS_PER_PAGE) + 1}–{Math.min(currentPage * USERS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length} usuarios
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <span key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="text-slate-600 px-1">···</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all border ${currentPage === page
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700/50 hover:bg-slate-700 hover:text-white'
                        }`}
                    >
                      {page}
                    </button>
                  </span>
                ))
              }
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-400 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Edit Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />

          <div className="relative w-full max-w-2xl bg-[#0f0f12] border border-slate-800/50 rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600/20 to-transparent p-10 flex items-start justify-between border-b border-slate-800/30">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-amber-600 rounded-3xl flex items-center justify-center text-white shadow-[0_0_30px_rgba(217,119,6,0.2)]">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Security & Role Management</h2>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex bg-[#121216] border-b border-slate-800/30">
              {(['general', 'security', 'wallet'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {tab === 'general' ? 'Datos Generales' : tab === 'security' ? 'Seguridad Staff' : 'Cartera'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 animate-in slide-in-from-left-full duration-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Modal Content */}
            <div className="p-10 max-h-[60vh] overflow-y-auto">
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={selectedUser.email || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                    <input
                      type="text"
                      value={selectedUser.full_name || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Username (@)</label>
                    <input
                      type="text"
                      value={selectedUser.username || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Rango Organizacional</label>
                    <input
                      type="text"
                      value={selectedUser.organizational_rank || ''}
                      onChange={(e) => setSelectedUser({ ...selectedUser, organizational_rank: e.target.value })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Rango Elite (NOVA DIGITAL Elite)</label>
                    <select
                      value={selectedUser.rank || 'Starter'}
                      onChange={(e) => setSelectedUser({ ...selectedUser, rank: e.target.value as any })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner appearance-none"
                    >
                      <option value="Starter">Starter</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                      <option value="Platinum">Platinum</option>
                      <option value="Diamond">Diamond</option>
                      <option value="Black Crown">Black Crown</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Volumen de Equipo (USD)</label>
                    <input
                      type="number"
                      value={selectedUser.team_volume || 0}
                      onChange={(e) => setSelectedUser({ ...selectedUser, team_volume: parseFloat(e.target.value) })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Estatus de Cuenta</label>
                    <select
                      value={selectedUser.status || 'active'}
                      onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value as any })}
                      className="w-full bg-[#1a1a20] border-none rounded-2xl py-5 px-6 text-white font-black text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner appearance-none"
                    >
                      <option value="active">Active (Full Access)</option>
                      <option value="inactive">Inactive</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Tag size={12} /> Etiqueta de Activación
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {ACCOUNT_TAGS.map((tag) => {
                        const isSelected = (selectedUser.user_tag || 'REAL_CRYPTO') === tag.value;
                        return (
                          <button
                            key={tag.value}
                            type="button"
                            onClick={() => setSelectedUser({ ...selectedUser, user_tag: tag.value as any })}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                              isSelected
                                ? `${tag.style} border-current scale-[1.02] shadow-lg`
                                : 'bg-[#1a1a20] border-slate-800/50 hover:border-slate-600 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full shrink-0 ${isSelected ? tag.dot : 'bg-slate-700'}`} />
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest">{tag.label}</p>
                              <p className="text-[9px] opacity-60 font-bold mt-0.5">{tag.desc}</p>
                            </div>
                            {isSelected && (
                              <span className="ml-auto text-[8px] font-black uppercase tracking-widest opacity-70">ACTIVO</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-amber-600/5 border border-amber-600/10 p-8 rounded-[2.5rem] flex items-center gap-8">
                    <div className="p-5 bg-amber-600/10 rounded-full text-amber-500 shrink-0">
                      <Fingerprint className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">TWO-FACTOR AUTHENTICATION (2FA)</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">La verificación de dos pasos añade una capa de seguridad criptográfica.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#1a1a20] p-8 rounded-3xl flex items-center justify-between border border-slate-800/50">
                      <div className="flex items-center gap-4">
                        <Shield className="text-indigo-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-300">Exigir 2FA para Login</span>
                      </div>
                      <button
                        onClick={() => setSelectedUser({ ...selectedUser, is_2fa_enabled: !selectedUser.is_2fa_enabled })}
                        className={`w-14 h-8 rounded-full transition-all relative ${selectedUser.is_2fa_enabled ? 'bg-amber-600' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${selectedUser.is_2fa_enabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="bg-[#1a1a20] p-8 rounded-3xl flex flex-col gap-4 border border-slate-800/50">
                      <div className="flex items-center gap-4">
                        <Key className="text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-300">Cambiar Contraseña</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          placeholder="Nueva contraseña..."
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="flex-1 bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl text-xs text-white outline-none focus:border-amber-500 transition-all"
                        />
                        <button
                          onClick={handleResetPassword}
                          disabled={resetingPassword}
                          className="bg-amber-600 hover:bg-amber-500 text-white p-2 rounded-xl transition-all disabled:opacity-50"
                        >
                          {resetingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'wallet' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-indigo-600/5 border border-indigo-600/10 p-8 rounded-[2.5rem] flex flex-col items-center justify-center gap-2">
                    <Wallet className="w-8 h-8 text-indigo-500 mb-1" />
                    <div className="flex gap-10">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Wallet Bank</p>
                        <p className="text-3xl font-black text-emerald-500 tracking-tighter">
                          <span className="text-sm opacity-50 mr-1">$</span>
                          {fmt(selectedUser.wallet_balance)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Credit Balance</p>
                        <p className="text-3xl font-black text-amber-500 tracking-tighter">
                          <span className="text-sm opacity-50 mr-1">$</span>
                          {fmt(selectedUser.credit_balance)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#1a1a20] p-8 rounded-3xl border border-slate-800/50">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Dirección de Wallet</p>
                      <input
                        type="text"
                        placeholder="Dirección USDT/BTC..."
                        value={selectedUser.wallet_address || ''}
                        onChange={(e) => setSelectedUser({ ...selectedUser, wallet_address: e.target.value })}
                        className="w-full bg-[#121216] border border-slate-800 rounded-xl py-4 px-5 text-white font-mono text-xs outline-none focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div className="bg-[#1a1a20] p-8 rounded-3xl border border-slate-800/50">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Rol del Sistema</p>
                      <select
                        value={selectedUser.role}
                        onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as any })}
                        className="w-full bg-[#121216] border border-slate-800 rounded-xl py-4 px-5 text-white font-black text-sm outline-none focus:border-indigo-500 transition-all"
                      >
                        <option value="user">Inversor Standard</option>
                        <option value="sub-admin">Moderador / Auditor</option>
                        <option value="admin">Super Admin / Root</option>
                      </select>
                    </div>

                    {/* Bloqueo de Retiros */}
                    <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-3xl flex items-center justify-between md:col-span-2">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-500/20 rounded-full text-rose-500">
                          <AlertCircle size={24} />
                        </div>
                        <div>
                          <span className="block text-xs font-black uppercase tracking-widest text-white">Bloqueo de Retiros</span>
                          <span className="text-[10px] text-rose-400 font-bold uppercase transition-all">
                            {selectedUser.withdrawals_blocked
                              ? 'El sistema rechazará cualquier intento de retiro'
                              : 'Suspensión manual de solicitudes de retiro'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUser({ ...selectedUser, withdrawals_blocked: !selectedUser.withdrawals_blocked })}
                        className={`w-14 h-8 rounded-full transition-all relative ${selectedUser.withdrawals_blocked ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-slate-800 border border-slate-700'
                          }`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${selectedUser.withdrawals_blocked ? 'right-1' : 'left-1'
                          }`} />
                      </button>
                    </div>

                    {/* Bloqueo de Transferencias */}
                    <div className="bg-orange-500/10 border border-orange-500/20 p-8 rounded-3xl flex items-center justify-between md:col-span-2">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-500/20 rounded-full text-orange-500">
                          <AlertCircle size={24} />
                        </div>
                        <div>
                          <span className="block text-xs font-black uppercase tracking-widest text-white">Bloqueo de Transferencias</span>
                          <span className="text-[10px] text-orange-400 font-bold uppercase transition-all">
                            {selectedUser.transfer_blocked
                              ? 'El usuario no podrá transferir saldo de crédito a otros usuarios'
                              : 'Suspensión manual de envíos de saldo de crédito'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUser({ ...selectedUser, transfer_blocked: !selectedUser.transfer_blocked })}
                        className={`w-14 h-8 rounded-full transition-all relative ${selectedUser.transfer_blocked ? 'bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-slate-800 border border-slate-700'
                          }`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${selectedUser.transfer_blocked ? 'right-1' : 'left-1'
                          }`} />
                      </button>
                    </div>

                    {/* Bloqueo de RIO */}
                    <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-3xl flex items-center justify-between md:col-span-2">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/20 rounded-full text-amber-500">
                          <AlertCircle size={24} />
                        </div>
                        <div>
                          <span className="block text-xs font-black uppercase tracking-widest text-white">Bloqueo de RIO</span>
                          <span className="text-[10px] text-amber-400 font-bold uppercase transition-all">
                            {selectedUser.roi_blocked
                              ? 'El sistema no generará ni pagará RIO diario a este usuario'
                              : 'Suspensión manual de generación de RIO'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUser({ ...selectedUser, roi_blocked: !selectedUser.roi_blocked })}
                        className={`w-14 h-8 rounded-full transition-all relative ${selectedUser.roi_blocked ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border border-slate-700'
                          }`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-lg ${selectedUser.roi_blocked ? 'right-1' : 'left-1'
                          }`} />
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-10 bg-[#0c0c0f] border-t border-slate-800/30 flex items-center justify-between">
              <div className="flex items-center gap-3 text-slate-600">
                <Shield className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Auditoría de Staff activa</span>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-10 py-5 bg-[#1a1a20] hover:bg-slate-800 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-10 py-5 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-[0_10px_30px_rgba(217,119,6,0.3)] flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Aplicar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
