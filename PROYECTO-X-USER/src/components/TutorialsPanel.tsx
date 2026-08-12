import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Tutorial } from '../types';
import {
    Search, Play, FileText, BookOpen, ExternalLink,
    ChevronRight, ArrowLeft, Loader2, Video, Globe, Sparkles,
    Headphones, Download, ChevronLeft, Calendar, User as UserIcon,
    X, Pause, Volume2
} from 'lucide-react';
import FlyerEditor from './FlyerEditor';

interface MonthlyBook {
    id: string;
    title: string;
    author?: string;
    description?: string;
    cover_url?: string;
    pdf_url?: string;
    audio_url?: string;
    month_label: string;
    month_order: number;
    is_featured: boolean;
    created_at: string;
}

function AudioPlayer({ src, title }: { src: string; title: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const toggle = () => {
        if (!audioRef.current) return;
        if (playing) { audioRef.current.pause(); }
        else { audioRef.current.play(); }
        setPlaying(!playing);
    };

    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-black/60 border border-white/10 rounded-2xl p-4 space-y-3">
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={() => setPlaying(false)}
            />
            <div className="flex items-center gap-3">
                <button
                    onClick={toggle}
                    className="w-10 h-10 rounded-full bg-geminix-accent flex items-center justify-center text-black shadow-[0_0_15px_rgba(0,243,255,0.3)] hover:scale-110 transition-transform shrink-0"
                >
                    {playing ? <Pause size={16} className="fill-black" /> : <Play size={16} className="fill-black ml-0.5" />}
                </button>
                <div className="flex-1 space-y-1">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest truncate">{title}</p>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-slate-500 font-mono w-8">{fmt(progress)}</span>
                        <input
                            type="range" min={0} max={duration || 1} value={progress}
                            onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); setProgress(Number(e.target.value)); }}
                            className="flex-1 h-1 accent-geminix-accent cursor-pointer"
                        />
                        <span className="text-[8px] text-slate-500 font-mono w-8 text-right">{fmt(duration)}</span>
                    </div>
                </div>
                <Volume2 size={14} className="text-slate-600 shrink-0" />
            </div>
        </div>
    );
}

