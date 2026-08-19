import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from './lib/supabase';
import { useUserData } from './hooks/useUserData';
import {
  createDeposit,
  createInvestment,
  createWithdrawal,
  withdrawReglaDeOro,
  createOrUpdateProfile,
  updateUserProfile
} from './services/database';
import {
  Profile,
  Transaction,
  TransactionType,
  TransactionStatus,
  NetworkNode
} from './types';
import { MockEmail } from './components/MockEmailInbox';
import { getSystemSettings } from './services/database';
import { MIN_WITHDRAWAL } from './constants';
import DashboardHeader from './components/DashboardHeader';
import NetworkVisualization from './components/NetworkVisualization';
import InvestmentPanel from './components/InvestmentPanel';
import WithdrawalForm from './components/WithdrawalForm';
import DepositForm from './components/DepositForm';
import TransactionHistory from './components/TransactionHistory';
import NotificationToast from './components/NotificationToast';
import WithdrawalConfirmationModal from './components/WithdrawalConfirmationModal';
import DepositConfirmationModal from './components/DepositConfirmationModal';
import MockEmailInbox from './components/MockEmailInbox';
import AuthPortal from './components/AuthPortal';
import ProfilePanel from './components/ProfilePanel';
import ResetPasswordForm from './components/ResetPasswordForm';
import TwoFactorVerificationModal from './components/TwoFactorVerificationModal';
import RankWidget from './components/RankWidget';
import LiveTerminal from './components/LiveTerminal';
import WeeklyYieldChart from './components/WeeklyYieldChart';
import SponsorWidget from './components/SponsorWidget';
import WorldMapWidget from './components/WorldMapWidget';
import LivePredictionMarketSimulation from './components/LivePredictionMarketSimulation';
import { SocketMessage } from './services/websocket';
import EventsPanel from './components/EventsPanel';
import FlashOfferModal from './components/FlashOfferModal';
import TutorialsPanel from './components/TutorialsPanel';
import PredictionMarketsPanel from './components/PredictionMarketsPanel';
import RoadMapPanel from './components/RoadMapPanel';
import DirectCommissionPanel from './components/DirectCommissionPanel';
import RoiDailyTasks from './components/RoiDailyTasks';
import BinaryBonusPanel from './components/BinaryBonusPanel';
import UserSidebar from './components/UserSidebar';
// Red vacía - se llenará con datos reales cuando se implemente backend de referidos
const EMPTY_NETWORK: NetworkNode = {
  id: 'root',
  name: 'My Node',
  level: 0,
  totalVolume: 0,
  children: []
};

