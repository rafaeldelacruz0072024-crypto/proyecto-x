
import React, { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { GatewayConfig } from '../types';
import {
  CreditCard,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  Plus,
  X,
  Globe,
  ShieldAlert
} from 'lucide-react';

const Gateways: React.FC = () => {
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New Gateway Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGatewayData, setNewGatewayData] = useState({
    provider: '',
    api_key: '',
    secret_key: '',
    webhook_secret: '',
    mode: 'test' as 'test' | 'live',
    is_active: true
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('system_gateways')
        .select('*')
        .order('provider');

      if (fetchErr) throw fetchErr;
      setGateways(data || []);
    } catch (err: any) {
      console.error("Error fetching gateways:", err);
      setError("No se pudo cargar la configuración de pasarelas.");
    } finally {
      setLoading(false);
    }
  };

  const validateKeys = (provider: string, apiKey: string, secretKey?: string, webhookSecret?: string): string | null => {
    const p = provider.toLowerCase();
    const isStripe = p.includes('stripe');
    const isNowPayments = p.includes('nowpayments');

    // Global validations
    if (apiKey.length < 8) return "La API Key parece demasiado corta.";
    if (apiKey.includes(' ')) return "Las llaves API no pueden contener espacios.";

    if (isStripe) {
      if (!apiKey.startsWith('pk_')) return "Formato de Stripe inválido: La llave pública debe comenzar con 'pk_'.";
      if (secretKey && !secretKey.startsWith('sk_')) return "Formato de Stripe inválido: La llave secreta debe comenzar con 'sk_'.";
      if (webhookSecret && webhookSecret.length > 0 && !webhookSecret.startsWith('whsec_')) return "Formato de Stripe inválido: El Webhook Secret suele comenzar con 'whsec_'.";
    }

    if (isNowPayments) {
      // NOWPayments keys are usually alphanumeric and around 30-40 chars
      if (apiKey.length < 20) return "La API Key de NOWPayments parece inválida.";
    }

    return null;
  };

  const handleCreateGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateKeys(newGatewayData.provider, newGatewayData.api_key, newGatewayData.secret_key, newGatewayData.webhook_secret);
    if (validationError) {
      setError(validationError);
      return;
    }

    setCreating(true);
    const payload = {
      ...newGatewayData,
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error: createErr } = await supabase
        .from('system_gateways')
        .insert([payload])
        .select();

      if (createErr) throw createErr;

      setSuccess(`Pasarela ${newGatewayData.provider} configurada con éxito.`);
      setIsCreateModalOpen(false);
      resetCreateForm();
      if (data) setGateways(prev => [...prev, data[0]]);
    } catch (err: any) {
      console.error("Create Gateway Error:", err);
      setError(`Error al crear pasarela: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateGateway = async (gateway: GatewayConfig) => {
    setError(null);
    setSuccess(null);

    const validationError = validateKeys(gateway.provider, gateway.api_key, gateway.secret_key, gateway.webhook_secret);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(gateway.id);

    try {
      const { error: updateErr } = await supabase
        .from('system_gateways')
        .update({
          api_key: gateway.api_key,
          secret_key: gateway.secret_key,
          webhook_secret: gateway.webhook_secret,
          is_active: gateway.is_active,
          mode: gateway.mode,
          updated_at: new Date().toISOString()
        })
        .eq('id', gateway.id);

      if (updateErr) throw updateErr;
      setSuccess(`Configuración de ${gateway.provider} guardada.`);
      fetchGateways();
    } catch (err: any) {
      console.error("Update Gateway Error:", err);
      setError(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteGateway = async (id: string, provider: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar la pasarela ${provider}? Esta acción no se puede deshacer.`)) return;

    setDeleting(id);
    try {
      const { error: delErr } = await supabase
        .from('system_gateways')
        .delete()
        .eq('id', id);

      if (delErr) throw delErr;
      setSuccess(`Pasarela ${provider} eliminada.`);
      setGateways(prev => prev.filter(gw => gw.id !== id));
    } catch (err: any) {
      console.error("Delete Gateway Error:", err);
      setError(`No se pudo eliminar: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const resetCreateForm = () => {
    setNewGatewayData({
      provider: '',
      api_key: '',
      secret_key: '',
      webhook_secret: '',
      mode: 'test',
      is_active: true
    });
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateGatewayLocal = (id: string, updates: Partial<GatewayConfig>) => {
    setGateways(prev => prev.map(gw => gw.id === id ? { ...gw, ...updates } : gw));
  };

  return (
    <div className="p-8 space-y-10 animate-in fade-in duration-700 bg-[#0c0c0e] min-h-screen text-slate-300">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-white tracking-tighter flex items-center gap-5 uppercase italic">
            <div className="p-4 bg-yellow-500/10 rounded-[2rem] border border-yellow-500/20 shadow-[0_0_30px_#eab30811]">
              <CreditCard className="text-yellow-500" size={36} />
            </div>
            Payment Gateways
          </h1>
          <div className="flex items-center gap-3 mt-4">
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse shadow-[0_0_10px_#eab308]" />
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em]">Gestión de Pasarelas Globales y Cripto</p>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center justify-center space-x-3 px-10 py-5 bg-yellow-500 hover:bg-yellow-400 text-black rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-[0_10px_40px_-10px_#eab30855] transition-all active:scale-95 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>Configurar Pasarela</span>
        </button>
      </div>

      {/* Alertas Premium */}
      <div className="space-y-4 max-w-4xl">
        {error && (
          <div className="bg-rose-500/5 border border-rose-500/20 p-6 rounded-[2.5rem] flex items-center space-x-5 text-rose-500 shadow-2xl animate-in slide-in-from-top-4">
            <div className="p-3 bg-rose-500/10 rounded-2xl">
              <ShieldAlert size={24} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Error de Configuración</p>
              <p className="font-bold text-sm tracking-tight">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-rose-500/10 rounded-full transition-colors"><X size={20} /></button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-[2.5rem] flex items-center space-x-5 text-emerald-500 shadow-2xl animate-in slide-in-from-top-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Operación Exitosa</p>
              <p className="font-bold text-sm tracking-tight">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="p-2 hover:bg-emerald-500/10 rounded-full transition-colors"><X size={20} /></button>
          </div>
        )}
      </div>

      {/* Lista de Pasarelas */}
      <div className="grid grid-cols-1 gap-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_#eab30844]" />
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.5em] animate-pulse">Sincronizando con la red financiera...</p>
          </div>
        ) : gateways.length === 0 ? (
          <div className="bg-[#111114] border border-slate-800/50 rounded-[4rem] p-32 text-center shadow-2xl">
            <div className="w-24 h-24 bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Globe className="text-slate-700" size={48} />
            </div>
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">No se han detectado integraciones activas.</p>
          </div>
        ) : gateways.map((gw) => (
          <div key={gw.id} className={`group bg-[#111114] border-2 ${gw.is_active ? 'border-yellow-500/20' : 'border-slate-800/50'} rounded-[3.5rem] overflow-hidden shadow-2xl transition-all duration-500 hover:translate-y-[-4px] hover:border-yellow-500/40`}>
            {/* Header de la Pasarela */}
            <div className="p-10 border-b border-slate-800/50 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-gradient-to-r from-transparent to-white/[0.01]">
              <div className="flex items-center space-x-6">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-500 ${gw.is_active ? 'bg-yellow-500 text-black rotate-3 group-hover:rotate-0' : 'bg-slate-800 text-slate-500'}`}>
                  {gw.provider.toLowerCase().includes('stripe') ? <Zap size={36} strokeWidth={2.5} /> :
                    gw.provider.toLowerCase().includes('nowpayments') ? <Zap size={36} strokeWidth={2.5} className="text-white fill-current" /> :
                      <CreditCard size={36} strokeWidth={2.5} />}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">{gw.provider}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${gw.mode === 'live' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                      {gw.mode} mode
                    </span>
                    <div className="h-1 w-1 bg-slate-700 rounded-full" />
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">Sincronizado: {new Date(gw.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <select
                  value={gw.mode}
                  onChange={(e) => updateGatewayLocal(gw.id, { mode: e.target.value as any })}
                  className="bg-[#0c0c0e] border border-slate-800 rounded-2xl py-3 px-6 text-[10px] font-black uppercase tracking-widest text-slate-300 outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all cursor-pointer"
                >
                  <option value="test">Sandbox (Dev)</option>
                  <option value="live">Producción (Live)</option>
                </select>

                <div className="h-10 w-[1px] bg-slate-800" />

                <button
                  onClick={() => updateGatewayLocal(gw.id, { is_active: !gw.is_active })}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-300 focus:outline-none ${gw.is_active ? 'bg-yellow-500 shadow-[0_0_20px_#eab30844]' : 'bg-slate-800'}`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${gw.is_active ? 'translate-x-9' : 'translate-x-1'}`} />
                </button>

                <button
                  onClick={() => handleDeleteGateway(gw.id, gw.provider)}
                  disabled={deleting === gw.id}
                  className="p-3 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all"
                  title="Eliminar Pasarela"
                >
                  {deleting === gw.id ? <Loader2 className="animate-spin" size={20} /> : <X size={20} />}
                </button>
              </div>
            </div>

            {/* Configuración Detallada */}
            <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <Lock size={12} className="text-yellow-500" /> Public / API Key
                    </label>
                    <button onClick={() => toggleKeyVisibility(gw.id + '_api')} className="text-slate-600 hover:text-yellow-500 transition-colors">
                      {showKeys[gw.id + '_api'] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type={showKeys[gw.id + '_api'] ? 'text' : 'password'}
                    value={gw.api_key}
                    onChange={(e) => updateGatewayLocal(gw.id, { api_key: e.target.value })}
                    className="w-full bg-[#0c0c0e] border border-slate-800/80 rounded-[1.5rem] py-5 px-6 text-yellow-500 font-mono text-xs focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <ShieldCheck size={12} className="text-yellow-500" /> Secret Key / Private Key
                    </label>
                    <button onClick={() => toggleKeyVisibility(gw.id + '_secret')} className="text-slate-600 hover:text-yellow-500 transition-colors">
                      {showKeys[gw.id + '_secret'] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type={showKeys[gw.id + '_secret'] ? 'text' : 'password'}
                    value={gw.secret_key || ''}
                    onChange={(e) => updateGatewayLocal(gw.id, { secret_key: e.target.value })}
                    className="w-full bg-[#0c0c0e] border border-slate-800/80 rounded-[1.5rem] py-5 px-6 text-slate-300 font-mono text-xs focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all shadow-inner placeholder:text-slate-800"
                    placeholder="Introduzca llave secreta..."
                  />
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                    <Globe size={12} className="text-yellow-500" /> Webhook Endpoint URL
                  </label>
                  <div className="relative group/url">
                    <input
                      type="text"
                      readOnly
                      value={`https://api.geminix.com/webhooks/${gw.provider.toLowerCase().replace(/\s+/g, '-')}`}
                      className="w-full bg-[#0c0c0e]/50 border border-slate-800 rounded-[1.5rem] py-5 px-6 text-slate-600 text-[10px] font-bold outline-none cursor-default group-hover/url:text-slate-400 transition-colors"
                    />
                    <ExternalLink className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-800 group-hover/url:text-yellow-500/50 transition-colors" size={16} />
                    <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover/url:opacity-100 rounded-[1.5rem] transition-opacity pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <Zap size={12} className="text-yellow-500" /> Webhook Secret / IPN Key
                    </label>
                    <button onClick={() => toggleKeyVisibility(gw.id + '_webhook')} className="text-slate-600 hover:text-yellow-500 transition-colors">
                      {showKeys[gw.id + '_webhook'] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <input
                    type={showKeys[gw.id + '_webhook'] ? 'text' : 'password'}
                    value={gw.webhook_secret || ''}
                    onChange={(e) => updateGatewayLocal(gw.id, { webhook_secret: e.target.value })}
                    className="w-full bg-[#0c0c0e] border border-slate-800/80 rounded-[1.5rem] py-5 px-6 text-emerald-500 font-mono text-xs focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all shadow-inner placeholder:text-slate-800"
                    placeholder="Firma de seguridad para callbacks..."
                  />
                </div>
              </div>
            </div>

            {/* Acción Final */}
            <div className="px-10 py-8 bg-black/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em]">Enterprise Grade Security Enabled</p>
              </div>
              <button
                onClick={() => handleUpdateGateway(gw)}
                disabled={saving === gw.id}
                className="flex items-center space-x-4 px-12 py-5 bg-white/[0.03] border border-slate-800 hover:border-yellow-500/50 hover:bg-yellow-500/10 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.3em] transition-all active:scale-95 disabled:opacity-50 group/save"
              >
                {saving === gw.id ? <Loader2 className="animate-spin text-yellow-500" size={18} /> : <Save size={18} className="text-yellow-500 group-hover/save:scale-110 transition-transform" />}
                <span>Sincronizar Cambios</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CREACIÓN PREMIUM */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-[#111114] border border-slate-800/50 w-full max-w-3xl rounded-[4rem] overflow-hidden shadow-[0_40px_100px_-20px_#000] animate-in zoom-in-95 duration-500">
            <div className="p-12 border-b border-slate-800/50 flex items-center justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex items-center space-x-6">
                <div className="p-5 bg-yellow-500 rounded-[2rem] text-black shadow-2xl shadow-yellow-500/20 rotate-3">
                  <Plus size={32} strokeWidth={3} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white tracking-tighter uppercase italic">Nueva Pasarela</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Configuración Maestro de Integración</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-12 h-12 flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-500 hover:text-white rounded-2xl transition-all active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateGateway} className="p-12 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                    <Globe size={14} className="text-yellow-500" /> Proveedor de Servicio
                  </label>
                  <input
                    type="text"
                    required
                    value={newGatewayData.provider}
                    onChange={e => setNewGatewayData({ ...newGatewayData, provider: e.target.value })}
                    placeholder="Ej: Stripe, NOWPayments..."
                    className="w-full bg-[#0c0c0e] border border-slate-800 rounded-3xl py-5 px-6 text-white text-sm font-bold focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all placeholder:text-slate-800"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                    <Zap size={14} className="text-yellow-500" /> Entorno de Ejecución
                  </label>
                  <select
                    value={newGatewayData.mode}
                    onChange={e => setNewGatewayData({ ...newGatewayData, mode: e.target.value as any })}
                    className="w-full bg-[#0c0c0e] border border-slate-800 rounded-3xl py-5 px-6 text-white text-sm font-black uppercase tracking-widest focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all cursor-pointer appearance-none"
                  >
                    <option value="test">Sandbox (Desarrollo)</option>
                    <option value="live">Producción (Live)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                    <Lock size={14} className="text-yellow-500" /> Public API Key
                  </label>
                  <input
                    type="text"
                    required
                    value={newGatewayData.api_key}
                    onChange={e => setNewGatewayData({ ...newGatewayData, api_key: e.target.value })}
                    className="w-full bg-[#0c0c0e] border border-slate-800 rounded-3xl py-5 px-6 text-yellow-500 font-mono text-xs focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all"
                    placeholder="pk_test_... o API Key de NOWPayments"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-yellow-500" /> Secret Key
                    </label>
                    <input
                      type="text"
                      value={newGatewayData.secret_key}
                      onChange={e => setNewGatewayData({ ...newGatewayData, secret_key: e.target.value })}
                      className="w-full bg-[#0c0c0e] border border-slate-800 rounded-3xl py-5 px-6 text-slate-300 font-mono text-xs focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all"
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2 flex items-center gap-2">
                      <Zap size={14} className="text-yellow-500" /> Webhook Secret / IPN
                    </label>
                    <input
                      type="text"
                      value={newGatewayData.webhook_secret}
                      onChange={e => setNewGatewayData({ ...newGatewayData, webhook_secret: e.target.value })}
                      className="w-full bg-[#0c0c0e] border border-slate-800 rounded-3xl py-5 px-6 text-emerald-500 font-mono text-xs focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all"
                      placeholder="whsec_... o IPN Key"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-8 flex gap-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-6 bg-slate-900 text-slate-500 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] hover:text-white transition-all active:scale-95 border border-slate-800"
                >
                  Abortar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-[2] py-6 bg-yellow-500 text-black rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] hover:bg-yellow-400 shadow-2xl shadow-yellow-500/20 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} className="fill-current" /><span>Activar Integración</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gateways;
