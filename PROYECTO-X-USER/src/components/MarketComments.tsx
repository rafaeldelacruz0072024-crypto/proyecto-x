import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, Trash2, Send, MessageCircle, Activity, TrendingUp } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Comment {
    id: string;
    market_id: string;
    user_id: string;
    content: string;
    likes: number;
    created_at: string;
    profiles: { email: string; username: string | null } | null;
}

interface RecentBet {
    id: string;
    user_id: string;
    option_id: string;
    amount: number;
    price_at_bet: number;
    created_at: string;
    profiles: { email: string; username: string | null } | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return 'ahora';
}

function userLabel(profile: { email: string; username: string | null } | null): string {
    if (!profile) return 'Usuario';
    return profile.username || profile.email.split('@')[0];
}

function avatarLetter(profile: { email: string; username: string | null } | null): string {
    return userLabel(profile)[0]?.toUpperCase() || '?';
}

// Consistent color per user_id
const AVATAR_COLORS = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600',
    'bg-rose-600', 'bg-yellow-600', 'bg-cyan-600',
    'bg-orange-600', 'bg-pink-600', 'bg-indigo-600',
];
function avatarColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ═══════════════════════════════════════════════════════════════════════════
type Tab = 'comments' | 'activity' | 'holders';

export default function MarketComments({
    marketId,
    options,
    user,
}: {
    marketId: string;
    options: { id: string; label: string; pool: number }[];
    user: any;
}) {
    const [tab, setTab] = useState<Tab>('comments');
    const [comments, setComments] = useState<Comment[]>([]);
    const [bets, setBets] = useState<RecentBet[]>([]);
    const [holders, setHolders] = useState<any[]>([]);
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const MAX = 400;

    // ── Fetch comments ───────────────────────────────────────────────────
    const fetchComments = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('prediction_market_comments')
            .select('*, profiles(email, username)')
            .eq('market_id', marketId)
            .order('created_at', { ascending: false })
            .limit(80);
        setComments(data || []);
        setLoading(false);
    }, [marketId]);

    // ── Fetch recent bets ────────────────────────────────────────────────
    const fetchBets = useCallback(async () => {
        const { data } = await supabase
            .from('prediction_bets')
            .select('id, user_id, option_id, amount, price_at_bet, created_at, profiles(email, username)')
            .eq('market_id', marketId)
            .order('created_at', { ascending: false })
            .limit(30);
        setBets(data || []);
    }, [marketId]);

    // ── Fetch top holders ────────────────────────────────────────────────
    const fetchHolders = useCallback(async () => {
        const { data } = await supabase
            .from('prediction_bets')
            .select('user_id, amount, option_id, profiles(email, username)')
            .eq('market_id', marketId);
        if (!data) return;
        // Aggregate by user
        const map: Record<string, { amount: number; options: Record<string, number>; profile: any }> = {};
        data.forEach((b: any) => {
            if (!map[b.user_id]) map[b.user_id] = { amount: 0, options: {}, profile: b.profiles };
            map[b.user_id].amount += Number(b.amount);
            map[b.user_id].options[b.option_id] = (map[b.user_id].options[b.option_id] || 0) + Number(b.amount);
        });
        const sorted = Object.entries(map)
            .map(([userId, v]) => ({ userId, ...v }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 20);
        setHolders(sorted);
    }, [marketId]);

    useEffect(() => { fetchComments(); }, [fetchComments]);
    useEffect(() => { if (tab === 'activity') fetchBets(); }, [tab, fetchBets]);
    useEffect(() => { if (tab === 'holders') fetchHolders(); }, [tab, fetchHolders]);

    // ── Real-time comments ───────────────────────────────────────────────
    useEffect(() => {
        const ch = supabase.channel(`comments_${marketId}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public',
                table: 'prediction_market_comments',
                filter: `market_id=eq.${marketId}`,
            }, () => fetchComments())
            .on('postgres_changes', {
                event: 'DELETE', schema: 'public',
                table: 'prediction_market_comments',
                filter: `market_id=eq.${marketId}`,
            }, () => fetchComments())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [marketId, fetchComments]);

    // ── Submit comment ───────────────────────────────────────────────────
    async function submit() {
        const trimmed = text.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        const { error } = await supabase.from('prediction_market_comments').insert({
            market_id: marketId,
            user_id: user.id,
            content: trimmed,
        });
        if (!error) { setText(''); fetchComments(); }
        setSubmitting(false);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
    }

    // ── Like ─────────────────────────────────────────────────────────────
    async function toggleLike(comment: Comment) {
        const alreadyLiked = likedIds.has(comment.id);
        const newLikes = alreadyLiked ? comment.likes - 1 : comment.likes + 1;
        setLikedIds(prev => {
            const s = new Set(prev);
            alreadyLiked ? s.delete(comment.id) : s.add(comment.id);
            return s;
        });
        setComments(prev => prev.map(c => c.id === comment.id ? { ...c, likes: newLikes } : c));
        await supabase.from('prediction_market_comments')
            .update({ likes: newLikes }).eq('id', comment.id);
    }

    // ── Delete ───────────────────────────────────────────────────────────
    async function deleteComment(id: string) {
        await supabase.from('prediction_market_comments').delete().eq('id', id);
        setComments(prev => prev.filter(c => c.id !== id));
    }

    const TABS: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
        { key: 'comments', label: 'Comentarios', icon: MessageCircle, count: comments.length },
        { key: 'holders',  label: 'Top Holders',  icon: TrendingUp },
        { key: 'activity', label: 'Actividad',    icon: Activity,   count: bets.length || undefined },
    ];

    return (
        <div className="bg-black/30 border border-white/8 clip-corner overflow-hidden">
            {/* ── Tabs ─────────────────────────────────────────────── */}
            <div className="flex border-b border-white/8">
                {TABS.map(t => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 ${
                                active
                                    ? 'border-proyecto-accent text-white'
                                    : 'border-transparent text-slate-600 hover:text-slate-400'
                            }`}
                        >
                            <Icon size={11} />
                            {t.label}
                            {t.count !== undefined && t.count > 0 && (
                                <span className={`text-[8px] px-1.5 py-0.5 clip-corner-sm font-black ${
                                    active ? 'bg-proyecto-accent/20 text-proyecto-accent' : 'bg-white/5 text-slate-600'
                                }`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── COMMENTS TAB ─────────────────────────────────────── */}
            {tab === 'comments' && (
                <div>
                    {/* Input */}
                    <div className="p-4 border-b border-white/5">
                        <div className="flex gap-3">
                            <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm ${avatarColor(user?.id || '')}`}>
                                {user?.email?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 space-y-2">
                                <textarea
                                    ref={inputRef}
                                    value={text}
                                    onChange={e => setText(e.target.value.slice(0, MAX))}
                                    onKeyDown={onKeyDown}
                                    placeholder="Añade un comentario... (Ctrl+Enter para enviar)"
                                    rows={2}
                                    className="w-full bg-white/5 border border-white/8 clip-corner-sm px-4 py-3 text-xs text-white placeholder-slate-600 outline-none focus:border-proyecto-accent/40 resize-none transition-all font-mono"
                                />
                                <div className="flex items-center justify-between">
                                    <span className={`text-[9px] font-mono ${text.length > MAX * 0.85 ? 'text-yellow-500' : 'text-slate-700'}`}>
                                        {text.length}/{MAX}
                                    </span>
                                    <button
                                        onClick={submit}
                                        disabled={!text.trim() || submitting}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-proyecto-accent/10 hover:bg-proyecto-accent/20 text-proyecto-accent border border-proyecto-accent/20 clip-corner-sm text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <Send size={10} />
                                        Publicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comments list */}
                    <div className="divide-y divide-white/5 max-h-96 overflow-y-auto scrollbar-none">
                        {loading ? (
                            <div className="p-6 text-center">
                                <div className="w-5 h-5 border-2 border-proyecto-accent/30 border-t-proyecto-accent rounded-full animate-spin mx-auto" />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="py-10 text-center">
                                <MessageCircle size={28} className="text-slate-800 mx-auto mb-2" />
                                <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest">
                                    Sin comentarios aún · ¡Sé el primero!
                                </p>
                            </div>
                        ) : (
                            comments.map(c => (
                                <CommentRow
                                    key={c.id}
                                    comment={c}
                                    currentUserId={user?.id}
                                    liked={likedIds.has(c.id)}
                                    onLike={() => toggleLike(c)}
                                    onDelete={() => deleteComment(c.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ── TOP HOLDERS TAB ──────────────────────────────────── */}
            {tab === 'holders' && (
                <div className="divide-y divide-white/5 max-h-96 overflow-y-auto scrollbar-none">
                    {holders.length === 0 ? (
                        <div className="py-10 text-center">
                            <TrendingUp size={28} className="text-slate-800 mx-auto mb-2" />
                            <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest">Sin posiciones aún</p>
                        </div>
                    ) : holders.map((h, i) => {
                        const topOption = Object.entries(h.options as Record<string, number>)
                            .sort((a, b) => b[1] - a[1])[0];
                        const optLabel = options.find(o => o.id === topOption?.[0])?.label || topOption?.[0];
                        return (
                            <div key={h.userId} className="flex items-center gap-3 px-4 py-3">
                                <span className="text-[9px] font-black text-slate-600 w-4">{i + 1}</span>
                                <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs ${avatarColor(h.userId)}`}>
                                    {avatarLetter(h.profile)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-white truncate">{userLabel(h.profile)}</p>
                                    <p className="text-[9px] font-mono text-slate-600">{optLabel}</p>
                                </div>
                                <span className="text-sm font-black font-mono text-proyecto-accent">${h.amount.toFixed(2)}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── ACTIVITY TAB ─────────────────────────────────────── */}
            {tab === 'activity' && (
                <div className="divide-y divide-white/5 max-h-96 overflow-y-auto scrollbar-none">
                    {bets.length === 0 ? (
                        <div className="py-10 text-center">
                            <Activity size={28} className="text-slate-800 mx-auto mb-2" />
                            <p className="text-[9px] text-slate-700 font-black uppercase tracking-widest">Sin actividad aún</p>
                        </div>
                    ) : bets.map(b => {
                        const opt = options.find(o => o.id === b.option_id);
                        const isUp = b.option_id === options[0]?.id;
                        return (
                            <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                                <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xs ${avatarColor(b.user_id)}`}>
                                    {avatarLetter(b.profiles)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-400">
                                        <span className="text-white font-bold">{userLabel(b.profiles)}</span>
                                        {' apostó '}
                                        <span className={`font-black ${isUp ? 'text-green-400' : 'text-rose-400'}`}>
                                            {opt?.label || b.option_id}
                                        </span>
                                    </p>
                                    <p className="text-[9px] text-slate-600 font-mono">{timeAgo(b.created_at)}</p>
                                </div>
                                <span className={`text-sm font-black font-mono ${isUp ? 'text-green-400' : 'text-rose-400'}`}>
                                    ${Number(b.amount).toFixed(2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Single Comment Row ──────────────────────────────────────────────────────
function CommentRow({
    comment, currentUserId, liked, onLike, onDelete,
}: {
    comment: Comment;
    currentUserId: string;
    liked: boolean;
    onLike: () => void;
    onDelete: () => void;
}) {
    const isOwn = comment.user_id === currentUserId;
    const [showDelete, setShowDelete] = useState(false);

    return (
        <div
            className="flex gap-3 px-4 py-3.5 hover:bg-white/[0.02] transition-colors group"
            onMouseEnter={() => setShowDelete(true)}
            onMouseLeave={() => setShowDelete(false)}
        >
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm ${avatarColor(comment.user_id)}`}>
                {avatarLetter(comment.profiles)}
            </div>

            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-black text-slate-300">
                        {userLabel(comment.profiles)}
                    </span>
                    <span className="text-[9px] text-slate-700 font-mono">
                        {timeAgo(comment.created_at)}
                    </span>
                </div>

                {/* Content */}
                <p className="text-xs text-slate-300 leading-relaxed break-words">
                    {comment.content}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-4 mt-2">
                    <button
                        onClick={onLike}
                        className={`flex items-center gap-1 text-[9px] font-black transition-all ${
                            liked ? 'text-rose-400' : 'text-slate-600 hover:text-rose-400'
                        }`}
                    >
                        <Heart size={11} fill={liked ? 'currentColor' : 'none'} />
                        {comment.likes > 0 ? comment.likes : ''}
                    </button>
                    {isOwn && showDelete && (
                        <button
                            onClick={onDelete}
                            className="flex items-center gap-1 text-[9px] font-black text-slate-700 hover:text-rose-500 transition-colors"
                        >
                            <Trash2 size={10} />
                            Borrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