const App: React.FC = () => {
  const { t } = useTranslation();
  // ✅ ESTADO CONECTADO A SUPABASE
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const {
    profile,
    transactions,
    investments,
    walletBalance,
    creditBalance,
    referralCommissionBalance,
    networkTree,
    networkStats,
    loading,
    refetch
  } = useUserData(user?.id);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'nodes' | 'network' | 'binary' | 'finance' | 'events' | 'tutorials' | 'predictions' | 'profile' | 'roadmap'>('dashboard');
  const [wsMessages, setWsMessages] = useState<any[]>([]); // WebSocket deshabilitado
  const [simulationSettings, setSimulationSettings] = useState<any>(null);
  const [latestEvent, setLatestEvent] = useState<SocketMessage | null>(null);
  const [referralFromUrl, setReferralFromUrl] = useState<string | null>(null);
  const [isReferralCopied, setIsReferralCopied] = useState<'LEFT' | 'RIGHT' | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768
  );

  // UI State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDepositConfirmModal, setShowDepositConfirmModal] = useState(false);
  const [lastWithdrawal, setLastWithdrawal] = useState<{ id: string; amount: number } | null>(null);
  const [lastDeposit, setLastDeposit] = useState<{ id: string; amount: number } | null>(null);
  const [lastDepositHash, setLastDepositHash] = useState<string>('');

  // 2FA Flow State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [is2FAVerifying, setIs2FAVerifying] = useState(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<{ amount: number, method: string, address: string } | null>(null);

  // Mock Email Simulation State (temporal - puedes quitarlo después)
  const [mockEmails, setMockEmails] = useState<MockEmail[]>([]);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string>('');
  const [residualConfig, setResidualConfig] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [processingInvestment, setProcessingInvestment] = useState(false);
  const [softwarePlans, setSoftwarePlans] = useState<any[]>([]);
  const [activePromotion, setActivePromotion] = useState<any>(null);
  const [showFlashOffer, setShowFlashOffer] = useState(false);
  const [passivePaidToday, setPassivePaidToday] = useState(false);

  const addNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Cargar configuración de simulación y ejecutar feed en tiempo real
  useEffect(() => {
    const fetchSimulationSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('simulation_settings')
          .select('*')
          .limit(1)
          .single();

        if (error) throw error;
        if (data) {
          setSimulationSettings(data);
        }
      } catch (err) {
        console.error("Error fetching simulation settings:", err);
      }
    };

    fetchSimulationSettings();
  }, []);

  useEffect(() => {
    if (!simulationSettings || !simulationSettings.is_active) return;

    const countries = simulationSettings.active_countries || ['Estados Unidos', 'España', 'México', 'Colombia'];
    const models = simulationSettings.selected_models || ['AI Arbitrage Node'];
    const speed = (simulationSettings.speed || 5) * 1000;

    const interval = setInterval(() => {
      const country = countries[Math.floor(Math.random() * countries.length)];
      const model = models[Math.floor(Math.random() * models.length)];
      
      const rand = Math.random();
      let type = 'PROFIT_TICK';
      let description = '';
      let amount: number | undefined = undefined;

      if (rand < 0.75) {
        // Arbitrage operation
        type = 'PROFIT_TICK';
        amount = Math.random() * 80 + 10; // $10 to $90
        description = `Yield arbitrage completed successfully on ${model}`;
      } else if (rand < 0.90) {
        // New Registration
        type = 'NETWORK_EVENT';
        const randId = Math.random().toString(36).substring(2, 6).toUpperCase();
        description = `New user node registered via sponsor under GMX_${randId}`;
      } else {
        // Node sync
        type = 'SYSTEM_STATUS';
        description = `Node synchronization complete for geographic region`;
      }

      const newMsg: SocketMessage = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        timestamp: new Date(),
        payload: {
          description,
          amount,
          country,
          model
        }
      };

      setWsMessages((prev) => [...prev.slice(-49), newMsg]);
      setLatestEvent(newMsg);
    }, speed);

    return () => clearInterval(interval);
  }, [simulationSettings]);

  // Capturar ?ref= del URL y persistir en localStorage + cookie (90 días)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refInUrl = urlParams.get('ref');
    const binarySide = (urlParams.get('side') || urlParams.get('binary') || urlParams.get('position'))?.toUpperCase();

    if (refInUrl) {
      const expires90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      localStorage.setItem('nova_digital_referral', refInUrl.toUpperCase());
      if (binarySide === 'LEFT' || binarySide === 'RIGHT') localStorage.setItem('nova_digital_binary_side', binarySide);
      document.cookie = `nova_digital_ref=${encodeURIComponent(refInUrl.toUpperCase())};expires=${expires90};path=/;SameSite=Lax`;
      setReferralFromUrl(refInUrl.toUpperCase());
      // Limpiar ?ref de la URL sin recargar
      urlParams.delete('ref');
      urlParams.delete('side');
      urlParams.delete('binary');
      urlParams.delete('position');
      const newSearch = urlParams.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
    } else {
      // Recuperar ref guardado de visitas anteriores
      const stored = localStorage.getItem('nova_digital_referral')
        || decodeURIComponent(document.cookie.split('; ').find(r => r.startsWith('nova_digital_ref='))?.split('=')[1] || '');
      if (stored) setReferralFromUrl(stored);
    }
  }, []);

  // Redireccionar a /landing si no hay sesión ni referido
  useEffect(() => {
    if (authLoading) return;
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const hasAuthTokensInHash = window.location.hash.includes('access_token');
    const hasRegisterAction = urlParams.get('action') === 'register';
    if (!user && (path === '/' || path === '/index.html') && !referralFromUrl && !localStorage.getItem('nova_digital_referral') && !hasAuthTokensInHash && !hasRegisterAction) {
      window.location.href = '/landing';
    }
  }, [user, authLoading, referralFromUrl]);

  // Fetch support and referral settings
  useEffect(() => {
    async function loadSettings() {
      const settings = await getSystemSettings();
      if (settings) {
        setSystemSettings(settings);
        if (settings.support_whatsapp) {
          setSupportWhatsapp(settings.support_whatsapp);
        }
        if (settings.residual_config) {
          setResidualConfig(settings.residual_config);
        }
      }

      // Fetch software plans (Baccarat AI packages)
      try {
        const { data: swPlans } = await supabase
          .from('plans')
          .select('*')
          .eq('is_software_package', true)
          .eq('status', 'active')
          .order('fixed_amount', { ascending: true });
        if (swPlans) setSoftwarePlans(swPlans);
      } catch (err) {
        console.error("Error loading software plans:", err);
      }

      // Check for Active Flash Promotions
      try {
        const { data: flashPromos, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('is_active', true)
          .eq('is_flash_offer', true)
          .lte('start_date', new Date().toISOString())
          .gte('end_date', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (flashPromos && flashPromos.length > 0) {
          const promo = flashPromos[0];
          const dismissedPromoId = localStorage.getItem('nova_digital_dismissed_flash_promo');

          if (dismissedPromoId !== promo.id) {
            setActivePromotion(promo);
            setShowFlashOffer(true);
          }
        }
      } catch (err) {
        console.error("Error loading flash promotions:", err);
      }
    }
    loadSettings();
  }, [user]);

  // Handle Auth State Changes & Persistence
  useEffect(() => {
    // 1. Check for auth tokens in URL hash (from admin impersonation)
    const processHashTokens = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1));
        const tokenType = params.get('type');

        // ⚠️ Si es recovery, NO interceptamos: dejamos que onAuthStateChange
        // dispare PASSWORD_RECOVERY y muestre el formulario de nueva contraseña
        if (tokenType === 'recovery') {
          return false;
        }

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (data?.session?.user) {
            setUser(data.session.user);
            window.history.replaceState({}, '', window.location.pathname);
            setAuthLoading(false);
            return true;
          }
        }
      }
      return false;
    };

    // 2. Check for current session on mount
    const checkSession = async () => {
      try {
        // Try hash tokens first (admin impersonation)
        const fromHash = await processHashTokens();
        if (fromHash) return; // Already set session from hash

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }
      } catch (error) {
        console.error("Error checking session:", error);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();

    // 3. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_IN') {
        setAuthLoading(false);
      }
      if (_event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        // Limpiar hash de la URL para que no quede expuesto
        window.history.replaceState({}, '', window.location.pathname);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);


  // ✅ LOGIN CON SUPABASE
  const handleLogin = useCallback(async (authenticatedUser: any) => {
    setUser(authenticatedUser);

    // Crear o actualizar perfil en Supabase
    await createOrUpdateProfile(
      authenticatedUser.id,
      authenticatedUser.email,
      referralFromUrl || undefined
    );

    // Limpiar todo rastro del referral (localStorage + cookies)
    localStorage.removeItem('nova_digital_referral');
    localStorage.removeItem('nova_digital_binary_side');
    localStorage.removeItem('nova_digital_ref_token');
    document.cookie = 'nova_digital_ref=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
    document.cookie = 'nova_digital_ref_token=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';

    // Refrescar datos desde Supabase
    refetch();
  }, [referralFromUrl, refetch]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setWsMessages([]);
    setActiveTab('dashboard');
    setReferralFromUrl(null);
    window.history.replaceState({}, '', '/login');
  }, []);



  // Automatic Session Timeout (5 Minutes of Inactivity)
  useEffect(() => {
    if (!user) return;

    let timeoutId: number;

    const resetTimer = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      // Set timeout for 5 minutes (300,000 ms)
      timeoutId = window.setTimeout(() => {
        addNotification("Sesión finalizada por inactividad (5 min)", "info");
        handleLogout();
      }, 5 * 60 * 1000);
    };

    // Events that count as activity
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Initialize timer
    resetTimer();

    // Add listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, handleLogout, addNotification]);

  // ✅ DEPOSIT - CONECTADO A SUPABASE
  const handleDeposit = useCallback(async (amount: number, hash?: string) => {
    if (!user) return;

    // Si el hash es 'INITIATED', significa que la Edge Function ya creó el registro.
    // Solo necesitamos refrescar los datos para mostrar la transacción "PENDIENTE".
    if (hash === 'INITIATED') {
      refetch();
      return;
    }

    const result = await createDeposit(user.id, amount, 'USDT', hash);

    if (result.success) {
      addNotification(t('deposit.notify_success'), "success");
      setLastDeposit({ amount, id: result.deposit.id });
      setLastDepositHash(hash || '');
      setShowDepositConfirmModal(true);
      const depositEmail: MockEmail = {
        id: `email_dep_${Date.now()}`,
        type: 'DEPOSIT',
        subject: "Depósito Enviado - Esperando Aprobación Admin",
        amount,
        method: "USDT (BEP-20)",
        address: "Nova Digital Wallet",
        txId: result.deposit.id,
        date: new Date(),
        isConfirmed: false
      };
      setMockEmails(prev => [depositEmail, ...prev]);

      refetch(); // Recargar datos
    } else {
      addNotification(t('notifications.deposit_error'), "error");
    }
  }, [user, addNotification, refetch]);

  // ✅ INVESTMENT - CONECTADO A SUPABASE
  const handleInvestment = useCallback(async (amount: number, planId?: string) => {
    if (!user || processingInvestment) return;
    if (walletBalance < amount) {
      addNotification('No tienes saldo suficiente en Wallet Bank para activar este nodo.', "error");
      return;
    }

    setProcessingInvestment(true);
    const result = await createInvestment(user.id, amount, planId);

    if (result.success) {
      addNotification(t('investment.notify_success'), 'success');
      refetch();
    } else {
      addNotification(t('investment.notify_error', { error: result.error }), 'error');
    }
    setProcessingInvestment(false);
  }, [walletBalance, user, addNotification, refetch, processingInvestment]);

  // ✅ WITHDRAWAL - CONECTADO A SUPABASE
  const handleWithdrawal = useCallback((amount: number, method: string, address: string) => {
    if (!user) return;
    if (walletBalance < amount) {
      addNotification(t('common.insufficient_funds'), "error");
      return;
    }

    if (user.two_factor_enabled || user.twoFactorEnabled) {
      setPendingWithdrawal({ amount, method, address });
      setShow2FAModal(true);
      return;
    }

    executeFinalWithdrawal(amount, method, address);
  }, [walletBalance, user, addNotification]);

  const executeFinalWithdrawal = useCallback(async (amount: number, method: string, address: string) => {
    if (!user) return;

    const result = method === 'Comisión Directa'
      ? await withdrawReglaDeOro(user.id, amount, method, address)
      : await createWithdrawal(user.id, amount, method, address);

    if (result.success) {
      setLastWithdrawal({ id: result.withdrawal.id, amount });
      setShowConfirmModal(true);
      addNotification(t('withdrawal.notify_success'), "info");

      // Mock email (opcional - solo para UI)
      const withdrawalEmail: MockEmail = {
        id: `email_wd_${Date.now()}`,
        type: 'WITHDRAWAL',
        subject: "Retiro Solicitado - Esperando Aprobación Admin",
        amount,
        method,
        address,
        txId: result.withdrawal.id,
        date: new Date(),
        isConfirmed: false
      };
      setMockEmails(prev => [withdrawalEmail, ...prev]);

      refetch(); // Recargar datos
    } else {
      if (result.error?.includes('withdrawal.errors')) {
        addNotification(t(result.error), "error");
      } else {
        addNotification(`Error: ${result.error}`, "error");
      }
    }
  }, [user, addNotification, refetch]);

  const handleVerify2FA = useCallback((code: string) => {
    if (!pendingWithdrawal) return;
    setIs2FAVerifying(true);
    setTimeout(() => {
      executeFinalWithdrawal(pendingWithdrawal.amount, pendingWithdrawal.method, pendingWithdrawal.address);
      setIs2FAVerifying(false);
      setShow2FAModal(false);
      setPendingWithdrawal(null);
      addNotification(t('profile.2fa.verified_notify'), "success");
    }, 1500);
  }, [pendingWithdrawal, executeFinalWithdrawal, addNotification]);

  const handleRoiActivated = useCallback((result: any) => {
    if (!result?.already_activated_today) setPassivePaidToday(true);
    refetch();
  }, [refetch]);

  // Mock email confirmation (puedes quitarlo después si no lo usas)
  const confirmTransactionFromEmail = useCallback((txId: string, emailId: string) => {
    setMockEmails(prev => prev.map(email =>
      email.id === emailId ? { ...email, isConfirmed: true } : email
    ));
    addNotification(t('common.confirmed'), "success");
    refetch();
  }, [addNotification, refetch]);

  const handleUpdateUser = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;

    const result = await updateUserProfile(user.id, updates);
    if (result.success) {
      refetch();
    } else {
      addNotification(`Error updating profile: ${result.error}`, "error");
    }
  }, [user, refetch, addNotification]);

  const binaryReferralLinks = useMemo(() => {
    if (!profile?.ref_code) return null;
    const base = `${window.location.origin}/login?ref=${encodeURIComponent(profile.ref_code)}&action=register`;
    return {
      LEFT: `${base}&side=LEFT`,
      RIGHT: `${base}&side=RIGHT`,
    } as const;
  }, [profile?.ref_code]);

  const copyReferralLink = useCallback((side: 'LEFT' | 'RIGHT') => {
    const link = binaryReferralLinks?.[side];
    if (!link) return;
    void navigator.clipboard.writeText(link);
    setIsReferralCopied(side);
    addNotification(`Enlace ${side === 'LEFT' ? 'izquierdo' : 'derecho'} copiado`, 'success');
    window.setTimeout(() => setIsReferralCopied(null), 2000);
  }, [binaryReferralLinks, addNotification]);

  const shareOnWhatsApp = useCallback((side: 'LEFT' | 'RIGHT') => {
    const link = binaryReferralLinks?.[side];
    if (!link) return;
    const text = encodeURIComponent(`${side === 'LEFT' ? 'Registro en la pierna izquierda' : 'Registro en la pierna derecha'}: ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [binaryReferralLinks]);

  const activeInvestmentTotal = useMemo(() => {
    return (investments || [])
      .filter(i => i.status === 'ACTIVE')
      .reduce((acc, inv) => acc + inv.amount, 0);
  }, [investments]);

  const estimatedDailyRoi = useMemo(() => {
    return (investments || [])
      .filter(i => i.status === 'ACTIVE')
      .reduce((total, investment) => total + Number(investment.amount) * Number(investment.assigned_roi_percentage || 0) / 100, 0);
  }, [investments]);

  const totalEarnings = useMemo(() => {
    const incomeTypes = [
      TransactionType.DAILY_RETURN,
      'DAILY_ROI',
      TransactionType.REFERRAL_COMMISSION,
      TransactionType.BINARY_COMMISSION,
      TransactionType.WEEKLY_SALARY,
      TransactionType.WEEKLY_BONUS,
      TransactionType.BONUS_WEEKLY
    ];

    return (transactions || [])
      .filter(tx =>
        (incomeTypes.includes(tx.type as any)) &&
        (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CONFIRMED || tx.status?.toUpperCase() === 'APPROVED' || tx.status?.toUpperCase() === 'COMPLETED') &&
        Number(tx.amount) > 0
      )
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
  }, [transactions]);

  // Ganancias nuevas desde el 22 de abril (para alejo@bancus.io)
  const earningsSinceApr22 = useMemo(() => {
    const cutoff = new Date('2026-04-23T00:00:00-04:00').getTime();
    const incomeTypes = [
      TransactionType.DAILY_RETURN,
      'DAILY_ROI',
      TransactionType.REFERRAL_COMMISSION,
      TransactionType.BINARY_COMMISSION,
      TransactionType.WEEKLY_SALARY,
      TransactionType.WEEKLY_BONUS,
      TransactionType.BONUS_WEEKLY
    ];
    return (transactions || [])
      .filter(tx =>
        (incomeTypes.includes(tx.type as any)) &&
        (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CONFIRMED || tx.status?.toUpperCase() === 'APPROVED' || tx.status?.toUpperCase() === 'COMPLETED') &&
        Number(tx.amount) > 0 &&
        new Date(tx.created_at).getTime() >= cutoff
      )
      .reduce((acc, tx) => acc + Number(tx.amount), 0);
  }, [transactions]);

  // Solo mostrar pantalla de carga completa si es el primer inicio (no hay perfil aún)
  if (authLoading || (user && loading && !profile)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20 animate-pulse"></div>
        <div className="z-10 text-center">
          <div className="text-proyecto-accent font-orbitron text-2xl tracking-[0.5em] animate-bounce">{t('common.loading')}</div>
          <div className="text-[10px] text-proyecto-brand font-mono mt-2">{t('common.secure_conn')}</div>
        </div>
      </div>
    );
  }

  // PREVENT LOGIN FLICKER ON LANDING REDIRECT
  const currentPath = window.location.pathname;
  const isRootPath = currentPath === '/' || currentPath === '/index.html';
  const hasReferralParam = new URLSearchParams(window.location.search).has('ref');
  const hasAuthTokens = window.location.hash.includes('access_token');
  const hasRegisterAction = new URLSearchParams(window.location.search).get('action') === 'register';

  if (!user && isRootPath && !referralFromUrl && !hasReferralParam && !hasAuthTokens && !hasRegisterAction) {
    // Return empty black screen while useEffect performs the redirect to /landing
    return <div className="min-h-screen bg-black"></div>;
  }

  if (isPasswordRecovery) {
    return <ResetPasswordForm onComplete={() => {
      setIsPasswordRecovery(false);
      setUser(null);
      supabase.auth.signOut();
    }} onSkip={() => {
      setIsPasswordRecovery(false);
    }} />;
  }

  if (!user) {
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action');
    const initialMode = actionParam === 'register' ? 'register' : undefined;
    return <AuthPortal onLogin={handleLogin} initialReferralCode={referralFromUrl} initialMode={initialMode} />;
  }

  if (!loading && profile && (profile.status === 'suspended' || profile.status === 'inactive')) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111114] border border-rose-500/20 rounded-[3rem] p-12 text-center space-y-8 shadow-2xl">
          <div className="mx-auto w-24 h-24 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <svg className="w-12 h-12 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.4em] text-rose-500 mb-3">Nova Digital</p>
            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Cuenta Suspendida</h1>
            <p className="text-slate-500 font-medium mt-4 leading-relaxed text-sm">
              Tu cuenta ha sido temporalmente suspendida por el equipo administrativo.
              Contacta a soporte para más información.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <a
              href="https://wa.me/18093011632"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-emerald-500/20 transition-all"
            >
              Contactar Soporte
            </a>
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-black uppercase text-[10px] tracking-widest rounded-2xl border border-rose-500/20 transition-all"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = mockEmails.filter(e => !e.isConfirmed).length;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-rajdhani selection:bg-proyecto-accent/30 selection:text-white relative overflow-x-hidden">
      {/* GLOBAL FUTURISTIC BACKGROUND LAYER */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center">
        {/* Holographic Brand Core */}
        <div className="absolute w-[150vw] h-[150vh] flex items-center justify-center opacity-[0.03] mix-blend-screen pointer-events-none select-none">
          <img src="/brand-3.jpg" alt="" className="w-full h-full object-cover animate-pulse-slow" />
        </div>
        <div className="absolute inset-0 bg-grid opacity-[0.15]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(0,114,255,0.15),_transparent_70%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,_rgba(0,243,255,0.05),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[noise] opacity-[0.02]"></div>
      </div>

      <div className="relative z-10 flex">
        <UserSidebar
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab as any); setIsSidebarOpen(false); }}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          profile={profile}
          walletBalance={walletBalance || 0}
        />

        <div className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : ''}`}>
        <DashboardHeader
          user={profile || user}
          balance={walletBalance || 0}
          onProfileClick={() => setActiveTab('profile')}
          onMenuToggle={() => setIsSidebarOpen(prev => !prev)}
        />

        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-32 relative sm:px-6 sm:py-8 lg:px-8">
          {/* Section Header with ID and Status */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2 md:mb-12 border-b border-white/5 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-proyecto-accent animate-pulse shadow-[0_0_8px_cyan]"></div>
                <span className="text-[10px] font-mono-tech text-proyecto-accent uppercase tracking-[0.4em]">Node Active: {profile?.username || profile?.full_name || user?.id?.slice(0, 8) || 'G-0X23'}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-orbitron font-black text-white uppercase tracking-tighter flex items-center gap-4">
                {t(`nav.${activeTab}`)}
                <span className="text-proyecto-accent opacity-20 text-2xl">//</span>
              </h1>
            </div>

            <div className="hidden md:flex items-center gap-6 bg-black/40 backdrop-blur-xl border border-white/5 p-2 px-6 clip-corner-sm">
              <div className="text-right">
                <p className="text-[8px] font-mono-tech text-slate-500 uppercase tracking-widest leading-none mb-1">Network Latency</p>
                <p className="text-xs font-orbitron font-bold text-proyecto-green leading-none">12ms <span className="text-[10px] opacity-50">SYNC</span></p>
              </div>
              <div className="h-8 w-[1px] bg-white/10"></div>
              <div className="text-right">
                <p className="text-[8px] font-mono-tech text-slate-500 uppercase tracking-widest leading-none mb-1">System Load</p>
                <p className="text-xs font-orbitron font-bold text-white leading-none">0.04%</p>
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className="mx-auto w-full max-w-6xl space-y-6 animate-slide-in sm:space-y-8">
              {/* REFERRAL CENTER */}
              <div className="holo-card p-6 rounded-none clip-corner flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:bg-slate-900/40">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 clip-corner flex items-center justify-center transition-all duration-500 ${isReferralCopied ? 'bg-proyecto-green/20 shadow-neon-cyan' : 'bg-proyecto-brand/20'}`}>
                    {isReferralCopied ? (
                      <svg className="w-6 h-6 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-6 h-6 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101" /></svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-orbitron font-bold text-white uppercase tracking-widest text-glow-cyan">{t('dashboard.referral_center')}</h3>
                    <p className="text-[10px] text-slate-400 font-mono-tech uppercase tracking-tighter">{t('dashboard.expand_network')}</p>
                  </div>
                </div>

                <div className="grid flex-1 max-w-2xl w-full gap-2 sm:grid-cols-2">
                  {(['LEFT', 'RIGHT'] as const).map(side => {
                    const link = binaryReferralLinks?.[side];
                    const copied = isReferralCopied === side;
                    return (
                      <div key={side} className="border border-proyecto-accent/20 bg-black/60 clip-corner px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-white">{side === 'LEFT' ? 'Izquierda' : 'Derecha'}</span>
                          <span className="text-[9px] font-mono-tech text-proyecto-accent">{side}</span>
                        </div>
                        <span className="mt-2 block truncate text-[10px] font-mono-tech text-slate-400">{link || 'Enlace pendiente de sincronizar'}</span>
                        <div className="mt-3 flex gap-2">
                          <button onClick={() => copyReferralLink(side)} disabled={!link} className={`flex-1 border px-2 py-2 text-[9px] font-orbitron font-bold uppercase disabled:opacity-30 ${copied ? 'border-proyecto-green bg-proyecto-green text-slate-950' : 'border-proyecto-brand/50 bg-proyecto-brand/20 text-proyecto-accent hover:bg-proyecto-brand/40'}`}>{copied ? t('dashboard.copied') : `Copiar ${side}`}</button>
                          <button onClick={() => shareOnWhatsApp(side)} disabled={!link} className="border border-green-500/30 bg-green-500/10 px-2 py-2 text-[9px] font-orbitron font-bold uppercase text-green-400 disabled:opacity-30">WhatsApp</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* REGLA DE ORO ROI: acceso principal de ancho completo */}
              <RoiDailyTasks
                userId={user?.id || ''}
                hasActiveContracts={activeInvestmentTotal > 0}
                onRoiActivated={handleRoiActivated}
                addNotification={addNotification}
              />

              {/* STATS GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {/* WALLET BANK CARD */}
                    <div className="holo-card p-6 rounded-none clip-corner relative group overflow-hidden hover:border-proyecto-green/50 transition-colors">
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-60 transition-opacity">
                        <svg className="w-10 h-10 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-slate-400 text-[10px] font-orbitron uppercase tracking-widest mb-2 opacity-80">{t('dashboard.wallet_bank')}</p>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-proyecto-green font-orbitron text-xl">$</span>
                        <p className="text-3xl font-orbitron font-bold text-white text-glow-white">
                          {walletBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-proyecto-green animate-pulse shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[9px] font-mono-tech text-proyecto-green uppercase tracking-widest">{t('dashboard.liquidity_available')}</span>
                      </div>
                    </div>

                    {/* ACTIVE CAPITAL CARD */}
                    <div className="holo-card p-6 rounded-none clip-corner relative group overflow-hidden hover:border-proyecto-accent/50 transition-colors">
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-60 transition-opacity">
                        <svg className="w-10 h-10 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                      </div>
                      <p className="text-slate-400 text-[10px] font-orbitron uppercase tracking-widest mb-2 opacity-80">{t('dashboard.active_capital')}</p>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-proyecto-accent font-orbitron text-xl">$</span>
                        <p className="text-3xl font-orbitron font-bold text-white text-glow-cyan">
                          {activeInvestmentTotal.toLocaleString('en-US')}
                        </p>
                      </div>
                      <div className="px-2 py-0.5 bg-proyecto-accent/10 border border-proyecto-accent/20 rounded inline-block">
                        <span className="text-[9px] font-mono-tech text-proyecto-accent uppercase tracking-widest">{t('dashboard.yield_rate')}</span>
                      </div>
                    </div>

                    {/* EARNINGS CARD */}
                    <div className="holo-card p-6 rounded-none clip-corner relative group overflow-hidden hover:border-proyecto-gold/50 transition-colors">
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-60 transition-opacity">
                        <svg className="w-10 h-10 text-proyecto-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-slate-400 text-[10px] font-orbitron uppercase tracking-widest mb-2 opacity-80">{t('dashboard.total_returns')}</p>
                      <div className="flex items-baseline gap-1 mb-2">
                        <span className="text-proyecto-gold font-orbitron text-xl">$</span>
                        <p className="text-3xl font-orbitron font-bold text-white text-glow-white">
                          {(profile?.email === 'alejo@bancus.io' ? 825 + earningsSinceApr22 : totalEarnings).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] font-mono-tech text-proyecto-gold uppercase tracking-widest">{t('dashboard.earnings_breakdown')}</div>
                    </div>
                  </div>

                  {/* WORLD MAP WIDGET */}
                  <WorldMapWidget settings={simulationSettings} latestEvent={latestEvent} />

                  {/* MERCADOS DE PREDICCIÃ“N: visualizaciÃ³n local sin operaciones reales */}
                  <LivePredictionMarketSimulation />

                  {/* CHARTS & TERMINAL */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="md:col-span-3 holo-card p-6 rounded-none clip-corner h-80 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-proyecto-accent to-transparent opacity-50"></div>
                      <div className="absolute top-2 right-2 z-10">
                        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 border border-proyecto-accent/30 rounded clip-corner-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-proyecto-accent animate-pulse shadow-[0_0_8px_cyan]"></div>
                          <span className="text-[8px] font-mono-tech text-proyecto-accent uppercase tracking-widest">{t('dashboard.arbitrage_live')}</span>
                        </div>
                      </div>
                      <WeeklyYieldChart investments={investments || []} />
                    </div>

                    <div className="md:col-span-2 h-80 holo-card p-0 clip-corner overflow-hidden bg-black/80">
                      <LiveTerminal messages={wsMessages} />
                    </div>
                  </div>

                </div>

                {/* RIGHT SIDEBAR */}
                <div className="space-y-6">
                  {profile && (
                    <RankWidget
                      rank={profile.rank || 'Starter'}
                      teamVolume={profile.team_volume || 0}
                      directsCount={networkStats.activeNodes || 0}
                    />
                  )}

                  {profile?.referred_by && (
                    <SponsorWidget sponsorId={profile.referred_by} />
                  )}



                  {/* ── DIRECT COMMISSION SECTION ── */}
                  {profile && (
                    <div className="space-y-3">
                      {/* Section label */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
                        <div className="flex items-center gap-2 px-3 py-1 border border-cyan-500/30 bg-cyan-500/5 clip-corner-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping absolute" />
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-cyan-400">
                            Retiro Disponible Hoy
                          </span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-l from-cyan-500/50 to-transparent" />
                      </div>

                      <DirectCommissionPanel
                        profile={profile}
                        walletBalance={walletBalance}
                        referralCommissionBalance={referralCommissionBalance}
                        handleWithdrawal={handleWithdrawal}
                      />
                    </div>
                  )}

                  {/* REGLA DE ORO ROI — las tareas diarias son el único disparador */}

                  {/* PROMOS Y EVENTOS — acceso directo desde el dashboard */}
                  <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-l-2 border-violet-400 bg-violet-500/[0.04] px-4 py-3">
                      <div>
                        <p className="text-[9px] font-mono-tech text-violet-300 uppercase tracking-[0.25em]">NOVA Digital</p>
                        <h2 className="mt-1 text-base font-orbitron font-black text-white uppercase tracking-[0.18em]">Promos y Eventos</h2>
                      </div>
                      <button
                        onClick={() => setActiveTab('events')}
                        className="w-fit px-4 py-2 border border-violet-400/40 bg-violet-500/10 text-[9px] font-orbitron font-black text-violet-200 uppercase tracking-widest hover:bg-violet-500/20 transition-all"
                      >
                        Ver módulo completo
                      </button>
                    </div>
                    <EventsPanel
                      onNavigateToDeposit={() => setActiveTab('finance')}
                      onSelectPromo={(promo) => {
                        setActivePromotion(promo);
                        setActiveTab('finance');
                      }}
                      profile={profile}
              teamVolume={networkStats.teamVolume}
                    />
                  </section>

                  {/* SECURITY WIDGET */}
                  <div className="holo-card p-6 rounded-none clip-corner border-slate-800">
                    <h4 className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest mb-4">{t('dashboard.security_protocol')}</h4>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 clip-corner-sm bg-proyecto-accent/5 border border-proyecto-accent/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-proyecto-accent animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </div>
                      <div>
                        <p className="text-[10px] text-white font-rajdhani font-bold uppercase tracking-wider">{t('dashboard.immutable_guard')}</p>
                        <p className="text-[8px] text-proyecto-accent font-mono-tech">{t('dashboard.encryption')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => { setActiveTab('finance'); }}
                        className="py-3 px-2 bg-proyecto-brand text-white clip-corner-sm text-[9px] font-bold uppercase tracking-widest hover:brightness-110 hover:shadow-neon-cyan transition-all"
                      >
                        {t('dashboard.deposit_funds')}
                      </button>
                      <button
                        onClick={() => { setActiveTab('finance'); }}
                        className="py-3 px-2 bg-transparent border border-slate-700 text-slate-400 clip-corner-sm text-[9px] font-bold uppercase tracking-widest hover:border-slate-500 hover:text-white transition-all"
                      >
                        {t('dashboard.withdraw')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="mx-auto w-full max-w-6xl animate-slide-in">
              <InvestmentPanel
                onInvest={handleInvestment}
                investments={investments || []}
                addNotification={addNotification}
                walletBalance={walletBalance}
                residualConfig={residualConfig}
                isLoading={processingInvestment}
                dynamicSettings={systemSettings}
              />
            </div>
          )}

          {activeTab === 'tutorials' && (
            <div className="animate-slide-in">
              <TutorialsPanel />
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6 animate-slide-in">
              <div className="flex justify-between items-center bg-black/30 p-4 border-l-2 border-proyecto-accent">
                <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">{t('network.strategic_network')}</h2>
                <span className="text-[9px] font-mono-tech text-proyecto-accent bg-proyecto-accent/10 px-3 py-1 border border-proyecto-accent/20">{t('network.node_status')}</span>
              </div>

              {/* REFERRAL CENTER (DUPLICATED FOR USER CONVENIENCE) */}
              <div className="holo-card p-4 sm:p-6 rounded-none clip-corner flex flex-col gap-4 transition-all hover:bg-slate-900/40">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 clip-corner flex items-center justify-center flex-shrink-0 transition-all duration-500 ${isReferralCopied ? 'bg-proyecto-green/20 shadow-neon-cyan' : 'bg-proyecto-brand/20'}`}>
                    {isReferralCopied ? (
                      <svg className="w-5 h-5 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-5 h-5 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826L10.242 9.172a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102 1.101" /></svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-orbitron font-bold text-white uppercase tracking-widest text-glow-cyan">{t('dashboard.referral_center')}</h3>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 font-mono-tech uppercase tracking-tighter">{t('dashboard.expand_network')}</p>
                  </div>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  {(['LEFT', 'RIGHT'] as const).map(side => {
                    const link = binaryReferralLinks?.[side];
                    const copied = isReferralCopied === side;
                    return (
                      <div key={side} className="border border-proyecto-accent/20 bg-black/60 clip-corner px-3 py-3">
                        <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-orbitron font-bold uppercase tracking-widest text-white">{side === 'LEFT' ? 'Izquierda' : 'Derecha'}</span><span className="text-[9px] font-mono-tech text-proyecto-accent">{side}</span></div>
                        <span className="mt-2 block break-all text-[10px] font-mono-tech text-slate-400">{link || 'Enlace pendiente de sincronizar'}</span>
                        <div className="mt-3 flex gap-2"><button onClick={() => copyReferralLink(side)} disabled={!link} className={`flex-1 border px-2 py-2.5 text-[9px] font-orbitron font-bold uppercase disabled:opacity-30 ${copied ? 'border-proyecto-green bg-proyecto-green text-slate-950' : 'border-proyecto-brand/50 bg-proyecto-brand/20 text-proyecto-accent'}`}>{copied ? t('dashboard.copied') : `Copiar ${side}`}</button><button onClick={() => shareOnWhatsApp(side)} disabled={!link} className="border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-[9px] font-orbitron font-bold uppercase text-green-400 disabled:opacity-30">WhatsApp</button></div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <NetworkVisualization
                data={networkTree || EMPTY_NETWORK}
                totalVolume={networkStats.teamVolume}
                totalEarnings={networkStats.totalEarnings}
                totalUsers={networkStats.activeNodes || 0}
              />
            </div>
          )}

          {activeTab === 'binary' && (
            <div className="space-y-6 animate-slide-in">
              <BinaryBonusPanel
                userId={user?.id || ''}
                refCode={profile?.ref_code || null}
                addNotification={addNotification}
              />
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="space-y-10 animate-slide-in">
              {/* ── FILA 1: DEPOSITAR + ACTIVAR INVERSIÓN ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">{t('finance.inject_liquidity')}</h2>
                    <div className="w-2 h-2 rounded-full bg-proyecto-green shadow-[0_0_10px_#10b981]"></div>
                  </div>
                  <DepositForm
                    onDeposit={handleDeposit}
                    userId={user?.id}
                    activePromotion={activePromotion}
                    onClearPromo={() => setActivePromotion(null)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">{t('finance.activate_node')}</h2>
                    <div className="w-2 h-2 rounded-full bg-proyecto-accent shadow-[0_0_10px_cyan]"></div>
                  </div>
                  <InvestmentPanel
                    onInvest={handleInvestment}
                    investments={investments || []}
                    addNotification={addNotification}
                    walletBalance={walletBalance}
                    softwarePlans={softwarePlans}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <h2 className="text-lg font-orbitron font-bold text-white uppercase tracking-widest">{t('finance.liquidate')}</h2>
                    <div className="w-2 h-2 rounded-full bg-proyecto-gold shadow-[0_0_10px_gold]"></div>
                  </div>
                  {profile ? (
                    <WithdrawalForm balance={walletBalance} handleWithdrawal={handleWithdrawal} user={profile} />
                  ) : (
                    <div className="p-10 text-center border border-dashed border-slate-800 rounded-2xl">
                      <div className="w-8 h-8 border-2 border-proyecto-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{t('common.loading')} Protocol...</p>
                    </div>
                  )}
                </div>

                {profile && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-900/50">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">{t('finance.global_ledger')}</h2>
                  <span className="text-[9px] font-mono-tech text-slate-500 uppercase tracking-widest">{t('finance.block')}: #{Date.now().toString().slice(-8)}</span>
                </div>
                <TransactionHistory transactions={transactions || []} />
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-6 animate-slide-in">
              <div className="flex justify-between items-center bg-black/30 p-4 border-l-2 border-proyecto-accent mb-6">
                <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">Eventos Exclusivos</h2>
                <span className="text-[9px] font-mono-tech text-proyecto-accent bg-proyecto-accent/10 px-3 py-1 border border-proyecto-accent/20">LIVE OPS</span>
              </div>
              <EventsPanel
                onNavigateToDeposit={() => setActiveTab('finance')}
                onSelectPromo={(promo) => {
                  setActivePromotion(promo);
                  setActiveTab('finance');
                }}
                profile={profile}
              />
            </div>
          )}

          {false && (
            <div className="space-y-6 animate-slide-in">
              <div className="flex justify-between items-center bg-black/30 p-4 border-l-2 border-proyecto-neon-purple">
                <h2 className="text-xl font-orbitron font-bold text-white tracking-[0.3em] text-glow-purple">◈ TOKEN GMX — Nova Digital Protocol</h2>
                <span className="text-[9px] font-mono-tech text-proyecto-neon-purple bg-proyecto-neon-purple/10 px-3 py-1 border border-proyecto-neon-purple/20">{t('common.internal_network')}</span>
              </div>
              <p className="text-sm text-slate-400">Este módulo fue retirado de NOVA Digital.</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6 animate-slide-in">
              <div className="flex justify-between items-center bg-black/30 p-4 border-l-2 border-white/50">
                <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em]">{t('common.system_config')}</h2>
                <span className="text-[9px] font-mono-tech text-proyecto-accent bg-proyecto-accent/10 px-3 py-1 border border-proyecto-accent/20">{t('common.access_granted')}</span>
              </div>
              {profile ? (
                <ProfilePanel user={profile} onUpdateUser={handleUpdateUser} addNotification={addNotification} />
              ) : loading ? (
                <div className="holo-card p-12 text-center animate-pulse">
                  <div className="text-proyecto-accent font-orbitron text-xl tracking-widest mb-4">SINCRONIZANDO PERFIL...</div>
                  <div className="text-[10px] text-slate-500 font-mono">Verificando integridad de datos en el nodo central...</div>
                </div>
              ) : (
                <div className="holo-card p-12 text-center space-y-4">
                  <div className="text-rose-400 font-orbitron text-sm tracking-widest mb-2 uppercase">Error al cargar perfil</div>
                  <div className="text-[10px] text-slate-500 font-mono mb-6">No se pudo sincronizar tu perfil. Verifica tu conexión e intenta de nuevo.</div>
                  <button
                    onClick={() => refetch()}
                    className="px-6 py-3 bg-proyecto-accent text-white font-orbitron font-black text-[10px] uppercase tracking-widest clip-corner-sm hover:brightness-110 transition-all"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-6 animate-slide-in">
              <div className="mx-auto mb-6 w-full max-w-7xl">
                <LivePredictionMarketSimulation />
              </div>
              <div className="flex justify-between items-center bg-black/30 p-4 border-l-2 border-proyecto-accent mb-6">
                <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-[0.3em] text-glow-cyan">PREDICTION MARKETS</h2>
                <span className="text-[9px] font-mono-tech text-proyecto-accent bg-proyecto-accent/10 px-3 py-1 border border-proyecto-accent/20">DATOS PÚBLICOS · POLYMARKET LIVE</span>
              </div>
              {profile ? (
<PredictionMarketsPanel
                  user={profile}
                  walletBalance={walletBalance}
                  onUpdateBalance={refetch}
                />
              ) : (
                <div className="p-10 text-center border border-dashed border-slate-800 rounded-2xl">
                  <div className="w-8 h-8 border-2 border-proyecto-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Cargando mercados...</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'roadmap' && (
            <RoadMapPanel />
          )}
        </main>
        </div>{/* end flex-1 md:ml-64 */}
      </div>{/* end relative z-10 flex */}


      {/* WHATSAPP SUPPORT BUTTON */}
      {supportWhatsapp && (
        <a
          href={`https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(t('common.whatsapp_support_text'))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 left-4 z-[9998] w-14 h-14 rounded-full bg-[#25D366] shadow-[0_0_30px_rgba(37,211,102,0.4)] flex items-center justify-center text-white group hover:scale-110 active:scale-95 transition-all duration-500 border-2 border-white/20"
          title={t('common.whatsapp_support_title')}
        >
          {/* Pulsing Aura */}
          <div className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20 group-hover:opacity-40 transition-opacity"></div>

          {/* Glassmorphism Inner Glow */}
          <div className="absolute inset-1 rounded-full border border-white/10 bg-gradient-to-tr from-transparent via-white/5 to-white/10 pointer-events-none"></div>

          <svg className="w-8 h-8 fill-current relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.438 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>

          {/* Premium Notification Badge */}
          <span className="absolute -top-1 -right-1 bg-white text-[#25D366] font-black text-[9px] w-6 h-6 flex items-center justify-center rounded-full border-2 border-[#25D366] animate-bounce shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20">
            HELP
          </span>

          {/* Tooltip */}
          <div className="absolute left-full ml-3 px-3 py-1.5 bg-black/80 backdrop-blur-xl border border-emerald-500/30 text-white text-[10px] font-orbitron font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap pointer-events-none">
            Soporte WhatsApp
          </div>
        </a>
      )}
      <footer className="mt-20 py-8 border-t border-slate-900/50 bg-black/40 text-center backdrop-blur-sm relative z-10">
        <p className="text-slate-600 text-[10px] font-rajdhani font-bold tracking-[0.5em]">Nova Digital Systems • Verified Node Architecture • V2.5.5</p>
      </footer>

      <NotificationToast notifications={notifications} removeNotification={removeNotification} />

      <WithdrawalConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        txId={lastWithdrawal?.id || ''}
        amount={lastWithdrawal?.amount || 0}
      />

      <DepositConfirmationModal
        isOpen={showDepositConfirmModal}
        onClose={() => setShowDepositConfirmModal(false)}
        amount={lastDeposit?.amount || 0}
        txId={lastDeposit?.id || ''}
        hash={lastDepositHash}
      />

      <TwoFactorVerificationModal
        isOpen={show2FAModal}
        onClose={() => { setShow2FAModal(false); setPendingWithdrawal(null); }}
        onVerify={handleVerify2FA}
        isLoading={is2FAVerifying}
      />

      <MockEmailInbox
        emails={mockEmails}
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
        amount={lastDeposit?.amount || 0}
      />

      {showFlashOffer && activePromotion && (
        <FlashOfferModal
          promotion={activePromotion}
          onClose={() => {
            setShowFlashOffer(false);
            localStorage.setItem('nova_digital_dismissed_flash_promo', activePromotion.id);
          }}
        />
      )}

    </div>
  );
};

export default App;
