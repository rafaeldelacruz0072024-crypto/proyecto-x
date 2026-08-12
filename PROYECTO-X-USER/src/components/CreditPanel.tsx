import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { supabase } from '../lib/supabase';
import { transferCredits, getSystemSettings, convertBalanceToCredit } from '../services/database';


import { Profile, NetworkMember } from '../types';

interface Props {
  userId: string;
  creditBalance: number;
  mainBalance: number;
  onRefresh: () => void;
  addNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
  transferBlocked?: boolean;
}

interface NetworkUser {
  id: string;
  email: string;
  name: string;
  level: number;
}

interface CreditLog {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  performed_by?: string;
}

// ==========================================
// HIERARCHICAL ACCORDION COMPONENT
// ==========================================
interface AccordionProps {
  node: any;
  selectedId: string;
  onSelect: (id: string) => void;
  level: number;
}

const ReferralAccordion: React.FC<AccordionProps> = ({ node, selectedId, onSelect, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div className="mb-2">
      <div
        onClick={() => onSelect(node.id)}
        className={`
          flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group
          ${isSelected ? 'bg-geminix-accent/15 border-geminix-accent shadow-[0_0_15px_rgba(0,243,255,0.1)]' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}
        `}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border ${isSelected ? 'bg-geminix-accent text-slate-950 border-geminix-accent' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
            {node.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">{node.name}</p>
            <p className="text-[9px] text-slate-500 uppercase font-mono">{node.email || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[8px] font-black text-geminix-accent px-2 py-0.5 bg-geminix-accent/10 border border-geminix-accent/20 rounded uppercase tracking-tighter">
            L{node.level || level}
          </span>
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className={`w-6 h-6 rounded-md border border-slate-800 flex items-center justify-center transition-all ${isOpen ? 'rotate-180 bg-slate-800 text-white' : 'text-slate-500 group-hover:text-white group-hover:border-slate-600'}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </button>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="ml-6 mt-2 pl-4 border-l border-slate-800 animate-fade-in space-y-2">
          {node.children.map((child: any) => (
            <ReferralAccordion
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CreditPanel: React.FC<Props> = ({ userId, creditBalance, mainBalance, onRefresh, addNotification, transferBlocked }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'transfer' | 'pay' | 'convert' | 'history' | 'tokenomics'>('transfer');

  const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]);
  const [networkTree, setNetworkTree] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<CreditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalUsers, setGlobalUsers] = useState<NetworkUser[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [transferFee, setTransferFee] = useState<number>(5);


  // Cargar usuarios de la red y configuración
  useEffect(() => {
    if (userId) {
      loadNetworkUsers();
      loadTransactions();
      loadSettings();
    }
  }, [userId]);

  // Global Search Effect with Debounce
  useEffect(() => {
    if (searchQuery.length < 3) {
      setGlobalUsers([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const { searchUsers } = await import('../services/database');
        const results = await searchUsers(searchQuery);

        // Filter out those already in networkUsers to avoid duplicates
        const filteredGlobal = results
          .filter(u => u.id !== userId && !networkUsers.some(nu => nu.id === u.id))
          .map(u => ({
            id: u.id,
            email: u.email,
            name: u.full_name || u.username || u.email,
            level: 0 // 0 indicates global/outside network
          }));

        setGlobalUsers(filteredGlobal);
      } catch (error) {
        console.error('Error during global search:', error);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery, userId, networkUsers]);

  const loadSettings = async () => {
    const settings = await getSystemSettings();
    if (settings?.credit_transfer_fee !== undefined) {
      setTransferFee(settings.credit_transfer_fee);
    }
  };


  const loadNetworkUsers = async () => {
    try {
      const { getNetworkTree } = await import('../services/database');
      const result = await getNetworkTree(userId);

      if (result && result.tree) {
        setNetworkTree(result.tree);
        const flatUsers: NetworkUser[] = [];

        const flatten = (node: any) => {
          if (node.id !== userId) {
            flatUsers.push({
              id: node.id,
              email: node.email,
              name: node.name,
              level: node.level
            });
          }
          if (node.children) {
            node.children.forEach(flatten);
          }
        };

        flatten(result.tree);
        setNetworkUsers(flatUsers);
      }
    } catch (error) {
      console.error('Error loading unified network users:', error);
    }
  };

  const loadTransactions = async () => {
    if (!userId) return;

    try {
      // 1. INTENTO PRIMARIO: credit_logs (Libro Mayor Dedicado)
      const { data: logsData, error: logsError } = await supabase
        .from('credit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!logsError && logsData && logsData.length > 0) {
        const mappedLogs: CreditLog[] = logsData.map(tx => {
          let displayDescription = tx.description || '';
          if (!displayDescription || displayDescription === 'Verified Operation') {
            if (tx.type === 'TRANSFER_IN') displayDescription = `GMX Token Recibido`;
            else if (tx.type === 'TRANSFER_OUT') displayDescription = `GMX Token Enviado`;
          }
          return {
            id: tx.id,
            user_id: tx.user_id,
            amount: Number(tx.amount),
            type: tx.type,
            description: displayDescription,
            created_at: tx.created_at
          };
        });
        setTransactions(mappedLogs);
        return;
      }

      // 2. RESPALDO: transactions (Libro Mayor General)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .in('type', ['CONVERSION', 'TRANSFER_IN', 'TRANSFER_OUT', 'INVESTMENT_COST', 'ADMIN_ADJUSTMENT'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (txError) throw txError;

      const mappedFallback: CreditLog[] = (txData || []).map(tx => {
        return {
          id: tx.id,
          user_id: tx.user_id,
          amount: Number(tx.amount),
          type: tx.type as any,
          description: tx.description || '',
          created_at: tx.created_at
        };
      });

      setTransactions(mappedFallback);
    } catch (error) {
      console.error('Final failure in credit history loader:', error);
    }
  };

  const handleTransfer = async () => {
    if (!selectedUser || !amount || parseFloat(amount) <= 0) {
      addNotification('Please select a user and enter a valid amount', 'error');
      return;
    }

    if (parseFloat(amount) < 10) {
      addNotification(t('credit.transfer.min_amount_error'), 'error');
      return;
    }

    if (parseFloat(amount) > creditBalance) {
      addNotification('Insufficient credit balance', 'error');
      return;
    }

    setLoading(true);
    try {
      const userToTransfer = [...networkUsers, ...globalUsers].find(u => u.id === selectedUser);
      if (!userToTransfer) throw new Error("User not found");

      const result = await transferCredits(userId, userToTransfer.email, parseFloat(amount));

      if (result?.success) {
        addNotification(t('credit.transfer.success'), 'success');
        setAmount('');
        setDescription('');
        setSelectedUser('');
        // Force immediate refresh
        setTimeout(() => {
          onRefresh();
          loadTransactions();
        }, 1000);
      } else {
        addNotification(result?.message || 'Transfer failed', 'error');
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      addNotification(error.message || 'Transfer failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      addNotification('Enter a valid amount', 'error');
      return;
    }

    if (parseFloat(amount) > mainBalance) {
      addNotification('Insufficient main balance', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await convertBalanceToCredit(userId, parseFloat(amount));

      if (result?.success) {
        addNotification(t('credit.convert.success'), 'success');
        setAmount('');
        // Force immediate refresh
        setTimeout(() => {
          onRefresh();
          loadTransactions();
        }, 1000);
      } else {
        addNotification(result?.message || 'Conversion failed', 'error');
      }
    } catch (error: any) {
      console.error('Conversion error:', error);
      addNotification(error.message || 'Conversion failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = networkUsers.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-geminix-accent/5 to-transparent pointer-events-none"></div>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-20 h-20 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 bg-geminix-accent/20 border border-geminix-accent/40 rounded text-[8px] font-black text-geminix-accent uppercase tracking-widest">GMX</span>
            <p className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-[0.3em]">{t('credit.labels.credit_balance')}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-geminix-accent font-black text-xl text-glow-cyan font-orbitron">◈</span>
            <p className="text-5xl font-orbitron font-black text-white tracking-tighter tabular-nums text-glow-cyan">{creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-none rotate-45 bg-geminix-accent animate-pulse shadow-[0_0_8px_cyan]"></div>
              <p className="text-[9px] text-slate-400 font-mono-tech font-bold uppercase tracking-[0.2em]">1 GMX = $1.00 USDT</p>
            </div>
            <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">BSC · Fase 3</span>
          </div>
        </div>

        <div className="holo-card p-8 rounded-none clip-corner border border-white/5 bg-black/40 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <svg className="w-20 h-20 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-[10px] font-orbitron font-black text-slate-500 uppercase tracking-[0.3em] mb-4">⬡ {t('credit.labels.wallet_bank')}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-slate-500 font-black text-xl font-orbitron">$</span>
            <p className="text-5xl font-orbitron font-black text-white tracking-tighter tabular-nums">{mainBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-slate-500">
            <svg className="w-3 h-3 animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <p className="text-[9px] font-mono-tech font-bold uppercase tracking-[0.2em]">{t('common.scanning')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-[#0a0a0c]/80 p-2 rounded-[2rem] border border-slate-800/50 backdrop-blur-xl shadow-inner">
        {(['transfer', 'convert', 'history', 'tokenomics'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 ${activeTab === tab
              ? 'bg-geminix-accent text-slate-950 shadow-[0_0_20px_rgba(0,243,255,0.3)] scale-[1.02]'
              : 'text-slate-500 hover:text-white hover:bg-white/5'
              }`}
          >
            {tab === 'transfer' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
            {tab === 'convert' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
            {tab === 'history' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            {tab === 'tokenomics' && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
            {t(`credit.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'transfer' && (
          <div className="blue-glass p-10 rounded-[2.5rem] border border-slate-800/50 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-1">{t('credit.transfer.title')}</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em]">{t('credit.transfer.subtitle')}</p>
              </div>

              {/* Fee Indicator */}
              <div className="px-6 py-3 bg-geminix-accent/5 border border-geminix-accent/20 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-geminix-accent/10 flex items-center justify-center text-geminix-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <p className="text-[9px] font-black text-geminix-accent uppercase tracking-widest">Gas Protocol</p>
                  <p className="text-[11px] text-white font-black italic">LOW FEE: {transferFee}%</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Recipient Selector */}
              <div className="space-y-6">
                {transferBlocked && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3 text-rose-500 mb-4">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest">Transferencias Bloqueadas</p>
                      <p className="text-[10px] font-medium uppercase tracking-tight opacity-80 mt-1">Tu cuenta ha sido restringida para enviar GMX Token.</p>
                    </div>
                  </div>
                )}
                <div className={`relative ${transferBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">01. Search Identity</label>
                  <div className="relative group">
                    <input
                      type="text"
                      placeholder={t('credit.transfer.search_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      disabled={transferBlocked}
                      className="w-full bg-[#050507] border border-slate-800 rounded-2xl py-5 px-6 pl-14 text-sm text-white focus:border-geminix-accent outline-none ring-0 transition-all font-medium placeholder:text-slate-700 disabled:opacity-50"
                    />
                    <svg className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600 group-focus-within:text-geminix-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                </div>

                <div className="max-h-[350px] overflow-y-auto space-y-2 scrollbar-none pr-2 bg-slate-900/10 rounded-2xl p-2 border border-slate-800/30 relative">
                  {isSearchingGlobal && (
                    <div className="absolute top-2 right-2">
                      <div className="w-4 h-4 border-2 border-geminix-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {searchQuery ? (
                    filteredUsers.length === 0 && globalUsers.length === 0 && !isSearchingGlobal ? (
                      <div className="text-center py-20 opacity-20 italic font-black uppercase text-[10px] tracking-widest">No Node Detected</div>
                    ) : (
                      <>
                        {filteredUsers.length > 0 && (
                          <div className="px-2 pb-2 text-[8px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800/50 mb-2 mt-1">Network Matches</div>
                        )}
                        {filteredUsers.map(user => (
                          <div
                            key={user.id}
                            onClick={() => setSelectedUser(user.id)}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group ${selectedUser === user.id
                              ? 'bg-geminix-accent border-geminix-accent shadow-lg scale-[0.98]'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${selectedUser === user.id ? 'bg-slate-950 text-geminix-accent border-slate-950' : 'bg-slate-900 text-slate-500 border-slate-800 group-hover:border-slate-600'}`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className={`text-sm font-black tracking-tight ${selectedUser === user.id ? 'text-slate-950' : 'text-white'}`}>{user.name}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-tight ${selectedUser === user.id ? 'text-slate-950/60' : 'text-slate-500'}`}>{user.email}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-black px-3 py-1 rounded-lg border ${selectedUser === user.id ? 'bg-slate-950/20 border-slate-950/30 text-slate-950' : 'text-geminix-accent bg-geminix-accent/10 border-geminix-accent/20'}`}>
                              L{user.level}
                            </span>
                          </div>
                        ))}

                        {globalUsers.length > 0 && (
                          <div className="px-2 py-2 text-[8px] font-black text-slate-600 uppercase tracking-widest border-b border-slate-800/50 mb-2 mt-4">Global Network Search</div>
                        )}
                        {globalUsers.map(user => (
                          <div
                            key={user.id}
                            onClick={() => setSelectedUser(user.id)}
                            className={`p-5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center group ${selectedUser === user.id
                              ? 'bg-geminix-accent border-geminix-accent shadow-lg scale-[0.98]'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                              }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border ${selectedUser === user.id ? 'bg-slate-950 text-geminix-accent border-slate-950' : 'bg-slate-900 text-slate-500 border-slate-800 group-hover:border-slate-600'}`}>
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className={`text-sm font-black tracking-tight ${selectedUser === user.id ? 'text-slate-950' : 'text-white'}`}>{user.name}</p>
                                <p className={`text-[9px] font-bold uppercase tracking-tight ${selectedUser === user.id ? 'text-slate-950/60' : 'text-slate-500'}`}>{user.email}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-black px-3 py-1 rounded-lg border flex items-center gap-2 ${selectedUser === user.id ? 'bg-slate-950/20 border-slate-950/30 text-slate-950' : 'text-slate-400 bg-slate-900 border-slate-800'}`}>
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                              GLOBAL
                            </span>
                          </div>
                        ))}
                      </>
                    )
                  ) : (
                    networkTree && networkTree.children && networkTree.children.map((child: any) => (
                      <ReferralAccordion
                        key={child.id}
                        node={child}
                        selectedId={selectedUser}
                        onSelect={setSelectedUser}
                        level={1}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Amount and Action */}
              <div className={`space-y-8 flex flex-col justify-center ${transferBlocked ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">{t('credit.rules.title')}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium uppercase tracking-tight">
                    {t('credit.rules.conversion_required')}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">02. Define Amount</label>
                      <p className="text-[9px] text-geminix-accent/60 font-bold uppercase tracking-widest mt-0.5">{t('credit.transfer.min_amount_hint')}</p>
                    </div>
                    {amount && parseFloat(amount) > 0 && (
                      <p className="text-[10px] text-geminix-accent font-black animate-pulse">
                        NET: ${(parseFloat(amount) * (1 - transferFee / 100)).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div className="relative group">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-geminix-accent font-black text-3xl group-focus-within:scale-110 transition-transform">$</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={transferBlocked}
                      className="w-full bg-[#050507] border border-slate-800 rounded-3xl py-8 pl-16 pr-6 text-4xl font-black text-white focus:border-geminix-accent outline-none transition-all shadow-inner tabular-nums disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTransfer}
                  disabled={loading || !selectedUser || !amount || transferBlocked}
                  className="group relative w-full py-6 blue-brand-gradient text-white rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_15px_40px_rgba(0,243,255,0.2)] hover:shadow-[0_20px_50px_rgba(0,243,255,0.4)] transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-4 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 skew-x-[-20deg]"></div>
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('credit.transfer.processing')}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Transmit GMX Token
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'convert' && (
          <div className="blue-glass p-10 rounded-[2.5rem] border border-slate-800/50 max-w-2xl mx-auto space-y-10 shadow-2xl">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-geminix-accent/10 rounded-[2rem] border border-geminix-accent/20 flex items-center justify-center mx-auto mb-6 relative">
                <svg className="w-10 h-10 text-geminix-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-geminix-accent rounded-full animate-ping opacity-30"></div>
              </div>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{t('credit.convert.title')}</h3>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] leading-relaxed">
                Convierte tus ganancias del Wallet Bank en GMX Token <br /> para uso interno en la plataforma y futura liquidez en BSC.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#050507] p-6 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Liquidity Available</p>
                <p className="text-2xl font-black text-white tabular-nums">${mainBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#050507] p-6 rounded-3xl border border-slate-800/50 flex flex-col items-center">
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Bridge Protocol</p>
                <p className="text-2xl font-black text-geminix-accent uppercase">Active</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 font-mono">Input Amount</label>
                <button onClick={() => setAmount(mainBalance.toString())} className="text-[9px] font-black text-geminix-accent uppercase hover:scale-105 transition-transform flex items-center gap-1">
                  Select Maximum
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l7-7 7 7M5 19l7-7 7 7" /></svg>
                </button>
              </div>
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-geminix-accent font-black text-3xl">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#050507] border border-slate-800 rounded-3xl py-8 pl-16 pr-6 text-4xl font-black text-white focus:border-geminix-accent outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <button
              onClick={handleConvert}
              disabled={loading || !amount}
              className="w-full py-6 bg-geminix-accent text-slate-950 rounded-[2rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_15px_40px_rgba(0,243,255,0.3)] hover:shadow-[0_20px_60px_rgba(0,243,255,0.4)] transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-4"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-4 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  {t('credit.convert.converting')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                  Execute Conversion
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === 'tokenomics' && (
          <div className="blue-glass p-10 rounded-[2.5rem] border border-slate-800/50 space-y-10 shadow-2xl">
            {/* Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full mb-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">BSC Binance Smart Chain · Fase 3</span>
              </div>
              <h3 className="text-5xl font-black text-white uppercase tracking-tighter font-orbitron">
                TOKEN <span className="text-geminix-accent text-glow-cyan">GMX</span>
              </h3>
              <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.3em]">GEMINIX Protocol Native Token · BEP-20</p>
            </div>

            {/* Total Supply */}
            <div className="bg-geminix-accent/5 border border-geminix-accent/20 rounded-3xl p-8 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-geminix-accent/5 to-transparent pointer-events-none"></div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3">Suministro Total</p>
              <p className="text-6xl font-black text-geminix-accent font-orbitron tracking-tighter text-glow-cyan">10,000,000</p>
              <p className="text-2xl font-black text-white mt-2 tracking-widest">GMX</p>
              <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">1 GMX = $1.00 USDT · Precio Interno</p>
            </div>

            {/* Distribution */}
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Distribución del 100%</p>

              {/* GEMINIX Reserve 25% */}
              <div className="p-5 bg-slate-900/50 border border-geminix-accent/20 rounded-2xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-geminix-accent shadow-[0_0_8px_rgba(0,243,255,0.6)]"></div>
                    <span className="text-sm font-black text-white uppercase tracking-wide">GEMINIX Reserva</span>
                  </div>
                  <div className="text-right">
                    <span className="text-geminix-accent font-black text-lg">25%</span>
                    <span className="text-slate-500 text-[10px] ml-2 font-mono">2,500,000 GMX</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div className="bg-geminix-accent h-2.5 rounded-full shadow-[0_0_8px_rgba(0,243,255,0.4)]" style={{ width: '25%' }}></div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">Propietario del protocolo · Vesting gradual</p>
              </div>

              {/* Platform Utility 35% */}
              <div className="p-5 bg-slate-900/50 border border-indigo-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                    <span className="text-sm font-black text-white uppercase tracking-wide">Utilidad de Plataforma</span>
                  </div>
                  <div className="text-right">
                    <span className="text-indigo-400 font-black text-lg">35%</span>
                    <span className="text-slate-500 text-[10px] ml-2 font-mono">3,500,000 GMX</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div className="bg-indigo-400 h-2.5 rounded-full" style={{ width: '35%' }}></div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">Rewards · Comisiones · Productos · Ecosistema</p>
              </div>

              {/* Burn 20% */}
              <div className="p-5 bg-slate-900/50 border border-rose-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-400"></div>
                    <span className="text-sm font-black text-white uppercase tracking-wide">Quema · Burn</span>
                  </div>
                  <div className="text-right">
                    <span className="text-rose-400 font-black text-lg">20%</span>
                    <span className="text-slate-500 text-[10px] ml-2 font-mono">2,000,000 GMX</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div className="bg-rose-400 h-2.5 rounded-full" style={{ width: '20%' }}></div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">Deflacionario automático · 0x000...dead</p>
              </div>

              {/* Public Sale / BSC 20% */}
              <div className="p-5 bg-slate-900/50 border border-amber-500/20 rounded-2xl">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                    <span className="text-sm font-black text-white uppercase tracking-wide">Venta Pública · BSC Listing</span>
                  </div>
                  <div className="text-right">
                    <span className="text-amber-400 font-black text-lg">20%</span>
                    <span className="text-slate-500 text-[10px] ml-2 font-mono">2,000,000 GMX</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5">
                  <div className="bg-amber-400 h-2.5 rounded-full" style={{ width: '20%' }}></div>
                </div>
                <p className="text-[9px] text-slate-600 mt-2 uppercase tracking-widest">Etapa 3 · DEX/CEX Binance Smart Chain</p>
              </div>
            </div>

            {/* Tu balance + precio */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-center">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Precio Interno</p>
                <p className="text-xl font-black text-white font-orbitron">$1.00</p>
                <p className="text-[8px] text-slate-600 mt-1">1 GMX = 1 USDT</p>
              </div>
              <div className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-5 text-center">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Red</p>
                <p className="text-xl font-black text-amber-400 font-orbitron">BSC</p>
                <p className="text-[8px] text-slate-600 mt-1">BEP-20 · Fase 3</p>
              </div>
              <div className="bg-geminix-accent/5 border border-geminix-accent/20 rounded-2xl p-5 text-center">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Tu Balance</p>
                <p className="text-xl font-black text-geminix-accent font-orbitron text-glow-cyan">{creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-[8px] text-slate-600 mt-1">GMX disponibles</p>
              </div>
            </div>

            {/* Phase roadmap */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-geminix-accent flex items-center justify-center text-slate-950 font-black text-sm shadow-[0_0_12px_rgba(0,243,255,0.4)]">1</div>
                <span className="text-[8px] text-geminix-accent font-black uppercase tracking-widest text-center">Utilidad<br/>Interna</span>
              </div>
              <div className="flex-1 h-[2px] bg-gradient-to-r from-geminix-accent to-slate-700"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-black text-sm">2</div>
                <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest text-center">Pre-Sale<br/>Privada</span>
              </div>
              <div className="flex-1 h-[2px] bg-slate-800"></div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-amber-500/20 flex items-center justify-center text-amber-500/50 font-black text-sm">3</div>
                <span className="text-[8px] text-slate-600 font-black uppercase tracking-widest text-center">BSC<br/>Listing</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="blue-glass rounded-[2.5rem] overflow-hidden border border-slate-800/50 shadow-2xl">
            <div className="p-8 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-geminix-accent/10 rounded-2xl border border-geminix-accent/20">
                  <svg className="w-6 h-6 text-geminix-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t('credit.history.title')}</h3>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.3em] font-mono">Immutable Operation History</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800/30">
              {transactions.length === 0 ? (
                <div className="p-32 text-center">
                  <div className="w-20 h-20 bg-slate-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800/30">
                    <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 8-8-8" /></svg>
                  </div>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">{t('credit.history.no_transactions')}</p>
                </div>
              ) : (
                transactions.map(tx => {
                  const isPositive = ['TRANSFER_IN', 'CONVERSION', 'ADMIN_ADJUSTMENT'].includes(tx.type) && tx.amount > 0;
                  const absAmount = Math.abs(tx.amount);

                  return (
                    <div key={tx.id} className="p-8 hover:bg-white/[0.02] transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-transform duration-500 group-hover:scale-105 shadow-xl ${isPositive ? 'bg-geminix-green/10 border-geminix-green/20 text-geminix-green' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                          {tx.type === 'TRANSFER_IN' && <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                          {tx.type === 'TRANSFER_OUT' && <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>}
                          {tx.type === 'CONVERSION' && <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                          {tx.type === 'INVESTMENT_COST' && <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                          {tx.type === 'ADMIN_ADJUSTMENT' && <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-base font-black text-white tracking-tight uppercase">
                              {tx.type === 'CONVERSION' ? t('credit.history.type_conversion') :
                                tx.type === 'TRANSFER_IN' ? t('credit.history.type_transfer_in') :
                                  tx.type === 'TRANSFER_OUT' ? t('credit.history.type_transfer_out') :
                                    tx.type === 'INVESTMENT_COST' ? 'Node Activation' :
                                      tx.type === 'ADMIN_ADJUSTMENT' ? t('credit.history.type_adjustment') : tx.type}
                            </p>
                            <span className="text-[9px] text-slate-500 font-mono pt-1">#{tx.id.slice(0, 8)}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1 font-medium uppercase tracking-widest">{tx.description || 'Verified Operation'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                            <p className="text-[9px] text-slate-600 font-black tracking-[0.2em] font-mono">
                              {new Date(tx.created_at).toLocaleString('en-US')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className={`text-2xl font-black tabular-nums transition-transform group-hover:scale-110 ${isPositive ? 'text-geminix-green' : 'text-rose-500'}`}>
                          {isPositive ? '+' : '-'}${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${isPositive ? 'text-geminix-green/70 border-geminix-green/20 bg-geminix-green/5' : 'text-rose-500/70 border-rose-500/20 bg-rose-500/5'}`}>
                            {isPositive ? 'GMX Inbound' : 'GMX Outbound'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditPanel;
