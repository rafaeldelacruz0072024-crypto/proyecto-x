import { useState } from 'react';
import { FileCheck2, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Investment } from '../types';
import Logo from './Logo';

export default function NodeCertificates({ nodes, holder, loading }: {
  nodes: Investment[];
  holder: string;
  loading: boolean;
}) {
  const { i18n } = useTranslation();
  const es = !i18n.language.startsWith('en');
  const [selectedId, setSelectedId] = useState('');
  const active = nodes.filter(node => node.status.toUpperCase() === 'ACTIVE');
  const selected = active.find(node => node.id === selectedId) ?? active[0];
  const amount = (value: number) => new Intl.NumberFormat(es ? 'es-DO' : 'en-US', {
    style: 'currency', currency: 'USD',
  }).format(value);

  if (!selected) return (
    <p role="status" className="rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-slate-300">
      {loading
        ? (es ? 'Cargando certificados…' : 'Loading certificates…')
        : (es ? 'Tus certificados aparecerán aquí al activar un nodo.' : 'Your certificates will appear here when you activate a node.')}
    </p>
  );

  const fields = [
    [es ? 'Titular' : 'Holder', holder],
    [es ? 'Nodo' : 'Node', selected.plans?.name ?? (es ? 'Nodo activo' : 'Active node')],
    [es ? 'Fecha de activación' : 'Activation date', new Intl.DateTimeFormat(es ? 'es-DO' : 'en-US', { dateStyle: 'long', timeZone: 'America/Santo_Domingo' }).format(new Date(selected.created_at))],
    [es ? 'Referencia del certificado' : 'Certificate reference', `NOVA-${selected.id.toUpperCase()}`],
  ];

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #nova-node-certificate, #nova-node-certificate * { visibility: visible !important; }
          #nova-node-certificate { position: absolute; top: 0; left: 0; width: 100%; box-shadow: none; border: 1px solid #aaa; }
        }
      `}</style>
      <article id="nova-node-certificate" className="min-w-0 overflow-hidden rounded-3xl bg-white text-slate-900 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800 bg-[#0e251d] px-5 py-4 text-white sm:px-8">
          <Logo size="sm" variant="icon" />
          <span className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-bold text-emerald-200">
            {es ? 'Nodo activo' : 'Active node'}
          </span>
        </div>
        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-3 text-emerald-800">
            <FileCheck2 className="shrink-0" aria-hidden="true" />
            <h2 className="text-xl font-black sm:text-2xl">{es ? 'Constancia digital de nodo' : 'Digital node certificate'}</h2>
          </div>
          <p className="mt-5 text-sm text-slate-600">{es ? 'Capital registrado en Nova' : 'Capital recorded in Nova'}</p>
          <p className="text-3xl font-black tabular-nums">{amount(selected.amount)}</p>
          <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold text-slate-600">{label}</dt>
                <dd className="mt-1 break-words text-sm font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-bold">{es ? 'Respaldo en blockchain pendiente de verificación' : 'On-chain backing pending verification'}</p>
            <p className="mt-1">{es ? 'Esta constancia acredita el registro del nodo en Nova. La asignación de USDT a este nodo todavía no está verificada.' : 'This certificate records the node in Nova. The allocation of USDT to this node has yet to be verified.'}</p>
          </div>
        </div>
      </article>
      <section className="min-w-0 self-start rounded-2xl border border-emerald-500/25 bg-[#0b1a15] p-4">
        <h2 className="text-lg font-bold text-white">{es ? 'Mis certificados' : 'My certificates'}</h2>
        <p className="mb-4 text-sm text-slate-400">{active.length} {es ? 'nodos activos' : 'active nodes'}</p>
        <div className="space-y-2">
          {active.map(node => (
            <button key={node.id} type="button" aria-pressed={node.id === selected.id} onClick={() => setSelectedId(node.id)}
              className="flex min-h-12 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-white hover:bg-white/5 aria-pressed:border-emerald-400 aria-pressed:bg-emerald-400/10">
              <span>{node.plans?.name ?? (es ? 'Nodo' : 'Node')} · {node.id.slice(0, 8).toUpperCase()}</span>
              <strong>{amount(node.amount)}</strong>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => window.print()}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 py-2 text-sm font-bold text-emerald-950">
          <Printer size={17} aria-hidden="true" /> {es ? 'Imprimir / guardar PDF' : 'Print / save PDF'}
        </button>
      </section>
    </div>
  );
}
