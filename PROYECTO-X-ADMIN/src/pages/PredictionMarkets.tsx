import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    TrendingUp,
    Plus,
    Search,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
    DollarSign,
    Users,
    BarChart2,
    ChevronDown,
    X,
    Save,
    AlertTriangle,
    Eye,
    Edit3,
    Trash2,
    Ban,
    Globe,
    Download,
    Trophy,
    Swords,
    PlusCircle,
    MinusCircle
} from 'lucide-react';

interface PredictionOption {
    id: string;
    label: string;
    pool: number;
}

interface PredictionMarket {
    id: string;
    title: string;
    description: string;
    category: string;
    image_url: string | null;
    options: PredictionOption[];
    total_pool: number;
    status: 'OPEN' | 'CLOSED' | 'RESOLVED' | 'CANCELLED';
    winning_option: string | null;
    house_fee_pct: number;
    closes_at: string;
    resolves_at: string | null;
    resolved_at: string | null;
    created_at: string;
}

interface BetRecord {
    id: string;
    user_id: string;
    option_id: string;
    amount: number;
    shares: number;
    price_at_bet: number;
    payout: number | null;
    status: string;
    created_at: string;
    profiles: { username: string; email: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
    OPEN: 'bg-green-500/10 text-green-400 border-green-500/20',
    CLOSED: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    RESOLVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const CATEGORIES = ['CRYPTO', 'SPORTS', 'POLITICS', 'ECONOMY', 'TECH', 'OTHER'];

const PredictionMarkets: React.FC = () => {
    const [markets, setMarkets] = useState<PredictionMarket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBetsModal, setShowBetsModal] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<PredictionMarket | null>(null);
    const [bets, setBets] = useState<BetRecord[]>([]);
    const [loadingBets, setLoadingBets] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [showPolyImporter, setShowPolyImporter] = useState(false);
    const [polyMarkets, setPolyMarkets] = useState<any[]>([]);
    const [polyLoading, setPolyLoading] = useState(false);
    const [polySelected, setPolySelected] = useState<Set<string>>(new Set());
    const [polyImporting, setPolyImporting] = useState(false);
    const [polySearch, setPolySearch] = useState('');
    const [polyCatFilter, setPolyCatFilter] = useState('ALL');
    const [polyOffset, setPolyOffset] = useState(0);
    const [polyHasMore, setPolyHasMore] = useState(true);
    const [polyLoadingMore, setPolyLoadingMore] = useState(false);
    const [polyDetailMarket, setPolyDetailMarket] = useState<any | null>(null);
    const [polyDetailForm, setPolyDetailForm] = useState({ titleEs: '', descEs: '', category: 'CRYPTO', house_fee_pct: 2, closes_at: '' });
    const [polyDetailTranslating, setPolyDetailTranslating] = useState(false);
    const [polyDetailImporting, setPolyDetailImporting] = useState(false);
    const [polyFetchTag, setPolyFetchTag] = useState<'crypto' | 'sports'>('crypto');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMarket, setEditingMarket] = useState<PredictionMarket | null>(null);
    const [showSportsModal, setShowSportsModal] = useState(false);
    const [savingSports, setSavingSports] = useState(false);
    const [sportsForm, setSportsForm] = useState({
        sport: '⚽ Fútbol',
        league: '',
        homeTeam: '',
        awayTeam: '',
        matchDate: '',
        closesAt: '',
        house_fee_pct: 2,
        image_url: '',
        incluirEmpate: true,
        extraOptions: [] as string[],
    });
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        category: 'CRYPTO',
        image_url: '',
        house_fee_pct: 2,
        closes_at: '',
        resolves_at: '',
        options: [] as { id: string; label: string }[],
    });

    // Create form
    const [form, setForm] = useState({
        title: '',
        description: '',
        category: 'CRYPTO',
        image_url: '',
        house_fee_pct: 2,
        closes_at: '',
        resolves_at: '',
        options: [
            { id: 'A', label: 'Sí' },
            { id: 'B', label: 'No' },
        ]
    });

    useEffect(() => {
        fetchMarkets();
    }, []);

    async function fetchMarkets() {
        setLoading(true);
        const { data, error } = await supabase
            .from('prediction_markets')
            .select('*')
            .order('created_at', { ascending: false });
        if (!error) setMarkets(data || []);
        setLoading(false);
    }

    async function fetchBets(marketId: string) {
        setLoadingBets(true);
        const { data } = await supabase
            .from('prediction_bets')
            .select(`*, profiles(username, email)`)
            .eq('market_id', marketId)
            .order('created_at', { ascending: false });
        setBets(data || []);
        setLoadingBets(false);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.title || !form.closes_at || form.options.some(o => !o.label)) return;
        setSaving(true);
        try {
            const options = form.options.map(o => ({ id: o.id, label: o.label, pool: 0 }));
            const { error } = await supabase.from('prediction_markets').insert([{
                title: form.title,
                description: form.description || null,
                category: form.category,
                image_url: form.image_url || null,
                house_fee_pct: form.house_fee_pct,
                closes_at: form.closes_at,
                resolves_at: form.resolves_at || null,
                options,
                status: 'OPEN',
            }]);
            if (error) throw error;
            setShowCreateModal(false);
            resetForm();
            fetchMarkets();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleResolve(market: PredictionMarket, winningOption: string) {
        if (!window.confirm(`¿Resolver mercado "${market.title}" con ganador: "${winningOption}"?`)) return;
        setResolving(true);
        try {
            const { data, error } = await supabase.rpc('resolve_prediction_market', {
                p_market_id: market.id,
                p_winning_option: winningOption,
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || 'Error desconocido');
            alert(`✅ Resuelto. Ganadores: ${data.winners} | Pagado: $${Number(data.total_paid).toFixed(2)} | Fee: $${Number(data.house_fee).toFixed(2)}`);
            fetchMarkets();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setResolving(false);
        }
    }

    async function handleClose(market: PredictionMarket) {
        if (!window.confirm(`¿Cerrar apuestas del mercado "${market.title}"?`)) return;
        const { error } = await supabase
            .from('prediction_markets')
            .update({ status: 'CLOSED' })
            .eq('id', market.id);
        if (!error) fetchMarkets();
    }

    async function handleCancel(market: PredictionMarket) {
        if (!window.confirm(`¿Cancelar y reembolsar "${market.title}"? Esta acción reembolsará a todos los apostadores.`)) return;
        // Cancel = mark as CANCELLED, refund all
        const { error } = await supabase
            .from('prediction_markets')
            .update({ status: 'CANCELLED' })
            .eq('id', market.id);
        if (!error) {
            // Refund all bets
            const { data: activeBets } = await supabase
                .from('prediction_bets')
                .select('*')
                .eq('market_id', market.id)
                .eq('status', 'ACTIVE');
            for (const bet of (activeBets || [])) {
                const { data: refundData, error: refundError } = await supabase.rpc('admin_refund_bet', { p_bet_id: bet.id });
                if (refundError) throw refundError;
                if (refundData && !refundData.success) throw new Error(refundData.error || refundData.message || 'El RPC rechazÃ³ el reembolso.');
            }
            fetchMarkets();
        }
    }

    function resetForm() {
        setForm({
            title: '',
            description: '',
            category: 'CRYPTO',
            image_url: '',
            house_fee_pct: 2,
            closes_at: '',
            resolves_at: '',
            options: [{ id: 'A', label: 'Sí' }, { id: 'B', label: 'No' }]
        });
    }

    function openEdit(market: PredictionMarket) {
        setEditingMarket(market);
        setEditForm({
            title: market.title,
            description: market.description || '',
            category: market.category,
            image_url: market.image_url || '',
            house_fee_pct: market.house_fee_pct,
            closes_at: market.closes_at ? new Date(market.closes_at).toISOString().slice(0, 16) : '',
            resolves_at: market.resolves_at ? new Date(market.resolves_at).toISOString().slice(0, 16) : '',
            options: market.options.map(o => ({ id: o.id, label: o.label })),
        });
        setShowEditModal(true);
    }

    async function handleEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editingMarket) return;
        setSaving(true);
        try {
            // Merge pool data from existing options
            const updatedOptions = editForm.options.map(o => {
                const existing = editingMarket.options.find(ex => ex.id === o.id);
                return { id: o.id, label: o.label, pool: existing?.pool ?? 0 };
            });
            const { error } = await supabase.from('prediction_markets').update({
                title: editForm.title,
                description: editForm.description || null,
                category: editForm.category,
                image_url: editForm.image_url || null,
                house_fee_pct: editForm.house_fee_pct,
                closes_at: editForm.closes_at,
                resolves_at: editForm.resolves_at || null,
                options: updatedOptions,
            }).eq('id', editingMarket.id);
            if (error) throw error;
            setShowEditModal(false);
            setEditingMarket(null);
            fetchMarkets();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(market: PredictionMarket) {
        if (!window.confirm(`⚠️ ¿ELIMINAR permanentemente el mercado "${market.title}"?\n\nEsto eliminará todas las apuestas asociadas.`)) return;
        const { error } = await supabase.from('prediction_markets').delete().eq('id', market.id);
        if (error) alert('Error: ' + error.message);
        else fetchMarkets();
    }

    const POLY_BATCH = 100;

    async function openPolyImporter(tag: 'crypto' | 'sports' = 'crypto') {
        setShowPolyImporter(true);
        setPolyFetchTag(tag);
        setPolySelected(new Set());
        setPolySearch('');
        setPolyCatFilter('ALL');
        setPolyOffset(0);
        setPolyHasMore(true);
        setPolyLoading(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
            const res = await fetch(
                `${supabaseUrl}/functions/v1/polymarket-proxy?limit=${POLY_BATCH}&offset=0&order=volumeNum&tag=${tag}`,
                { headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const existingPolyIds = markets.map(m => (m as any).polymarket_id).filter(Boolean);
            const filtered = data.filter((m: any) => !existingPolyIds.includes(m.id));
            setPolyMarkets(filtered);
            setPolyOffset(POLY_BATCH);
            setPolyHasMore(data.length === POLY_BATCH);
        } catch (e: any) {
            alert('Error al cargar Polymarket: ' + e.message);
            setShowPolyImporter(false);
        } finally {
            setPolyLoading(false);
        }
    }

    async function loadMorePolyMarkets() {
        setPolyLoadingMore(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
            const res = await fetch(
                `${supabaseUrl}/functions/v1/polymarket-proxy?limit=${POLY_BATCH}&offset=${polyOffset}&order=volumeNum&tag=${polyFetchTag}`,
                { headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` } }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const existingPolyIds = markets.map(m => (m as any).polymarket_id).filter(Boolean);
            const newItems = data.filter((m: any) => !existingPolyIds.includes(m.id) && !polyMarkets.find(p => p.id === m.id));
            setPolyMarkets(prev => [...prev, ...newItems]);
            setPolyOffset(prev => prev + POLY_BATCH);
            setPolyHasMore(data.length === POLY_BATCH);
        } catch (e: any) {
            alert('Error al cargar más mercados: ' + e.message);
        } finally {
            setPolyLoadingMore(false);
        }
    }

    async function loadAllPolyMarkets() {
        setPolyLoadingMore(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
            const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
            const existingPolyIds = markets.map(m => (m as any).polymarket_id).filter(Boolean);
            let currentOffset = polyOffset;
            let allNew: any[] = [];
            let hasMore = true;
            while (hasMore) {
                const res = await fetch(
                    `${supabaseUrl}/functions/v1/polymarket-proxy?limit=${POLY_BATCH}&offset=${currentOffset}&order=volumeNum&tag=${polyFetchTag}`,
                    { headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}` } }
                );
                if (!res.ok) break;
                const data = await res.json();
                const newItems = data.filter((m: any) => !existingPolyIds.includes(m.id) && !polyMarkets.find(p => p.id === m.id) && !allNew.find(p => p.id === m.id));
                allNew = [...allNew, ...newItems];
                currentOffset += POLY_BATCH;
                hasMore = data.length === POLY_BATCH;
            }
            setPolyMarkets(prev => [...prev, ...allNew]);
            setPolyOffset(currentOffset);
            setPolyHasMore(false);
        } catch (e: any) {
            alert('Error al cargar todos los mercados: ' + e.message);
        } finally {
            setPolyLoadingMore(false);
        }
    }

    async function translateTexts(texts: string[]): Promise<string[]> {
        if (texts.length === 0) return [];
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        try {
            const res = await fetch(`${supabaseUrl}/functions/v1/translate-text`, {
                method: 'POST',
                headers: { apikey: supabaseAnon, Authorization: `Bearer ${supabaseAnon}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts }),
            });
            if (!res.ok) return texts;
            const data = await res.json();
            return data.translations || texts;
        } catch { return texts; }
    }

    async function openPolyDetail(pm: any) {
        const cat = (pm.category || 'CRYPTO').toUpperCase().split('/')[0].trim();
        const tagDefault = polyFetchTag === 'sports' ? 'SPORTS' : 'CRYPTO';
        const mappedCat = ['CRYPTO', 'SPORTS', 'POLITICS', 'ECONOMY', 'TECH'].includes(cat) ? cat : tagDefault;
        setPolyDetailForm({
            titleEs: pm.question,
            descEs: pm.description || '',
            category: mappedCat,
            house_fee_pct: 2,
            closes_at: pm.endDate ? new Date(pm.endDate).toISOString().slice(0, 16) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16),
        });
        setPolyDetailMarket(pm);
        setPolyDetailTranslating(true);
        try {
            const toTranslate = [pm.question, pm.description || ''].filter((t: string) => t.trim());
            const translated = await translateTexts(toTranslate);
            const hasDesc = (pm.description || '').trim().length > 0;
            setPolyDetailForm(f => ({
                ...f,
                titleEs: translated[0] || pm.question,
                descEs: hasDesc ? (translated[1] || pm.description || '') : '',
            }));
        } catch { /* keep originals */ }
        setPolyDetailTranslating(false);
    }

    async function importSingleMarket() {
        if (!polyDetailMarket) return;
        setPolyDetailImporting(true);
        try {
            const pm = polyDetailMarket;
            const outcomes: string[] = (() => { try { return JSON.parse(pm.outcomes || '["Sí","No"]'); } catch { return ['Sí', 'No']; } })();
            const options = outcomes.map((label: string, i: number) => ({ id: String.fromCharCode(65 + i), label, pool: 0 }));
            const { error } = await supabase.from('prediction_markets').insert({
                title: polyDetailForm.titleEs,
                description: polyDetailForm.descEs || null,
                category: polyDetailForm.category,
                image_url: pm.image || null,
                house_fee_pct: polyDetailForm.house_fee_pct,
                closes_at: polyDetailForm.closes_at,
                resolves_at: polyDetailForm.closes_at || null,
                options,
                status: 'OPEN',
                polymarket_id: pm.id,
                external_source: 'POLYMARKET',
                external_url: `https://polymarket.com/event/${pm.slug || pm.id}`,
            });
            if (error) throw error;
            setPolyDetailMarket(null);
            setShowPolyImporter(false);
            fetchMarkets();
            alert('✅ Mercado importado con éxito en español.');
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setPolyDetailImporting(false);
        }
    }

    async function importSelected() {
        if (polySelected.size === 0) return;
        setPolyImporting(true);
        const selectedPMs = ([...polySelected] as string[]).map(id => polyMarkets.find((m: any) => m.id === id)).filter(Boolean) as any[];
        // Translate all titles to Spanish at once
        const titleMap: Record<string, string> = {};
        try {
            const translations = await translateTexts(selectedPMs.map((pm: any) => pm.question));
            selectedPMs.forEach((pm: any, i: number) => { titleMap[pm.id] = translations[i] || pm.question; });
        } catch {
            selectedPMs.forEach((pm: any) => { titleMap[pm.id] = pm.question; });
        }
        let imported = 0;
        for (const pm of selectedPMs) {
            try {
                const outcomes: string[] = (() => { try { return JSON.parse(pm.outcomes || '["Sí","No"]'); } catch { return ['Sí', 'No']; } })();
                const options = outcomes.map((label: string, i: number) => ({ id: String.fromCharCode(65 + i), label, pool: 0 }));
                const cat = (pm.category || 'CRYPTO').toUpperCase().split('/')[0].trim().substring(0, 10);
                const tagDefault = polyFetchTag === 'sports' ? 'SPORTS' : 'CRYPTO';
                await supabase.from('prediction_markets').insert({
                    title: titleMap[pm.id] || pm.question,
                    description: pm.description || null,
                    category: ['CRYPTO', 'SPORTS', 'POLITICS', 'ECONOMY', 'TECH'].includes(cat) ? cat : tagDefault,
                    image_url: pm.image || null,
                    house_fee_pct: 2,
                    closes_at: pm.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
                    resolves_at: pm.endDate || null,
                    options,
                    status: 'OPEN',
                    polymarket_id: pm.id,
                    external_source: 'POLYMARKET',
                    external_url: `https://polymarket.com/event/${pm.slug || pm.id}`,
                });
                imported++;
            } catch (_) {}
        }
        setPolyImporting(false);
        setShowPolyImporter(false);
        fetchMarkets();
        alert(`✅ ${imported} mercados importados de Polymarket (en español).`);
    }

    function resetSportsForm() {
        setSportsForm({
            sport: '⚽ Fútbol',
            league: '',
            homeTeam: '',
            awayTeam: '',
            matchDate: '',
            closesAt: '',
            house_fee_pct: 2,
            image_url: '',
            incluirEmpate: true,
            extraOptions: [] as string[],
        });
    }

    async function handleCreateSports(e: React.FormEvent) {
        e.preventDefault();
        if (!sportsForm.homeTeam.trim() || !sportsForm.awayTeam.trim() || !sportsForm.matchDate) return;
        setSavingSports(true);
        try {
            const options: { id: string; label: string; pool: number }[] = [
                { id: 'A', label: `${sportsForm.homeTeam.trim()} Gana`, pool: 0 },
            ];
            if (sportsForm.incluirEmpate) {
                options.push({ id: 'B', label: 'Empate', pool: 0 });
                options.push({ id: 'C', label: `${sportsForm.awayTeam.trim()} Gana`, pool: 0 });
            } else {
                options.push({ id: 'B', label: `${sportsForm.awayTeam.trim()} Gana`, pool: 0 });
            }
            sportsForm.extraOptions.forEach((label) => {
                if (label.trim()) {
                    options.push({ id: String.fromCharCode(65 + options.length), label: label.trim(), pool: 0 });
                }
            });

            const { error } = await supabase.from('prediction_markets').insert([{
                title: `${sportsForm.homeTeam.trim()} vs ${sportsForm.awayTeam.trim()}`,
                description: `${sportsForm.sport}${sportsForm.league ? ' · ' + sportsForm.league : ''}`,
                category: 'SPORTS',
                image_url: sportsForm.image_url || null,
                house_fee_pct: sportsForm.house_fee_pct,
                closes_at: sportsForm.closesAt || sportsForm.matchDate,
                resolves_at: sportsForm.matchDate,
                options,
                status: 'OPEN',
            }]);
            if (error) throw error;
            setShowSportsModal(false);
            resetSportsForm();
            fetchMarkets();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSavingSports(false);
        }
    }

    function addOption() {
        const nextId = String.fromCharCode(65 + form.options.length);
        setForm(f => ({ ...f, options: [...f.options, { id: nextId, label: '' }] }));
    }

    function removeOption(idx: number) {
        setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
    }

    const filtered = markets.filter(m => {
        const matchStatus = statusFilter === 'ALL' || m.status === statusFilter;
        const matchSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchStatus && matchSearch;
    });

    const stats = {
        total: markets.length,
        open: markets.filter(m => m.status === 'OPEN').length,
        resolved: markets.filter(m => m.status === 'RESOLVED').length,
        totalPool: markets.reduce((acc, m) => acc + Number(m.total_pool), 0),
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <TrendingUp className="text-blue-500" /> MERCADOS DE PREDICCIÓN
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Gestión de mercados estilo Polymarket</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={() => openPolyImporter('crypto')}
                        className="flex items-center gap-2 px-5 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
                    >
                        <Globe size={16} /> IMPORTAR POLYMARKET
                    </button>
                    <button
                        onClick={() => { resetSportsForm(); setShowSportsModal(true); }}
                        className="flex items-center gap-2 px-5 py-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all active:scale-95"
                    >
                        <Trophy size={16} /> CREAR PARTIDO
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <Plus size={16} /> NUEVO MERCADO
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Mercados', value: stats.total, icon: BarChart2, color: 'blue' },
                    { label: 'Abiertos', value: stats.open, icon: Clock, color: 'green' },
                    { label: 'Resueltos', value: stats.resolved, icon: CheckCircle, color: 'purple' },
                    { label: 'Pool Total', value: `$${stats.totalPool.toFixed(2)}`, icon: DollarSign, color: 'yellow' },
                ].map((s, i) => (
                    <div key={i} className="bg-[#0c0c0e]/50 border border-slate-800/50 rounded-3xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{s.label}</p>
                            <s.icon size={16} className={`text-${s.color}-500`} />
                        </div>
                        <p className="text-2xl font-black text-white">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-[#0c0c0e]/50 border border-slate-800/50 rounded-3xl p-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Buscar mercados..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-[#111114] border border-slate-800/50 rounded-2xl py-3 pl-11 pr-6 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none"
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {['ALL', 'OPEN', 'CLOSED', 'RESOLVED', 'CANCELLED'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${statusFilter === s ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-transparent text-slate-500 border-slate-800 hover:border-slate-600'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                    <button onClick={fetchMarkets} className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all">
                        <RefreshCw size={16} />
                    </button>
                </div>

                {/* Markets Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800/50">
                                {['Mercado', 'Categoría', 'Status', 'Pool Total', 'Opciones', 'Cierra', 'Acciones'].map(h => (
                                    <th key={h} className="pb-4 px-3 text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {loading ? (
                                Array(4).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="py-4"><div className="h-8 bg-slate-900/50 rounded-xl" /></td>
                                    </tr>
                                ))
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">
                                        No hay mercados
                                    </td>
                                </tr>
                            ) : filtered.map(market => (
                                <tr key={market.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-4 px-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            {(market as any).external_source === 'POLYMARKET' && (
                                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md flex items-center gap-1">
                                                    <Globe size={8} /> Polymarket
                                                </span>
                                            )}
                                            {market.category === 'SPORTS' && (market as any).external_source !== 'POLYMARKET' && (
                                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-md flex items-center gap-1">
                                                    <Trophy size={8} /> Partido
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-white max-w-[200px] truncate">{market.title}</p>
                                        <p className="text-[9px] text-slate-600 font-mono mt-0.5">{market.id.slice(0, 8)}...</p>
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className="px-2 py-1 bg-slate-800 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-wider">{market.category}</span>
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${STATUS_STYLES[market.status]}`}>
                                            {market.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-3">
                                        <span className="font-black text-white font-mono">${Number(market.total_pool).toFixed(2)}</span>
                                    </td>
                                    <td className="py-4 px-3">
                                        <div className="space-y-1">
                                            {market.options.map(opt => {
                                                const pct = market.total_pool > 0 ? ((opt.pool / market.total_pool) * 100).toFixed(1) : '50.0';
                                                const isWinner = market.winning_option === opt.id;
                                                return (
                                                    <div key={opt.id} className="flex items-center gap-2">
                                                        <span className={`text-[9px] font-black ${isWinner ? 'text-green-400' : 'text-slate-400'}`}>
                                                            {opt.label}
                                                        </span>
                                                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full min-w-[60px]">
                                                            <div
                                                                className={`h-full rounded-full ${isWinner ? 'bg-green-500' : 'bg-blue-500'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] text-slate-500 font-mono w-10 text-right">{pct}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="py-4 px-3 text-[10px] text-slate-500 font-mono">
                                        {new Date(market.closes_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-3">
                                        <div className="flex gap-2 flex-wrap">
                                            {/* View Bets */}
                                            <button
                                                onClick={() => { setSelectedMarket(market); fetchBets(market.id); setShowBetsModal(true); }}
                                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all"
                                                title="Ver apuestas"
                                            >
                                                <Eye size={14} />
                                            </button>

                                            {/* Edit */}
                                            <button
                                                onClick={() => openEdit(market)}
                                                className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all"
                                                title="Editar mercado"
                                            >
                                                <Edit3 size={14} />
                                            </button>

                                            {/* Close */}
                                            {market.status === 'OPEN' && (
                                                <button
                                                    onClick={() => handleClose(market)}
                                                    className="px-3 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-xl font-black text-[9px] uppercase tracking-wider border border-yellow-500/10 transition-all"
                                                >
                                                    CERRAR
                                                </button>
                                            )}

                                            {/* Resolve */}
                                            {(market.status === 'OPEN' || market.status === 'CLOSED') && (
                                                <ResolveDropdown
                                                    market={market}
                                                    onResolve={(opt) => handleResolve(market, opt)}
                                                    loading={resolving}
                                                />
                                            )}

                                            {/* Delete */}
                                            {(market.status === 'CANCELLED' || market.status === 'RESOLVED') && (
                                                <button
                                                    onClick={() => handleDelete(market)}
                                                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all"
                                                    title="Eliminar mercado"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sports Market Creator Modal */}
            {showSportsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSportsModal(false)} />
                    <div className="bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-800/50 flex justify-between items-center bg-green-500/5">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <Trophy className="text-green-400" size={22} /> CREAR PARTIDO DEPORTIVO
                                </h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Apuesta de resultado de partido</p>
                            </div>
                            <button onClick={() => setShowSportsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSports} className="p-8 overflow-y-auto space-y-6">
                            {/* Sport selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deporte</label>
                                <div className="flex flex-wrap gap-2">
                                    {['⚽ Fútbol', '🏀 Baloncesto', '🎾 Tenis', '🥊 Boxeo/MMA', '⚾ Baseball', '🏈 Fut. Americano', '🏒 Hockey', '🏐 Voleibol'].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSportsForm(f => ({ ...f, sport: s, incluirEmpate: s.includes('Fútbol') }))}
                                            className={`px-4 py-2 rounded-xl font-black text-xs transition-all border ${sportsForm.sport === s ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-[#111114] text-slate-500 border-slate-800 hover:border-slate-600'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* League */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Liga / Torneo</label>
                                <input
                                    type="text"
                                    value={sportsForm.league}
                                    onChange={e => setSportsForm(f => ({ ...f, league: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all"
                                    placeholder="Ej: UEFA Champions League, NBA, Roland Garros..."
                                />
                            </div>

                            {/* Teams */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipos / Jugadores</label>
                                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
                                    <input
                                        required
                                        type="text"
                                        value={sportsForm.homeTeam}
                                        onChange={e => setSportsForm(f => ({ ...f, homeTeam: e.target.value }))}
                                        className="bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all text-center"
                                        placeholder="Local"
                                    />
                                    <div className="flex flex-col items-center gap-1">
                                        <Swords size={18} className="text-slate-600" />
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">VS</span>
                                    </div>
                                    <input
                                        required
                                        type="text"
                                        value={sportsForm.awayTeam}
                                        onChange={e => setSportsForm(f => ({ ...f, awayTeam: e.target.value }))}
                                        className="bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all text-center"
                                        placeholder="Visitante"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha del Partido *</label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={sportsForm.matchDate}
                                        onChange={e => setSportsForm(f => ({ ...f, matchDate: e.target.value, closesAt: f.closesAt || e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cierre de Apuestas *</label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={sportsForm.closesAt || sportsForm.matchDate}
                                        onChange={e => setSportsForm(f => ({ ...f, closesAt: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Options preview */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opciones de Apuesta</label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incluir Empate</span>
                                        <div
                                            onClick={() => setSportsForm(f => ({ ...f, incluirEmpate: !f.incluirEmpate }))}
                                            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${sportsForm.incluirEmpate ? 'bg-green-500' : 'bg-slate-700'}`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sportsForm.incluirEmpate ? 'left-5' : 'left-0.5'}`} />
                                        </div>
                                    </label>
                                </div>
                                <div className="bg-[#111114] border border-slate-800 rounded-2xl p-4 space-y-2">
                                    <div className="flex items-center gap-3 px-2 py-1.5">
                                        <span className="text-[9px] font-black text-green-400 w-5">A</span>
                                        <span className="text-sm text-white">{sportsForm.homeTeam || 'Equipo Local'} Gana</span>
                                    </div>
                                    {sportsForm.incluirEmpate && (
                                        <div className="flex items-center gap-3 px-2 py-1.5">
                                            <span className="text-[9px] font-black text-green-400 w-5">B</span>
                                            <span className="text-sm text-white">Empate</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 px-2 py-1.5">
                                        <span className="text-[9px] font-black text-green-400 w-5">{sportsForm.incluirEmpate ? 'C' : 'B'}</span>
                                        <span className="text-sm text-white">{sportsForm.awayTeam || 'Equipo Visitante'} Gana</span>
                                    </div>
                                    {sportsForm.extraOptions.map((opt, i) => (
                                        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                                            <span className="text-[9px] font-black text-green-400 w-5">{String.fromCharCode(65 + (sportsForm.incluirEmpate ? 3 : 2) + i)}</span>
                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={e => setSportsForm(f => ({ ...f, extraOptions: f.extraOptions.map((o, idx) => idx === i ? e.target.value : o) }))}
                                                className="flex-1 bg-transparent border-b border-slate-700 text-sm text-white outline-none focus:border-green-500/50 pb-1"
                                                placeholder="Ej: Más de 2.5 goles..."
                                            />
                                            <button type="button" onClick={() => setSportsForm(f => ({ ...f, extraOptions: f.extraOptions.filter((_, idx) => idx !== i) }))}>
                                                <MinusCircle size={14} className="text-slate-600 hover:text-red-400 transition-colors" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setSportsForm(f => ({ ...f, extraOptions: [...f.extraOptions, ''] }))}
                                        className="flex items-center gap-2 text-[10px] font-black text-slate-600 hover:text-green-400 transition-colors px-2 pt-1"
                                    >
                                        <PlusCircle size={12} /> Agregar opción extra
                                    </button>
                                </div>
                            </div>

                            {/* Fee + Image */}
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Casa (%)</label>
                                    <input
                                        type="number"
                                        min={0} max={10} step={0.5}
                                        value={sportsForm.house_fee_pct}
                                        onChange={e => setSportsForm(f => ({ ...f, house_fee_pct: Number(e.target.value) }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL Imagen (opcional)</label>
                                    <input
                                        type="url"
                                        value={sportsForm.image_url}
                                        onChange={e => setSportsForm(f => ({ ...f, image_url: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-green-500/50 transition-all"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-4">
                                <button type="button" onClick={() => setShowSportsModal(false)}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all">
                                    CANCELAR
                                </button>
                                <button type="submit" disabled={savingSports}
                                    className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-green-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {savingSports ? 'CREANDO...' : <><Trophy size={16} /> CREAR PARTIDO</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                    <div className="bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-800/50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest">NUEVO MERCADO</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-8 overflow-y-auto space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título de la pregunta *</label>
                                <input
                                    required
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    placeholder="Ej: ¿Bitcoin superará los $100k antes de junio?"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                                <textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all resize-none"
                                    placeholder="Contexto adicional del mercado..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    >
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Casa (%)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={10}
                                        step={0.5}
                                        value={form.house_fee_pct}
                                        onChange={e => setForm(f => ({ ...f, house_fee_pct: Number(e.target.value) }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cierre de apuestas *</label>
                                    <input
                                        required
                                        type="datetime-local"
                                        value={form.closes_at}
                                        onChange={e => setForm(f => ({ ...f, closes_at: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha estimada resolución</label>
                                    <input
                                        type="datetime-local"
                                        value={form.resolves_at}
                                        onChange={e => setForm(f => ({ ...f, resolves_at: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL Imagen (opcional)</label>
                                <input
                                    type="url"
                                    value={form.image_url}
                                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    placeholder="https://..."
                                />
                            </div>

                            {/* Options */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Opciones de apuesta *</label>
                                    <button
                                        type="button"
                                        onClick={addOption}
                                        disabled={form.options.length >= 6}
                                        className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider disabled:opacity-40"
                                    >
                                        + AÑADIR OPCIÓN
                                    </button>
                                </div>
                                {form.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-400">
                                            {opt.id}
                                        </div>
                                        <input
                                            required
                                            type="text"
                                            value={opt.label}
                                            onChange={e => setForm(f => ({
                                                ...f,
                                                options: f.options.map((o, i) => i === idx ? { ...o, label: e.target.value } : o)
                                            }))}
                                            className="flex-1 bg-[#111114] border border-slate-800 rounded-2xl py-3 px-5 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                            placeholder={`Etiqueta opción ${opt.id}`}
                                        />
                                        {form.options.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeOption(idx)}
                                                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? 'CREANDO...' : <><Save size={16} /> CREAR MERCADO</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bets Modal */}
            {showBetsModal && selectedMarket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowBetsModal(false)} />
                    <div className="bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] w-full max-w-3xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-widest">APUESTAS DEL MERCADO</h2>
                                <p className="text-xs text-slate-500 mt-1 truncate max-w-md">{selectedMarket.title}</p>
                            </div>
                            <button onClick={() => setShowBetsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {/* Market summary */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div className="bg-[#111114] border border-slate-800/50 rounded-2xl p-4 text-center">
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Pool Total</p>
                                    <p className="text-lg font-black text-white font-mono">${Number(selectedMarket.total_pool).toFixed(2)}</p>
                                </div>
                                <div className="bg-[#111114] border border-slate-800/50 rounded-2xl p-4 text-center">
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Apuestas</p>
                                    <p className="text-lg font-black text-white">{bets.length}</p>
                                </div>
                                {selectedMarket.options.map(opt => {
                                    const pct = selectedMarket.total_pool > 0 ? ((opt.pool / selectedMarket.total_pool) * 100).toFixed(1) : '50.0';
                                    return (
                                        <div key={opt.id} className={`bg-[#111114] border rounded-2xl p-4 text-center ${selectedMarket.winning_option === opt.id ? 'border-green-500/30' : 'border-slate-800/50'}`}>
                                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">{opt.label}</p>
                                            <p className="text-lg font-black text-white font-mono">{pct}%</p>
                                            <p className="text-[9px] text-slate-600 font-mono">${Number(opt.pool).toFixed(2)}</p>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Bets table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-800/50">
                                            {['Usuario', 'Opción', 'Apostado', 'Shares', 'Precio', 'Payout', 'Status', 'Fecha'].map(h => (
                                                <th key={h} className="pb-3 px-2 text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/30">
                                        {loadingBets ? (
                                            <tr><td colSpan={8} className="py-8 text-center text-slate-600 text-xs">Cargando...</td></tr>
                                        ) : bets.length === 0 ? (
                                            <tr><td colSpan={8} className="py-8 text-center text-slate-600 font-bold uppercase text-xs">Sin apuestas</td></tr>
                                        ) : bets.map(bet => {
                                            const optLabel = selectedMarket.options.find(o => o.id === bet.option_id)?.label || bet.option_id;
                                            return (
                                                <tr key={bet.id} className="hover:bg-white/[0.02]">
                                                    <td className="py-3 px-2">
                                                        <p className="text-xs font-bold text-white">{bet.profiles?.username || '—'}</p>
                                                        <p className="text-[8px] text-slate-600">{bet.profiles?.email}</p>
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${selectedMarket.winning_option === bet.option_id ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-400'}`}>
                                                            {optLabel}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 font-mono text-xs text-white">${Number(bet.amount).toFixed(2)}</td>
                                                    <td className="py-3 px-2 font-mono text-[10px] text-slate-400">{Number(bet.shares).toFixed(4)}</td>
                                                    <td className="py-3 px-2 font-mono text-[10px] text-slate-400">{(Number(bet.price_at_bet) * 100).toFixed(1)}%</td>
                                                    <td className="py-3 px-2 font-mono text-xs">
                                                        {bet.payout != null ? <span className="text-green-400">${Number(bet.payout).toFixed(2)}</span> : <span className="text-slate-600">—</span>}
                                                    </td>
                                                    <td className="py-3 px-2">
                                                        <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${bet.status === 'WON' ? 'bg-green-500/10 text-green-400' : bet.status === 'LOST' ? 'bg-rose-500/10 text-rose-400' : bet.status === 'REFUNDED' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-slate-800 text-slate-400'}`}>
                                                            {bet.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-2 text-[9px] text-slate-600 font-mono">
                                                        {new Date(bet.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Polymarket Importer Modal */}
            {showPolyImporter && (() => {
                const polyUniqueCats = ['ALL', ...Array.from(new Set(polyMarkets.map(m => m.category).filter(Boolean))).sort()];
                const polyVisible = polyMarkets.filter(m => {
                    const matchSearch = polySearch === '' || m.question?.toLowerCase().includes(polySearch.toLowerCase());
                    const matchCat = polyCatFilter === 'ALL' || m.category === polyCatFilter;
                    return matchSearch && matchCat;
                });
                return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowPolyImporter(false)} />
                    <div className="bg-[#0c0c0e] border border-purple-900/50 rounded-[2.5rem] w-full max-w-4xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">

                        {/* Header */}
                        <div className="p-6 border-b border-slate-800/50" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.05), transparent)' }}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                        <Globe size={20} className="text-purple-400" /> IMPORTAR DE POLYMARKET
                                    </h2>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {polyMarkets.length} mercados cargados · {polyVisible.length} visibles · {polySelected.size} seleccionados
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {polySelected.size > 0 && (
                                        <span className="text-xs font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-xl">
                                            {polySelected.size} sel.
                                        </span>
                                    )}
                                    <button onClick={() => setShowPolyImporter(false)} className="text-slate-500 hover:text-white transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>

                            {/* Tag switcher: CRYPTO | SPORTS */}
                            <div className="flex gap-2 mb-4">
                                {([
                                    { tag: 'crypto', label: '₿ CRYPTO', activeColor: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
                                    { tag: 'sports', label: '⚽ DEPORTES', activeColor: 'bg-green-500/15 text-green-300 border-green-500/30' },
                                ] as const).map(({ tag, label, activeColor }) => (
                                    <button
                                        key={tag}
                                        onClick={() => {
                                            if (polyFetchTag !== tag) openPolyImporter(tag);
                                        }}
                                        disabled={polyLoading}
                                        className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-[0.15em] border transition-all ${polyFetchTag === tag ? activeColor : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'} disabled:opacity-50`}
                                    >
                                        {label}
                                        {polyFetchTag === tag && polyLoading && <span className="ml-2 opacity-60">···</span>}
                                    </button>
                                ))}
                                <span className="ml-auto self-center text-[9px] text-slate-600 font-mono uppercase tracking-widest">
                                    Polymarket · {polyFetchTag === 'sports' ? 'Sports Markets' : 'Crypto Markets'}
                                </span>
                            </div>

                            {/* Search */}
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    value={polySearch}
                                    onChange={e => setPolySearch(e.target.value)}
                                    placeholder="Buscar por título, categoría..."
                                    className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-purple-500/50 transition-colors"
                                />
                            </div>

                            {/* Category filter + Select All */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {polyUniqueCats.slice(0, 8).map(cat => (
                                    <button key={cat} onClick={() => setPolyCatFilter(cat)}
                                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${polyCatFilter === cat ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-900/50 text-slate-500 border border-slate-800 hover:border-slate-600'}`}>
                                        {cat === 'ALL' ? 'TODOS' : cat}
                                    </button>
                                ))}
                                <div className="ml-auto flex gap-2">
                                    <button
                                        onClick={() => {
                                            const visibleIds = new Set(polyVisible.map(m => m.id));
                                            setPolySelected(prev => {
                                                const next = new Set(prev);
                                                visibleIds.forEach(id => next.add(id));
                                                return next;
                                            });
                                        }}
                                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                                    >
                                        SEL. TODO ({polyVisible.length})
                                    </button>
                                    <button
                                        onClick={() => setPolySelected(new Set())}
                                        className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-900/50 text-slate-500 border border-slate-800 hover:border-slate-600 transition-all"
                                    >
                                        LIMPIAR
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Market list */}
                        <div className="overflow-y-auto flex-1 p-6">
                            {polyLoading ? (
                                <div className="flex flex-col gap-3">
                                    {Array(6).fill(0).map((_, i) => (
                                        <div key={i} className="h-20 bg-slate-900/50 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : polyVisible.length === 0 ? (
                                <div className="text-center py-16 text-slate-600">
                                    <Globe size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-xs font-black uppercase tracking-widest">Sin resultados para "{polySearch}"</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {polyVisible.map(pm => {
                                        const outcomes: string[] = (() => { try { return JSON.parse(pm.outcomes || '["Sí","No"]'); } catch { return ['Sí', 'No']; } })();
                                        const prices: string[] = (() => { try { return JSON.parse(pm.outcomePrices || '["0.5","0.5"]'); } catch { return ['0.5', '0.5']; } })();
                                        const selected = polySelected.has(pm.id);
                                        const vol = pm.volumeNum > 1e6 ? `$${(pm.volumeNum/1e6).toFixed(1)}M` : pm.volumeNum > 1e3 ? `$${(pm.volumeNum/1e3).toFixed(0)}K` : `$${pm.volumeNum?.toFixed(0)||'0'}`;
                                        const yesPct = (parseFloat(prices[0]||'0')*100).toFixed(0);
                                        const noPct = (parseFloat(prices[1]||'0')*100).toFixed(0);

                                        return (
                                            <div key={pm.id}
                                                className={`p-4 rounded-2xl border transition-all ${selected ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-900/40 border-slate-800/50 hover:border-slate-600'}`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        onClick={() => {
                                                            setPolySelected(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(pm.id)) next.delete(pm.id); else next.add(pm.id);
                                                                return next;
                                                            });
                                                        }}
                                                        className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all cursor-pointer ${selected ? 'bg-purple-500 border-purple-500' : 'border-slate-700 hover:border-purple-500'}`}
                                                    >
                                                        {selected && <span className="text-white text-[10px] font-black">✓</span>}
                                                    </div>
                                                    <div
                                                        className="flex-1 min-w-0 cursor-pointer"
                                                        onClick={() => {
                                                            setPolySelected(prev => {
                                                                const next = new Set(prev);
                                                                if (next.has(pm.id)) next.delete(pm.id); else next.add(pm.id);
                                                                return next;
                                                            });
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-slate-800 text-slate-400 rounded-lg">{pm.category || 'General'}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-white leading-snug mb-2">{pm.question}</p>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-[10px] font-mono">
                                                                <span className="text-green-400 font-black">YES {yesPct}%</span>
                                                                <span className="text-slate-600 mx-1">·</span>
                                                                <span className="text-red-400 font-black">NO {noPct}%</span>
                                                            </span>
                                                            {outcomes.length > 2 && (
                                                                <span className="text-[9px] text-slate-500 font-mono">+{outcomes.length - 2} opciones</span>
                                                            )}
                                                            <span className="ml-auto text-[10px] font-black text-yellow-400">{vol}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openPolyDetail(pm); }}
                                                        className="flex-shrink-0 self-center px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap"
                                                    >
                                                        VER
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Load more / Load all buttons */}
                                    {polyHasMore && (
                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={loadMorePolyMarkets}
                                                disabled={polyLoadingMore}
                                                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {polyLoadingMore
                                                    ? <><RefreshCw size={12} className="animate-spin" /> Cargando...</>
                                                    : <>+ CARGAR {POLY_BATCH} MÁS</>
                                                }
                                            </button>
                                            <button
                                                onClick={loadAllPolyMarkets}
                                                disabled={polyLoadingMore}
                                                className="flex-1 py-3 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-800/50 hover:border-purple-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {polyLoadingMore
                                                    ? <><RefreshCw size={12} className="animate-spin" /> Cargando todos...</>
                                                    : <><Download size={12} /> CARGAR TODOS</>
                                                }
                                            </button>
                                        </div>
                                    )}
                                    {!polyHasMore && polyMarkets.length > 0 && (
                                        <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest pt-2">
                                            ✓ Todos los mercados cargados ({polyMarkets.length} total)
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-800/50 flex gap-4">
                            <button onClick={() => setShowPolyImporter(false)}
                                className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all">
                                CANCELAR
                            </button>
                            <button
                                onClick={importSelected}
                                disabled={polySelected.size === 0 || polyImporting}
                                className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-purple-500/20 disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {polyImporting
                                    ? <><RefreshCw size={14} className="animate-spin" /> IMPORTANDO {polySelected.size}...</>
                                    : <><Download size={14} /> IMPORTAR {polySelected.size > 0 ? `${polySelected.size} MERCADOS` : ''}</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Polymarket Single-Market Detail / Import Modal */}
            {polyDetailMarket && (() => {
                const pm = polyDetailMarket;
                const outcomes: string[] = (() => { try { return JSON.parse(pm.outcomes || '["Sí","No"]'); } catch { return ['Sí', 'No']; } })();
                const prices: string[] = (() => { try { return JSON.parse(pm.outcomePrices || '["0.5","0.5"]'); } catch { return ['0.5', '0.5']; } })();
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPolyDetailMarket(null)} />
                        <div className="bg-[#0c0c0e] border border-blue-900/50 rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-800/50" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05), transparent)' }}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-3">
                                            <Globe size={18} className="text-blue-400" /> IMPORTAR APUESTA
                                        </h2>
                                        <p className="text-[10px] text-slate-500 mt-1">Revisa y edita la traducción antes de importar</p>
                                    </div>
                                    <button onClick={() => setPolyDetailMarket(null)} className="text-slate-500 hover:text-white transition-colors">
                                        <X size={22} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-5">
                                {/* Original English */}
                                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl">
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Original (Inglés)</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">{pm.question}</p>
                                </div>
                                {/* Translated title */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        Título en Español
                                        {polyDetailTranslating && <RefreshCw size={10} className="animate-spin text-blue-400" />}
                                        {!polyDetailTranslating && <span className="text-[8px] text-blue-400 font-bold normal-case tracking-normal">✓ traducido por IA</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={polyDetailForm.titleEs}
                                        onChange={e => setPolyDetailForm(f => ({ ...f, titleEs: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                        placeholder="Traducción del título..."
                                    />
                                </div>
                                {/* Description */}
                                {polyDetailForm.descEs && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción (Español)</label>
                                        <textarea
                                            rows={2}
                                            value={polyDetailForm.descEs}
                                            onChange={e => setPolyDetailForm(f => ({ ...f, descEs: e.target.value }))}
                                            className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all resize-none"
                                        />
                                    </div>
                                )}
                                {/* Category + Fee */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</label>
                                        <select
                                            value={polyDetailForm.category}
                                            onChange={e => setPolyDetailForm(f => ({ ...f, category: e.target.value }))}
                                            className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-4 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Casa (%)</label>
                                        <input
                                            type="number" min={0} max={10} step={0.5}
                                            value={polyDetailForm.house_fee_pct}
                                            onChange={e => setPolyDetailForm(f => ({ ...f, house_fee_pct: Number(e.target.value) }))}
                                            className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                                {/* Close date */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cierre de Apuestas</label>
                                    <input
                                        type="datetime-local"
                                        value={polyDetailForm.closes_at}
                                        onChange={e => setPolyDetailForm(f => ({ ...f, closes_at: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                {/* Outcomes preview */}
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Opciones de Apuesta</p>
                                    <div className="flex flex-wrap gap-2">
                                        {outcomes.map((label: string, i: number) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl">
                                                <span className="text-[9px] font-black text-blue-400 w-5">{String.fromCharCode(65 + i)}</span>
                                                <span className="text-xs text-white">{label}</span>
                                                <span className="text-[9px] text-slate-500 font-mono">{(parseFloat(prices[i] || '0') * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-800/50 flex gap-3">
                                <button
                                    onClick={() => setPolyDetailMarket(null)}
                                    className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    onClick={importSingleMarket}
                                    disabled={polyDetailImporting || polyDetailTranslating || !polyDetailForm.titleEs}
                                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-40 flex items-center justify-center gap-2"
                                >
                                    {polyDetailImporting
                                        ? <><RefreshCw size={14} className="animate-spin" /> IMPORTANDO...</>
                                        : polyDetailTranslating
                                        ? <><RefreshCw size={14} className="animate-spin" /> TRADUCIENDO...</>
                                        : <><Download size={14} /> IMPORTAR ESTA APUESTA</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Edit Modal */}
            {showEditModal && editingMarket && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
                    <div className="bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-800/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                                    <Edit3 size={20} className="text-indigo-400" /> EDITAR MERCADO
                                </h2>
                                <p className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-xs">{editingMarket.id}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="p-8 overflow-y-auto space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título *</label>
                                <input required type="text" value={editForm.title}
                                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                                <textarea rows={2} value={editForm.description}
                                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Categoría</label>
                                    <select value={editForm.category}
                                        onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fee Casa (%)</label>
                                    <input type="number" min={0} max={10} step={0.5} value={editForm.house_fee_pct}
                                        onChange={e => setEditForm(f => ({ ...f, house_fee_pct: Number(e.target.value) }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cierre de apuestas</label>
                                    <input type="datetime-local" value={editForm.closes_at}
                                        onChange={e => setEditForm(f => ({ ...f, closes_at: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha resolución</label>
                                    <input type="datetime-local" value={editForm.resolves_at}
                                        onChange={e => setEditForm(f => ({ ...f, resolves_at: e.target.value }))}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">URL Imagen</label>
                                <input type="url" value={editForm.image_url}
                                    onChange={e => setEditForm(f => ({ ...f, image_url: e.target.value }))}
                                    className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-indigo-500 transition-all"
                                    placeholder="https://..." />
                            </div>
                            {/* Options labels (no pool edit) */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Etiquetas de opciones</label>
                                <p className="text-[10px] text-slate-600">Solo se editan las etiquetas — los pools se preservan.</p>
                                {editForm.options.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400">{opt.id}</div>
                                        <input type="text" value={opt.label}
                                            onChange={e => setEditForm(f => ({ ...f, options: f.options.map((o, i) => i === idx ? { ...o, label: e.target.value } : o) }))}
                                            className="flex-1 bg-[#111114] border border-slate-800 rounded-2xl py-3 px-5 text-white text-sm outline-none focus:border-indigo-500 transition-all" />
                                        <div className="text-[9px] text-slate-600 font-mono w-20 text-right">
                                            Pool: ${(editingMarket.options.find(o => o.id === opt.id)?.pool ?? 0).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 flex gap-4">
                                <button type="button" onClick={() => setShowEditModal(false)}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all">
                                    CANCELAR
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {saving ? 'GUARDANDO...' : <><Save size={16} /> GUARDAR CAMBIOS</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Resolve dropdown component
const ResolveDropdown: React.FC<{
    market: PredictionMarket;
    onResolve: (optionId: string) => void;
    loading: boolean;
}> = ({ market, onResolve, loading }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-xl font-black text-[9px] uppercase tracking-wider border border-green-500/10 transition-all disabled:opacity-50"
            >
                {loading ? 'PROCESANDO...' : <><CheckCircle size={12} /> RESOLVER <ChevronDown size={10} /></>}
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 bg-[#111114] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-20 min-w-[160px]">
                        {market.options.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => { setOpen(false); onResolve(opt.id); }}
                                className="w-full text-left px-5 py-3 text-xs font-bold text-white hover:bg-green-500/10 hover:text-green-400 transition-colors"
                            >
                                ✓ {opt.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default PredictionMarkets;
