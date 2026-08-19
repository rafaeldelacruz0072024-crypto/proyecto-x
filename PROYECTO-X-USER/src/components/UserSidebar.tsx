import React from 'react';
import { useTranslation } from 'react-i18next';

interface UserSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  walletBalance: number;
}

const NAV_ITEMS = [
  {
    id: 'dashboard',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  },
  {
    id: 'nodes',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h10" /></svg>,
  },
  {
    id: 'network',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    id: 'binary',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01M12 12h.01M7 7l5 5m5-5l-5 5m0 0l-5 5m5-5l5 5" /></svg>,
  },
  {
    id: 'finance',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: 'events',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  },
  {
    id: 'predictions',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  },
  {
    id: 'tutorials',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  },
  {
    id: 'roadmap',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  },
  {
    id: 'profile',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
];

const UserSidebar: React.FC<UserSidebarProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  isOpen,
  onClose,
  profile,
  walletBalance,
}) => {
  const { t } = useTranslation();

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    onClose();
  };

  const userName = profile?.username || profile?.full_name || profile?.email?.split('@')[0] || 'USUARIO';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-50 flex flex-col
        bg-[#020408] border-r border-proyecto-accent/20
        shadow-[4px_0_30px_rgba(139,92,246,0.14)]
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Header + close */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-proyecto-accent/10">
          <p className="text-[9px] font-orbitron font-black text-slate-600 uppercase tracking-[0.3em]">MENÚ</p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-proyecto-accent hover:bg-proyecto-accent/10 border border-transparent hover:border-proyecto-accent/30 transition-all"
            aria-label="Cerrar menú"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b border-white/5 mx-3 mt-3 rounded-xl bg-proyecto-accent/5 border border-proyecto-accent/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 clip-corner-sm bg-proyecto-brand/20 border border-proyecto-accent/30 flex items-center justify-center text-proyecto-accent font-orbitron font-black text-sm">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-orbitron font-black text-white uppercase truncate">{userName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-proyecto-green animate-pulse"></span>
                <p className="text-[8px] font-mono-tech text-slate-500 uppercase tracking-widest">ONLINE</p>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <div className="text-center">
              <p className="text-[8px] text-slate-600 uppercase tracking-widest font-mono">Wallet</p>
              <p className="text-[10px] font-black text-proyecto-green font-orbitron">${walletBalance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5 scrollbar-none">
          <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] px-3 py-2 mt-1">Módulos</p>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-proyecto-accent/10 border border-proyecto-accent/30 text-proyecto-accent shadow-[0_0_12px_rgba(0,243,255,0.08)]'
                    : 'text-slate-500 hover:text-white hover:bg-white/[0.03] border border-transparent'}
                `}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-proyecto-accent rounded-r-full shadow-[0_0_8px_rgba(0,243,255,0.6)]" />
                )}
                <span className={`transition-colors duration-200 ${isActive ? 'text-proyecto-accent' : 'text-slate-600 group-hover:text-slate-300'}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-orbitron font-black uppercase tracking-[0.15em] transition-colors duration-200 ${isActive ? 'text-proyecto-accent' : ''}`}>
                  {item.id === 'nodes' ? 'Mis nodos' : t(`nav.${item.id}`)}
                </span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-proyecto-accent animate-pulse shadow-[0_0_6px_rgba(0,243,255,0.8)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/40 text-red-500 text-[9px] font-orbitron font-black uppercase tracking-[0.2em] rounded-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default UserSidebar;
