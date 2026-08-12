import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Gamepad2,
    Plus,
    Search,
    Edit2,
    Trash2,
    ToggleLeft,
    ToggleRight,
    ExternalLink,
    Code2,
    Image as ImageIcon,
    Save,
    X,
    AlertCircle,
    History as HistoryIcon
} from 'lucide-react';
import { Game } from '../types';

const Games: React.FC = () => {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingGame, setEditingGame] = useState<Partial<Game> | null>(null);
    const [saving, setSaving] = useState(false);
    const [winningsHistory, setWinningsHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        fetchGames();
        fetchWinningsHistory();
    }, []);

    async function fetchWinningsHistory() {
        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('transactions')
                .select(`
                    id,
                    amount,
                    description,
                    created_at,
                    profiles (
                        username,
                        email
                    )
                `)
                .eq('type', 'GAME_WIN')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setWinningsHistory(data || []);
        } catch (err) {
            console.error('Error fetching winnings history:', err);
        } finally {
            setLoadingHistory(false);
        }
    }

    async function fetchGames() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setGames(data || []);
        } catch (err) {
            console.error('Error fetching games:', err);
        } finally {
            setLoading(false);
        }
    }

    const handleToggleActive = async (game: Game) => {
        try {
            const { error } = await supabase
                .from('games')
                .update({ is_active: !game.is_active })
                .eq('id', game.id);

            if (error) throw error;
            setGames(games.map(g => g.id === game.id ? { ...g, is_active: !g.is_active } : g));
        } catch (err) {
            console.error('Error toggling game status:', err);
        }
    };

    const handleSaveGame = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGame?.title) return;

        try {
            setSaving(true);
            if (editingGame.id) {
                // Update
                const { error } = await supabase
                    .from('games')
                    .update({
                        title: editingGame.title,
                        description: editingGame.description,
                        category: editingGame.category,
                        image_url: editingGame.image_url,
                        game_url: editingGame.game_url,
                        game_code: editingGame.game_code,
                        min_bet: editingGame.min_bet,
                        max_bet: editingGame.max_bet,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingGame.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('games')
                    .insert([{
                        title: editingGame.title,
                        description: editingGame.description,
                        category: editingGame.category || 'TRADING',
                        image_url: editingGame.image_url,
                        game_url: editingGame.game_url,
                        game_code: editingGame.game_code,
                        min_bet: editingGame.min_bet || 1,
                        max_bet: editingGame.max_bet || 500,
                        is_active: true
                    }]);

                if (error) throw error;
            }

            setShowModal(false);
            setEditingGame(null);
            fetchGames();
        } catch (err) {
            console.error('Error saving game:', err);
            alert('Error saving game information');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGame = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este juego? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('games')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setGames(games.filter(g => g.id !== id));
        } catch (err) {
            console.error('Error deleting game:', err);
        }
    };

    const filteredGames = games.filter(game =>
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                        <Gamepad2 className="text-blue-500" /> JUEGOS Y ENTRETENIMIENTO
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Gestión de catálogo de juegos para usuarios</p>
                </div>
                <button
                    onClick={() => {
                        setEditingGame({});
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus size={16} /> AÑADIR JUEGO
                </button>
            </div>

            <div className="bg-[#0c0c0e]/50 border border-slate-800/50 rounded-3xl p-6">
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar juegos por título o categoría..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#111114] border border-slate-800/50 rounded-2xl py-4 pl-12 pr-6 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none transition-all"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        Array(3).fill(0).map((_, i) => (
                            <div key={i} className="h-64 bg-[#111114] border border-slate-800/50 rounded-3xl animate-pulse" />
                        ))
                    ) : filteredGames.length === 0 ? (
                        <div className="col-span-full py-20 text-center">
                            <Gamepad2 size={48} className="text-slate-800 mx-auto mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No se encontraron juegos</p>
                        </div>
                    ) : (
                        filteredGames.map((game) => (
                            <div key={game.id} className="bg-[#111114] border border-slate-800/50 rounded-3xl overflow-hidden group hover:border-blue-500/30 transition-all flex flex-col">
                                <div className="h-40 bg-slate-900 flex items-center justify-center relative">
                                    {game.image_url ? (
                                        <img src={game.image_url} alt={game.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <Gamepad2 size={48} className="text-slate-800" />
                                    )}
                                    <div className="absolute top-4 right-4">
                                        <button
                                            onClick={() => handleToggleActive(game)}
                                            className={`p-2 rounded-xl border transition-all ${game.is_active ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}
                                        >
                                            {game.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                    </div>
                                    <div className="absolute bottom-4 left-4">
                                        <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-[10px] text-blue-400 font-black rounded-lg uppercase tracking-widest border border-blue-500/20">
                                            {game.category}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-6 flex-1 flex flex-col">
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2 group-hover:text-blue-400 transition-colors">{game.title}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">{game.description || 'Sin descripción'}</p>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">
                                            <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1 text-center">Apuesta Mín</p>
                                            <p className="text-sm font-black text-white text-center">${game.min_bet}</p>
                                        </div>
                                        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800/50">
                                            <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1 text-center">Apuesta Máx</p>
                                            <p className="text-sm font-black text-white text-center">${game.max_bet}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto flex gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingGame(game);
                                                setShowModal(true);
                                            }}
                                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <Edit2 size={12} /> EDITAR
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGame(game.id)}
                                            className="p-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all border border-rose-500/10"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Winnings History Section */}
            <div className="bg-[#0c0c0e]/50 border border-slate-800/50 rounded-3xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                            <HistoryIcon className="text-green-500" /> HISTORIAL DE GANANCIAS (CRÉDITO)
                        </h2>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Últimas 50 ganancias acreditadas a usuarios</p>
                    </div>
                    <button
                        onClick={fetchWinningsHistory}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all"
                    >
                        <Save size={16} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-800/50">
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Usuario</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Juego / Descripción</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 text-right">Monto</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 text-right">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {loadingHistory ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="py-4 bg-slate-900/20 rounded-lg"></td>
                                    </tr>
                                ))
                            ) : winningsHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-slate-600 font-bold uppercase tracking-widest text-xs">No hay registros de ganancias</td>
                                </tr>
                            ) : (
                                winningsHistory.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-4 px-4">
                                            <p className="text-sm font-bold text-white tracking-tight">{record.profiles?.username || 'Usuario Desconocido'}</p>
                                            <p className="text-[9px] text-slate-500 font-medium">{record.profiles?.email}</p>
                                        </td>
                                        <td className="py-4 px-4 text-xs text-slate-400 font-medium">
                                            {record.description}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <span className="text-sm font-black text-green-500 font-mono">
                                                +${Number(record.amount).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right text-[10px] text-slate-500 font-mono">
                                            {new Date(record.created_at).toLocaleString('en-US')}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                    <div className="bg-[#0c0c0e] border border-slate-800 rounded-[2.5rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-800/50 flex justify-between items-center">
                            <h2 className="text-xl font-black text-white uppercase tracking-widest">
                                {editingGame?.id ? 'EDITAR JUEGO' : 'NUEVO JUEGO'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveGame} className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Título del Juego</label>
                                    <input
                                        required
                                        type="text"
                                        value={editingGame?.title || ''}
                                        onChange={(e) => setEditingGame({ ...editingGame, title: e.target.value })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all shadow-inner"
                                        placeholder="Ej: Crypto Trading Game"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descripción</label>
                                    <textarea
                                        rows={3}
                                        value={editingGame?.description || ''}
                                        onChange={(e) => setEditingGame({ ...editingGame, description: e.target.value })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all shadow-inner resize-none"
                                        placeholder="Descripción breve del funcionamiento..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
                                    <input
                                        type="text"
                                        value={editingGame?.category || ''}
                                        onChange={(e) => setEditingGame({ ...editingGame, category: e.target.value })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                        placeholder="Ej: TRADING, AZAR, etc."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL de Imagen</label>
                                    <div className="relative">
                                        <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                        <input
                                            type="url"
                                            value={editingGame?.image_url || ''}
                                            onChange={(e) => setEditingGame({ ...editingGame, image_url: e.target.value })}
                                            className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apuesta Mínima</label>
                                    <input
                                        type="number"
                                        value={editingGame?.min_bet || 0}
                                        onChange={(e) => setEditingGame({ ...editingGame, min_bet: Number(e.target.value) })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Apuesta Máxima</label>
                                    <input
                                        type="number"
                                        value={editingGame?.max_bet || 0}
                                        onChange={(e) => setEditingGame({ ...editingGame, max_bet: Number(e.target.value) })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL del Juego (Opcional)</label>
                                        <ExternalLink size={12} className="text-slate-600" />
                                    </div>
                                    <input
                                        type="url"
                                        value={editingGame?.game_url || ''}
                                        onChange={(e) => setEditingGame({ ...editingGame, game_url: e.target.value })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-sm outline-none focus:border-blue-500 transition-all"
                                        placeholder="URL externa del juego..."
                                    />
                                </div>

                                <div className="col-span-2 space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Código del Juego (Advanced)</label>
                                        <Code2 size={12} className="text-slate-600" />
                                    </div>
                                    <textarea
                                        rows={4}
                                        value={editingGame?.game_code || ''}
                                        onChange={(e) => setEditingGame({ ...editingGame, game_code: e.target.value })}
                                        className="w-full bg-[#111114] border border-slate-800 rounded-2xl py-4 px-6 text-white text-xs font-mono outline-none focus:border-blue-500 transition-all resize-none"
                                        placeholder="Código HTML/JS embebido..."
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all"
                                >
                                    CANCELAR
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? 'GUARDANDO...' : (
                                        <><Save size={16} /> GUARDAR JUEGO</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Games;
