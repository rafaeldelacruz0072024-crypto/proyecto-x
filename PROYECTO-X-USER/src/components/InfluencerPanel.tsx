import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Camera, ChartNoAxesColumnIncreasing, Film } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Campaign = {
  id: string; title: string; rules: string; kind: 'views' | 'ugc';
  reward_cents: number; min_views: number; closes_on: string;
  description: string; requires_statistics: boolean;
};
type Submission = {
  id: string; title: string; kind: Campaign['kind']; status: 'pending' | 'approved' | 'rejected' | 'paid';
  verified_views: number; amount_cents: number; review_note: string | null;
};
type Overview = { registrations: number; ranking: { campaign_id: string; handle: string; views: number }[] };

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const number = new Intl.NumberFormat('en-US');
const statusLabels = { pending: 'En revisión', approved: 'Aprobado · Por cobrar', rejected: 'Rechazado', paid: 'Pagado' };
const input = 'w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-white';
const action = 'inline-flex items-center justify-center gap-2 rounded-lg bg-proyecto-accent px-4 py-3 font-bold text-slate-950 hover:brightness-110 disabled:opacity-50';
const imageExtensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const extensions: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

function canonicalPost(raw: string) {
  const url = URL.canParse(raw) ? new URL(raw) : null;
  if (url?.protocol === 'https:' && !url.username && !url.password && !url.port) {
    const host = url.hostname.replace(/^www\./, '');
    const path = url.pathname.replace(/\/$/, '');
    if (host === 'tiktok.com' && /^\/@[A-Za-z0-9_.-]+\/video\/\d+$/.test(path)) {
      return 'https://www.tiktok.com' + path;
    }
    if (host === 'instagram.com' && /^\/(reel|p|tv)\/[A-Za-z0-9_-]+$/.test(path)) {
      return 'https://www.instagram.com' + path;
    }
    const videoId = host === 'youtu.be' ? path.slice(1)
      : ['youtube.com', 'm.youtube.com'].includes(host)
        ? (path === '/watch' ? url.searchParams.get('v') : path.match(/^\/shorts\/([^/]+)$/)?.[1])
        : null;
    if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return 'https://www.youtube.com/watch?v=' + videoId;
    }
  }
  throw new Error('Usa el enlace directo del video público en TikTok, Instagram o YouTube.');
}

