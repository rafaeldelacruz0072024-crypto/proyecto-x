import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TransactionType, TransactionStatus } from '../types';

interface Props {
  transactions: any[]; // Flexible para Supabase
}

const ITEMS_PER_PAGE = 8;

const TransactionHistory: React.FC<Props> = ({ transactions }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  // Filtering Logic (COMPATIBLE CON SUPABASE)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filterType === 'ALL' || tx.type === filterType;

      // ✅ COMPATIBLE: usa created_at (Supabase) o date (mock)
      const txDate = new Date(tx.created_at || tx.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;
      const matchesDate = txDate >= start && txDate <= end;

      return matchesType && matchesDate;
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || a.date).getTime();
      const dateB = new Date(b.created_at || b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, filterType, startDate, endDate]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedData = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="holo-card p-4 rounded-none clip-corner border border-proyecto-accent/20 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('finance.filter_protocol')}</label>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-2 px-3 text-sm text-white font-mono-tech focus:outline-none focus:border-proyecto-accent transition-all"
          >
            <option value="ALL">{t('finance.all_transactions')}</option>
            {Object.values(TransactionType).map(type => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('finance.start_date')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="bg-black/50 border border-slate-800 clip-corner-sm py-2 px-3 text-sm text-slate-300 font-mono-tech focus:outline-none focus:border-proyecto-accent transition-all uppercase"
          />
        </div>

        <div>
          <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('finance.end_date')}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="bg-black/50 border border-slate-800 clip-corner-sm py-2 px-3 text-sm text-slate-300 font-mono-tech focus:outline-none focus:border-proyecto-accent transition-all uppercase"
          />
        </div>

        <button
          onClick={() => { setFilterType('ALL'); setStartDate(''); setEndDate(''); setCurrentPage(1); }}
          className="bg-slate-900 border border-slate-800 text-[10px] px-4 py-2.5 clip-corner-sm hover:bg-slate-800 transition text-slate-400 uppercase font-mono-tech font-bold tracking-widest hover:text-white"
        >
          {t('finance.reset')}
        </button>
      </div>

      {/* Results Table */}
      <div className="holo-card p-0 rounded-none clip-corner overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-proyecto-accent/20 relative group/table">
        {/* Horizontal Scanner */}
        <div className="absolute top-[52px] left-0 w-full h-[1px] bg-proyecto-accent/40 shadow-[0_0_10px_cyan] animate-scanline-h z-30 pointer-events-none"></div>

        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-proyecto-accent/10 to-transparent pointer-events-none"></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-black/80 border-b border-white/5 text-[10px] uppercase text-slate-400 font-orbitron font-black tracking-[0.3em] relative z-10 sticky top-0">
              <tr>
                <th className="px-6 py-5">{t('finance.ref_id')}</th>
                <th className="px-6 py-5">{t('finance.timestamp')}</th>
                <th className="px-6 py-5">{t('finance.operation_details')}</th>
                <th className="px-6 py-5">{t('finance.status')}</th>
                <th className="px-6 py-5 text-right">{t('finance.value')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-sm relative z-10 bg-black/20">
              {paginatedData.length > 0 ? (
                paginatedData.map((tx) => {
                  const txDate = new Date(tx.created_at || tx.date);
                  const txId = tx.id || '';

                  return (
                    <tr
                      key={txId}
                      onClick={() => setSelectedTx(tx)}
                      className="hover:bg-proyecto-accent/[0.03] transition-all group cursor-pointer relative"
                    >
                      <td className="px-6 py-6 font-mono-tech text-[10px] text-slate-500 group-hover:text-proyecto-accent transition-colors tracking-widest">
                        {txId.startsWith('tx_') ? txId.slice(0, 12).toUpperCase() : `NODE-${String(txId).slice(-8).toUpperCase()}`}
                      </td>
                      <td className="px-6 py-6 border-l border-white/[0.02]">
                        <div className="text-white font-mono-tech font-black text-xs uppercase tracking-tighter">{txDate.toLocaleDateString()}</div>
                        <div className="text-[9px] text-slate-500 font-mono-tech uppercase font-bold tracking-widest mt-1 opacity-60">{txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-6 max-w-xs border-l border-white/[0.02]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-1.5 h-1.5 rounded-none rotate-45 ${tx.amount > 0 ? 'bg-proyecto-green shadow-[0_0_5px_rgba(16,185,129,1)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,1)]'}`}></span>
                          <span className={`text-[9px] font-orbitron font-black tracking-[0.1em] uppercase ${tx.amount > 0 ? 'text-proyecto-green' : 'text-red-400'}`}>
                            {t(`finance.types.${tx.type}`, { defaultValue: String(tx.type).replace('_', ' ') })}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 font-mono-tech font-bold line-clamp-1 group-hover:text-white transition-colors uppercase tracking-tight">
                          {tx.description}
                        </div>
                      </td>
                      <td className="px-6 py-6 border-l border-white/[0.02]">
                        <div className={`inline-flex items-center px-3 py-1 rounded-none border text-[9px] font-orbitron font-black uppercase tracking-widest ${
                          tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CONFIRMED || tx.status === 'COMPLETED' || tx.status === 'CONFIRMED'
                            ? 'bg-proyecto-green/10 border-proyecto-green/30 text-proyecto-green'
                            : tx.status === TransactionStatus.REJECTED || tx.status === TransactionStatus.FAILED || tx.status === 'REJECTED' || tx.status === 'FAILED' || tx.type === 'WITHDRAWAL_REJECTED'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'bg-proyecto-gold/10 border-proyecto-gold/30 text-proyecto-gold animate-pulse'
                        }`}>
                          {tx.type === 'WITHDRAWAL_REJECTED' ? 'DEVUELTO' : tx.status}
                        </div>
                      </td>
                      <td className={`px-6 py-6 text-right font-orbitron font-black text-xl border-l border-white/[0.02] ${tx.amount > 0 ? 'text-proyecto-green text-glow-green' : 'text-red-500 text-glow-red'}`}>
                        {tx.amount > 0 ? '+' : ''}{Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <svg className="w-16 h-16 text-slate-500 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-slate-400 font-orbitron font-bold text-sm uppercase tracking-[0.2em]">{t('finance.empty_ledger')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-black/60 px-6 py-4 border-t border-slate-800/50 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 clip-corner-sm text-[10px] font-orbitron font-bold uppercase transition border ${currentPage === 1
                  ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
              >
                {t('finance.prev')}
              </button>
              <div className="flex items-center space-x-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => handlePageChange(i + 1)}
                    className={`w-8 h-8 clip-corner-sm text-[10px] font-orbitron font-bold transition flex items-center justify-center ${currentPage === i + 1
                      ? 'bg-proyecto-accent text-black shadow-[0_0_10px_cyan]'
                      : 'text-slate-500 hover:text-white hover:bg-slate-800'
                      }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 clip-corner-sm text-[10px] font-orbitron font-bold uppercase transition border ${currentPage === totalPages
                  ? 'border-slate-800 text-slate-700 cursor-not-allowed'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
              >
                {t('finance.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
          <div className="holo-card p-0 rounded-none clip-corner border border-proyecto-accent rounded-[0] w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(0,243,255,0.2)]">
            <div className="p-8 relative z-10">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-proyecto-accent to-transparent"></div>

              {/* Header */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-[10px] font-mono-tech font-bold text-proyecto-accent uppercase tracking-[0.3em] mb-1">{t('finance.audit_protocol')}</h3>
                  <h4 className="text-xl font-orbitron font-bold text-white uppercase tracking-tighter">{t('finance.operation_detail_title')}</h4>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="w-10 h-10 clip-corner-sm bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white hover:border-proyecto-accent transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Amount Display */}
              <div className="bg-black/50 rounded-none clip-corner-sm p-8 text-center border border-slate-900 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-proyecto-brand opacity-40"></div>
                <p className="text-[10px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2">{t('finance.tx_volume')}</p>
                <div className={`text-4xl font-orbitron font-bold ${selectedTx.amount > 0 ? 'text-proyecto-green text-glow-green' : 'text-red-500 text-glow-red'}`}>
                  {selectedTx.amount > 0 ? '+' : ''}{Number(selectedTx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xl opacity-40 uppercase">USDT</span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/40 p-4 clip-corner-sm border border-slate-800/50">
                    <p className="text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-1">{t('finance.node_status_label')}</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rotate-45 ${selectedTx.status === 'COMPLETED' || selectedTx.status === 'CONFIRMED' ? 'bg-proyecto-green shadow-[0_0_5px_green]' : 'bg-proyecto-gold animate-pulse shadow-[0_0_5px_gold]'}`}></div>
                      <span className="text-xs font-orbitron font-bold text-white uppercase">{selectedTx.status}</span>
                    </div>
                  </div>
                  <div className="bg-slate-900/40 p-4 clip-corner-sm border border-slate-800/50">
                    <p className="text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-1">{t('finance.asset_class')}</p>
                    <span className="text-xs font-orbitron font-bold text-white uppercase tracking-tighter">{String(selectedTx.type).replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="bg-slate-900/40 p-5 clip-corner-sm border border-slate-800/50">
                  <p className="text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2">{t('finance.tech_desc')}</p>
                  <p className="text-xs text-slate-300 font-mono-tech font-bold leading-relaxed">
                    {selectedTx.description}
                  </p>
                </div>

                {selectedTx.type === 'WITHDRAWAL_REJECTED' && selectedTx.description && (
                  <div className="bg-red-500/5 p-5 clip-corner-sm border border-red-500/20">
                    <p className="text-[9px] font-mono-tech font-bold text-red-400 uppercase tracking-widest mb-2">Motivo del Rechazo</p>
                    <p className="text-xs text-red-300 font-mono-tech font-bold leading-relaxed">
                      {selectedTx.description.includes('Motivo:')
                        ? selectedTx.description.split('Motivo:').pop()?.trim()
                        : selectedTx.description}
                    </p>
                    <p className="text-[9px] text-red-400/60 font-mono-tech font-bold uppercase tracking-widest mt-3">
                      Tu saldo fue restaurado automáticamente
                    </p>
                  </div>
                )}

                <div className="space-y-3 pt-2 border-t border-slate-800/50 mt-4">
                  <div className="flex justify-between items-center text-[10px] px-2 pt-2">
                    <span className="text-slate-500 font-mono-tech font-bold uppercase tracking-widest">{t('finance.ledger_id_label')}</span>
                    <span className="text-proyecto-accent font-mono font-bold text-[9px]">{String(selectedTx.id).slice(0, 20)}...</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] px-2">
                    <span className="text-slate-500 font-mono-tech font-bold uppercase tracking-widest">{t('finance.timestamp')}</span>
                    <span className="text-white font-mono-tech font-bold">{new Date(selectedTx.created_at || selectedTx.date).toLocaleString('en-US')}</span>
                  </div>
                  {selectedTx.reference_id && (
                    <div className="flex justify-between items-center text-[10px] px-2">
                      <span className="text-slate-500 font-mono-tech font-bold uppercase tracking-widest">{t('finance.ref_hash')}</span>
                      <span className="text-slate-300 font-mono text-[9px] truncate ml-4">{String(selectedTx.reference_id).slice(0, 15)}...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedTx.id);
                  }}
                  className="flex-grow py-4 bg-slate-900 border border-slate-800 clip-corner-sm text-[10px] font-orbitron font-bold text-slate-400 uppercase tracking-widest hover:text-white hover:border-proyecto-accent transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  {t('finance.copy_id')}
                </button>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-10 py-4 bg-proyecto-brand text-white clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(0,114,255,0.3)] active:scale-95 transition-all hover:brightness-110"
                >
                  {t('finance.close_access')}
                </button>
              </div>
            </div>

            <div className="bg-black/80 py-3 text-center border-t border-slate-900/50 relative z-10">
              <span className="text-[8px] font-mono-tech font-bold text-slate-700 uppercase tracking-[0.5em]">{t('finance.infrastructure_label')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
