import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Tutorial } from '../types';
import {
    Plus, Edit2, Trash2, CheckCircle, XCircle, Search,
    Video, FileText, Globe, BookOpen, Layers, Eye,
    RefreshCw, ExternalLink, Play, Link as LinkIcon,
    Headphones, Star, Calendar, Save, X
} from 'lucide-react';

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
    is_active: boolean;
    is_featured: boolean;
    created_at: string;
}

export default function Tutorials() {
    const [mainTab, setMainTab] = useState<'tutorials' | 'books'>('tutorials');

    // ── Tutorials state ──
    const [tutorials, setTutorials] = useState<Tutorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

    // ── Books state ──
    const [books, setBooks] = useState<MonthlyBook[]>([]);
    const [booksLoading, setBooksLoading] = useState(false);
    const [bookModalOpen, setBookModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState<MonthlyBook | null>(null);
    const [bookForm, setBookForm] = useState({
        title: '', author: '', description: '', cover_url: '',
        pdf_url: '', audio_url: '', month_label: '', month_order: 0,
        is_active: true, is_featured: false
    });

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        content_type: 'VIDEO' as 'VIDEO' | 'PDF' | 'DOCUMENT',
        url: '',
        thumbnail_url: '',
        category: 'GENERAL',
        is_active: true
    });

    useEffect(() => { fetchTutorials(); }, []);
    useEffect(() => { if (mainTab === 'books' && books.length === 0) fetchBooks(); }, [mainTab]);

    const fetchBooks = async () => {
        setBooksLoading(true);
        const { data } = await supabase.from('monthly_books').select('*').order('month_order', { ascending: false });
        setBooks(data || []);
        setBooksLoading(false);
    };

    const openBookModal = (book?: MonthlyBook) => {
        if (book) {
            setEditingBook(book);
            setBookForm({
                title: book.title, author: book.author || '', description: book.description || '',
                cover_url: book.cover_url || '', pdf_url: book.pdf_url || '', audio_url: book.audio_url || '',
                month_label: book.month_label, month_order: book.month_order,
                is_active: book.is_active, is_featured: book.is_featured
            });
        } else {
            setEditingBook(null);
            const now = new Date();
            const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            setBookForm({
                title: '', author: '', description: '', cover_url: '', pdf_url: '', audio_url: '',
                month_label: `${months[now.getMonth()]} ${now.getFullYear()}`,
                month_order: now.getFullYear() * 100 + now.getMonth() + 1,
                is_active: true, is_featured: false
            });
        }
        setBookModalOpen(true);
    };

    const saveBook = async () => {
        try {
            if (editingBook) {
                const { error } = await supabase.from('monthly_books').update(bookForm).eq('id', editingBook.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('monthly_books').insert([bookForm]);
                if (error) throw error;
            }
            setBookModalOpen(false);
            fetchBooks();
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const deleteBook = async (id: string) => {
        if (!confirm('¿Eliminar este libro?')) return;
        await supabase.from('monthly_books').delete().eq('id', id);
        fetchBooks();
    };

    const toggleBookFeatured = async (book: MonthlyBook) => {
        // Si lo marcamos como destacado, quitar destacado a los demás
        if (!book.is_featured) {
            await supabase.from('monthly_books').update({ is_featured: false }).neq('id', book.id);
        }
        await supabase.from('monthly_books').update({ is_featured: !book.is_featured }).eq('id', book.id);
        fetchBooks();
    };

    const fetchTutorials = async () => {
        try {
            const { data, error } = await supabase
                .from('tutorials')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTutorials(data || []);
        } catch (error) {
            console.error('Error fetching tutorials:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target as HTMLInputElement;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const openAddModal = () => {
        setEditingTutorial(null);
        setFormData({
            title: '',
            description: '',
            content_type: 'VIDEO',
            url: '',
            thumbnail_url: '',
            category: 'GENERAL',
            is_active: true
        });
        setIsModalOpen(true);
    };

    const openEditModal = (tutorial: Tutorial) => {
        setEditingTutorial(tutorial);
        setFormData({
            title: tutorial.title,
            description: tutorial.description || '',
            content_type: tutorial.content_type,
            url: tutorial.url,
            thumbnail_url: tutorial.thumbnail_url || '',
            category: tutorial.category,
            is_active: tutorial.is_active
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                updated_at: new Date().toISOString()
            };

            if (editingTutorial) {
                const { error } = await supabase
                    .from('tutorials')
                    .update(payload)
                    .eq('id', editingTutorial.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('tutorials')
                    .insert([payload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchTutorials();
        } catch (error) {
            console.error('Error saving tutorial:', error);
            alert('Error al guardar el tutorial.');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('tutorials')
                .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchTutorials();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const deleteTutorial = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este tutorial?')) return;
        try {
            const { error } = await supabase
                .from('tutorials')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchTutorials();
        } catch (error) {
            console.error('Error deleting tutorial:', error);
        }
    };

    const filteredTutorials = tutorials.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'VIDEO': return <Video size={20} />;
            case 'PDF': return <FileText size={20} />;
            default: return <BookOpen size={20} />;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative z-10 w-full max-w-full pb-20">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-400 to-cyan-400 font-orbitron tracking-tighter uppercase italic">
                        LEARNING <span className="text-white">COMMAND CENTER</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        Sistema de Gestión Educativa v1.0
                    </p>
                </div>
                {mainTab === 'tutorials' ? (
                    <button onClick={openAddModal} className="group relative px-6 py-3 bg-blue-600 text-white rounded-none clip-corner transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <div className="relative flex items-center gap-3">
                            <Plus size={20} /><span className="font-black text-xs uppercase tracking-[0.2em]">Nuevo Tutorial</span>
                        </div>
                    </button>
                ) : (
                    <button onClick={() => openBookModal()} className="group relative px-6 py-3 bg-amber-500 text-black rounded-none clip-corner transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                        <div className="relative flex items-center gap-3">
                            <Plus size={20} /><span className="font-black text-xs uppercase tracking-[0.2em]">Subir Libro del Mes</span>
                        </div>
                    </button>
                )}
            </div>

            {/* MAIN TABS */}
            <div className="flex gap-0 border-b border-slate-800">
                <button
                    onClick={() => setMainTab('tutorials')}
                    className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${mainTab === 'tutorials' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <BookOpen size={13} /> Tutoriales & Videos
                </button>
                <button
                    onClick={() => setMainTab('books')}
                    className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${mainTab === 'books' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    <BookOpen size={13} className="text-amber-400" /> Libro del Mes
                    <span className="px-1.5 py-0.5 bg-amber-400/20 text-amber-400 text-[7px] font-black">NEW</span>
                </button>
            </div>

            {/* ── BOOKS PANEL ── */}
            {mainTab === 'books' && (
                <div className="space-y-6">
                    {booksLoading ? (
                        <div className="py-20 text-center"><RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" /></div>
                    ) : books.length === 0 ? (
                        <div className="py-20 text-center bg-white/5 border border-white/5">
                            <BookOpen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sin libros. Sube el primero.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {books.map(book => (
                                <div key={book.id} className={`relative flex flex-col bg-[#0c0f18] border overflow-hidden transition-all ${book.is_featured ? 'border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'border-slate-800'}`}>
                                    {book.is_featured && (
                                        <div className="absolute top-0 left-0 right-0 z-10 bg-amber-400 text-black text-[8px] font-black uppercase tracking-widest text-center py-1">
                                            ★ LIBRO DEL MES ACTIVO
                                        </div>
                                    )}
                                    <div className={`h-48 relative overflow-hidden bg-black/50 ${book.is_featured ? 'mt-6' : ''}`}>
                                        {book.cover_url ? (
                                            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-amber-900/20 to-black flex items-center justify-center">
                                                <BookOpen size={40} className="text-amber-400/20" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                        <div className="absolute bottom-2 left-2 flex gap-1">
                                            {book.pdf_url && <span className="px-1.5 py-0.5 bg-amber-400 text-black text-[7px] font-black">PDF</span>}
                                            {book.audio_url && <span className="px-1.5 py-0.5 bg-cyan-400 text-black text-[7px] font-black flex items-center gap-0.5"><Headphones size={8} /> AUDIO</span>}
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <p className="text-[8px] text-amber-400 font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar size={8} />{book.month_label}</p>
                                        <p className="text-sm font-black text-white uppercase italic truncate">{book.title}</p>
                                        {book.author && <p className="text-[9px] text-slate-500 mt-0.5">{book.author}</p>}
                                    </div>
                                    <div className="p-3 border-t border-slate-800 flex gap-2">
                                        <button
                                            onClick={() => toggleBookFeatured(book)}
                                            title={book.is_featured ? 'Quitar destacado' : 'Marcar como Libro del Mes'}
                                            className={`w-8 h-8 flex items-center justify-center border transition-all ${book.is_featured ? 'bg-amber-400/20 border-amber-400/50 text-amber-400' : 'border-slate-700 text-slate-500 hover:text-amber-400 hover:border-amber-400/30'}`}
                                        >
                                            <Star size={14} className={book.is_featured ? 'fill-amber-400' : ''} />
                                        </button>
                                        <button onClick={() => openBookModal(book)} className="w-8 h-8 flex items-center justify-center border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => deleteBook(book.id)} className="w-8 h-8 flex items-center justify-center border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                        <button
                                            onClick={() => supabase.from('monthly_books').update({ is_active: !book.is_active }).eq('id', book.id).then(() => fetchBooks())}
                                            className={`ml-auto w-8 h-8 flex items-center justify-center border transition-all ${book.is_active ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}
                                        >
                                            {book.is_active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Book Modal */}
                    {bookModalOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                            <div className="w-full max-w-2xl bg-[#0c0f18] border border-slate-800 overflow-hidden max-h-[90vh] overflow-y-auto">
                                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                    <h2 className="text-lg font-black text-white uppercase flex items-center gap-3">
                                        <BookOpen className="text-amber-400" />
                                        {editingBook ? 'Editar Libro' : 'Nuevo Libro del Mes'}
                                    </h2>
                                    <button onClick={() => setBookModalOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            { key: 'title', label: 'Título', placeholder: 'Ej: Padre Rico, Padre Pobre' },
                                            { key: 'author', label: 'Autor', placeholder: 'Ej: Robert Kiyosaki' },
                                            { key: 'month_label', label: 'Etiqueta del Mes', placeholder: 'Ej: Marzo 2026' },
                                            { key: 'month_order', label: 'Orden (YYYYMM)', placeholder: 'Ej: 202603', type: 'number' },
                                            { key: 'cover_url', label: 'URL Portada (imagen)', placeholder: 'https://...', full: true },
                                            { key: 'pdf_url', label: 'URL del PDF', placeholder: 'https://...pdf', full: true },
                                            { key: 'audio_url', label: 'URL del Audio (MP3)', placeholder: 'https://...mp3', full: true },
                                        ].map(({ key, label, placeholder, type, full }) => (
                                            <div key={key} className={full ? 'md:col-span-2' : ''}>
                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</label>
                                                <input
                                                    type={type || 'text'}
                                                    value={(bookForm as any)[key]}
                                                    onChange={e => setBookForm(prev => ({ ...prev, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                                                    placeholder={placeholder}
                                                    className="w-full bg-slate-950 border border-slate-800 p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                                                />
                                            </div>
                                        ))}
                                        <div className="md:col-span-2">
                                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Descripción</label>
                                            <textarea
                                                rows={3}
                                                value={bookForm.description}
                                                onChange={e => setBookForm(prev => ({ ...prev, description: e.target.value }))}
                                                placeholder="Resumen del libro..."
                                                className="w-full bg-slate-950 border border-slate-800 p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all resize-none"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="b_active" checked={bookForm.is_active} onChange={e => setBookForm(prev => ({ ...prev, is_active: e.target.checked }))} className="w-4 h-4" />
                                            <label htmlFor="b_active" className="text-xs font-black text-emerald-400 uppercase tracking-widest cursor-pointer">Publicado</label>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <input type="checkbox" id="b_featured" checked={bookForm.is_featured} onChange={e => setBookForm(prev => ({ ...prev, is_featured: e.target.checked }))} className="w-4 h-4" />
                                            <label htmlFor="b_featured" className="text-xs font-black text-amber-400 uppercase tracking-widest cursor-pointer">★ Libro del Mes activo</label>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-4 border-t border-slate-800">
                                        <button onClick={() => setBookModalOpen(false)} className="flex-1 py-3 border border-slate-700 text-slate-400 font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all">
                                            Cancelar
                                        </button>
                                        <button onClick={saveBook} className="flex-[2] py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                            <Save size={16} /> {editingBook ? 'Actualizar' : 'Publicar Libro'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── TUTORIALS PANEL ── */}
            {mainTab === 'tutorials' && <><div>{/* spacer */}</div>
            {/* MAIN CATALOG TABLE */}
            <div className="bg-[#0c0f18] border border-slate-800 rounded-none shadow-2xl overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/30">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="FILTRAR POR TÍTULO O CATEGORÍA..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-none pl-12 pr-4 py-3 text-xs font-black uppercase tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all font-mono-tech"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-1 bg-slate-800 border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filteredTutorials.length} CONTENIDOS DETECTADOS
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/80">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Contenido / Tipo</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Categoría</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fuente / URL</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Archivos...</p>
                                    </td>
                                </tr>
                            ) : filteredTutorials.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">No se detectó material educativo.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTutorials.map((tutorial) => (
                                    <tr key={tutorial.id} className="group hover:bg-blue-500/5 transition-colors border-l-2 border-transparent hover:border-blue-500">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-none border border-slate-800 flex items-center justify-center shrink-0 ${tutorial.content_type === 'VIDEO' ? 'text-blue-400 bg-blue-500/5' : 'text-emerald-400 bg-emerald-500/5'}`}>
                                                    {getIcon(tutorial.content_type)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-white uppercase tracking-tighter italic">{tutorial.title}</div>
                                                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">
                                                        {tutorial.content_type} RESOURCE
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <span className="px-2 py-1 bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700">
                                                {tutorial.category}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 max-w-[200px]">
                                                <LinkIcon size={14} className="text-slate-500 shrink-0" />
                                                <span className="text-[10px] font-mono-tech text-slate-400 truncate uppercase">
                                                    {tutorial.url.replace(/(^\w+:|^)\/\//, '')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${tutorial.is_active ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                                                <span className={`text-[10px] font-black tracking-widest ${tutorial.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {tutorial.is_active ? 'ENABLED' : 'HIDDEN'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => toggleStatus(tutorial.id, tutorial.is_active)}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-none border transition-all ${tutorial.is_active ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                                                    title={tutorial.is_active ? "Ocultar Contenido" : "Mostrar Contenido"}
                                                >
                                                    {tutorial.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(tutorial)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-none border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteTutorial(tutorial.id)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-none border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ENHANCED MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in overflow-y-auto font-rajdhani">
                    <div className="bg-[#0c0f18] border border-slate-800 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-5xl flex flex-col lg:flex-row h-auto lg:h-[80vh]">

                        {/* LEFT: FORM SECTION */}
                        <div className="flex-1 flex flex-col border-r border-slate-800 min-h-0">
                            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div>
                                    <h2 className="text-xl font-black text-white font-orbitron flex items-center gap-3 uppercase italic leading-none">
                                        <BookOpen className="text-blue-500" />
                                        {editingTutorial ? 'Editar Recurso' : 'Nuevo Recurso Educativo'}
                                    </h2>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Configuración de Material de Entrenamiento</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
                                <form id="tutorialForm" onSubmit={handleSubmit} className="space-y-6 pb-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Título del Contenido</label>
                                            <input
                                                type="text"
                                                name="title"
                                                required
                                                value={formData.title}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-sm font-black text-white uppercase focus:outline-none focus:border-blue-500 transition-all"
                                                placeholder="EJ: GUÍA DE CONFIGURACIÓN DE WALLET"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Resumen / Descripción</label>
                                            <textarea
                                                name="description"
                                                required
                                                rows={3}
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-all resize-none"
                                                placeholder="Describa brevemente el contenido de este recurso..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Tipo de Recurso</label>
                                            <select
                                                name="content_type"
                                                value={formData.content_type}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-xs font-black text-white uppercase focus:outline-none focus:border-blue-500 transition-all"
                                            >
                                                <option value="VIDEO">VIDEO (ENLACE)</option>
                                                <option value="PDF">ARCHIVO PDF (URL)</option>
                                                <option value="DOCUMENT">DOCUMENTO / GUÍA</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Categoría</label>
                                            <select
                                                name="category"
                                                value={formData.category}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-xs font-black text-white uppercase focus:outline-none focus:border-blue-500 transition-all"
                                            >
                                                <option value="GENERAL">GENERAL</option>
                                                <option value="PLATAFORMA">USO DE PLATAFORMA</option>
                                                <option value="INVERSIONES">ESTRATEGIA INVERSIONES</option>
                                                <option value="NETWORK">RED Y REFERIDOS</option>
                                                <option value="SEGURIDAD">SEGURIDAD (2FA)</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Enlace Directo (URL)</label>
                                            <div className="relative">
                                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="url"
                                                    name="url"
                                                    required
                                                    value={formData.url}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-none pl-12 pr-4 py-4 text-xs text-blue-400 focus:outline-none focus:border-blue-500 transition-all font-mono-tech"
                                                    placeholder="https://youtube.com/watch?v=... o URL de PDF"
                                                />
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Imagen Miniatura (URL)</label>
                                            <input
                                                type="url"
                                                name="thumbnail_url"
                                                value={formData.thumbnail_url}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-xs text-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                                                placeholder="DEJAR VACÍO PARA USAR PREDETERMINADA"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800 md:col-span-2">
                                            <input
                                                type="checkbox"
                                                id="is_active"
                                                name="is_active"
                                                checked={formData.is_active}
                                                onChange={handleInputChange}
                                                className="w-5 h-5 rounded-none border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                            />
                                            <label htmlFor="is_active" className="text-xs font-black text-emerald-500 uppercase tracking-widest cursor-pointer select-none font-orbitron">
                                                Publicar Inmediatamente (Visible para Usuarios)
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* RIGHT: PREVIEW SECTION */}
                        <div className="w-full lg:w-[380px] bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-5">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                            </div>

                            <div className="w-full relative z-10 flex flex-col items-center">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2 animate-pulse font-orbitron">
                                    <Eye size={12} /> Visual Preview
                                </p>

                                {/* TUTORIAL CARD PREVIEW */}
                                <div className="w-full max-w-[300px] bg-[#0c0f18] border border-slate-800 overflow-hidden shadow-2xl">
                                    <div className="relative h-40 bg-slate-900 overflow-hidden border-b border-slate-800">
                                        {formData.thumbnail_url ? (
                                            <img src={formData.thumbnail_url} alt="Preview" className="w-full h-full object-cover opacity-60" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
                                                {formData.content_type === 'VIDEO' ? <Play size={40} className="text-blue-500/50" /> : <FileText size={40} className="text-emerald-500/50" />}
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f18] to-transparent"></div>
                                        <div className="absolute top-2 left-2">
                                            <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[8px] font-black uppercase tracking-widest">
                                                {formData.category}
                                            </span>
                                        </div>
                                        {formData.content_type === 'VIDEO' && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/50 flex items-center justify-center backdrop-blur-sm">
                                                    <Play size={20} className="text-white fill-white translate-x-0.5" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-sm font-black text-white uppercase italic truncate font-orbitron">{formData.title || 'SIN_TÍTULO_ASIGNADO'}</h3>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 mb-3">
                                            Resource Type: {formData.content_type}
                                        </p>
                                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed h-[30px]">
                                            {formData.description || 'Proporcione una descripción para visualizar el bloque informativo...'}
                                        </p>
                                        <div className="mt-4 pt-4 border-t border-slate-800/50">
                                            <div className={`w-full py-2 bg-slate-900 border border-slate-800 text-center font-black text-[9px] uppercase tracking-[0.2em] ${formData.content_type === 'VIDEO' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                {formData.content_type === 'VIDEO' ? 'Reproducir Tutorial' : 'Abrir Documento'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 w-full space-y-4">
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 py-3 border border-slate-800 font-black text-[10px] text-slate-500 uppercase tracking-widest hover:bg-slate-900 transition-all font-orbitron"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            form="tutorialForm"
                                            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-[0_0_30px_rgba(37,99,235,0.2)] font-orbitron"
                                        >
                                            {editingTutorial ? 'ACTUALIZAR' : 'REGISTRAR'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </> /* end tutorials tab */}
        </div>
    );
}

