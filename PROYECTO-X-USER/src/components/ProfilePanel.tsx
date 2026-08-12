import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

interface Props {
  user: any; // Flexible para aceptar tanto User de types como profile de Supabase
  onUpdateUser: (updates: any) => void;
  addNotification: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ProfilePanel: React.FC<Props> = ({ user, onUpdateUser, addNotification }) => {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'security' | 'sessions'>('info');
  const [passForm, setPassForm] = useState({ current: '', new: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [is2faLoading, setIs2faLoading] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [wallet, setWallet] = useState(user?.withdrawal_wallet || user?.withdrawalWallet || '');
  const [cardAddress, setCardAddress] = useState(user?.geminix_card_address || '');
  const [cardUser, setCardUser] = useState(user?.geminix_card_user || '');

  // Derivados de seguridad
  const kycVerified = user?.kycVerified || user?.kyc_verified || false;
  const twoFactorEnabled = user?.two_factor_enabled || user?.twoFactorEnabled || false;
  const walletAddress = user?.withdrawal_wallet || user?.withdrawalWallet || '';
  const hasWallet = !!walletAddress;

  // La bóveda solo se congela si el 2FA está ACTIVO y ya existe una wallet configurada.
  // Si el usuario desactiva el 2FA, la bóveda se desbloquea automáticamente.
  const isWalletFrozen = twoFactorEnabled && hasWallet;

  // 2FA Setup Flow State
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [isLinkingWalletWith2FA, setIsLinkingWalletWith2FA] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');

  // Extraer nombre compatible con ambos formatos
  const userName = user?.full_name || user?.name || user?.username || user?.email?.split('@')[0] || 'User';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  // Load Sponsor Name via RPC (bypasses RLS)
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [sponsorUsername, setSponsorUsername] = useState<string | null>(null);
  useEffect(() => {
    const fetchSponsor = async () => {
      if (!user?.referred_by) return;
      try {
        const { data, error } = await supabase.rpc('get_sponsor_info', { p_sponsor_id: user.referred_by });
        if (!error && data) {
          setSponsorName(data.full_name || data.username || data.email?.split('@')[0] || 'Patrocinador');
          setSponsorUsername(data.username || null);
        } else {
          // Fallback directo
          const { data: profile } = await supabase.from('profiles').select('full_name, username, email').eq('id', user.referred_by).maybeSingle();
          if (profile) {
            setSponsorName(profile.full_name || profile.username || profile.email?.split('@')[0] || 'Patrocinador');
            setSponsorUsername(profile.username || null);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSponsor();
  }, [user?.referred_by]);

  // Password strength calculation
  const passStrength = useMemo(() => {
    if (!passForm.new) return 0;
    let score = 0;
    if (passForm.new.length > 8) score += 25;
    if (/[A-Z]/.test(passForm.new)) score += 25;
    if (/[0-9]/.test(passForm.new)) score += 25;
    if (/[^A-Za-z0-9]/.test(passForm.new)) score += 25;
    return score;
  }, [passForm.new]);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) {
      addNotification(t('profile.notifications.pass_mismatch'), "error");
      return;
    }
    if (passStrength < 75) {
      addNotification(t('profile.notifications.pass_weak'), "error");
      return;
    }

    setIsChangingPass(true);

    // Simulate encryption update
    setTimeout(() => {
      addNotification(t('profile.notifications.pass_sync'), "success");
      setPassForm({ current: '', new: '', confirm: '' });
      setIsChangingPass(false);
    }, 2000);
  };

  const saveWallet = () => {
    if (isWalletFrozen) return;

    if (wallet && (wallet.length < 10 || !wallet.startsWith('0x'))) {
      addNotification(t('profile.notifications.wallet_invalid'), "error");
      return;
    }

    if (cardAddress && (cardAddress.length < 10 || !cardAddress.startsWith('0x'))) {
      addNotification("Dirección de tarjeta inválida. Debe empezar con 0x", "error");
      return;
    }

    if (!wallet && !cardAddress && !cardUser) {
      addNotification("Por favor introduzca alguna dirección", "error");
      return;
    }

    if (!twoFactorEnabled) {
      setIsLinkingWalletWith2FA(true);
      setIsSettingUp2FA(true);
      addNotification(t('profile.notifications.auth_req'), "info");
    } else {
      onUpdateUser({ 
        withdrawal_wallet: wallet,
        geminix_card_address: cardAddress,
        geminix_card_user: cardUser
      });
      addNotification(t('profile.notifications.wallet_saved'), "success");
    }
  };

  const start2FASetup = () => {
    setIsSettingUp2FA(true);
    setIsLinkingWalletWith2FA(false);
    addNotification(t('profile.notifications.auth_syncing'), "info");
  };

  const complete2FASetup = () => {
    if (verificationCode.length !== 6) {
      addNotification(t('profile.notifications.code_invalid'), "error");
      return;
    }

    setIs2faLoading(true);
    // Simular validación del código del servidor de auth
    setTimeout(() => {
      const updates: any = { two_factor_enabled: true };

      if (isLinkingWalletWith2FA) {
        updates.withdrawal_wallet = wallet;
        updates.geminix_card_address = cardAddress;
        updates.geminix_card_user = cardUser;
      }

      onUpdateUser(updates);
      addNotification(t('profile.notifications.auth_success'), "success");
      setIsSettingUp2FA(false);
      setIsLinkingWalletWith2FA(false);
      setVerificationCode('');
      setIs2faLoading(false);
    }, 1500);
  };

  const disable2FA = () => {
    setIs2faLoading(true);
    setTimeout(() => {
      onUpdateUser({ two_factor_enabled: false });
      addNotification(t('profile.notifications.auth_disabled'), "info");
      setIs2faLoading(false);
    }, 1200);
  };

  const securityScore = (twoFactorEnabled ? 33 : 0) + (kycVerified ? 34 : 0) + (hasWallet ? 33 : 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar - Node Status */}
      <div className="lg:col-span-1 space-y-6">
        <div className="holo-card p-6 rounded-none clip-corner border border-geminix-accent/20 text-center relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-geminix-brand shadow-[0_0_10px_cyan]"></div>

          <div className="relative mx-auto w-24 h-24 rounded-full p-1 border border-geminix-accent/50 mb-4 flex items-center justify-center group-hover:scale-105 transition-transform">
            <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center text-4xl font-orbitron font-bold text-white border border-geminix-accent/20 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
              {userInitial}
            </div>
            <div className="absolute inset-0 rounded-full border border-geminix-accent/30 animate-ping opacity-20"></div>
          </div>

          <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-tighter leading-none text-glow-cyan">{userName}</h2>
          <div className="flex items-center justify-center gap-2 mt-2 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-geminix-accent animate-pulse"></div>
            <p className="text-[10px] text-geminix-accent font-mono-tech font-bold uppercase tracking-widest">{t('profile.sidebar.rank_operator', { rank: t(`ranks.${user?.rank || 'Starter'}`) })}</p>
          </div>

          {/* Security Score Meter */}
          <div className="mb-6 px-2">
            <div className="flex justify-between text-[9px] font-mono-tech font-bold uppercase text-slate-500 mb-2 tracking-widest">
              <span>{t('profile.sidebar.integrity')}</span>
              <span className={securityScore > 70 ? 'text-geminix-green text-glow-green' : 'text-geminix-gold'}>{securityScore}%</span>
            </div>
            <div className="h-1.5 w-full bg-black rounded-none overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-1000 ${securityScore > 70 ? 'bg-geminix-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-geminix-gold shadow-[0_0_8px_rgba(255,215,0,0.5)]'}`}
                style={{ width: `${securityScore}%` }}
              ></div>
            </div>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            <span className={`px-3 py-1 clip-corner-sm text-[8px] font-mono-tech font-bold uppercase border transition-all ${kycVerified ? 'bg-geminix-green/10 text-geminix-green border-geminix-green/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              KYC {kycVerified ? t('profile.sidebar.verified') : t('profile.sidebar.pending')}
            </span>
            <span className={`px-3 py-1 clip-corner-sm text-[8px] font-mono-tech font-bold uppercase border transition-all ${twoFactorEnabled ? 'bg-geminix-accent/10 text-geminix-accent border-geminix-accent/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              2FA {twoFactorEnabled ? t('profile.2fa.on') : t('profile.2fa.off')}
            </span>
          </div>

          <div className="space-y-4 text-left pt-6 border-t border-slate-800/50">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase text-slate-600 font-mono-tech font-bold tracking-widest">{t('profile.identity.email')}</span>
              <span className="text-[10px] text-white font-mono">{userEmail}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase text-slate-600 font-mono-tech font-bold tracking-widest">{t('profile.identity.node_id')}</span>
              <span className="text-[10px] text-geminix-accent font-mono">{user?.id?.slice(-8) || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase text-slate-600 font-mono-tech font-bold tracking-widest">{t('profile.identity.member_since')}</span>
              <span className="text-[10px] text-slate-400 font-mono">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3 space-y-6">
        {/* Sub-Tabs Navigation */}
        <div className="flex gap-2 bg-black/40 p-1.5 clip-corner-sm border border-slate-800/50">
          {(['info', 'security', 'sessions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex-1 py-3 rounded-none clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] transition-all ${activeSubTab === tab ? 'bg-geminix-brand text-white shadow-[0_0_15px_rgba(0,114,255,0.3)]' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
            >
              {t(`profile.tabs.${tab}`)}
            </button>
          ))}
        </div>

        {activeSubTab === 'info' && (
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20">
              <h3 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] mb-8 text-glow-cyan">{t('profile.identity.title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.name')}</label>
                  <input type="text" value={userName} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white opacity-50 cursor-not-allowed font-mono-tech" />
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.email')}</label>
                  <input type="email" value={userEmail} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white opacity-50 cursor-not-allowed font-mono-tech" />
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.username')}</label>
                  <input type="text" value={user?.username || 'N/A'} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-geminix-accent opacity-80 cursor-not-allowed font-mono-tech" />
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.country')}</label>
                  <input type="text" value={user?.country || 'N/A'} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white opacity-80 cursor-not-allowed font-mono-tech" />
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.phone')}</label>
                  <input type="text" value={user?.phone || 'N/A'} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white opacity-80 cursor-not-allowed font-mono-tech" />
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.ref_code')}</label>
                  <div className="relative">
                    <div className="flex gap-2">
                        <div className="flex-grow flex flex-col gap-1">
                          <input 
                            type="text" 
                            value={user?.ref_code || 'NO DETECTADO'} 
                            disabled 
                            className={`w-full bg-geminix-accent/5 border clip-corner-sm py-4 px-5 font-orbitron cursor-not-allowed tracking-widest ${!user?.ref_code ? 'text-red-400 border-red-500/30 font-bold' : 'text-geminix-accent border-geminix-accent/20'}`} 
                          />
                          {!user?.ref_code && (
                            <button 
                              onClick={() => window.location.reload()} 
                              className="text-[8px] bg-red-500/10 text-red-500 font-black py-1 px-3 border border-red-500/30 rounded flex items-center gap-2 hover:bg-red-500/20 transition-all uppercase tracking-widest"
                            >
                              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              FORZAR SINCRONIZACIÓN DE NODO
                            </button>
                          )}
                        </div>
                       <button
                         onClick={() => {
                           if (user?.ref_code) {
                             navigator.clipboard.writeText(user.ref_code);
                             // Simple alert or feedback could be added here
                           }
                         }}
                         className="px-4 bg-slate-900 border border-geminix-accent/20 text-geminix-accent hover:bg-geminix-accent/10 transition-colors clip-corner-sm flex items-center justify-center"
                         title={t('common.copy', 'Copy')}
                       >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                       </button>
                    </div>

                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.rank')}</label>
                  <div className="relative">
                    <input type="text" value={t(`ranks.${user?.rank || 'Starter'}`)} disabled className={`w-full bg-slate-900 border border-slate-800 clip-corner-sm py-4 px-5 font-orbitron font-bold uppercase tracking-widest cursor-not-allowed ${user?.rank === 'Black Crown' ? 'text-purple-500' :
                      user?.rank === 'Diamond' ? 'text-cyan-400' :
                        user?.rank === 'Gold' ? 'text-yellow-400' :
                          'text-white'
                      }`} />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.identity.sponsor', 'SPONSOR DE RED')}</label>
                  <input type="text" value={sponsorName ? `${sponsorName}${sponsorUsername ? ` (@${sponsorUsername})` : ''}` : (user?.referred_by || 'Direct Entry')} disabled className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white opacity-80 cursor-not-allowed font-mono-tech" />
                </div>
              </div>
            </div>

            {/* Withdrawal Configuration */}
            <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20 relative overflow-hidden group">
              {isWalletFrozen && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-geminix-green/10 border border-geminix-green/20 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                    <svg className="w-3 h-3 text-geminix-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <span className="text-[9px] font-mono-tech font-bold text-geminix-green uppercase tracking-widest">{t('profile.vault.status_locked')}</span>
                  </div>
                </div>
              )}
              <h3 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] mb-4 text-glow-cyan">{t('profile.vault.title')}</h3>
              <p className="text-[11px] text-slate-500 font-mono-tech uppercase font-bold tracking-tighter mb-8 border-b border-slate-800 pb-4">
                {isWalletFrozen
                  ? t('profile.vault.frozen_desc')
                  : t('profile.vault.unfrozen_desc')}
              </p>
              
              <div className="space-y-6">
                {/* USDT WALLET */}
                <div className="space-y-2">
                  <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest ml-1">USDT (BEP-20) WALLET</label>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-grow group">
                      <input
                        type="text"
                        value={wallet}
                        onChange={(e) => !isWalletFrozen && setWallet(e.target.value)}
                        disabled={isWalletFrozen}
                        placeholder="0x..."
                        className={`w-full bg-black/50 border clip-corner-sm py-4 px-5 font-mono text-sm transition-all ${isWalletFrozen ? 'border-geminix-green/30 text-slate-400 cursor-not-allowed' : 'border-slate-800 text-geminix-accent focus:border-geminix-accent focus:shadow-[0_0_10px_cyan]'}`}
                      />
                    </div>
                  </div>
                </div>

                {/* GEMINIX CARD FIELDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/30">
                  <div className="space-y-2">
                    <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest ml-1">{t('profile.vault.card_address_label')}</label>
                    <input
                      type="text"
                      value={cardAddress}
                      onChange={(e) => !isWalletFrozen && setCardAddress(e.target.value)}
                      disabled={isWalletFrozen}
                      placeholder={t('profile.vault.card_address_placeholder')}
                      className={`w-full bg-black/50 border clip-corner-sm py-4 px-5 font-mono text-sm transition-all ${isWalletFrozen ? 'border-geminix-green/30 text-slate-400 cursor-not-allowed' : 'border-slate-800 text-geminix-accent focus:border-geminix-accent focus:shadow-[0_0_10px_cyan]'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest ml-1">{t('profile.vault.card_user_label')}</label>
                    <input
                      type="text"
                      value={cardUser}
                      onChange={(e) => !isWalletFrozen && setCardUser(e.target.value)}
                      disabled={isWalletFrozen}
                      placeholder={t('profile.vault.card_user_placeholder')}
                      className={`w-full bg-black/50 border clip-corner-sm py-4 px-5 font-mono text-sm transition-all ${isWalletFrozen ? 'border-geminix-green/30 text-slate-400 cursor-not-allowed' : 'border-slate-800 text-geminix-accent focus:border-geminix-accent focus:shadow-[0_0_10px_cyan]'}`}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  {!isWalletFrozen && (
                    <button onClick={saveWallet} className="w-full md:w-auto px-12 py-4 bg-geminix-brand text-white clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(0,114,255,0.3)] active:scale-95 transition-all hover:brightness-110">
                      {twoFactorEnabled ? t('profile.vault.update_button') : t('profile.vault.save_button')}
                    </button>
                  )}
                  {isWalletFrozen && (
                    <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 clip-corner-sm flex items-center justify-center md:justify-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-geminix-green animate-pulse"></div>
                      <span className="text-[10px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest">{t('profile.vault.immutable')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'security' && (
          <div className="space-y-6">
            {/* Password Change */}
            <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20">
              <h3 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] mb-8 text-glow-cyan">{t('profile.security.title')}</h3>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.security.current_key')}</label>
                    <input type="password" required value={passForm.current} onChange={e => setPassForm({ ...passForm, current: e.target.value })} className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white text-sm focus:border-geminix-accent focus:shadow-[0_0_10px_cyan] transition-all font-mono" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.security.new_key')}</label>
                    <input type={showPass ? 'text' : 'password'} required value={passForm.new} onChange={e => setPassForm({ ...passForm, new: e.target.value })} className="w-full bg-black/50 border border-slate-800 clip-corner-sm py-4 px-5 text-white text-sm focus:border-geminix-accent focus:shadow-[0_0_10px_cyan] transition-all font-mono" />
                    {passForm.new && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[8px] uppercase text-slate-600 mb-2 font-mono-tech font-bold tracking-widest">
                          <span>{t('profile.security.strength')}</span>
                          <span className={passStrength > 75 ? 'text-geminix-green' : 'text-geminix-gold'}>{passStrength}%</span>
                        </div>
                        <div className="h-1 bg-black rounded-none overflow-hidden border border-slate-800">
                          <div className={`h-full transition-all ${passStrength > 75 ? 'bg-geminix-green shadow-[0_0_5px_green]' : 'bg-geminix-gold shadow-[0_0_5px_gold]'}`} style={{ width: `${passStrength}%` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono-tech font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">{t('profile.security.confirm_key')}</label>
                    <input type="password" required value={passForm.confirm} onChange={e => setPassForm({ ...passForm, confirm: e.target.value })} className={`w-full bg-black/50 border clip-corner-sm py-4 px-5 text-white text-sm focus:border-geminix-accent transition-all font-mono ${passForm.confirm && passForm.new !== passForm.confirm ? 'border-red-500 shadow-[0_0_10px_red]' : 'border-slate-800'}`} />
                  </div>
                </div>
                <div className="pt-6">
                  <button type="submit" disabled={isChangingPass || !passForm.new || passForm.new !== passForm.confirm} className="px-10 py-4 bg-geminix-brand text-white clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(0,114,255,0.3)] active:scale-95 transition-all disabled:opacity-50 hover:brightness-110">
                    {isChangingPass ? t('auth.processing') : t('profile.security.button')}
                  </button>
                </div>
              </form>
            </div>

            {/* Multi-Factor Shield */}
            <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20 relative overflow-hidden group">
              <div className="flex flex-col md:flex-row gap-8 items-center mb-8 relative z-10">
                <div className={`w-20 h-20 clip-corner-sm flex items-center justify-center shrink-0 border transition-all duration-500 ${twoFactorEnabled ? 'bg-geminix-green/10 border-geminix-green shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-red-500/10 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]'}`}>
                  <svg className={`w-10 h-10 ${twoFactorEnabled ? 'text-geminix-green' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <div className="flex-grow text-center md:text-left">
                  <div className="flex items-center gap-3 justify-center md:justify-start">
                    <h4 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">{t('profile.2fa.title')}</h4>
                    {twoFactorEnabled && (
                      <span className="bg-geminix-green/10 text-geminix-green text-[8px] font-mono-tech font-bold px-2 py-0.5 rounded border border-geminix-green/20 shadow-[0_0_5px_green]">{t('profile.2fa.active')}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono-tech uppercase font-bold tracking-tighter mt-1 leading-relaxed">
                    {isLinkingWalletWith2FA
                      ? t('profile.2fa.mandatory')
                      : t('profile.2fa.desc')}
                  </p>
                </div>
                {!isSettingUp2FA && (
                  <button
                    onClick={twoFactorEnabled ? disable2FA : start2FASetup}
                    disabled={is2faLoading}
                    className={`px-10 py-4 clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-widest transition-all active:scale-95 ${twoFactorEnabled ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-geminix-brand text-white shadow-[0_0_15px_rgba(0,114,255,0.4)] hover:brightness-110'}`}
                  >
                    {is2faLoading ? t('auth.processing').toUpperCase() : (twoFactorEnabled ? t('profile.2fa.disable') : t('profile.2fa.setup'))}
                  </button>
                )}
              </div>

              {/* Setup Wizard UI */}
              {isSettingUp2FA && (
                <div className="mt-8 pt-8 border-t border-slate-800/50 animate-fade-in relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-[0_0_20px_white]">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/GEMINIX:${userEmail}?secret=JBSWY3DPEHPK3PXP&issuer=GEMINIX`}
                        alt="2FA QR Code"
                        className="w-40 h-40 mix-blend-multiply"
                      />
                      <p className="mt-4 text-[9px] text-black font-mono-tech font-bold uppercase tracking-widest border-t border-black/10 pt-2 w-full text-center">{t('profile.2fa.scan_protocol')}</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <h5 className="text-[10px] font-orbitron font-bold text-white uppercase tracking-widest">{t('profile.2fa.step1')}</h5>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-mono-tech uppercase font-bold">{t('profile.2fa.step1_desc')}</p>
                      </div>

                      <div className="space-y-1">
                        <h5 className="text-[10px] font-orbitron font-bold text-white uppercase tracking-widest">{t('profile.2fa.step2')}</h5>
                        <div className="bg-black border border-geminix-accent/20 px-4 py-3 clip-corner-sm font-mono text-geminix-accent text-[10px] flex justify-between items-center group/key shadow-[0_0_10px_rgba(0,243,255,0.1)]">
                          <span>JBSWY3DPEHPK3PXP</span>
                          <button className="text-slate-700 group-hover/key:text-geminix-accent transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          </button>
                        </div>
                        <p className="text-[8px] text-red-500/80 font-mono-tech uppercase font-bold tracking-widest">{t('profile.2fa.recovery_warn')}</p>
                      </div>

                      <div className="space-y-3">
                        <h5 className="text-[10px] font-orbitron font-bold text-white uppercase tracking-widest">{t('profile.2fa.step3')}</h5>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="000000"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                            className="flex-grow bg-black/50 border border-slate-800 clip-corner-sm py-3 px-4 text-center font-orbitron font-bold tracking-[0.5em] text-geminix-accent text-lg focus:border-geminix-accent focus:shadow-[0_0_10px_cyan] transition-all"
                          />
                          <button
                            onClick={complete2FASetup}
                            disabled={is2faLoading || verificationCode.length !== 6}
                            className="px-6 bg-geminix-green text-slate-950 clip-corner-sm text-[10px] font-orbitron font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-30 transition-all hover:brightness-110"
                          >
                            {is2faLoading ? '...' : t('profile.2fa.verify_button')}
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsSettingUp2FA(false)}
                        className="text-[9px] text-slate-600 font-mono-tech font-bold uppercase tracking-widest hover:text-white transition-colors border-b border-transparent hover:border-white"
                      >
                        {t('profile.2fa.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'sessions' && (
          <div className="holo-card p-8 rounded-none clip-corner border border-geminix-accent/20 space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">{t('profile.sessions.title')}</h3>
              <button className="text-[9px] font-mono-tech font-bold text-red-500 uppercase border border-red-500/20 px-4 py-2 clip-corner-sm hover:bg-red-500/10 transition-all hover:shadow-[0_0_10px_red]">{t('profile.sessions.emergency_logout')}</button>
            </div>
            <div className="space-y-4">
              {[
                { ip: '192.168.1.45', device: 'Web Terminal (Chrome/macOS)', location: 'London, UK', status: 'ACTIVE' },
                { ip: '172.24.5.12', device: 'Geminix Mobile Node (iOS)', location: 'Current Position', status: 'PAST' }
              ].map((session, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-black/40 clip-corner-sm border border-slate-800 hover:border-geminix-accent/30 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 clip-corner-sm flex items-center justify-center border ${session.status === 'ACTIVE' ? 'bg-geminix-green/10 text-geminix-green border-geminix-green/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-slate-900 text-slate-600 border-slate-800'}`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-orbitron font-bold text-white uppercase tracking-tighter group-hover:text-geminix-accent transition-colors">{session.device}</p>
                      <p className="text-[10px] text-slate-500 font-mono-tech font-bold uppercase tracking-widest">{session.ip} • {session.location}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-mono-tech font-bold uppercase px-3 py-1 clip-corner-sm border ${session.status === 'ACTIVE' ? 'bg-geminix-green/10 text-geminix-green border-geminix-green/20' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>{session.status === 'ACTIVE' ? t('profile.sessions.current') : t('profile.sessions.past')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePanel;
