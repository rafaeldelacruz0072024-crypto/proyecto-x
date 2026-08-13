import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ArrowUpRight,
  TrendingUp,
  ClipboardList,
  Settings2,
  Gift,
  Share2,
  History,
  CreditCard,
  Coins,
  Wrench,
  LogOut,
  ChevronRight,
  Tag,
  TrendingDown,
  ShoppingBag,
  Package,
  BookOpen,
  Gamepad2,
  Map,
  Megaphone,
  MailOpen,
  Banknote
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { signOut, profile } = useAuth();

  const menuItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/network', label: 'Referral Networks', icon: Share2 },
    { path: '/commissions', label: 'Commission Logs', icon: History },
    { path: '/users', label: 'User Management', icon: Users },
    { path: '/deposits', label: 'Deposit Terminal', icon: Wallet },
    { path: '/withdrawals', label: 'Withdrawal Center', icon: ArrowUpRight },
    { path: '/nova-digital-cards', label: 'NOVA DIGITAL CARD Control', icon: CreditCard },
    { path: '/investments', label: 'Investment Audit', icon: TrendingUp },
    { path: '/balance-manager', label: 'Balance Manager', icon: TrendingDown },
    { path: '/plans', label: 'ROI Plans', icon: ClipboardList },
    { path: '/roi-engine', label: 'ROI Engine', icon: Settings2 },
    { path: '/weekly-bonuses', label: 'Weekly Bonuses', icon: Gift },
    { path: '/promotions', label: 'Promo & Events', icon: Tag },
    { path: '/products', label: 'PRODUCTOS (NUEVO)', icon: ShoppingBag }, // Changed icon to ShoppingBag for products
    { path: '/tutorials', label: 'TUTORIALES & EDU', icon: BookOpen },
    { path: '/games', label: 'Games Catalog', icon: Gamepad2 },
    { path: '/predictions', label: 'Prediction Markets', icon: TrendingUp },
    { path: '/marketing', label: 'Marketing Hub', icon: Megaphone },
    { path: '/communications', label: 'Comunicaciones', icon: MailOpen },
  { path: '/payroll', label: 'Nómina Cripto', icon: Banknote },
    { path: '/gateways', label: 'Payment Gateways', icon: CreditCard },
    { path: '/credits', label: 'System Credits', icon: Coins },
    { path: '/roadmap', label: 'Road Map', icon: Map },
    { path: '/settings', label: 'Master Settings', icon: Wrench },
  ];

  return (
    <aside className={`w-64 bg-[#0c0c0e] border-r border-slate-800/50 h-screen flex flex-col fixed left-0 top-0 z-50 shadow-2xl transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 border-b border-slate-800/20">
        <div className="flex flex-col items-center gap-2">
          <Logo variant="blue" size="sm" glow={true} className="mb-1" />
          <div className="text-center">
            <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none mb-1">NOVA DIGITAL</h1>
            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-none">Super-Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-none">
        <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] px-4 mb-4 mt-2">Módulos</p>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group ${isActive
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5'
                : 'text-slate-500 hover:bg-white/[0.02] hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-4">
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(0,243,255,0.4)]' : 'group-hover:text-slate-300'}
                  />
                  <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-white' : 'font-bold'}`}>
                    {item.label}
                  </span>
                </div>
                {isActive && <ChevronRight size={14} className="animate-pulse" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800/50 bg-[#09090b]/50">
        <div className="mb-4 p-5 bg-[#111114] border border-slate-800/50 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-12 h-12 bg-blue-500/5 rounded-full -mr-6 -mt-6 blur-2xl group-hover:bg-blue-500/10 transition-all" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-slate-400 group-hover:text-blue-400 transition-colors">
              {profile?.email?.[0].toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate">{profile?.email || 'Admin'}</p>
              <p className="text-xs font-black text-white uppercase tracking-tighter">
                {profile?.role === 'admin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95"
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
