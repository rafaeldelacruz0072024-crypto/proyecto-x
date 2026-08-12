import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

interface Props {
    onComplete: () => void;
    onSkip?: () => void;
}

const ResetPasswordForm: React.FC<Props> = ({ onComplete, onSkip }) => {
    const { t } = useTranslation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 6) {
            setError(t('reset_password.error_min_length'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('reset_password.error_mismatch'));
            return;
        }

        setLoading(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => {
                onComplete();
            }, 3000);
        } catch (err: any) {
            console.error('Error updating password:', err);
            setError(err.message || t('reset_password.error_generic'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-geminix-dark p-4">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-geminix-brand/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-geminix-accent/10 rounded-full blur-[120px] pointer-events-none animate-pulse-slow"></div>

            <div className="w-full max-w-md z-10 animate-fade-in">
                <div className="flex flex-col items-center mb-10">
                    <Logo size="lg" className="transition-all hover:scale-105 duration-700 ease-in-out" />
                </div>

                <div className="blue-glass p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl relative">
                    {success ? (
                        <div className="text-center animate-fade-in">
                            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-geminix-green/20 border border-geminix-green/50 flex items-center justify-center">
                                <svg className="w-8 h-8 text-geminix-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-white text-lg font-orbitron font-bold mb-3">
                                {t('reset_password.success_title')}
                            </h2>
                            <p className="text-slate-400 text-xs mb-6">
                                {t('reset_password.success_desc')}
                            </p>
                            <div className="flex items-center justify-center gap-2 text-geminix-accent text-[10px] font-mono-tech">
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {t('reset_password.redirecting')}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-geminix-accent/10 border border-geminix-accent/30 flex items-center justify-center">
                                    <svg className="w-7 h-7 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                </div>
                                <h2 className="text-white text-sm font-orbitron font-bold uppercase tracking-widest mb-2">
                                    {t('reset_password.title')}
                                </h2>
                                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                                    {t('reset_password.subtitle')}
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-red-500 text-xs font-bold">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="animate-fade-in">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                        {t('reset_password.new_password')}
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        disabled={loading}
                                        minLength={6}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-geminix-accent transition-all disabled:opacity-50"
                                        placeholder="••••••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>

                                <div className="animate-fade-in">
                                    <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                                        {t('reset_password.confirm_password')}
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        disabled={loading}
                                        minLength={6}
                                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-geminix-accent transition-all disabled:opacity-50"
                                        placeholder="••••••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <p className="text-[8px] text-slate-600 mt-1 ml-1 font-bold text-right uppercase tracking-tighter">
                                        {t('reset_password.min_chars')}
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 blue-brand-gradient text-white font-black text-xs uppercase tracking-[0.3em] rounded-xl shadow-2xl shadow-geminix-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        t('reset_password.button')
                                    )}
                                </button>
                            </form>

                            {onSkip && (
                                <button
                                    type="button"
                                    onClick={onSkip}
                                    className="w-full py-3 mt-3 bg-transparent border border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:border-geminix-accent hover:text-geminix-accent transition-all"
                                >
                                    Ir al Dashboard →
                                </button>
                            )}
                        </>
                    )}

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter leading-relaxed">
                            {t('reset_password.footer')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordForm;
