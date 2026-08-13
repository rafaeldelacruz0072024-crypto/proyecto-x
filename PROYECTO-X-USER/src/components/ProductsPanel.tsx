import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Product, Profile } from '../types';
import {
    ShoppingBag, Star, ExternalLink, Shield, Zap, CheckCircle2,
    DollarSign, Wallet, RefreshCw, AlertTriangle, ArrowRight,
    QrCode, Copy, FileText, Check, Layers, Cpu, Database, Package
} from 'lucide-react';

interface ProductsPanelProps {
    profile: Profile | null;
    onPurchaseSuccess?: () => void;
}

interface UserPurchase extends Product {
    purchase_id: string;
    purchase_status: string;
    purchase_date: string;
}

export default function ProductsPanel({ profile, onPurchaseSuccess }: ProductsPanelProps) {
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [userPurchases, setUserPurchases] = useState<UserPurchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'BALANCE' | 'USDT'>('BALANCE');
    const [purchasing, setPurchasing] = useState(false);
    const [hash, setHash] = useState('');
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<'MARKET' | 'MY_ASSETS'>('MARKET');
    const [activeInvestment, setActiveInvestment] = useState(0);

    const USDT_ADDRESS = "TDPs9m2v8v1U1U1U1U1U1U1U1U1U1U1U1U"; // Example TRC20 Address

    useEffect(() => {
        if (profile) {
            fetchAllData();
        }
    }, [profile]);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([fetchProducts(), fetchUserPurchases(), fetchActiveCapital()]);
        setLoading(false);
    };

    const fetchActiveCapital = async () => {
        if (!profile) return;
        try {
            const { data, error } = await supabase
                .from('investments')
                .select('amount')
                .eq('user_id', profile.id)
                .eq('status', 'ACTIVE');

            if (error) throw error;
            const total = (data || []).reduce((acc, curr) => acc + curr.amount, 0);
            setActiveInvestment(total);
        } catch (error) {
            console.error('Error fetching active capital:', error);
        }
    };

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('is_flagship', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const fetchUserPurchases = async () => {
        if (!profile) return;
        try {
            const { data, error } = await supabase
                .from('product_purchases')
                .select(`
                    id,
                    status,
                    created_at,
                    products (*)
                `)
                .eq('user_id', profile.id);

            if (error) throw error;

            const flattened: UserPurchase[] = (data || [])
                .filter(item => item.products !== null)
                .map(item => ({
                    ...(item.products as any),
                    purchase_id: item.id,
                    purchase_status: item.status,
                    purchase_date: item.created_at
                }));

            setUserPurchases(flattened);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(USDT_ADDRESS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePurchase = async () => {
        if (!selectedProduct || !profile) return;
        setPurchasing(true);

        try {
            if (paymentMethod === 'BALANCE') {
                // REGLA DE ORO FRONTEND
                if (selectedProduct.is_flagship && activeInvestment < 500) {
                    alert('REGLA DE ORO: Se requiere un capital activo de al menos $500 para adquirir este activo Elite.');
                    setPurchasing(false);
                    return;
                }

                if (profile.wallet_balance < selectedProduct.price) {
                    alert(t('products.funds_insufficient'));
                    setPurchasing(false);
                    return;
                }

                const { error: debitError } = await supabase.rpc('process_product_purchase', {
                    p_user_id: profile.id,
                    p_product_id: selectedProduct.id,
                    p_amount: selectedProduct.price,
                    p_method: 'BALANCE'
                });

                if (debitError) throw debitError;
                alert('Purchase successful! License activated.');
            } else {
                if (!hash.trim()) {
                    alert('Please provide the Transaction Hash (TXID) to verify your payment.');
                    setPurchasing(false);
                    return;
                }

                const { error } = await supabase
                    .from('product_purchases')
                    .insert([{
                        user_id: profile.id,
                        product_id: selectedProduct.id,
                        amount: selectedProduct.price,
                        payment_method: 'USDT',
                        status: 'PENDING',
                        details: { hash, network: 'TRC20' }
                    }]);

                if (error) throw error;
                alert('Payment reported! Our team will verify the hash and activate your license shortly.');
            }

            setIsPurchaseModalOpen(false);
            setHash('');
            fetchAllData();
            if (onPurchaseSuccess) onPurchaseSuccess();
        } catch (error: any) {
            console.error('Purchase error:', error);
            alert(`Error: ${error.message || 'Try again'}`);
        } finally {
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="relative">
                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse"></div>
                </div>
                <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-[10px] animate-pulse">Sincronizando Mercado Digital...</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in relative pb-10">
            {/* HUD HEADER */}
            <div className="relative group overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-none blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative bg-[#0c0f18] border border-slate-800 p-8 rounded-none backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em]">SISTEMA OPERATIVO</span>
                        </div>
                        <h2 className="text-4xl font-black text-white font-orbitron tracking-tighter uppercase italic leading-none mb-3">
                            GK <span className="text-blue-500">DIGITAL</span> ASSETS
                        </h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest max-w-xl">
                            {viewMode === 'MARKET' ? t('products.subtitle') : 'Gestión y control de tus activos tecnológicos adquiridos.'}
                        </p>
                    </div>

                    {/* TAB SWITCHER */}
                    <div className="flex bg-slate-900/80 border border-slate-800 p-1.5 rounded-none backdrop-blur-md">
                        <button
                            onClick={() => setViewMode('MARKET')}
                            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all clip-corner ${viewMode === 'MARKET' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <ShoppingBag size={14} />
                                {t('products.marketplace')}
                            </div>
                        </button>
                        <button
                            onClick={() => setViewMode('MY_ASSETS')}
                            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all clip-corner ${viewMode === 'MY_ASSETS' ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Cpu size={14} />
                                {t('products.my_assets')} ({userPurchases.length})
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'MARKET' ? (
                /* MARKETPLACE VIEW */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            className={`relative group h-full flex flex-col ${product.is_flagship ? 'outline outline-2 outline-amber-500/20' : ''}`}
                        >
                            {product.is_flagship && (
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-yellow-600 to-amber-500 rounded-none blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
                            )}

                            <div className="relative flex flex-col h-full bg-[#0c0f18] border border-slate-800 hover:border-slate-500 transition-all duration-700 overflow-hidden shadow-2xl">
                                {product.is_flagship && (
                                    <div className="absolute top-5 right-5 z-20 flex items-center gap-2 px-4 py-1.5 bg-amber-500 text-[#0c0f18] font-black text-[10px] uppercase tracking-tighter italic shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                                        <Star size={14} fill="currentColor" />
                                        ELITE SOFTWARE
                                    </div>
                                )}

                                <div className="relative h-72 overflow-hidden bg-slate-900 border-b border-slate-800">
                                    {product.is_flagship || product.name.includes('GOLD') ? (
                                        <img
                                            src="/nova_digital_gold_thumb.png"
                                            alt={product.name}
                                            className="w-full h-full object-cover transform scale-100 group-hover:scale-110 transition-transform duration-[2000ms] opacity-70 group-hover:opacity-100"
                                        />
                                    ) : product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="w-full h-full object-cover transform scale-100 group-hover:scale-110 transition-transform duration-[2000ms] opacity-70 group-hover:opacity-100"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ShoppingBag className="w-16 h-16 text-slate-800" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0f18] via-[#0c0f18]/20 to-transparent"></div>

                                    <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">{product.category}</span>
                                            </div>
                                            <h3 className="text-3xl font-black text-white font-orbitron uppercase tracking-tighter leading-none italic">
                                                {product.name}
                                            </h3>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Precio Acceso</div>
                                            <div className="text-4xl font-black text-white italic font-orbitron tracking-tighter">${product.price.toLocaleString('en-US')}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-8 flex-1 flex flex-col relative">
                                    {/* HUD Decorative Elements */}
                                    <div className="absolute top-0 right-0 w-24 h-24 border-t border-r border-slate-800/50 pointer-events-none"></div>
                                    <div className="absolute bottom-0 left-0 w-24 h-24 border-b border-l border-slate-800/50 pointer-events-none"></div>

                                    <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1 font-medium border-l-2 border-slate-800 pl-4 py-2">
                                        {product.description}
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 mb-8">
                                        <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 group/item hover:border-blue-500/50 transition-colors">
                                            <div className="w-10 h-10 rounded-none bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover/item:bg-blue-500/20 transition-all">
                                                <Shield size={20} className="text-blue-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('products.guarantee')}</p>
                                                <p className="text-[11px] font-bold text-white uppercase">{t('products.support_247')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 group/item hover:border-cyan-500/50 transition-colors">
                                            <div className="w-10 h-10 rounded-none bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover/item:bg-cyan-500/20 transition-all">
                                                <Zap size={20} className="text-cyan-500" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('products.execution')}</p>
                                                <p className="text-[11px] font-bold text-white uppercase italic">{t('products.immediate')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {product.myfxbook_url && (
                                            <a
                                                href={product.myfxbook_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/50 hover:bg-slate-700 text-white font-black text-[11px] uppercase tracking-[0.2em] transition-all border border-slate-700 clip-corner italic"
                                            >
                                                <ExternalLink size={18} />
                                                Ver Auditoría
                                            </a>
                                        )}
                                        <button
                                            onClick={() => {
                                                setSelectedProduct(product);
                                                setIsPurchaseModalOpen(true);
                                            }}
                                            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 font-black text-[11px] uppercase tracking-[0.3em] transition-all transform hover:scale-[1.02] active:scale-95 clip-corner italic ${product.is_flagship ? 'bg-amber-500 hover:bg-amber-600 text-[#0c0f18] shadow-[0_0_30px_rgba(245,158,11,0.3)] font-black' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]'}`}
                                        >
                                            <ShoppingBag size={18} />
                                            Adquirir Ahora
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* MY ASSETS VIEW */
                <div className="space-y-6">
                    {userPurchases.length === 0 ? (
                        <div className="py-24 text-center border-2 border-dashed border-slate-800 bg-slate-900/20">
                            <Database className="w-16 h-16 text-slate-800 mx-auto mb-6" />
                            <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs">Sin Activos Detectados</p>
                            <p className="text-slate-600 text-[10px] mt-2 italic">Visita el Marketplace para expandir tu infraestructura tecnológica.</p>
                            <button
                                onClick={() => setViewMode('MARKET')}
                                className="mt-8 px-8 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                            >
                                IR AL MARKETPLACE
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {userPurchases.map((purchase) => (
                                <div key={purchase.purchase_id} className="bg-[#0c0f18] border border-slate-800 p-6 relative group overflow-hidden">
                                    <div className={`absolute top-0 right-0 p-3 opacity-20 ${purchase.purchase_status === 'COMPLETED' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {purchase.purchase_status === 'COMPLETED' ? <CheckCircle2 size={32} /> : <div className="animate-pulse"><RefreshCw size={32} /></div>}
                                    </div>
                                    <div className="flex items-start gap-4 mb-6">
                                        <div className="w-16 h-16 bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                            {purchase.is_flagship || purchase.name.includes('GOLD') ? (
                                                <img src="/nova_digital_gold_thumb.png" alt={purchase.name} className="w-full h-full object-cover opacity-60" />
                                            ) : purchase.image_url ? (
                                                <img src={purchase.image_url} alt={purchase.name} className="w-full h-full object-cover opacity-60" />
                                            ) : (
                                                <Package className="text-slate-700" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-white font-black uppercase text-sm italic">{purchase.name}</h4>
                                            <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">ID: {purchase.purchase_id.slice(0, 8)}...</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-900">
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Estatus del Nodo</span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${purchase.purchase_status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {purchase.purchase_status === 'COMPLETED' ? t('products.status_operative') : t('products.status_pending_ver')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center bg-slate-950/50 p-2 border border-slate-900">
                                            <span className="text-[9px] font-black text-slate-500 uppercase">Adquisición</span>
                                            <span className="text-[9px] font-black text-white">{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <button
                                        disabled={purchase.purchase_status !== 'COMPLETED'}
                                        className="mt-6 w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-[0.2em] transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                                    >
                                        {t('products.access_license')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ENHANCED PURCHASE MODAL */}
            {isPurchaseModalOpen && selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-fade-in shadow-2xl">
                    <div className="bg-[#0c0f18] border border-slate-800 rounded-none w-full max-w-2xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col max-h-[95vh]">
                        <div className="p-8 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-white font-orbitron uppercase tracking-tighter italic">{t('products.confirm_acquisition')}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{t('products.secure_payment')}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPurchaseModalOpen(false)}
                                className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all border border-slate-800"
                            >
                                <RefreshCw className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                            {/* Product Info Summary */}
                            <div className="bg-slate-900/50 border border-slate-800 p-6 flex items-center gap-6 relative overflow-hidden">
                                <div className="w-24 h-24 bg-slate-950 border border-slate-800 flex items-center justify-center z-10 shrink-0 overflow-hidden">
                                    {selectedProduct.is_flagship || selectedProduct.name.includes('GOLD') ? (
                                        <img src="/nova_digital_gold_thumb.png" alt={selectedProduct.name} className="w-full h-full object-cover opacity-80" />
                                    ) : selectedProduct.image_url ? (
                                        <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-cover opacity-80" />
                                    ) : (
                                        <ShoppingBag size={40} className="text-slate-800" />
                                    )}
                                </div>
                                <div className="z-10 flex-1">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">{selectedProduct.category}</p>
                                    <h4 className="text-xl font-black text-white uppercase italic">{selectedProduct.name}</h4>
                                    <div className="flex items-baseline gap-2 mt-2">
                                        <span className="text-emerald-400 font-orbitron font-black text-3xl">${selectedProduct.price.toLocaleString('en-US')}</span>
                                        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">USDT</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method Switcher */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{t('products.select_method')}</p>
                                    <div className="h-px flex-1 bg-slate-800 mx-4"></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setPaymentMethod('BALANCE')}
                                        className={`flex flex-col items-center gap-3 p-6 border transition-all relative overflow-hidden group ${paymentMethod === 'BALANCE' ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-600 hover:bg-slate-900'}`}
                                    >
                                        {paymentMethod === 'BALANCE' && <div className="absolute top-0 right-0 w-8 h-8 bg-blue-500 rotate-45 translate-x-4 -translate-y-4"></div>}
                                        <Wallet size={28} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('products.wallet_bank')}</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('USDT')}
                                        className={`flex flex-col items-center gap-3 p-6 border transition-all relative overflow-hidden group ${paymentMethod === 'USDT' ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-600 hover:bg-slate-900'}`}
                                    >
                                        {paymentMethod === 'USDT' && <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500 rotate-45 translate-x-4 -translate-y-4"></div>}
                                        <Zap size={28} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t('products.usdt_crypto')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Method Content */}
                            <div className="animate-in fade-in duration-500">
                                {paymentMethod === 'BALANCE' ? (
                                    <div className="space-y-6">
                                        <div className="bg-slate-900/50 p-6 border border-slate-800">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('products.your_balance')}</span>
                                                <span className={`text-lg font-black font-orbitron ${profile && profile.wallet_balance >= selectedProduct.price ? 'text-emerald-400' : 'text-red-500'}`}>
                                                    ${profile?.wallet_balance.toLocaleString('en-US') || '0'}
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-800 rounded-none overflow-hidden flex">
                                                <div
                                                    className={`h-full transition-all duration-1000 ${profile && profile.wallet_balance >= selectedProduct.price ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                    style={{ width: profile ? Math.min(100, (profile.wallet_balance / selectedProduct.price) * 100) + '%' : '0%' }}
                                                ></div>
                                            </div>
                                            {profile && profile.wallet_balance < selectedProduct.price && (
                                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-3 flex items-center gap-2">
                                                    <AlertTriangle size={14} /> {t('products.funds_insufficient')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 flex flex-col md:flex-row items-center gap-8">
                                            <div className="p-4 bg-white rounded-none shrink-0 relative group">
                                                <QrCode size={120} className="text-slate-900" />
                                                <div className="absolute inset-0 border-2 border-emerald-500 scale-105 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                            <div className="flex-1 space-y-4 w-full">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">DIRECCIÓN (TRC20)</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="flex-1 bg-slate-950 p-3 text-[11px] text-white border border-slate-800 font-mono italic select-all break-all">
                                                            {USDT_ADDRESS}
                                                        </code>
                                                        <button
                                                            onClick={handleCopy}
                                                            className="p-3 bg-slate-800 hover:bg-slate-700 text-white transition-all shadow-lg"
                                                        >
                                                            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-relaxed">
                                                    {t('products.usdt_network_info', { amount: selectedProduct.price })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <FileText size={14} className="text-blue-500" />
                                                {t('products.tx_hash_label')}
                                            </label>
                                            <input
                                                type="text"
                                                value={hash}
                                                onChange={(e) => setHash(e.target.value)}
                                                placeholder={t('products.tx_hash_placeholder')}
                                                className="w-full bg-slate-950 border border-slate-800 p-4 text-xs font-bold text-white uppercase placeholder:text-slate-700 focus:outline-none focus:border-blue-500 transition-all font-mono italic"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Sticky Footer */}
                        <div className="p-8 bg-[#0a0d15] border-t border-blue-500/20 flex flex-col gap-6 shrink-0">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">{t('products.total_final')}</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-white font-orbitron tracking-tighter italic">${selectedProduct.price.toLocaleString('en-US')}</span>
                                        <span className="text-slate-500 text-xs font-black uppercase">USDT</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 mb-2">VERIFICACIÓN INSTANTÁNEA</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed max-w-[200px]">
                                        {t('products.terms')}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handlePurchase}
                                disabled={purchasing || (paymentMethod === 'BALANCE' && profile && profile.wallet_balance < selectedProduct.price) || (selectedProduct.is_flagship && activeInvestment < 500)}
                                className={`w-full py-5 font-black text-sm uppercase tracking-[0.4em] flex items-center justify-center gap-4 transition-all transform hover:scale-[1.01] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed clip-corner italic ${paymentMethod === 'BALANCE' ? 'bg-blue-600 text-white shadow-[0_0_50px_rgba(37,99,235,0.4)]' : 'bg-emerald-600 text-white shadow-[0_0_50px_rgba(16,185,129,0.4)]'}`}
                            >
                                {purchasing ? (
                                    <RefreshCw className="animate-spin" size={20} />
                                ) : (
                                    <Shield size={20} />
                                )}
                                {purchasing ? t('products.processing') : (selectedProduct.is_flagship && activeInvestment < 500 ? 'REGLA DE ORO ACTIVA' : (paymentMethod === 'USDT' ? t('products.report_payment_btn') : t('products.authorize_btn')))}
                                <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
