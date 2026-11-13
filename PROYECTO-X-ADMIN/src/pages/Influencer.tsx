import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Campaign = {
  id: string; title: string; rules: string; kind: 'views' | 'ugc';
  reward_cents: number; min_views: number; closes_on: string; active: boolean;
  description: string; requires_statistics: boolean;
};
type Submission = {
  id: string; campaign_id: string; user_id: string; title: string; handle: string;
  post_url: string | null; video_path: string | null; statistics_path: string | null; kind: Campaign['kind'];
  reward_cents: number; min_views: number; verified_views: number; creative_cents: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid'; review_note: string | null;
  payment_reference: string | null; paid_at: string | null; amount_cents: number; updated_at: string;
};

const statuses = { pending: 'En revisión', approved: 'Por pagar', rejected: 'Rechazado', paid: 'Pagado' };
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const input = 'block w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-white';
const primary = 'rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50';
const secondary = 'rounded-lg border border-slate-600 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50';
const pageSize = 30;

function CampaignEditor({ campaign, onSave }: { campaign?: Campaign; onSave: (values: Omit<Campaign, 'id'>) => Promise<boolean> }) {
  const [kind, setKind] = useState<Campaign['kind']>(campaign?.kind ?? 'views');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await onSave({
      title: String(form.get('title')).trim(), rules: String(form.get('rules')).trim(), kind,
      description: String(form.get('description')).trim(),
      requires_statistics: kind === 'views' && form.get('requires_statistics') === 'on',
      reward_cents: Math.round(Number(form.get('reward')) * 100),
      min_views: kind === 'views' ? Number(form.get('min_views')) : 0,
      closes_on: String(form.get('closes_on')), active: form.get('active') === 'on',
    });
    if (saved && !campaign) {
      formElement.reset();
      setKind('views');
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 pt-4 sm:grid-cols-2">
      <label>Título<input className={input} name="title" defaultValue={campaign?.title} required maxLength={120} /></label>
      <label>Modalidad<select className={input} value={kind} onChange={event => setKind(event.target.value as Campaign['kind'])}>
        <option value="views">Por vistas</option><option value="ugc">Contenido original</option>
      </select></label>
      <label>{kind === 'views' ? 'USD por 1,000 vistas' : 'Tope por video en USD'}
        <input className={input} name="reward" type="number" min="0.01" max="1000" step="0.01" defaultValue={campaign && campaign.reward_cents / 100} required />
      </label>
      {kind === 'views' && <label>Mínimo de vistas<input className={input} name="min_views" type="number" min="1000" max="1000000000" defaultValue={campaign?.min_views || 1000} required /></label>}
      <label>Fecha de cierre<input className={input} name="closes_on" type="date" defaultValue={campaign?.closes_on} required /></label>
      <label className="flex items-center gap-2"><input name="active" type="checkbox" defaultChecked={campaign?.active ?? true} /> Visible en el programa</label>
      {kind === 'views' && <label className="flex items-center gap-2"><input name="requires_statistics" type="checkbox" defaultChecked={campaign?.requires_statistics ?? false} /> Exigir captura de estadísticas</label>}
      <label className="sm:col-span-2">Descripción<textarea className={input} name="description" defaultValue={campaign?.description} maxLength={1000} rows={2} /></label>
      <label className="sm:col-span-2">Reglas<textarea className={input} name="rules" defaultValue={campaign?.rules} required maxLength={4000} rows={3} /></label>
      <button className={primary + ' justify-self-start'}>{campaign ? 'Guardar campaña' : 'Crear campaña'}</button>
    </form>
  );
}

