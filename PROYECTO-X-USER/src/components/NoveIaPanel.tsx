import { Bot, CalendarDays, CreditCard, Layers } from 'lucide-react';

export default function NoveIaPanel({ activeCycles }: { activeCycles: number }) {
  return (
    <section aria-labelledby="nova-ia-plan" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
      <div className="holo-card space-y-6 rounded-xl p-6 sm:p-9">
        <Bot className="text-proyecto-accent" size={32} aria-hidden="true" />
        <h2 id="nova-ia-plan" className="text-3xl font-black text-white sm:text-4xl">
          Deja que la IA lo haga por ti
        </h2>
        <p className="max-w-xl text-slate-300">
          Nova IA completará las cuatro tareas de cada ciclo activo de lunes a viernes,
          según el horario de Santo Domingo y el corte de cada ciclo.
        </p>
        <dl className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 text-sm text-slate-300">
              <Layers size={17} aria-hidden="true" /> Tus ciclos activos
            </dt>
            <dd className="mt-2 text-2xl font-bold text-white">{activeCycles}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-sm text-slate-300">
              <CalendarDays size={17} aria-hidden="true" /> Días de ejecución
            </dt>
            <dd className="mt-2 text-lg font-bold text-white">Lunes a viernes</dd>
          </div>
        </dl>
      </div>
      <div className="holo-card space-y-4 self-start rounded-xl p-6 sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <CreditCard className="text-proyecto-accent" size={20} aria-hidden="true" />
          Suscripción mensual
        </h2>
        <p className="text-3xl font-black text-proyecto-accent">50 USDT <span className="text-base">al mes</span></p>
        <p className="text-sm text-slate-300">USDT por BNB Smart Chain (BEP20) mediante NOWPayments.</p>
        <p className="border-t border-white/10 pt-4 text-sm text-slate-300">
          Suscripción y automatización próximamente.
        </p>
      </div>
    </section>
  );
}
