import React from 'react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { profile } = useAuth();

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-2 sm:px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 text-slate-400 hover:text-white md:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div>
          <h2 className="text-sm md:text-lg font-black text-white truncate max-w-[150px] md:max-w-none">Panel de Administración</h2>
          <p className="text-[10px] text-slate-500 hidden md:block">NOVA DIGITAL Control Center</p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="px-2 md:px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg hidden sm:block">
          <span className="text-[10px] md:text-xs font-bold text-green-500">🟢 Sistema Activo</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs md:text-sm font-bold text-white">{profile?.name || 'Admin'}</p>
            <p className="text-[10px] text-slate-500">{profile?.role}</p>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs md:text-base">
            {profile?.email?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
