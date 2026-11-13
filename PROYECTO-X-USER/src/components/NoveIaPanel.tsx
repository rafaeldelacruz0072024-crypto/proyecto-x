import { Bot } from 'lucide-react';

export default function NoveIaPanel() {
  return (
    <section className="holo-card max-w-2xl space-y-5 rounded-xl p-6 sm:p-9">
      <div className="flex items-center gap-3 text-proyecto-accent">
        <Bot aria-hidden="true" />
        <h1 className="text-3xl font-black">Nove IA</h1>
      </div>
      <p className="text-2xl font-bold text-white">Deja que la IA lo haga por ti</p>
      <p className="text-slate-300">Próximamente podrás automatizar las cuatro tareas de cada ciclo activo de lunes a viernes.</p>
      <p className="text-xl font-black text-proyecto-accent">50 USDT al mes</p>
      <p className="text-slate-300">La mensualidad se descontará de tu saldo cuando autorices la suscripción.</p>
    </section>
  );
}
