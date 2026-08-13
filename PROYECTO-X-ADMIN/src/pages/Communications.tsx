import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Mail, Send, Users, Clock, CheckCircle, XCircle,
  Loader2, Eye, History, Plus, RefreshCw, AlertTriangle,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Segment = 'all' | 'deposited' | 'no_deposit' | 'custom';
type Tab = 'compose' | 'history';

interface Campaign {
  id: string;
  subject: string;
  body: string;
  segment: string;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  sent_at: string | null;
}

const SEGMENTS: { id: Segment; label: string; desc: string; color: string }[] = [
  { id: 'all', label: 'Todos los usuarios', desc: 'Toda la base de miembros registrados', color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
  { id: 'deposited', label: 'Con depósito aprobado', desc: 'Usuarios que ya realizaron al menos un depósito', color: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400' },
  { id: 'no_deposit', label: 'Sin depósito', desc: 'Registrados pero que aún no han depositado', color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
  { id: 'custom', label: 'Lista Externa', desc: 'Ingresar correos separados por comas. Máx 500.', color: 'border-purple-500/40 bg-purple-500/5 text-purple-400' },
];

const STATUS_BADGE: Record<string, JSX.Element> = {
  pending: <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDIENTE</span>,
  sending: <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">ENVIANDO</span>,
  sent: <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ENVIADO</span>,
  failed: <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-400 border border-red-500/20">FALLIDO</span>,
};

const Communications: React.FC = () => {
  const [tab, setTab] = useState<Tab>('compose');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [segmentCounts, setSegmentCounts] = useState<Record<Segment, number>>({ all: 0, deposited: 0, no_deposit: 0, custom: 0 });
  const [customEmailsText, setCustomEmailsText] = useState('');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchSegmentCounts();
  }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
  }, [tab]);

  const fetchSegmentCounts = async () => {
    const { count: allCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });

    const { data: deps } = await supabase.from('deposits').select('user_id').eq('status', 'approved');
    const depositedIds = [...new Set((deps || []).map((d: any) => d.user_id))];

    setSegmentCounts(prev => ({
      ...prev,
      all: allCount || 0,
      deposited: depositedIds.length,
      no_deposit: (allCount || 0) - depositedIds.length,
    }));
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setCampaigns(data || []);
    setLoadingHistory(false);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

    let validEmails: string[] = [];
    if (segment === 'custom') {
      validEmails = customEmailsText
        .split(/[\s,]+/)
        .map(e => e.trim())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

      if (validEmails.length === 0) {
        alert('No se encontraron correos electrónicos válidos.');
        return;
      }
      if (validEmails.length > 500) {
        alert(`Demasiados correos (${validEmails.length}). El límite es 500 por envío para proteger tu cuota.`);
        return;
      }
    }

    setSending(true);
    setResult(null);

    // 1. Crear campaña en DB como pending
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .insert({ subject, body, segment, status: 'sending' })
      .select()
      .single();

    if (campaignError) {
      setSending(false);
      alert('Error guardando campaña: ' + campaignError.message);
      return;
    }

    // 2. Llamar Edge Function
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          subject,
          body,
          segment,
          campaign_id: campaign.id,
          ...(segment === 'custom' ? { custom_emails: validEmails } : {})
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando');

      setResult({ sent: data.sent, failed: data.failed });
      setSubject('');
      setBody('');
    } catch (e: any) {
      await supabase
        .from('email_campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id);
      alert('Error: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const totalStats = campaigns.reduce(
    (acc, c) => ({ sent: acc.sent + (c.sent_count || 0), failed: acc.failed + (c.failed_count || 0) }),
    { sent: 0, failed: 0 }
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">Comunicaciones</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Campañas de Email · Powered by Resend</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Resend Activo</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Miembros', value: segmentCounts.all, icon: <Users size={16} />, color: 'text-blue-400' },
          { label: 'Emails Enviados', value: totalStats.sent, icon: <CheckCircle size={16} />, color: 'text-emerald-400' },
          { label: 'Campañas', value: campaigns.length, icon: <Mail size={16} />, color: 'text-violet-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#111118] border border-slate-800/50 rounded-2xl p-4">
            <div className={`flex items-center gap-2 ${s.color} mb-2`}>{s.icon}<span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span></div>
            <p className="text-2xl font-black text-white">{s.value.toLocaleString('en-US')}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800/50">
        {[
          { id: 'compose' as Tab, label: 'Nueva Campaña', icon: <Plus size={14} /> },
          { id: 'history' as Tab, label: 'Historial', icon: <History size={14} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all -mb-px ${tab === t.id
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* — COMPOSE TAB — */}
      {tab === 'compose' && (
        <div className="space-y-4">
          {/* Result banner */}
          {result && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-400 shrink-0" />
              <div>
                <p className="text-emerald-400 font-black text-sm">¡Campaña enviada exitosamente!</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {result.sent} enviados · {result.failed} fallidos
                </p>
              </div>
              <button onClick={() => setResult(null)} className="ml-auto text-slate-500 hover:text-white text-xs">✕</button>
            </div>
          )}

          {/* Segment selector */}
          <div className="bg-[#111118] border border-slate-800/50 rounded-2xl p-5 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Segmento de destinatarios</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SEGMENTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSegment(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${segment === s.id ? s.color + ' border-opacity-100' : 'border-slate-800/50 text-slate-500 hover:border-slate-700'
                    }`}
                >
                  <p className="text-xs font-black uppercase tracking-wide">{s.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{s.desc}</p>
                  <p className="text-lg font-black mt-1">{segmentCounts[s.id].toLocaleString('en-US')} <span className="text-[10px] font-bold opacity-60">usuarios</span></p>
                </button>
              ))}
            </div>

            {segment === 'custom' && (
              <div className="mt-4 p-4 border border-purple-500/30 bg-purple-500/5 rounded-xl transition-all">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Correos Destinatarios</label>
                  <span className="text-[10px] text-purple-400/60 font-medium">Separados por comas o espacios</span>
                </div>
                <textarea
                  value={customEmailsText}
                  onChange={(e) => {
                    setCustomEmailsText(e.target.value);
                    const count = e.target.value.split(/[\s,]+/).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).length;
                    setSegmentCounts(prev => ({ ...prev, custom: count }));
                  }}
                  rows={4}
                  placeholder="ejemplo1@gmail.com, carlos@empresa.com, contacto@dominio.com..."
                  className="w-full bg-[#0a0a0f] border border-purple-500/20 rounded-lg px-4 py-3 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-y"
                />
                {segmentCounts.custom > 500 && (
                  <p className="text-red-400 text-[10px] font-bold mt-2 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Has superado el límite ({segmentCounts.custom} / 500). Por favor envía en bloques más pequeños.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="bg-[#111118] border border-slate-800/50 rounded-2xl p-5 space-y-4">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contenido del Email</p>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Asunto</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: 🚀 Novedades importantes de NOVA DIGITAL"
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mensaje</label>
                <span className="text-[10px] text-slate-600">Usa <code className="text-blue-400 bg-blue-500/10 px-1 rounded">{'{{nombre}}'}</code> para personalizar</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder={`Hola {{nombre}},\n\nTenemos novedades emocionantes para ti...\n\nEl Equipo NOVA DIGITAL`}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm font-medium placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>

            {/* Info bar */}
            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <AlertTriangle size={12} />
              <span>Los emails se envían desde tu dominio configurado en Resend. Asegúrate de tener el dominio verificado.</span>
            </div>
          </div>

          {/* Preview */}
          <button
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
          >
            <Eye size={14} />
            {preview ? 'Ocultar vista previa' : 'Ver vista previa del email'}
          </button>

          {preview && subject && body && (
            <div className="bg-[#111118] border border-slate-800/50 rounded-2xl p-5">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Vista Previa</p>
              <div className="bg-[#0a0a0f] rounded-xl p-6 max-w-2xl mx-auto">
                <div className="text-center mb-6 pb-4 border-b border-slate-800">
                  <div className="text-2xl font-black text-blue-400 tracking-widest">NOVA DIGITAL</div>
                  <div className="text-[9px] text-slate-600 tracking-widest mt-1">PLATAFORMA FINANCIERA DIGITAL</div>
                </div>
                <p className="text-slate-400 text-sm mb-3">Hola, <strong className="text-white">{'{{nombre}}'}</strong> 👋</p>
                <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{body.replace(/\{\{nombre\}\}/g, 'Juan')}</pre>
                <div className="mt-6 text-center">
                  <div className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-bold">ABRIR NOVA DIGITAL →</div>
                </div>
              </div>
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim() || (segment === 'custom' && segmentCounts.custom === 0) || (segment === 'custom' && segmentCounts.custom > 500)}
            className="w-full flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all active:scale-[0.99]"
          >
            {sending ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enviando a {segmentCounts[segment].toLocaleString('en-US')} usuarios...
              </>
            ) : (
              <>
                <Send size={18} />
                Enviar a {segmentCounts[segment].toLocaleString('en-US')} usuarios
              </>
            )}
          </button>
        </div>
      )}

      {/* — HISTORY TAB — */}
      {tab === 'history' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={fetchHistory}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
            >
              <RefreshCw size={14} />Actualizar
            </button>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-slate-600" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <Mail size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-black uppercase tracking-widest">Sin campañas enviadas</p>
            </div>
          ) : (
            <div className="bg-[#111118] border border-slate-800/50 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    {['Asunto', 'Segmento', 'Enviados', 'Fallidos', 'Estado', 'Fecha'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-slate-800/20 hover:bg-white/[0.01] transition-colors">
                      <td className="px-4 py-3 text-white font-medium text-xs max-w-[200px] truncate">{c.subject}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs capitalize">{c.segment}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-black">
                          <CheckCircle size={12} />{c.sent_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-red-400 text-xs font-black">
                          <XCircle size={12} />{c.failed_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">{STATUS_BADGE[c.status] || STATUS_BADGE.pending}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(c.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Communications;