export default function Influencer() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rows, setRows] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<Submission['status'] | 'all'>('pending');
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statistics, setStatistics] = useState<{ id: string; url: string } | null>(null);
  const [video, setVideo] = useState<{ id: string; url: string } | null>(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    let query = supabase.from('influencer_submissions').select('*', { count: 'exact' });
    if (filter !== 'all') query = query.eq('status', filter);
    void Promise.all([
      supabase.from('influencer_campaigns').select('*').order('title'),
      query.order('created_at', { ascending: false }).order('id').range(page * pageSize, (page + 1) * pageSize - 1),
    ]).then(([campaignResult, submissionResult]) => {
      if (!current) return;
      const failure = campaignResult.error || submissionResult.error;
      if (failure) setLoadError(failure.message);
      else {
        const total = submissionResult.count ?? 0;
        if (page > 0 && page * pageSize >= total) setPage(Math.max(0, Math.ceil(total / pageSize) - 1));
        setCampaigns(campaignResult.data ?? []);
        setRows(submissionResult.data ?? []);
        setCount(total);
      }
      setLoading(false);
    }, () => {
      if (current) {
        setLoadError('No se pudo cargar el programa.');
        setLoading(false);
      }
    });
    return () => { current = false; };
  }, [filter, page, revision]);

  async function mutate(action: () => PromiseLike<{ error: { message: string } | null }>, message: string) {
    if (busy) return false;
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const result = await action();
      if (result.error) throw new Error(result.error.message);
      setNotice(message);
      setRevision(value => value + 1);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el cambio.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function review(event: FormEvent<HTMLFormElement>, row: Submission) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status = button?.value || 'pending';
    const update = status === 'paid'
      ? { status, payment_reference: String(form.get('payment_reference')).trim() }
      : {
          status,
          verified_views: Number(form.get('views') || 0),
          creative_cents: Math.round(Number(form.get('reward') || 0) * 100),
          review_note: String(form.get('note') || '').trim() || null,
        };
    await mutate(() => supabase.from('influencer_submissions').update(update)
      .eq('id', row.id).eq('updated_at', row.updated_at).select('id').single(),
      status === 'paid' ? 'Pago externo registrado.' : 'Revisión guardada.');
  }

  async function showVideo(row: Submission) {
    if (!row.video_path) return;
    setError('');
    const { data, error: failure } = await supabase.storage.from('influencer-videos').createSignedUrl(row.video_path, 600);
    if (failure) setError('No se pudo abrir el video adjunto.');
    else setVideo({ id: row.id, url: data.signedUrl });
  }

  async function showStatistics(row: Submission) {
    if (!row.statistics_path) return;
    setError('');
    const { data, error: failure } = await supabase.storage.from('influencer-statistics').createSignedUrl(row.statistics_path, 600);
    if (failure) setError('No se pudo abrir la captura de estadísticas.');
    else setStatistics({ id: row.id, url: data.signedUrl });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 text-white">
      <header>
        <h1 className="text-3xl font-bold">Influencer</h1>
        <p className="mt-2 text-slate-400">Gestiona campañas, valida las vistas y registra los pagos realizados fuera de la plataforma.</p>
      </header>
      {error && <p role="alert" className="sticky top-0 z-10 rounded-lg bg-rose-950 p-3 text-rose-200">{error}</p>}
      {notice && <p role="status" className="text-emerald-300">{notice}</p>}
      {loadError && <p role="alert">{loadError} <button onClick={() => setRevision(value => value + 1)} className="underline">Reintentar</button></p>}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Campañas</h2>
        <fieldset disabled={busy || loading || !!loadError} className="space-y-3">
          <details className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <summary className="cursor-pointer font-semibold">Nueva campaña</summary>
            <CampaignEditor onSave={values => mutate(() => supabase.from('influencer_campaigns').insert(values), 'Campaña creada.')} />
          </details>
          {campaigns.map(campaign => (
            <details className="rounded-xl border border-slate-700 bg-slate-900 p-4" key={campaign.id}>
              <summary className="cursor-pointer break-words font-semibold">{campaign.title} · {campaign.active ? 'Visible' : 'Oculta'}</summary>
              <CampaignEditor campaign={campaign} onSave={values => mutate(() => supabase.from('influencer_campaigns').update(values).eq('id', campaign.id).select('id').single(), 'Campaña guardada.')} />
            </details>
          ))}
        </fieldset>
      </section>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Envíos</h2>
          <label className="flex items-center gap-2">Estado
            <select className={input} value={filter} onChange={event => { setPage(0); setFilter(event.target.value as typeof filter); }}>
              <option value="all">Todos</option>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {loading && <p role="status">Cargando envíos…</p>}
        {!loading && !loadError && !rows.length && <p className="text-slate-400">No hay envíos con este estado.</p>}
        {!loading && !loadError && rows.map(row => (
          <article key={row.id + row.updated_at} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-blue-300">{campaigns.find(c => c.id === row.campaign_id)?.title}</p>
                <h3 className="break-words text-lg font-bold">{row.title} <span className="text-slate-400">{row.handle}</span></h3>
                <p className="break-all text-xs text-slate-400">Usuario {row.user_id}</p>
              </div>
              <p className="font-semibold">{statuses[row.status]} · {currency.format(row.amount_cents / 100)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {row.post_url && <a className={secondary} href={row.post_url} target="_blank" rel="noreferrer">Abrir publicación</a>}
              {row.statistics_path && <button className={secondary} onClick={() => void showStatistics(row)}>Ver captura de estadísticas</button>}
              {row.video_path && <button className={secondary} onClick={() => void showVideo(row)}>Ver video adjunto</button>}
            </div>
            {statistics?.id === row.id && <a href={statistics.url} target="_blank" rel="noreferrer" className="block">
              <img className="max-h-96 rounded-lg object-contain" src={statistics.url} alt="Estadísticas del video" />
            </a>}
            {video?.id === row.id && <video className="max-h-96 w-full rounded-lg bg-black" controls src={video.url} />}
            {row.status === 'paid' ? (
              <div className="space-y-1 text-sm text-slate-300">
                {row.kind === 'views' && <p>{row.verified_views.toLocaleString('en-US')} vistas verificadas</p>}
                <p className="break-words">Referencia del pago · {row.payment_reference}</p>
                {row.paid_at && <p>{new Date(row.paid_at).toLocaleString('es-DO')}</p>}
                {row.review_note && <p className="break-words">{row.review_note}</p>}
              </div>
            ) : (
              <>
                <form onSubmit={event => void review(event, row)}>
                  <fieldset disabled={busy} className="space-y-3">
                    {row.kind === 'views' ? <label className="block">Vistas verificadas · Mínimo {row.min_views.toLocaleString('en-US')}
                      <input className={input} name="views" type="number" min="0" max="1000000000" required defaultValue={row.verified_views} />
                    </label> : <label className="block">Recompensa en USD · Hasta {currency.format(row.reward_cents / 100)}
                      <input className={input} name="reward" type="number" min="0" max={row.reward_cents / 100} step="0.01" required defaultValue={row.creative_cents / 100} />
                    </label>}
                    <label className="block">Nota para el creador<textarea className={input} name="note" defaultValue={row.review_note || ''} maxLength={1000} /></label>
                    <div className="flex flex-wrap gap-2">
                      <button className={secondary} value="pending">Guardar en revisión</button>
                      <button className={primary} value="approved">{row.status === 'approved' ? 'Actualizar aprobación' : 'Aprobar recompensa'}</button>
                      <button className={secondary} value="rejected">Rechazar</button>
                    </div>
                  </fieldset>
                </form>
                {row.status === 'approved' && <form className="border-t border-slate-700 pt-4" onSubmit={event => void review(event, row)}>
                  <fieldset disabled={busy} className="space-y-3">
                    <label className="block">Referencia del pago externo<input className={input} name="payment_reference" required maxLength={200} /></label>
                    <button className={primary} value="paid">Registrar pago de {currency.format(row.amount_cents / 100)}</button>
                  </fieldset>
                </form>}
              </>
            )}
          </article>
        ))}
        {!loading && !loadError && count > pageSize && <div className="flex flex-wrap items-center gap-3">
          <button className={secondary} disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button>
          <span>Página {page + 1} de {Math.ceil(count / pageSize)}</span>
          <button className={secondary} disabled={(page + 1) * pageSize >= count} onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </div>}
      </section>
    </div>
  );
}
