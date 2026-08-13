import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product } from '../types';
import {
    Plus, Edit2, Trash2, CheckCircle, XCircle, Search, ShoppingBag,
    DollarSign, Package, Link as LinkIcon, Star, TrendingUp,
    BarChart3, Layers, Layout, Eye, Shield, Zap, ExternalLink,
    RefreshCw
} from 'lucide-react';

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalRevenue: 0,
        activeCount: 0,
        flagshipCount: 0
    });

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        image_url: '',
        stock: null as number | null,
        myfxbook_url: '',
        category: 'SOFTWARE',
        is_active: true,
        is_flagship: false
    });

    useEffect(() => {
        fetchProducts();
        fetchSalesStats();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);

            // Calculate basic stats from products
            if (data) {
                setStats(prev => ({
                    ...prev,
                    activeCount: data.filter(p => p.is_active).length,
                    flagshipCount: data.filter(p => p.is_flagship).length
                }));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSalesStats = async () => {
        try {
            const { data, error } = await supabase
                .from('product_purchases')
                .select('amount');

            if (error) throw error;

            if (data) {
                const total = data.reduce((acc, curr) => acc + curr.amount, 0);
                setStats(prev => ({
                    ...prev,
                    totalSales: data.length,
                    totalRevenue: total
                }));
            }
        } catch (error) {
            console.error('Error fetching sales stats:', error);
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
                [name]: name === 'price' || name === 'stock' ? (value === '' ? null : Number(value)) : value
            }));
        }
    };

    const openAddModal = () => {
        setEditingProduct(null);
        setFormData({
            name: '',
            description: '',
            price: 0,
            image_url: '',
            stock: null,
            myfxbook_url: '',
            category: 'SOFTWARE',
            is_active: true,
            is_flagship: false
        });
        setIsModalOpen(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            price: product.price,
            image_url: product.image_url || '',
            stock: product.stock,
            myfxbook_url: product.myfxbook_url || '',
            category: product.category,
            is_active: product.is_active,
            is_flagship: product.is_flagship
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

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update(payload)
                    .eq('id', editingProduct.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('products')
                    .insert([payload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error al guardar el producto.');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchProducts();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const deleteProduct = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar este producto permanentemente?')) return;
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchProducts();
        } catch (error) {
            console.error('Error deleting product:', error);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-fade-in relative z-10 w-full max-w-full pb-20">
            {/* HEADER SECTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-400 to-cyan-400 font-orbitron tracking-tighter uppercase italic">
                        PRODUCT <span className="text-white">COMMAND CENTER</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-black uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        Sistema de Gestión de Activos Digitales v2.0
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="group relative px-6 py-3 bg-blue-600 text-white rounded-none clip-corner transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <div className="relative flex items-center gap-3">
                        <Plus size={20} className="font-black" />
                        <span className="font-black text-xs uppercase tracking-[0.2em]">Desplegar Activo</span>
                    </div>
                </button>
            </div>

            {/* QUICK STATS DASHBOARD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Volumen Total', value: `$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Unidades Vendidas', value: stats.totalSales, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                    { label: 'Nodos Activos', value: stats.activeCount, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Elite Assets', value: stats.flagshipCount, icon: Star, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map((stat, i) => (
                    <div key={i} className="bg-slate-900/50 border border-slate-800 p-6 rounded-none relative group overflow-hidden">
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${stat.color}`}>
                            <stat.icon size={48} />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                            <h3 className={`text-2xl font-black font-orbitron capitalize ${stat.color}`}>{stat.value}</h3>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1 w-0 group-hover:w-full transition-all duration-500 ${stat.bg.replace('/10', '')}`}></div>
                    </div>
                ))}
            </div>

            {/* MAIN CATALOG TABLE */}
            <div className="bg-[#0c0f18] border border-slate-800 rounded-none shadow-2xl overflow-hidden mt-8">
                <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/30">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="FILTRAR POR NOMBRE O CATEGORÍA..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-none pl-12 pr-4 py-3 text-xs font-black uppercase tracking-widest text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all font-mono-tech"
                        />
                    </div>
                    <div className="flex gap-2">
                        <div className="px-3 py-1 bg-slate-800 border border-slate-700 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {filteredProducts.length} ITEMS DETECTADOS
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/80">
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Activo Digital</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Precio Acceso</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Capacidad/Stock</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estado Nodo</th>
                                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Terminal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sincronizando Base de Datos...</p>
                                    </td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">No se detectaron activos en este sector.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className="group hover:bg-blue-500/5 transition-colors border-l-2 border-transparent hover:border-blue-500">
                                        <td className="p-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-none border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0 relative overflow-hidden group-hover:border-blue-500/50 transition-colors">
                                                    {product.image_url ? (
                                                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                    ) : (
                                                        <ShoppingBag className="w-6 h-6 text-slate-700" />
                                                    )}
                                                    {product.is_flagship && <div className="absolute top-0 right-0 w-3 h-3 bg-amber-500 rotate-45 translate-x-1.5 -translate-y-1.5 shadow-[0_0_10px_gold]"></div>}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-black text-white uppercase tracking-tighter italic">{product.name}</div>
                                                        {product.is_flagship && <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 font-black uppercase">Elite</span>}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1 flex items-center gap-2">
                                                        <Layers size={10} />
                                                        {product.category}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="font-mono-tech text-lg font-black text-emerald-400 italic">${product.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className={`h-full ${product.stock === null ? 'w-full bg-blue-500' : 'w-1/2 bg-amber-500'}`}></div>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase">{product.stock === null ? '∞' : product.stock}</span>
                                            </div>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${product.is_active ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                                                <span className={`text-[10px] font-black tracking-widest ${product.is_active ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {product.is_active ? 'ONLINE' : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => toggleStatus(product.id, product.is_active)}
                                                    className={`w-9 h-9 flex items-center justify-center rounded-none border transition-all ${product.is_active ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                                                    title={product.is_active ? "Desactivar Nodo" : "Activar Nodo"}
                                                >
                                                    {product.is_active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    className="w-9 h-9 flex items-center justify-center rounded-none border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => deleteProduct(product.id)}
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

            {/* ENHANCED MODAL WITH LIVE PREVIEW */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-fade-in overflow-y-auto">
                    <div className="bg-[#0c0f18] border border-slate-800 rounded-none shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-6xl flex flex-col lg:flex-row h-auto lg:h-[85vh]">

                        {/* LEFT: FORM SECTION */}
                        <div className="flex-1 flex flex-col border-r border-slate-800 min-h-0">
                            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <div>
                                    <h2 className="text-xl font-black text-white font-orbitron flex items-center gap-3 uppercase italic">
                                        <Package className="text-blue-500" />
                                        {editingProduct ? 'Configurar Nodo' : 'Inyectar Nuevo Activo'}
                                    </h2>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Configuración de Parámetros Digitales</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                                    <XCircle size={24} />
                                </button>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-800">
                                <form id="productForm" onSubmit={handleSubmit} className="space-y-6 pb-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Identificador de Producto</label>
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={formData.name}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-sm font-bold text-white uppercase focus:outline-none focus:border-blue-500 transition-all"
                                                placeholder="EJ: NOVA DIGITAL GOLD v5.0"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción Técnica</label>
                                            <textarea
                                                name="description"
                                                required
                                                rows={4}
                                                value={formData.description}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500 transition-all resize-none"
                                                placeholder="Protocolos, funcionalidades y ventajas competitivas..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Precio de Acceso (USDT)</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
                                                <input
                                                    type="number"
                                                    name="price"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    value={formData.price}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-none pl-12 pr-4 py-4 text-lg font-black text-white focus:outline-none focus:border-emerald-500 transition-all font-mono-tech italic"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Capacidad de Nodos (Stock)</label>
                                            <input
                                                type="number"
                                                name="stock"
                                                value={formData.stock || ''}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-all"
                                                placeholder="DEJAR VACÍO PARA ILIMITADO"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Directorio de Imagen (URL)</label>
                                            <input
                                                type="url"
                                                name="image_url"
                                                value={formData.image_url}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-none p-4 text-xs text-blue-400 focus:outline-none focus:border-blue-500 transition-all"
                                                placeholder="URL DE IMAGEN (JPG, PNG, WEBP)"
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Enlace de Auditoría (MyFxBook)</label>
                                            <div className="relative">
                                                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                                <input
                                                    type="url"
                                                    name="myfxbook_url"
                                                    value={formData.myfxbook_url}
                                                    onChange={handleInputChange}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-none pl-12 pr-4 py-4 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 transition-all"
                                                    placeholder="URL PÚBLICA DE MYFXBOOK"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800">
                                            <input
                                                type="checkbox"
                                                id="is_flagship"
                                                name="is_flagship"
                                                checked={formData.is_flagship}
                                                onChange={handleInputChange}
                                                className="w-5 h-5 rounded-none border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                                            />
                                            <label htmlFor="is_flagship" className="flex items-center gap-2 text-xs font-black text-amber-500 uppercase tracking-widest cursor-pointer select-none italic">
                                                <Star size={14} fill="currentColor" />
                                                Activo Elite (Predeterminado)
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-3 p-4 bg-slate-950 border border-slate-800">
                                            <input
                                                type="checkbox"
                                                id="is_active"
                                                name="is_active"
                                                checked={formData.is_active}
                                                onChange={handleInputChange}
                                                className="w-5 h-5 rounded-none border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                            />
                                            <label htmlFor="is_active" className="text-xs font-black text-emerald-500 uppercase tracking-widest cursor-pointer select-none">
                                                Nodo Operativo (Visible)
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* RIGHT: LIVE HUD PREVIEW SECTION */}
                        <div className="w-full lg:w-[450px] bg-slate-950 p-8 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                            {/* Visual background decorations */}
                            <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-5">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
                            </div>

                            <div className="w-full relative z-10 flex flex-col items-center">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-2 animate-pulse">
                                    <Eye size={12} /> Live HUd Preview
                                </p>

                                {/* REAL TIME PRODUCT CARD PREVIEW (Mirroring User Portal) */}
                                <div className={`w-full max-w-[340px] relative group ${formData.is_flagship ? 'outline outline-2 outline-amber-500/20' : ''}`}>
                                    {formData.is_flagship && (
                                        <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-none blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                                    )}
                                    <div className="relative flex flex-col h-full bg-[#0c0f18] border border-slate-800 overflow-hidden shadow-2xl">
                                        {formData.is_flagship && (
                                            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500 text-[#0c0f18] font-black text-[8px] uppercase tracking-tighter italic">
                                                <Star size={10} fill="currentColor" />
                                                ELITE SOFTWARE
                                            </div>
                                        )}
                                        <div className="relative h-48 overflow-hidden bg-slate-900 border-b border-slate-800">
                                            {formData.image_url ? (
                                                <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover opacity-80" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-slate-800" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f18] via-transparent to-transparent"></div>
                                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                                                <div>
                                                    <span className="px-1.5 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[8px] font-black uppercase tracking-widest mb-1.5 block w-fit">
                                                        {formData.category}
                                                    </span>
                                                    <h3 className="text-xl font-black text-white font-orbitron uppercase tracking-tighter truncate max-w-[180px]">
                                                        {formData.name || 'NEW_ASSET'}
                                                    </h3>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-black text-white italic">${formData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <p className="text-slate-400 text-[10px] leading-relaxed mb-4 line-clamp-3">
                                                {formData.description || 'Proporcione una descripción técnica para visualizar el comportamiento del bloque de texto...'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 mb-4">
                                                <div className="flex items-center gap-2 p-1.5 bg-slate-900/50 border border-slate-800">
                                                    <Shield size={12} className="text-blue-500" />
                                                    <span className="text-[8px] font-black text-white uppercase">Soporte 24/7</span>
                                                </div>
                                                <div className="flex items-center gap-2 p-1.5 bg-slate-900/50 border border-slate-800">
                                                    <Zap size={12} className="text-cyan-500" />
                                                    <span className="text-[8px] font-black text-white uppercase italic">Inmediata</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                {formData.myfxbook_url && (
                                                    <div className="w-full py-1.5 border border-slate-700 bg-slate-800 text-white font-black text-[9px] uppercase tracking-widest text-center flex items-center justify-center gap-2">
                                                        <ExternalLink size={12} /> AUDITORIA MYFXBOOK
                                                    </div>
                                                )}
                                                <div className={`w-full py-2.5 font-black text-[10px] uppercase tracking-[0.2em] text-center ${formData.is_flagship ? 'bg-amber-500 text-[#0c0f18]' : 'bg-blue-600 text-white'}`}>
                                                    ADQUIRIR LICENCIA
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 w-full space-y-4">
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-none">
                                        <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest leading-relaxed">
                                            <span className="text-blue-300">SISTEMA:</span> La previsualización refleja fielmente el renderizado en el portal de usuario. Verifique el contraste de la imagen y la longitud de la descripción.
                                        </p>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 py-3 border border-slate-800 font-black text-[10px] text-slate-500 uppercase tracking-widest hover:bg-slate-900 transition-all"
                                        >
                                            Abortar
                                        </button>
                                        <button
                                            type="submit"
                                            form="productForm"
                                            className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-[0.3em] transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                        >
                                            {editingProduct ? 'ACTUALIZAR NODO' : 'INICIALIZAR ACTIVO'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
