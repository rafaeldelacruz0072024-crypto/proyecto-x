import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import ProtocolTermsModal from './ProtocolTermsModal';
import ResetPasswordForm from './ResetPasswordForm';

interface Props {
  onLogin: (user: any) => void;
  initialReferralCode?: string | null;
  initialMode?: 'login' | 'register';
}

const AuthPortal: React.FC<Props> = ({ onLogin, initialReferralCode, initialMode }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode || 'login');
  const [forgotEmailSent, setForgotEmailSent] = useState(false);

  const defaultRef = initialReferralCode || '';

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    country: '',
    phone: '',
    referralCode: defaultRef,
    termsAccepted: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  type FieldStatus = 'idle' | 'checking' | 'available' | 'taken';
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<FieldStatus>('idle');
  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const binarySide = (localStorage.getItem('nova_digital_binary_side') || 'LEFT').toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';

  useEffect(() => {
    if (initialReferralCode) {
      setMode('register');
      setFormData(prev => ({ ...prev, referralCode: initialReferralCode }));
    }
    // Si no hay código de referido, dejar el campo vacío.
    // El trigger de la BD asigna ROOT como fallback cuando sponsor_code está vacío,
    // evitando que el ref_code de ROOT se pase explícitamente y cause que usuarios
    // con sponsor correcto queden registrados bajo ROOT.
  }, [initialReferralCode]);

  useEffect(() => {
    if (mode !== 'register') return;
    const username = formData.username.trim();
    if (!username || username.length < 3 || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('check_username_available', { p_username: username });
      setUsernameStatus(!error && data ? 'available' : 'taken');
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.username, mode]);

  useEffect(() => {
    if (mode !== 'register') return;
    const email = normalizeEmail(formData.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailStatus('idle');
      return;
    }
    setEmailStatus('checking');
    const timer = setTimeout(async () => {
      // Check auth.users via RPC (more reliable than profiles table)
      const { data: existsInAuth } = await supabase.rpc('check_email_in_auth', { p_email: email });
      if (existsInAuth) { setEmailStatus('taken'); return; }
      setEmailStatus('available');
    }, 600);
    return () => clearTimeout(timer);
  }, [formData.email, mode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.termsAccepted) {
      setError(t('auth.errors.terms'));
      return;
    }

    // Input validation
    if (formData.name.trim().length < 2 || formData.name.length > 80) {
      setError('El nombre debe tener entre 2 y 80 caracteres.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(formData.username)) {
      setError('El username debe tener 3-30 caracteres (letras, números, guión bajo).');
      return;
    }
    const normalizedEmail = normalizeEmail(formData.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('El email no es válido. Escribe un correo como nombre@dominio.com.');
      return;
    }
    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (formData.phone && !/^\+?[\d\s\-()]{7,20}$/.test(formData.phone)) {
      setError('El número de teléfono no es válido.');
      return;
    }

    // REGLA DE ORO: código de patrocinador obligatorio
    const sponsorCode = (localStorage.getItem('nova_digital_referral') || formData.referralCode?.trim() || '').toUpperCase();
    if (!sponsorCode || !sponsorCode.startsWith('GK-')) {
      setError('El código de patrocinador es obligatorio. Solicítalo a quien te invitó a Nova Digital.');
      return;
    }

    setLoading(true);
    setError(null);
    setFormData(prev => ({ ...prev, email: normalizedEmail }));

    try {
      // Verificar que el código de sponsor existe en la BD
      const { data: sponsorValid, error: sponsorValidationError } = await supabase.rpc('validate_sponsor_code', {
        p_code: sponsorCode
      });

      if (sponsorValidationError) {
        throw new Error('No se pudo validar el patrocinador. Intenta nuevamente.');
      }
      if (!sponsorValid) {
        setError('El código de patrocinador no es válido. Verifica e intenta nuevamente.');
        setLoading(false);
        return;
      }

      // 1. Registrar usuario en Supabase Auth

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            username: formData.username,
            sponsor_code: sponsorCode,
            binary_side: binarySide,
            country: formData.country,
            phone: formData.phone
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error(t('auth.errors.generic_register'));

      // Supabase puede devolver el usuario sin una sesiÃ³n cuando exige confirmaciÃ³n de email.
      // Nunca invoques complete_registration como anon: el RPC exige el rol authenticated.
      const registrationSession = authData.session;
      if (!registrationSession) {
        localStorage.removeItem('nova_digital_referral');
        localStorage.removeItem('nova_digital_binary_side');
        document.cookie = 'nova_digital_ref=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';
        setMode('login');
        setError('Tu cuenta se creÃ³ correctamente. Revisa tu correo, confirma la cuenta y luego inicia sesiÃ³n.');
        return;
      }

      // Instalar explÃ­citamente el JWT devuelto por signUp antes de llamar al RPC.
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: registrationSession.access_token,
        refresh_token: registrationSession.refresh_token,
      });
      if (sessionError) throw sessionError;

      // 2. Esperar un momento para que el trigger cree el profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generar ref_code único (verificado contra BD)

      // 4. Actualizar el profile via RPC (resolución de sponsor 100% server-side)
      // IMPORTANTE: complete_registration NUNCA lanza errores SQL (captura con EXCEPTION),
      // por eso debemos verificar el campo success del JSON devuelto, no solo updateError.
      const { data: rpcData, error: updateError } = await supabase.rpc('complete_registration', {
        p_user_id:      authData.user.id,
        p_username:     formData.username,
        p_full_name:    formData.name,
        p_email:        normalizedEmail,
        p_country:      formData.country,
        p_phone:        formData.phone,
        p_ref_code:     null,
        p_sponsor_code: sponsorCode.toUpperCase(),
        p_binary_side:  binarySide
      });

      if (updateError || !rpcData?.success) {
        console.warn('RPC complete_registration failed, retrying...', updateError || rpcData);
        await new Promise(r => setTimeout(r, 1500));
        const { data: retryData, error: retryError } = await supabase.rpc('complete_registration', {
          p_user_id:      authData.user.id,
          p_username:     formData.username,
          p_full_name:    formData.name,
          p_email:        normalizedEmail,
          p_country:      formData.country,
          p_phone:        formData.phone,
          p_ref_code:     null,
          p_sponsor_code: sponsorCode.toUpperCase(),
          p_binary_side:  binarySide
        });
        if (retryError || !retryData?.success) {
          throw new Error(retryData?.error || retryError?.message || 'No se pudo completar el registro.');
        }
      }

      // Limpiar referral del localStorage después del registro exitoso
      localStorage.removeItem('nova_digital_referral');
      localStorage.removeItem('nova_digital_binary_side');
      document.cookie = 'nova_digital_ref=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/';

      // Login automático
      onLogin(authData.user);

    } catch (err: any) {
      console.error('Error en registro completo:', err);
      const raw = err.message || '';
      let errorMsg: string;

      if (raw.toLowerCase().includes('already registered') || raw.toLowerCase().includes('user already')) {
        errorMsg = 'Este email ya tiene una cuenta registrada. Por favor inicia sesión o usa "¿Olvidaste tu contraseña?" para recuperar el acceso.';
        setEmailStatus('taken');
      } else if (raw.toLowerCase().includes('password')) {
        errorMsg = 'La contraseña debe tener al menos 8 caracteres.';
      } else if (raw.toLowerCase().includes('invalid email') || raw.toLowerCase().includes('email')) {
        errorMsg = 'El email no es válido.';
      } else if (raw.toLowerCase().includes('rate limit') || raw.toLowerCase().includes('too many')) {
        errorMsg = 'Demasiados intentos. Espera unos minutos e intenta nuevamente.';
      } else {
        const details = err.details || err.hint || '';
        errorMsg = details ? `${raw} (${details})` : (raw || t('auth.errors.generic_register'));
      }

      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(formData.email),
        password: formData.password
      });

      if (loginError) throw loginError;
      if (!data.user) throw new Error(t('auth.errors.generic_login'));

      onLogin(data.user);

    } catch (err: any) {
      console.error('Error en login:', err);
      setError(err.message || t('auth.errors.generic_login'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError(t('reset_password.error_email_required'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Omitting captcha verification as requested
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(formData.email),
        { redirectTo: 'https://proyecto-x-user.vercel.app/login' }
      );
      if (resetError) throw resetError;
      setForgotEmailSent(true);
    } catch (err: any) {
      console.error('Error sending reset email:', err);
      setError(err.message || t('reset_password.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = mode === 'forgot' ? handleForgotPassword : (mode === 'login' ? handleLogin : handleRegister);

  const countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
    "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon",
    "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
    "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel",
    "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo",
    "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
    "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
    "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia",
    "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway", "Oman",
    "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
    "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
    "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan",
    "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan",
    "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
    "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-rajdhani relative overflow-hidden">
      <div
        className="fixed inset-0 bg-[length:auto_100%] bg-[center_right] bg-no-repeat pointer-events-none"
        style={{ backgroundImage: "url('/nova-login-background.png')" }}
        aria-hidden="true"
      />
      <div className="fixed inset-0 bg-[linear-gradient(90deg,rgba(3,7,18,.94)_0%,rgba(3,7,18,.82)_38%,rgba(3,7,18,.24)_68%,rgba(3,7,18,.1)_100%)] pointer-events-none" />
      <div className="fixed inset-0 bg-grid opacity-40 pointer-events-none" />
      {/* Language Switcher Overlay */}
      <div className="absolute top-4 right-4 z-[60] pointer-events-auto">
        <LanguageSwitcher />
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in lg:mr-auto lg:ml-[8vw]">
        <div className="flex flex-col items-center mb-10 relative">
          <div className="absolute -top-10 w-40 h-40 bg-proyecto-accent/10 rounded-full blur-[80px] animate-pulse"></div>
          <Logo size="lg" variant="blue" glow className="transition-all hover:scale-105 duration-1000 ease-in-out" />
          <div className="flex flex-col items-center mt-4">
            <p className="text-[10px] uppercase text-proyecto-accent font-black tracking-[0.6em] text-glow-cyan text-center opacity-90 animate-pulse">
              NOVA Digital · Mercados de predicción
            </p>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-proyecto-accent/50 to-transparent mt-2"></div>
          </div>
        </div>

        <div className="holo-card bg-slate-950/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-proyecto-accent/25 shadow-[0_0_50px_rgba(0,0,0,0.55)] relative z-20 group isolation-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-proyecto-accent/5 via-transparent to-proyecto-brand/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10"></div>
          {mode === 'forgot' ? (
            <div className="mb-6 py-2 animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setForgotEmailSent(false);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('auth.login_tab')}</span>
              </button>
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-proyecto-accent/10 border border-proyecto-accent/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-proyecto-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-white text-sm font-orbitron font-bold uppercase tracking-widest mb-1">
                  {t('reset_password.title')}
                </h3>
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                  {t('reset_password.subtitle')}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative z-20 flex bg-slate-950/50 p-1 rounded-xl mb-8 border border-slate-800">
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all relative z-30 cursor-pointer ${mode === 'login' ? 'blue-brand-gradient text-white shadow-lg' : 'text-slate-500'}`}
                type="button"
              >
                {t('auth.login_tab')}
              </button>
              <button
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all relative z-30 cursor-pointer ${mode === 'register' ? 'blue-brand-gradient text-white shadow-lg' : 'text-slate-500'}`}
                type="button"
              >
                {t('auth.register_tab')}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl overflow-auto max-h-60">
              <p className="text-red-500 text-[10px] font-bold whitespace-pre-wrap">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="animate-fade-in">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.full_name')}</label>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-proyecto-accent transition-all disabled:opacity-50"
                    placeholder={t('auth.kyc_placeholder')}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="animate-fade-in">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.username')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={loading}
                      className={`w-full bg-slate-950/50 border rounded-xl py-3 px-4 pr-10 text-sm text-white focus:outline-none transition-all disabled:opacity-50 ${
                        usernameStatus === 'available' ? 'border-green-500 focus:border-green-400' :
                        usernameStatus === 'taken' ? 'border-red-500 focus:border-red-400' :
                        'border-slate-800 focus:border-proyecto-accent'
                      }`}
                      placeholder={t('auth.alias_placeholder')}
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                    />
                    {usernameStatus === 'checking' && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    )}
                    {usernameStatus === 'available' && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                    {usernameStatus === 'taken' && (
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    )}
                  </div>
                  {usernameStatus === 'available' && <p className="text-[9px] text-green-500 font-black mt-1 ml-1 uppercase tracking-widest">Disponible ✓</p>}
                  {usernameStatus === 'taken' && <p className="text-[9px] text-red-500 font-black mt-1 ml-1 uppercase tracking-widest">No disponible ✗</p>}
                  {usernameStatus === 'checking' && <p className="text-[9px] text-slate-500 font-black mt-1 ml-1 uppercase tracking-widest">Verificando...</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="animate-fade-in">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.country')}</label>
                    <select
                      required
                      disabled={loading}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-proyecto-accent transition-all disabled:opacity-50 appearance-none cursor-pointer"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    >
                      <option value="" disabled>{t('auth.select_country')}</option>
                      {countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="animate-fade-in">
                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.phone')}</label>
                    <input
                      type="tel"
                      required
                      disabled={loading}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-proyecto-accent transition-all disabled:opacity-50"
                      placeholder="+1 234..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="animate-fade-in">
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.email')}</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  disabled={loading}
                  className={`w-full bg-slate-950/50 border rounded-xl py-3 px-4 pr-10 text-sm text-white focus:outline-none transition-all disabled:opacity-50 ${
                    mode === 'register' && emailStatus === 'available' ? 'border-green-500 focus:border-green-400' :
                    mode === 'register' && emailStatus === 'taken' ? 'border-red-500 focus:border-red-400' :
                    'border-slate-800 focus:border-proyecto-accent'
                  }`}
                  placeholder="node@gk-network.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {mode === 'register' && emailStatus === 'checking' && (
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {mode === 'register' && emailStatus === 'available' && (
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                )}
                {mode === 'register' && emailStatus === 'taken' && (
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                )}
              </div>
              {mode === 'register' && emailStatus === 'available' && <p className="text-[9px] text-green-500 font-black mt-1 ml-1 uppercase tracking-widest">Disponible ✓</p>}
              {mode === 'register' && emailStatus === 'taken' && <p className="text-[9px] text-red-500 font-black mt-1 ml-1 uppercase tracking-widest">Email ya registrado ✗</p>}
              {mode === 'register' && emailStatus === 'checking' && <p className="text-[9px] text-slate-500 font-black mt-1 ml-1 uppercase tracking-widest">Verificando...</p>}
            </div>

            {mode !== 'forgot' && (
              <div className="animate-fade-in relative">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('auth.password')}</label>
                <input
                  type="password"
                  required
                  disabled={loading}
                  minLength={6}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-proyecto-accent transition-all disabled:opacity-50"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                {mode === 'register' && (
                  <p className="text-[8px] text-slate-600 mt-1 ml-1 font-bold text-right uppercase tracking-tighter">{t('auth.password_hint')}</p>
                )}
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setForgotEmailSent(false);
                    }}
                    className="text-[9px] text-proyecto-accent/70 mt-1.5 ml-1 font-bold uppercase tracking-tighter hover:text-proyecto-accent transition-colors cursor-pointer block text-right w-full"
                  >
                    {t('reset_password.forgot_link')}
                  </button>
                )}
              </div>
            )}

            {mode === 'forgot' && forgotEmailSent && (
              <div className="text-center animate-fade-in py-4">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-proyecto-green/20 border border-proyecto-green/50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-proyecto-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white text-sm font-bold mb-2">{t('reset_password.email_sent_title')}</p>
                <p className="text-slate-400 text-xs mb-4">{t('reset_password.email_sent_desc')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotEmailSent(false);
                    setError(null);
                  }}
                  className="text-proyecto-accent text-[10px] font-bold uppercase tracking-widest hover:underline"
                >
                  {t('reset_password.back_to_login')}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div className="animate-fade-in">
                  <label className="block text-[9px] font-black text-proyecto-accent uppercase tracking-widest mb-1.5 ml-1">
                    {t('auth.sponsor')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={loading}
                    className="w-full bg-proyecto-accent/5 border border-proyecto-accent/20 rounded-xl py-3 px-4 text-sm text-proyecto-accent font-black focus:outline-none focus:border-proyecto-accent transition-all disabled:opacity-50 uppercase"
                    placeholder="GK-XXXX-XX"
                    value={formData.referralCode}
                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                  />
                </div>

                <div className="animate-fade-in flex items-start gap-3 mt-4 group">
                  <input
                    type="checkbox"
                    id="terms"
                    required
                    checked={formData.termsAccepted}
                    onChange={(e) => setFormData({ ...formData, termsAccepted: e.target.checked })}
                    className="mt-1 w-4 h-4 bg-slate-950 border-slate-800 text-proyecto-accent rounded focus:ring-proyecto-accent cursor-pointer transition-all"
                  />
                  <label htmlFor="terms" className="text-[10px] text-slate-500 font-bold uppercase tracking-tight -mt-0.5 leading-tight">
                    Confirmo ser mayor de edad y acepto los <button type="button" onClick={() => setShowTermsModal(true)} className="text-proyecto-accent hover:underline cursor-pointer">Términos del Protocolo</button>.
                  </label>
                </div>
              </>
            )}

            {!(mode === 'forgot' && forgotEmailSent) && (
              <div className="pt-4 border-t border-slate-800/50">
                <div className="flex flex-col mb-6 bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-proyecto-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    {t('auth.security_check', 'SEGURIDAD CLOUDFLARE')}
                  </label>
                  
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="flex-1 bg-green-500/10 border border-green-500/30 text-green-500 rounded-lg py-2.5 px-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      {t('auth.human_verified', 'NODO PROTEGIDO')}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`relative w-full overflow-hidden rounded-xl bg-proyecto-accent text-white font-black text-xs sm:text-sm uppercase tracking-[0.2em] py-4 transition-all duration-300 shadow-[0_0_20px_rgba(26,115,232,0.3)] hover:shadow-[0_0_40px_rgba(26,115,232,0.6)] group disabled:opacity-50 disabled:grayscale ${mode === 'register' ? 'mt-4' : ''}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('auth.processing')}
                    </span>
                  ) : (
                    mode === 'forgot' ? t('reset_password.send_button') : (mode === 'login' ? t('auth.button_login') : t('auth.button_register'))
                  )}
                </button>
              </div>
            )}
          </form>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter leading-relaxed">
              {t('auth.footer_terms')}
            </p>
          </div>
        </div>

        <div className="mt-10 flex justify-center gap-6 opacity-40">
          <img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png" className="h-4 grayscale hover:grayscale-0 transition-all" alt="USDT" />
          <img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png" className="h-4 grayscale hover:grayscale-0 transition-all" alt="BNB" />
          <img src="https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png" className="h-4 grayscale hover:grayscale-0 transition-all" alt="BTC" />
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      <ProtocolTermsModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  );
};

export default AuthPortal;