export default function InfluencerPanel({ userId, refCode }: { userId: string; refCode?: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [overview, setOverview] = useState<Overview>({ registrations: 0, ranking: [] });
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [campaignResult, submissionResult, overviewResult] = await Promise.all([
        supabase.from('influencer_campaigns').select('*').eq('active', true).order('kind', { ascending: false }).order('reward_cents', { ascending: false }),
        supabase.from('influencer_submissions').select('id,title,kind,status,verified_views,amount_cents,review_note').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.rpc('influencer_overview'),
      ]);
      const error = campaignResult.error || submissionResult.error || overviewResult.error;
      if (error) throw error;
      setCampaigns(campaignResult.data ?? []);
      setSubmissions(submissionResult.data ?? []);
      setOverview(overviewResult.data);
    } catch {
      setLoadError('No se pudo cargar el programa Influencer.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || sending) return;
    setSending(true);
    setSubmitError('');
    setFeedback('');
    const form = new FormData(event.currentTarget);
    const id = crypto.randomUUID();
    let videoPath: string | null = null;
    let statisticsPath: string | null = null;
    try {
      const title = String(form.get('title')).trim();
      const handle = '@' + String(form.get('handle')).trim().replace(/^@/, '');
      if (!title || !/^@[A-Za-z0-9_.-]{1,60}$/.test(handle)) throw new Error('Escribe un título y un nombre de usuario válido.');
      const postUrl = selected.kind === 'views' ? canonicalPost(String(form.get('url')).trim()) : null;
      const statistics = form.get('statistics');
      if (selected.requires_statistics) {
        if (!(statistics instanceof File) || !statistics.size) throw new Error('Adjunta una captura de las estadísticas.');
        const extension = imageExtensions[statistics.type];
        if (!extension || statistics.size > 10 * 1024 * 1024) throw new Error('Selecciona una captura PNG, JPG o WebP de hasta 10 MB.');
        const path = userId + '/' + id + '.' + extension;
        const { error } = await supabase.storage.from('influencer-statistics').upload(path, statistics);
        if (error) throw new Error('No se pudo subir la captura. Intenta de nuevo.');
        statisticsPath = path;
      }
      const file = form.get('video');
      if (file instanceof File && file.size) {
        const extension = extensions[file.type];
        if (!extension || file.size > 50 * 1024 * 1024) throw new Error('Selecciona un video MP4, MOV o WebM de hasta 50 MB.');
        const path = userId + '/' + id + '.' + extension;
        const { error } = await supabase.storage.from('influencer-videos').upload(path, file);
        if (error) throw new Error('No se pudo subir el video. Intenta de nuevo.');
        videoPath = path;
      } else if (selected.kind === 'ugc') {
        throw new Error('Adjunta tu video original.');
      }
      const { error } = await supabase.from('influencer_submissions').insert({
        id, campaign_id: selected.id, title, handle, post_url: postUrl, video_path: videoPath, statistics_path: statisticsPath,
      });
      if (error) {
        throw new Error(error.code === '23505' ? 'Esta publicación ya fue enviada.' : error.message);
      }
      videoPath = null;
      statisticsPath = null;
      setSelected(null);
      setFeedback('Recibimos tu video. Puedes seguir la revisión en Mis envíos.');
      await load();
    } catch (error) {
      await Promise.allSettled([
        videoPath && supabase.storage.from('influencer-videos').remove([videoPath]),
        statisticsPath && supabase.storage.from('influencer-statistics').remove([statisticsPath]),
      ]);
      setSubmitError(error instanceof Error ? error.message : 'No se pudo enviar el contenido.');
    } finally {
      setSending(false);
    }
  }

  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santo_Domingo' }).format(new Date());
  const totals = submissions.reduce((sum, item) => ({
    paid: sum.paid + (item.status === 'paid' ? item.amount_cents : 0),
    due: sum.due + (item.status === 'approved' ? item.amount_cents : 0),
  }), { paid: 0, due: 0 });

  return (
    <section className="mx-auto max-w-6xl space-y-10 text-white">
      <header className="rounded-3xl border border-proyecto-accent/25 bg-gradient-to-br from-emerald-950/60 via-slate-950 to-slate-900 px-5 py-12 text-center sm:py-16">
        <p className="mb-4 text-sm font-bold uppercase tracking-widest text-proyecto-accent">Influencer · Programa de creadores</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Crea. Publica. <span className="text-proyecto-accent">Cobra.</span></h1>
        <p className="mx-auto mt-5 max-w-xl text-slate-300">Participa en las campañas y gana por vistas verificadas o por contenido original aprobado.</p>
      </header>
      {loading && <p role="status">Cargando campañas y envíos…</p>}
      {loadError && <p role="alert">{loadError} <button className="underline" onClick={() => void load()}>Reintentar</button></p>}
      {!loading && !loadError && <>
        <dl className="grid grid-cols-2 divide-x divide-slate-800 rounded-2xl border border-slate-800 bg-slate-950/70 sm:grid-cols-5">
          {[
            ['Cobrado', money(totals.paid)], ['Por cobrar', money(totals.due)],
            ['Envíos', number.format(submissions.length)], ['Registros referidos', number.format(overview.registrations)],
            ['Tu código', refCode || '—'],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0 px-3 py-5 text-center">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="mt-2 break-words text-xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-5 lg:grid-cols-2">
          {!campaigns.length && <p className="text-slate-400">Aún no hay campañas disponibles.</p>}
          {campaigns.map(campaign => {
            const ranking = overview.ranking.filter(row => row.campaign_id === campaign.id);
            const byViews = campaign.kind === 'views';
            const closed = campaign.closes_on < today;
            return (
              <article key={campaign.id} className="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 sm:p-7">
                <div className="flex items-center gap-2 text-sm font-semibold text-proyecto-accent">
                  {byViews ? <ChartNoAxesColumnIncreasing size={18} /> : <Film size={18} />}
                  {byViews ? 'Clipping · Por vistas' : 'Contenido original · UGC'}
                </div>
                <h2 className="text-2xl font-bold">{campaign.title}</h2>
                {campaign.description && <p className="text-sm leading-relaxed text-slate-300">{campaign.description}</p>}
                <div className="border-y border-slate-800 py-5">
                  <p className="text-4xl font-black text-proyecto-accent">{!byViews && 'Hasta '}{money(campaign.reward_cents)}</p>
                  <p className="mt-1 text-sm text-slate-300">{byViews ? 'Por cada 1,000 vistas verificadas' : 'Por video aprobado'}</p>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
                  {byViews && <span>Mínimo {number.format(campaign.min_views)} vistas</span>}
                  <span>{closed ? 'Cerró el ' : 'Cierra el '}{new Date(campaign.closes_on + 'T12:00:00').toLocaleDateString('es-DO', { dateStyle: 'medium' })}</span>
                </div>
                {byViews && <>
                  <p className="text-sm text-slate-400">TikTok · Instagram · YouTube</p>
                  <div className="space-y-2 border-t border-slate-800 pt-4">
                    <h3 className="text-sm font-semibold">Ranking por vistas verificadas</h3>
                    {!ranking.length && <p className="text-sm text-slate-400">Todavía no hay vistas verificadas.</p>}
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
                      {ranking.map((row, index) => <li key={index}><span className="flex justify-between gap-2"><span className="break-all">{row.handle}</span><span>{number.format(row.views)}</span></span></li>)}
                    </ol>
                  </div>
                </>}
                <details className="text-sm text-slate-300">
                  <summary className="cursor-pointer font-semibold">Ver reglas</summary>
                  <p className="mt-2 whitespace-pre-line">{campaign.rules}</p>
                </details>
                <button className={action + ' mt-auto'} disabled={closed || sending} onClick={() => {
                  setSelected(campaign);
                  setSubmitError('');
                  requestAnimationFrame(() => document.getElementById('influencer-submit')?.focus());
                }}>
                  <Camera size={18} /> {closed ? 'Campaña cerrada' : 'Enviar mi video'}
                </button>
              </article>
            );
          })}
        </div>
        <p className="text-center text-sm text-slate-400">El equipo verifica las vistas de la publicación pública. Los pagos se realizan fuera de la plataforma.</p>
      </>}
      {selected && <form key={selected.id} onSubmit={submit} className="space-y-4 rounded-2xl border border-proyecto-accent/40 bg-slate-950 p-5 sm:p-7">
        <h2 id="influencer-submit" tabIndex={-1} className="text-xl font-bold">Enviar video · {selected.title}</h2>
        <label className="block">Título del video<input className={input} name="title" required maxLength={120} /></label>
        <label className="block">Usuario en redes<input className={input} name="handle" placeholder="@usuario" required maxLength={61} /></label>
        {selected.kind === 'views' && <label className="block">Enlace de la publicación pública<input className={input} name="url" type="url" required maxLength={1000} /></label>}
        {selected.requires_statistics && <label className="block">Captura de las estadísticas del video
          <input className={input} name="statistics" type="file" accept="image/png,image/jpeg,image/webp" required />
          <span className="text-sm text-slate-400">PNG, JPG o WebP · Hasta 10 MB</span>
        </label>}
        <label className="block">{selected.kind === 'views' ? 'Adjuntar video (opcional)' : 'Video original'}
          <input className={input} name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required={selected.kind === 'ugc'} />
          <span className="text-sm text-slate-400">MP4, MOV o WebM · Hasta 50 MB</span>
        </label>
        {submitError && <p role="alert" className="text-rose-300">{submitError}</p>}
        <div className="flex flex-wrap gap-3">
          <button className={action} disabled={sending}>{sending ? 'Enviando…' : 'Enviar a revisión'}</button>
          <button type="button" className="px-4 py-3 underline" disabled={sending} onClick={() => setSelected(null)}>Cancelar</button>
        </div>
      </form>}
      {feedback && <p role="status" className="text-emerald-300">{feedback}</p>}
      {!loading && !loadError && <section className="space-y-4">
        <h2 className="text-2xl font-bold">Mis envíos</h2>
        {!submissions.length && <p className="text-slate-400">Todavía no has enviado videos.</p>}
        {submissions.map(item => <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="break-all font-bold">{item.title}</h3>
            <p className="text-sm text-proyecto-accent">{statusLabels[item.status]}</p>
          </div>
          <p className="mt-1 text-sm text-slate-300">{item.kind === 'views' && number.format(item.verified_views) + ' vistas verificadas · '}{money(item.amount_cents)}</p>
          {item.review_note && <p className="mt-2 break-words text-sm text-slate-400">{item.review_note}</p>}
        </article>)}
      </section>}
    </section>
  );
}
