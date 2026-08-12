import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (user && profile?.role === 'admin') {
      navigate('/');
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!supabase) throw new Error('Cliente Supabase no inicializado');

      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) throw loginError;

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        throw new Error('No se encontró el perfil de administrador para este usuario.');
      }

      if (profileData.role !== 'admin' && profileData.role !== 'sub-admin') {
        await supabase.auth.signOut();
        throw new Error('Acceso denegado. Solo administradores pueden acceder.');
      }

      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Infinite recursion')) {
        setError('Error del sistema: Recursión en políticas de seguridad. Ejecuta el script fix_rls.sql en Supabase.');
      } else if (err.message?.includes('Invalid login credentials')) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(err.message || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {!supabase && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-2xl text-red-200 text-sm font-semibold shadow-lg backdrop-blur-sm animate-pulse">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              ⚠️ Configuración Faltante
            </h3>
            <p>
              No se han detectado las variables de entorno de Supabase.
            </p>
            <p className="mt-2 text-xs opacity-75">
              Por favor configura <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en tu archivo <code>.env</code>
            </p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-8">
            <Logo size="lg" className="mx-auto mb-4" variant="blue" glow={true} />
            <h1 className="text-3xl font-black text-white tracking-tight">GK GEMINIX ADMIN</h1>
            <p className="text-slate-500 text-sm mt-2 font-bold uppercase tracking-wider">
              Sistema de Control Maestro
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-bold">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">
                Email Administrativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!supabase}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="admin@geminix.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!supabase}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !supabase}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-600/50"
            >
              {loading ? '🔄 Verificando...' : '🔐 Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-700 text-xs font-bold uppercase tracking-wider">
              GK GEMINIX Core v2.0 • Sesión Cifrada
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="mt-6 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-amber-500 text-xs font-bold text-center">
            🔒 Solo usuarios con role="admin" pueden acceder
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