export default function TutorialsPanel() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'tutorials' | 'books' | 'flyer'>('tutorials');
    const [books, setBooks] = useState<MonthlyBook[]>([]);
    const [selectedBook, setSelectedBook] = useState<MonthlyBook | null>(null);
    const [booksLoading, setBooksLoading] = useState(false);
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

    useEffect(() => {
        fetchTutorials();
    }, []);

    useEffect(() => {
        if (activeTab === 'books' && books.length === 0) fetchBooks();
    }, [activeTab]);

    const fetchBooks = async () => {
        setBooksLoading(true);
        try {
            const { data, error } = await supabase
                .from('monthly_books')
                .select('*')
                .eq('is_active', true)
                .order('month_order', { ascending: false });
            if (error) throw error;
            setBooks(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setBooksLoading(false);
        }
    };

    const fetchTutorials = async () => {
        try {
            const { data, error } = await supabase
                .from('tutorials')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTutorials(data || []);
        } catch (error) {
            console.error('Error fetching tutorials:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories = ['ALL', ...new Set(tutorials.map(t => t.category))];

    const filteredTutorials = tutorials.filter(tutorial => {
        const matchesSearch = tutorial.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tutorial.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'ALL' || tutorial.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getYouTubeEmbedUrl = (url: string | null | undefined): string | null => {
        if (!url) return null;
        try {
            // youtu.be/VIDEO_ID
            const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
            if (shortMatch) return `https://www.youtube-nocookie.com/embed/${shortMatch[1]}?rel=0`;

            // youtube.com/watch?v=VIDEO_ID
            const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (watchMatch) return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}?rel=0`;

            // youtube.com/embed/VIDEO_ID (ya es embed)
            const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
            if (embedMatch) return `https://www.youtube-nocookie.com/embed/${embedMatch[1]}?rel=0`;

            // youtube.com/shorts/VIDEO_ID
            const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (shortsMatch) return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}?rel=0`;
        } catch {
            return null;
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <Loader2 className="w-12 h-12 text-geminix-accent animate-spin mb-4" />
                <p className="text-[10px] font-orbitron font-bold text-slate-500 uppercase tracking-[0.3em]">
                    {t('tutorials.loading') || 'Sincronizando Biblioteca Educativa...'}
                </p>
            </div>
        );
    }

    if (selectedTutorial) {
        const embedUrl = selectedTutorial.content_type === 'VIDEO' ? getYouTubeEmbedUrl(selectedTutorial.url) : null;

        return (
            <div className="space-y-8 animate-fade-in">
                <button
                    onClick={() => setSelectedTutorial(null)}
                    className="flex items-center gap-2 text-geminix-accent hover:text-white transition-colors group mb-6"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-orbitron font-bold uppercase tracking-widest">
                        {t('tutorials.back_to_list') || 'Volver a la Galería'}
                    </span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="relative aspect-video bg-black border border-white/5 clip-corner-sm overflow-hidden shadow-2xl">
                            {selectedTutorial.content_type === 'VIDEO' && embedUrl ? (
                                <iframe
                                    src={embedUrl}
                                    className="w-full h-full"
                                    title={selectedTutorial.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                    allowFullScreen
                                    frameBorder="0"
                                ></iframe>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50 p-12 text-center">
                                    {selectedTutorial.content_type === 'VIDEO' ? (
                                        <Video size={80} className="text-blue-500/30 mb-6" />
                                    ) : selectedTutorial.content_type === 'PDF' ? (
                                        <FileText size={80} className="text-emerald-500/30 mb-6" />
                                    ) : (
                                        <BookOpen size={80} className="text-blue-500/30 mb-6" />
                                    )}
                                    <h2 className="text-xl font-orbitron font-black text-white uppercase mb-4 italic">
                                        {selectedTutorial.title}
                                    </h2>
                                    <p className="text-sm text-slate-400 mb-8 max-w-md mx-auto">
                                        {selectedTutorial.description}
                                    </p>
                                    <a
                                        href={selectedTutorial.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-8 py-4 bg-geminix-accent text-slate-950 font-black text-xs uppercase tracking-widest clip-corner hover:scale-105 transition-all flex items-center gap-3"
                                    >
                                        <ExternalLink size={18} />
                                        {selectedTutorial.content_type === 'VIDEO'
                                            ? 'Ver en YouTube'
                                            : (t('tutorials.open_resource') || 'Abrir Recurso Externo')}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="holo-card p-6 clip-corner border-geminix-accent/20">
                            <h3 className="text-xs font-orbitron font-bold text-geminix-accent uppercase tracking-[0.2em] mb-4">Información del Módulo</h3>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Categoría</p>
                                    <p className="text-sm font-black text-white uppercase italic">{selectedTutorial.category}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Tipo de Contenido</p>
                                    <p className="text-sm font-black text-white uppercase italic">{selectedTutorial.content_type}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Fecha de Publicación</p>
                                    <p className="text-sm font-black text-white uppercase italic">
                                        {new Date(selectedTutorial.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-blue-500/5 border border-blue-500/10 clip-corner-sm">
                            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-relaxed italic">
                                "La educación es la base del éxito. Asegúrate de comprender cada paso antes de ejecutar operaciones de alto volumen."
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative z-10 w-full max-w-full">

            {/* ── Main Tabs ── */}
            <div className="flex gap-2 border-b border-white/5 pb-0 overflow-x-auto scrollbar-none">
                <button
                    onClick={() => setActiveTab('tutorials')}
                    className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'tutorials'
                            ? 'border-geminix-accent text-white'
                            : 'border-transparent text-slate-600 hover:text-slate-300'
                    }`}
                >
                    <BookOpen size={13} /> Tutoriales & Educación
                </button>
                <button
                    onClick={() => setActiveTab('books')}
                    className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'books'
                            ? 'border-amber-400 text-amber-400'
                            : 'border-transparent text-slate-600 hover:text-slate-300'
                    }`}
                >
                    <BookOpen size={13} className="text-amber-400" /> Libro del Mes
                    <span className="text-[7px] px-1.5 py-0.5 bg-amber-400/20 text-amber-400 font-black clip-corner-sm">NEW</span>
                </button>
                <button
                    onClick={() => setActiveTab('flyer')}
                    className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                        activeTab === 'flyer'
                            ? 'border-geminix-accent text-white'
                            : 'border-transparent text-slate-600 hover:text-slate-300'
                    }`}
                >
                    <Sparkles size={13} /> Flyer Bienvenida
                </button>
            </div>

            {/* ── Flyer Editor tab ── */}
            {activeTab === 'flyer' && <FlyerEditor />}

            {/* ── Libro del Mes tab ── */}
            {activeTab === 'books' && (
                <div className="space-y-8 animate-fade-in">
                    {booksLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cargando biblioteca...</p>
                        </div>
                    ) : books.length === 0 ? (
                        <div className="py-20 text-center bg-white/5 border border-white/5 clip-corner">
                            <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Próximamente — Primer libro del mes</p>
                        </div>
                    ) : (
                        <>
                            {/* Libro destacado */}
                            {books.filter(b => b.is_featured)[0] && (() => {
                                const featured = books.filter(b => b.is_featured)[0];
                                return (
                                    <div className="relative overflow-hidden rounded-none clip-corner bg-gradient-to-r from-amber-900/30 via-black to-black border border-amber-400/20 p-0">
                                        <div className="flex flex-col md:flex-row gap-0">
                                            {/* Cover */}
                                            <div className="w-full md:w-56 shrink-0 h-64 md:h-auto relative overflow-hidden">
                                                {featured.cover_url ? (
                                                    <img src={featured.cover_url} alt={featured.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-amber-900/40 to-black flex items-center justify-center">
                                                        <BookOpen size={64} className="text-amber-400/30" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black hidden md:block" />
                                                <div className="absolute top-3 left-3">
                                                    <span className="px-3 py-1 bg-amber-400 text-black text-[8px] font-black uppercase tracking-widest">
                                                        ★ LIBRO DEL MES
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 p-8 flex flex-col justify-between">
                                                <div>
                                                    <p className="text-[9px] text-amber-400 font-black uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                                                        <Calendar size={10} /> {featured.month_label}
                                                    </p>
                                                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight mb-2 leading-tight">
                                                        {featured.title}
                                                    </h2>
                                                    {featured.author && (
                                                        <p className="text-sm text-slate-400 font-bold mb-4 flex items-center gap-2">
                                                            <UserIcon size={12} /> {featured.author}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 mb-6">
                                                        {featured.description}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {featured.pdf_url && (
                                                        <a
                                                            href={featured.pdf_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 px-5 py-3 bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-all clip-corner-sm"
                                                        >
                                                            <FileText size={14} /> Leer PDF
                                                        </a>
                                                    )}
                                                    {featured.audio_url && (
                                                        <button
                                                            onClick={() => setSelectedBook(featured)}
                                                            className="flex items-center gap-2 px-5 py-3 bg-white/10 border border-white/20 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all clip-corner-sm"
                                                        >
                                                            <Headphones size={14} /> Escuchar Audio
                                                        </button>
                                                    )}
                                                    {featured.pdf_url && (
                                                        <a
                                                            href={featured.pdf_url}
                                                            download
                                                            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all clip-corner-sm"
                                                        >
                                                            <Download size={14} /> Descargar
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Archivo de libros anteriores */}
                            {books.filter(b => !b.is_featured).length > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                        <ChevronLeft size={12} /> Biblioteca Anterior
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {books.filter(b => !b.is_featured).map(book => (
                                            <div
                                                key={book.id}
                                                className="group relative flex flex-col bg-slate-900/40 border border-white/5 hover:border-amber-400/30 transition-all clip-corner-sm overflow-hidden hover:-translate-y-1 cursor-pointer"
                                                onClick={() => setSelectedBook(book)}
                                            >
                                                <div className="h-48 relative overflow-hidden bg-black/50">
                                                    {book.cover_url ? (
                                                        <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-amber-900/20 to-black flex items-center justify-center">
                                                            <BookOpen size={32} className="text-amber-400/20" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                                                    <div className="absolute bottom-2 left-2 flex gap-1">
                                                        {book.pdf_url && <span className="px-1.5 py-0.5 bg-amber-400/80 text-black text-[7px] font-black">PDF</span>}
                                                        {book.audio_url && <span className="px-1.5 py-0.5 bg-cyan-400/80 text-black text-[7px] font-black flex items-center gap-0.5"><Headphones size={8} /> AUDIO</span>}
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-[8px] text-amber-400 font-black uppercase tracking-widest mb-1">{book.month_label}</p>
                                                    <p className="text-xs font-black text-white uppercase italic truncate">{book.title}</p>
                                                    {book.author && <p className="text-[9px] text-slate-500 truncate mt-0.5">{book.author}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Modal detalle de libro */}
                    {selectedBook && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setSelectedBook(null)} />
                            <div className="relative w-full max-w-2xl bg-[#0f0f12] border border-amber-400/20 clip-corner overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                                <div className="flex items-start justify-between p-6 border-b border-white/10">
                                    <div>
                                        <p className="text-[8px] text-amber-400 font-black uppercase tracking-widest mb-1">{selectedBook.month_label}</p>
                                        <h3 className="text-lg font-black text-white uppercase italic">{selectedBook.title}</h3>
                                        {selectedBook.author && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><UserIcon size={10} />{selectedBook.author}</p>}
                                    </div>
                                    <button onClick={() => setSelectedBook(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 space-y-6">
                                    {selectedBook.cover_url && (
                                        <img src={selectedBook.cover_url} alt={selectedBook.title} className="w-40 mx-auto object-cover border border-white/10" />
                                    )}
                                    {selectedBook.description && (
                                        <p className="text-sm text-slate-400 leading-relaxed">{selectedBook.description}</p>
                                    )}
                                    {selectedBook.audio_url && (
                                        <div>
                                            <p className="text-[9px] text-cyan-400 font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Headphones size={10} /> Audiolibro</p>
                                            <AudioPlayer src={selectedBook.audio_url} title={selectedBook.title} />
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-3 pt-2">
                                        {selectedBook.pdf_url && (
                                            <>
                                                <a href={selectedBook.pdf_url} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center gap-2 px-5 py-3 bg-amber-400 text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-all clip-corner-sm">
                                                    <ExternalLink size={14} /> Abrir PDF
                                                </a>
                                                <a href={selectedBook.pdf_url} download
                                                    className="flex items-center gap-2 px-5 py-3 bg-white/10 border border-white/20 text-white font-black text-[10px] uppercase tracking-widest hover:bg-white/20 transition-all clip-corner-sm">
                                                    <Download size={14} /> Descargar
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tutorials tab ── */}
            {activeTab === 'tutorials' && <div className="space-y-10">

            {/* SEARCH AND FILTER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
                <div className="relative w-full max-w-md group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-geminix-accent group-hover:scale-110 transition-transform" size={18} />
                    <input
                        type="text"
                        placeholder={t('tutorials.search_placeholder') || 'BUSCAR RECURSOS...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-none pl-12 pr-4 py-4 text-xs font-orbitron tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-geminix-accent/50 transition-all clip-corner-sm"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none w-full md:w-auto">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-6 py-2.5 text-[9px] font-orbitron font-bold uppercase tracking-widest clip-corner-sm transition-all whitespace-nowrap ${selectedCategory === cat
                                ? 'bg-geminix-accent text-slate-950 shadow-neon-cyan'
                                : 'bg-white/5 text-slate-500 hover:text-white hover:bg-white/10'}`}
                        >
                            {cat === 'ALL' ? (t('tutorials.all_categories') || 'TODAS') : cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* TUTORIALS GRID */}
            {filteredTutorials.length === 0 ? (
                <div className="py-20 text-center bg-white/5 border border-white/5 clip-corner">
                    <BookOpen className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-xs font-orbitron font-bold text-slate-600 uppercase tracking-widest">
                        {t('tutorials.no_results') || 'No se encontraron tutoriales con los criterios de búsqueda.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredTutorials.map((tutorial) => (
                        <div
                            key={tutorial.id}
                            className="group relative flex flex-col bg-slate-900/40 border border-white/5 hover:border-geminix-accent/30 transition-all duration-500 clip-corner-sm overflow-hidden hover:translate-y-[-4px]"
                        >
                            <div className="relative h-44 overflow-hidden bg-black/50 border-b border-white/5">
                                {tutorial.thumbnail_url ? (
                                    <img
                                        src={tutorial.thumbnail_url}
                                        alt={tutorial.title}
                                        className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-black gap-2 transition-all group-hover:scale-110">
                                        {tutorial.content_type === 'VIDEO' ? <Video size={32} className="text-blue-500/40" /> : <FileText size={32} className="text-emerald-500/40" />}
                                        <Globe size={16} className="text-white/5 animate-pulse" />
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

                                <div className="absolute top-3 left-3 flex gap-2">
                                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 text-geminix-accent text-[8px] font-orbitron font-black uppercase tracking-widest">
                                        {tutorial.category}
                                    </span>
                                </div>

                                {tutorial.content_type === 'VIDEO' && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-14 h-14 rounded-full bg-geminix-accent/20 border border-geminix-accent/50 flex items-center justify-center backdrop-blur-md">
                                            <Play size={24} className="text-white fill-white shadow-neon-cyan" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-5 flex flex-col flex-1">
                                <h3 className="text-sm font-orbitron font-black text-white uppercase italic tracking-tight mb-2 group-hover:text-geminix-accent transition-colors truncate">
                                    {tutorial.title}
                                </h3>

                                <div className="flex items-center gap-2 mb-4">
                                    {tutorial.content_type === 'VIDEO' ? (
                                        <span className="text-[10px] font-mono-tech text-blue-400 flex items-center gap-1.5 uppercase tracking-tighter">
                                            <Video size={10} /> {t('tutorials.video_tutorial') || 'VIDEO TUTORIAL'}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-mono-tech text-emerald-400 flex items-center gap-1.5 uppercase tracking-tighter">
                                            <FileText size={10} /> {t('tutorials.pdf_document') || 'RECURSO PDF'}
                                        </span>
                                    )}
                                </div>

                                <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed h-[30px] mb-6">
                                    {tutorial.description}
                                </p>

                                <button
                                    onClick={() => setSelectedTutorial(tutorial)}
                                    className="mt-auto w-full py-3 border border-white/10 group-hover:border-geminix-accent group-hover:bg-geminix-accent/10 transition-all font-orbitron font-black text-[9px] uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                                >
                                    {tutorial.content_type === 'VIDEO' ? (t('tutorials.watch_now') || 'REPRODUCIR AHORA') : (t('tutorials.open_resource') || 'ABRIR RECURSO')}
                                    <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </div>} {/* end tutorials tab */}
        </div>
    );
}

