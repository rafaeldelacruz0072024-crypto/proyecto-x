import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bot,
    Users,
    CheckCircle2,
    Gift,
    Loader2,
    ExternalLink,
    ShieldCheck,
    Smartphone,
    ChevronRight,
    Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserTasks, completeTask, claimTelegramReward } from '../services/database';

interface Task {
    id: string;
    title: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    status: 'PENDING' | 'COMPLETED';
    actionLabel: string;
    link: string;
}

const TelegramRewardPanel: React.FC<{ userId: string; onRewardClaimed?: () => void }> = ({ userId, onRewardClaimed }) => {
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [alreadyClaimed, setAlreadyClaimed] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        fetchTaskStatus();
    }, [userId]);

    const fetchTaskStatus = async () => {
        setLoading(true);
        try {
            // Fetch System Settings first
            const { data: sysSettings } = await supabase
                .from('system_settings')
                .select('*')
                .limit(1)
                .single();

            setSettings(sysSettings);

            const userTasks = await getUserTasks(userId);

            const checkClaimed = await supabase
                .from('transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('type', 'BONUS')
                .ilike('description', '%Telegram%')
                .limit(1);

            if (checkClaimed.data && checkClaimed.data.length > 0) {
                setAlreadyClaimed(true);
            }

            const initialTasks: Task[] = [
                {
                    id: 'telegram_connect',
                    title: t('telegram_reward.task1_title', { defaultValue: 'CONECTA TU TELEGRAM' }),
                    name: t('telegram_reward.task1_name', { defaultValue: 'Vincular Cuenta' }),
                    description: t('telegram_reward.task1_desc', { defaultValue: 'Paso 1: Vincula tu cuenta de Telegram al ecosistema PROYECTO X.' }),
                    icon: <Smartphone className="w-4 h-4" />,
                    status: userTasks.find((t: any) => t.task_id === 'telegram_connect')?.status || 'PENDING',
                    actionLabel: t('telegram_reward.connect', { defaultValue: 'Conectar' }),
                    link: sysSettings?.telegram_link_connect || 'https://t.me/Proyecto X22_bot'
                },
                {
                    id: 'telegram_bot',
                    title: t('telegram_reward.task2_title', { defaultValue: 'INICIAR EL BOT OFICIAL' }),
                    name: t('telegram_reward.task2_name', { defaultValue: 'Activar Bot' }),
                    description: t('telegram_reward.task2_desc', { defaultValue: 'Paso 2: Inicia nuestro Bot Oficial para recibir notificaciones y accesos.' }),
                    icon: <Bot className="w-4 h-4" />,
                    status: userTasks.find((t: any) => t.task_id === 'telegram_bot')?.status || 'PENDING',
                    actionLabel: t('telegram_reward.start', { defaultValue: 'Iniciar' }),
                    link: sysSettings?.telegram_link_bot || 'https://t.me/Proyecto X22_bot'
                },
                {
                    id: 'telegram_channel',
                    title: t('telegram_reward.task3_title', { defaultValue: 'ÚNETE A LA COMUNIDAD' }),
                    name: t('telegram_reward.task3_name', { defaultValue: 'Acceso vía Bot' }),
                    description: t('telegram_reward.task3_desc', { defaultValue: 'Paso 3: El Bot te enviará el enlace exclusivo para unirte a nuestro Canal de Comunidad.' }),
                    icon: <Users className="w-4 h-4" />,
                    status: userTasks.find((t: any) => t.task_id === 'telegram_channel')?.status || 'PENDING',
                    actionLabel: t('telegram_reward.join', { defaultValue: 'Verificar' }),
                    // The link here can be the bot again or empty since the bot gives the access
                    link: sysSettings?.telegram_link_channel || 'https://t.me/Proyecto X22_bot'
                }
            ];

            setTasks(initialTasks);
        } catch (err) {
            console.error('Error loading tasks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskAction = async (task: Task) => {
        if (task.status === 'COMPLETED') return;
        window.open(task.link, '_blank');
        const res = await completeTask(userId, task.id);
        if (res.success) {
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'COMPLETED' } : t));
        }
    };

    const handleClaim = async () => {
        setClaiming(true);
        setError(null);
        try {
            const res = await claimTelegramReward(userId);
            if (res.success) {
                setSuccess(t('telegram_reward.success_claim', { amount: settings?.telegram_reward_amount || '5.00' }));
                setAlreadyClaimed(true);
                if (onRewardClaimed) onRewardClaimed();
            } else {
                setError(res.message || 'Error al reclamar el bono');
            }
        } catch (err) {
            setError('Error inesperado');
        } finally {
            setClaiming(false);
        }
    };

    const allCompleted = tasks.every(t => t.status === 'COMPLETED');

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-slate-900/40 border border-white/5 rounded-none clip-corner">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="holo-card p-0 rounded-none clip-corner flex flex-col h-full bg-slate-900/60 backdrop-blur-3xl overflow-hidden group shadow-2xl transition-all duration-500 hover:border-indigo-500/30">
            {/* SCANLINE EFFECT */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 z-0">
                <div className="absolute inset-0 bg-scanline animate-scan"></div>
            </div>

            {settings?.telegram_enabled === false && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 text-rose-500 animate-pulse mx-auto mb-4" />
                        <h4 className="text-[10px] font-orbitron font-black text-rose-500 uppercase tracking-widest leading-relaxed">
                            [ SISTEMA FUERA DE LÍNEA ]
                        </h4>
                        <p className="text-[7px] text-slate-500 font-mono-tech mt-2 uppercase tracking-tighter">
                            Ajustando protocolos de recompensa...
                        </p>
                    </div>
                </div>
            )}

            {/* HEADER SECTION */}
            <div className="p-6 border-b border-white/5 bg-black/40 relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>
                    <div>
                        <h3 className="text-xs font-orbitron font-black text-white uppercase tracking-[0.2em] text-glow-indigo">
                            {t('telegram_reward.title')}
                        </h3>
                        <p className="text-[8px] text-slate-500 font-mono-tech uppercase tracking-widest mt-0.5">
                            Protocol: Community Rewards 0xGMX
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-none clip-corner-sm">
                    <Zap className="w-3 h-3 text-indigo-400" />
                    <span className="text-[10px] font-orbitron font-bold text-indigo-400">${settings?.telegram_reward_amount || '5.00'}</span>
                </div>
            </div>

            {/* MISSIONS LIST */}
            <div className="flex-grow p-6 space-y-4 relative z-10">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => handleTaskAction(task)}
                        className={`group/task flex items-center justify-between p-4 border transition-all duration-300 cursor-pointer clip-corner-sm ${task.status === 'COMPLETED'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-black/20 border-white/5 hover:bg-indigo-500/5 hover:border-indigo-500/30'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 flex items-center justify-center transition-colors ${task.status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-500 group-hover/task:text-indigo-400'
                                }`}>
                                {task.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5" /> : task.icon}
                            </div>
                            <div>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest transition-colors ${task.status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-300'
                                    }`}>
                                    {task.name}
                                </h4>
                                <p className="text-[8px] text-slate-500 font-mono-tech mt-0.5 tracking-tighter">
                                    {task.status === 'COMPLETED' ? 'STATUS: SYNCHRONIZED' : 'STATUS: PENDING_CONNECTION'}
                                </p>
                            </div>
                        </div>
                        {task.status !== 'COMPLETED' && (
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover/task:text-indigo-400 group-hover/task:translate-x-0.5 transition-all" />
                        )}
                    </div>
                ))}
            </div>

            {/* TERMINAL FOOTER / CLAIM AREA */}
            <div className="p-6 bg-black/40 border-t border-white/5 relative z-10">
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold text-center uppercase tracking-widest animate-in slide-in-from-top-1">
                        !! {error} !!
                    </div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold text-center uppercase tracking-widest animate-in slide-in-from-top-1">
                        {success}
                    </div>
                )}

                <button
                    onClick={handleClaim}
                    disabled={!allCompleted || claiming || alreadyClaimed}
                    className={`w-full py-4 clip-corner-sm font-orbitron font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 group/btn ${alreadyClaimed
                        ? 'bg-slate-800 text-slate-600 cursor-default'
                        : allCompleted
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] active:scale-95'
                            : 'bg-slate-800/50 text-slate-600 border border-white/5'
                        }`}
                >
                    {claiming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : alreadyClaimed ? (
                        <>
                            <ShieldCheck className="w-4 h-4" />
                            {t('telegram_reward.already_claimed')}
                        </>
                    ) : (
                        <>
                            <Gift className="w-4 h-4 group-hover/btn:animate-bounce" />
                            {t('telegram_reward.claim_bonus')}
                        </>
                    )}
                </button>

                {!allCompleted && !alreadyClaimed && (
                    <div className="mt-4 flex items-center justify-between text-[7px] font-mono-tech text-slate-600 uppercase tracking-widest">
                        <span>[ SYSTEM: LOCK_ACTIVE ]</span>
                        <span className="animate-pulse">AWAITING_TASKS...</span>
                    </div>
                )}
            </div>

            {/* DECORATIVE CORNER */}
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-br from-transparent to-indigo-500/5 pointer-events-none"></div>
        </div>
    );
};

export default TelegramRewardPanel;
