import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Promotion, PromotionType } from '../types';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Search, Calendar, Tag, Percent, Image as ImageIcon, Info } from 'lucide-react';

export default function Promotions() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'CASHBACK' as PromotionType,
        reward_value: 0,
        min_investment: 0,
        start_date: '',
        end_date: '',
        image_url: '',
        coupon_code: '',
        is_flash_offer: false
    });

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        try {
            const { data, error } = await supabase
                .from('promotions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPromotions(data || []);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : (['reward_value', 'min_investment'].includes(name) ? Number(value) : value)
        }));
    };

    const openAddModal = () => {
        setEditingPromo(null);
        setFormData({
            title: '',
            description: '',
            type: 'CASHBACK',
            reward_value: 0,
            min_investment: 0,
            start_date: new Date().toISOString().slice(0, 16),
            end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
            image_url: '',
            coupon_code: '',
            is_flash_offer: false
        });
        setIsModalOpen(true);
    };

    const openEditModal = (promo: Promotion) => {
        setEditingPromo(promo);
        setFormData({
            title: promo.title,
            description: promo.description,
            type: promo.type,
            reward_value: promo.reward_value,
            min_investment: promo.min_investment || 0,
            start_date: new Date(promo.start_date).toISOString().slice(0, 16),
            end_date: new Date(promo.end_date).toISOString().slice(0, 16),
            image_url: promo.image_url || '',
            coupon_code: promo.coupon_code || '',
            is_flash_offer: promo.is_flash_offer || false
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                reward_value: formData.reward_value,
                min_investment: formData.min_investment || null,
                start_date: new Date(formData.start_date).toISOString(),
                end_date: new Date(formData.end_date).toISOString(),
                image_url: formData.image_url || null,
                coupon_code: formData.coupon_code || null,
                is_flash_offer: formData.is_flash_offer
            };

            if (editingPromo) {
                const { error } = await supabase
                    .from('promotions')
                    .update(payload)
                    .eq('id', editingPromo.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('promotions')
                    .insert([payload]);
                if (error) throw error;
            }

            setIsModalOpen(false);
            fetchPromotions();
        } catch (error) {
            console.error('Error saving promotion:', error);
            alert('Error al guardar la promoción.');
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('promotions')
                .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    const deletePromotion = async (id: string) => {
        if (!window.confirm('¿Estás seguro de que deseas eliminar esta promoción de forma permanente?')) return;
        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error('Error deleting promotion:', error);
        }
    };

    const filteredPromotions = promotions.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (isActive: boolean, endDate: string) => {
        const isExpired = new Date(endDate) < new Date();
        if (!isActive) return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
        if (isExpired) return 'bg-red-500/10 text-red-500 border-red-500/20';
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    };

    const getStatusText = (isActive: boolean, endDate: string) => {
        const isExpired = new Date(endDate) < new Date();
        if (!isActive) return 'INACTIVA';
        if (isExpired) return 'EXPIRADA';
        return 'ACTIVA / EN VIVO';
    };

    return (
        <div className="space-y-6 animate-fade-in relative z-10 w-full max-w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 font-orbitron">
                        Gestión de Promociones
                    </h1>
                    <p className="text-sm text-slate-400">
                        Crea cashbacks, bonos y descuentos para inyectar liquidez y fidelizar a tu red de líderes.
                    </p>
                </div>
                <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 bg-proyecto-accent text-white rounded-lg hover:bg-proyecto-accent-hover transition-all"
                >
                    <Plus size={18} />
                    Nueva Promoción
                </button>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar promoción por título o tipo..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-proyecto-accent transition-colors"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-800/50">
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Promoción</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Beneficios</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Duración</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400">Cargando promociones...</td>
                                </tr>
                            ) : filteredPromotions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400">No se encontraron promociones. Crea una nueva para empezar.</td>
                                </tr>
                            ) : (
                                filteredPromotions.map((promo) => (
                                    <tr key={promo.id} className="hover:bg-slate-800/30 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                {promo.image_url ? (
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0 relative group">
                                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10" />
                                                        <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                                        {promo.type === 'CASHBACK' ? <Percent className="w-5 h-5 text-proyecto-accent" /> : <Tag className="w-5 h-5 text-proyecto-gold" />}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-white mb-0.5">{promo.title}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">{promo.type}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-bold text-white mb-0.5">
                                                {promo.type === 'CASHBACK' || promo.type === 'DISCOUNT' ? `${promo.reward_value}%` : `$${promo.reward_value}`}
                                            </div>
                                            <div className="text-[10px] text-slate-400">Min. {promo.min_investment ? `$${promo.min_investment}` : 'N/A'}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-1">
                                                <Calendar size={12} className="text-slate-500" />
                                                {new Date(promo.start_date).toLocaleDateString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                <Calendar size={12} className="text-slate-600" />
                                                {new Date(promo.end_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider border ${getStatusColor(promo.is_active, promo.end_date)}`}>
                                                {getStatusText(promo.is_active, promo.end_date)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => toggleStatus(promo.id, promo.is_active)}
                                                    title={promo.is_active ? 'Desactivar' : 'Activar'}
                                                    className={`p-1.5 rounded-lg transition-colors ${promo.is_active ? 'text-amber-400 hover:bg-amber-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`}
                                                >
                                                    {promo.is_active ? <XCircle size={18} /> : <CheckCircle size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(promo)}
                                                    title="Editar"
                                                    className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => deletePromotion(promo.id)}
                                                    title="Eliminar permanentemente"
                                                    className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
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

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#0f141e] border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
                            <h2 className="text-xl font-bold text-white font-orbitron">
                                {editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <form id="promoForm" onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Título Atractivo <span className="text-red-400">*</span></label>
                                        <input
                                            type="text"
                                            name="title"
                                            required
                                            value={formData.title}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors"
                                            placeholder="Ej: Promo Flash Fin de Semana"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Descripción y Condiciones <span className="text-red-400">*</span></label>
                                        <textarea
                                            name="description"
                                            required
                                            rows={3}
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors resize-none"
                                            placeholder="Explica a tus usuarios qué deben hacer para obtener la recompensa."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Clase de Bonificación <span className="text-red-400">*</span></label>
                                        <select
                                            name="type"
                                            required
                                            value={formData.type}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors"
                                        >
                                            <option value="CASHBACK">Cashback (%)</option>
                                            <option value="BONUS">Bono Fijo (USDT)</option>
                                            <option value="DISCOUNT">Descuento Compra (%)</option>
                                            <option value="EVENT">Evento General</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Valor Obtenido (Monto o %) <span className="text-red-400">*</span></label>
                                        <input
                                            type="number"
                                            name="reward_value"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.reward_value}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Inversión Base Mínima (USDT)</label>
                                        <input
                                            type="number"
                                            name="min_investment"
                                            min="0"
                                            step="1"
                                            value={formData.min_investment}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors"
                                            placeholder="0 = Aplica a todo"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2">Banner Image URL (Opcional)</label>
                                        <div className="relative">
                                            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="url"
                                                name="image_url"
                                                value={formData.image_url}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-3 py-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors"
                                                placeholder="https://imgur.com/tu-promo.png"
                                            />
                                        </div>
                                        <p className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                            <Info size={12} className="text-proyecto-accent" />
                                            Recomendado: <b>1200x600px</b> (Relación 2:1). Las imágenes se ajustarán automáticamente.
                                        </p>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Código de Cupón (Opcional)</label>
                                            <input
                                                type="text"
                                                name="coupon_code"
                                                value={formData.coupon_code}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors font-mono"
                                                placeholder="EJ: NOVA DIGITAL10"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="relative inline-flex items-center cursor-pointer mt-6">
                                                <input
                                                    type="checkbox"
                                                    name="is_flash_offer"
                                                    checked={formData.is_flash_offer}
                                                    onChange={handleInputChange}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-proyecto-accent"></div>
                                                <span className="ml-3 text-xs font-medium text-slate-400 uppercase tracking-widest">¿Oferta Flash Semanal?</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Comienza el: <span className="text-red-400">*</span></label>
                                        <input
                                            type="datetime-local"
                                            name="start_date"
                                            required
                                            value={formData.start_date}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors [color-scheme:dark]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 uppercase tracking-widest mb-2 font-orbitron">Termina el: (Expiración) <span className="text-red-400">*</span></label>
                                        <input
                                            type="datetime-local"
                                            name="end_date"
                                            required
                                            value={formData.end_date}
                                            onChange={handleInputChange}
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-proyecto-accent transition-colors [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="promoForm"
                                className="px-6 py-2.5 bg-proyecto-accent hover:bg-proyecto-accent-hover text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                {editingPromo ? 'Guardar Cambios' : 'Lanzar Promoción'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
