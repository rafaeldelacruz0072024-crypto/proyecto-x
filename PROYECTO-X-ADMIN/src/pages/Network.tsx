import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Profile, NetworkNode, NetworkMember } from '../types';
import {
    Search,
    Download,
    RefreshCw,
    Plus,
    Minus,
    Maximize2,
    Users,
    Zap,
    ChevronRight,
    TrendingUp,
    Target,
    UserCircle,
    Bell,
    Settings,
    Hand
} from 'lucide-react';

const EMPTY_NETWORK: NetworkNode = {
    id: 'root',
    name: 'Select a User',
    level: 0,
    totalVolume: 0,
    children: []
};

const Network: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [networkTree, setNetworkTree] = useState<NetworkNode>(EMPTY_NETWORK);
    const [zoomScale, setZoomScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [loading, setLoading] = useState(false);

    const handleZoomIn = () => setZoomScale(prev => Math.min(prev + 0.1, 2));
    const handleZoomOut = () => setZoomScale(prev => Math.max(prev - 0.1, 0.2));
    const handleZoomReset = () => {
        setZoomScale(1);
        setPos({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };

    const handleMouseUp = () => setIsDragging(false);
    const [levelBreakdown, setLevelBreakdown] = useState<{ level: number, volume: number, commission: number, percent: number }[]>([]);
    const [residualConfig, setResidualConfig] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        activeRate: 0,
        networkVolume: 0
    });

    useEffect(() => {
        fetchUsers();
        fetchGlobalStats();
    }, []);

    const fetchUsers = async () => {
        // Obtenemos todos los perfiles y todas las inversiones activas para calcular volúmenes localmente con eficiencia
        const { data: profiles, error: pError } = await supabase
            .from('profiles')
            .select('id, email, username, referred_by, role, status, organizational_rank, created_at')
            .eq('role', 'user');

        const { data: investments, error: iError } = await supabase
            .from('investments')
            .select('user_id, amount')
            .eq('status', 'ACTIVE');

        if (!pError && profiles && investments) {
            // 1. Mapear volúmenes personales por usuario
            const volMap = new Map<string, number>();
            investments.forEach(inv => {
                volMap.set(inv.user_id, (volMap.get(inv.user_id) || 0) + (Number(inv.amount) || 0));
            });

            // 2. Construir mapa de hijos por padre
            const childrenMap = new Map<string, string[]>();
            profiles.forEach(p => {
                if (p.referred_by) {
                    const children = childrenMap.get(p.referred_by) || [];
                    children.push(p.id);
                    childrenMap.set(p.referred_by, children);
                }
            });

            // 3. Función recursiva para calcular volumen total de equipo (Personal + Red)
            const getTeamVol = (uid: string, memo: Map<string, number>): number => {
                if (memo.has(uid)) return memo.get(uid)!;

                let total = volMap.get(uid) || 0;
                const children = childrenMap.get(uid) || [];
                children.forEach(childId => {
                    total += getTeamVol(childId, memo);
                });

                memo.set(uid, total);
                return total;
            };

            const memo = new Map<string, number>();
            const processedUsers = profiles.map(u => ({
                ...u,
                personal_volume: volMap.get(u.id) || 0,
                team_volume: getTeamVol(u.id, memo) // Volumen total (Personal + Descendientes)
            })).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

            setUsers(processedUsers as any);
        }
    };

    const fetchGlobalStats = async () => {
        const { data: allUsers } = await supabase.from('profiles').select('id, status').eq('role', 'user');
        const { data: activeInvestments } = await supabase.from('investments').select('amount').eq('status', 'ACTIVE');
        const { data: sysSettings } = await supabase.from('system_settings').select('residual_config').limit(1).single();

        if (sysSettings?.residual_config) {
            setResidualConfig(sysSettings.residual_config);
        }

        if (allUsers) {
            const activeCount = allUsers.filter(u => u.status === 'active').length;
            setStats(prev => ({
                ...prev,
                totalUsers: allUsers.length,
                activeUsers: activeCount,
                activeRate: allUsers.length > 0 ? (activeCount / allUsers.length) * 100 : 0
            }));
        }

        if (activeInvestments) {
            const vol = activeInvestments.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
            setStats(prev => ({ ...prev, networkVolume: vol }));
        }
    };

    const handleUserSelect = async (user: Profile) => {
        setLoading(true);
        setSelectedUser(user);
        setLevelBreakdown([]);

        try {
            const { data: rootInvestments } = await supabase
                .from('investments')
                .select('amount')
                .eq('user_id', user.id)
                .eq('status', 'ACTIVE');

            const rootPersonalVolume = (rootInvestments || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

            const { data: members, error } = await supabase.rpc('get_network_tree', { root_id: user.id });
            if (error) throw error;

            if (members && (members as NetworkMember[]).length > 0) {
                const memberList = members as NetworkMember[];
                const tree = buildTree(memberList, user, rootPersonalVolume);
                setNetworkTree(tree);

                // Calcular Desglose por Niveles
                const minGlobalLevel = Math.min(...memberList.map(m => m.level));
                const breakdownMap = new Map<number, { level: number, volume: number, commission: number, percent: number }>();

                memberList.forEach(m => {
                    // El nivel relativo 1 es el nivel de los invitados directos
                    const relativeLvl = m.level - minGlobalLevel + 1;
                    const config = residualConfig.find(rc => rc.id === relativeLvl);
                    const percent = config ? config.percent : 0;

                    const current = breakdownMap.get(relativeLvl) || { level: relativeLvl, volume: 0, commission: 0, percent };
                    current.volume += Number(m.personal_volume) || 0;
                    current.commission += (Number(m.personal_volume) || 0) * (percent / 100);
                    breakdownMap.set(relativeLvl, current);
                });

                const sortedBreakdown = Array.from(breakdownMap.values()).sort((a, b) => a.level - b.level);
                setLevelBreakdown(sortedBreakdown);
            } else {
                setNetworkTree({
                    id: user.id,
                    name: user.username || user.email.split('@')[0],
                    level: 0,
                    totalVolume: rootPersonalVolume,
                    children: [],
                    status: user.status,
                    rank: 'ROOT',
                    directsCount: 0
                });
            }
        } catch (err) {
            console.error('Error fetching lineage:', err);
        } finally {
            setLoading(false);
        }
    };

    const buildTree = (members: NetworkMember[], rootUser: Profile, rootPersonalVolume: number): NetworkNode => {
        const map = new Map<string, NetworkNode>();
        const roots: NetworkNode[] = [];

        members.forEach(m => {
            map.set(m.id, {
                id: m.id,
                name: m.username || m.email.split('@')[0],
                level: m.level,
                totalVolume: m.personal_volume,
                children: [],
                status: m.status,
                directsCount: m.direct_referrals_count,
                rank: m.personal_volume > 1000 ? 'GOLD' : 'MEMBER' // Logic placeholder
            });
        });

        members.forEach(m => {
            const node = map.get(m.id)!;
            const parentId = m.referred_by;

            if (parentId === rootUser.id) {
                roots.push(node);
            } else if (parentId && map.has(parentId)) {
                map.get(parentId)!.children.push(node);
            } else {
                // Orphan: attach to root so it always appears
                roots.push(node);
            }
        });

        const calculateVol = (node: NetworkNode): number => {
            let vol = Number(node.totalVolume) || 0;
            node.children.forEach(child => {
                vol += calculateVol(child);
            });
            node.totalVolume = vol;
            return vol;
        };

        roots.forEach(calculateVol);

        return {
            id: rootUser.id,
            name: rootUser.username || rootUser.email.split('@')[0],
            level: 0,
            totalVolume: rootPersonalVolume + roots.reduce((s, r) => s + r.totalVolume, 0),
            children: roots,
            status: rootUser.status,
            rank: 'ROOT',
            directsCount: roots.length
        };
    };

    const countTotalTeam = (node: NetworkNode): number => {
        let count = 0;
        if (node.children) {
            count += node.children.length;
            node.children.forEach(child => {
                count += countTotalTeam(child);
            });
        }
        return count;
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700 bg-[#0c0c0e] min-h-screen text-slate-300">
            {/* Header Maestro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="relative group w-full max-w-xl">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-yellow-500 transition-colors" size={20} />
                    <input
                        type="text"
                        placeholder="Search global network..."
                        value={globalSearch}
                        onChange={(e) => setGlobalSearch(e.target.value)}
                        className="w-full bg-[#111114] border border-slate-800/50 rounded-2xl py-4 pl-14 pr-6 text-white text-sm focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all"
                    />
                </div>

                <div className="flex items-center gap-4">
                    <button className="p-3 bg-[#111114] border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-xl">
                        <Bell size={20} />
                    </button>
                    <button className="p-3 bg-[#111114] border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all shadow-xl">
                        <Settings size={20} />
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-yellow-500/10 active:scale-95">
                        <Download size={18} />
                        Export Data
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-4">
                <div>
                    <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic">Referral Networks</h1>
                    <p className="text-slate-500 font-medium mt-1">Command center for global hierarchical data and performance.</p>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] flex flex-col min-w-[200px] shadow-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Users in Network</p>
                        <div className="flex items-end gap-3">
                            <p className="text-3xl font-black text-white tracking-tight">{stats.totalUsers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <span className="text-[10px] text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded-full mb-1">+10%</span>
                        </div>
                    </div>
                    <div className="bg-[#111114] border border-slate-800/50 p-6 rounded-[2rem] flex flex-col min-w-[200px] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Total Active Users</p>
                        <div className="flex items-end gap-3">
                            <p className="text-3xl font-black text-white tracking-tight">{stats.activeUsers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            <p className="text-[10px] text-slate-600 font-bold mb-1">{stats.activeRate.toFixed(1)}% Rate</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[700px]">
                {/* Sidebar: Pro Network List */}
                <div className="lg:col-span-4 bg-[#111114] border border-slate-800/50 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl backdrop-blur-3xl">
                    <div className="p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                                <Users size={18} className="text-yellow-500" />
                                Network User List
                            </h3>
                            <span className="text-[9px] font-black text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">LIVE</span>
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-yellow-500" size={16} />
                            <input
                                type="text"
                                placeholder="Filter by name, ID or rank..."
                                className="w-full bg-[#0c0c0e] border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-xs text-white focus:border-yellow-500/50 transition-all outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-1 scrollbar-none">
                        <div className="grid grid-cols-12 px-6 py-3 text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            <div className="col-span-6">User</div>
                            <div className="col-span-3 text-center">Rank</div>
                            <div className="col-span-3 text-right">Volume</div>
                        </div>

                        {filteredUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => handleUserSelect(user)}
                                className={`w-full grid grid-cols-12 items-center px-6 py-4 rounded-3xl transition-all border group ${selectedUser?.id === user.id ? 'bg-yellow-500/5 border-yellow-500/30 shadow-inner' : 'bg-transparent border-transparent hover:bg-white/[0.02]'}`}
                            >
                                <div className="col-span-6 flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs border transition-all ${selectedUser?.id === user.id ? 'bg-yellow-500 text-slate-950 border-yellow-400' : 'bg-slate-900 text-slate-500 border-slate-800 group-hover:border-slate-700'}`}>
                                        {user.username?.substring(0, 2).toUpperCase() || user.email.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className={`text-xs font-black truncate transition-colors ${selectedUser?.id === user.id ? 'text-white' : 'text-slate-100'}`}>{user.username || user.email.split('@')[0]}</p>
                                        <p className="text-[9px] text-slate-600 font-bold tracking-tight uppercase">ID: {user.id.substring(0, 4)}</p>
                                    </div>
                                </div>
                                <div className="col-span-3 text-center">
                                    <span className={`text-[9px] font-black tracking-widest ${user.organizational_rank === 'MASTER' ? 'text-yellow-500' : 'text-slate-500'}`}>
                                        {user.organizational_rank || 'MEMBER'}
                                    </span>
                                </div>
                                <div className="col-span-3 text-right">
                                    <p className="text-xs font-black text-slate-200">${(user as any).team_volume?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Tree Canvas */}
                <div className="lg:col-span-8 bg-[#111114] border border-slate-800/50 rounded-[3rem] relative overflow-hidden flex flex-col shadow-2xl group">
                    <div className="absolute top-8 right-8 flex gap-3 z-10">
                        <div className="flex items-center bg-[#0c0c0e]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-1 shadow-2xl">
                            <button
                                onClick={handleZoomIn}
                                className="p-3 text-slate-500 hover:text-white transition-colors border-r border-slate-800"
                                title="Zoom In"
                            >
                                <Plus size={18} />
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="p-3 text-slate-500 hover:text-white transition-colors border-r border-slate-800"
                                title="Zoom Out"
                            >
                                <Minus size={18} />
                            </button>
                            <button
                                onClick={handleZoomReset}
                                className="p-3 text-slate-500 hover:text-white transition-colors border-r border-slate-800"
                                title="Reset View"
                            >
                                <Maximize2 size={18} />
                            </button>
                            <div className="p-3 text-slate-500 border-r border-slate-800 cursor-default" title="Drag to Move">
                                <Hand size={18} className={isDragging ? 'text-yellow-500' : ''} />
                            </div>
                            <button onClick={() => selectedUser && handleUserSelect(selectedUser)} className="p-3 text-slate-500 hover:text-yellow-500 transition-colors">
                                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div
                        className={`flex-1 overflow-hidden bg-[radial-gradient(circle_at_50%_50%,_#1e1b4b_0%,_transparent_60%)] relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="space-y-6 text-center">
                                    <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_20px_#eab308]" />
                                    <p className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] animate-pulse">Scanning Lineage...</p>
                                </div>
                            </div>
                        ) : selectedUser ? (
                            <div
                                className={`absolute left-1/2 top-20 flex flex-col items-center ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
                                style={{
                                    transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px) scale(${zoomScale})`,
                                    transformOrigin: 'top center',
                                    willChange: 'transform'
                                }}
                            >
                                <VerticalTreeNode node={networkTree} isRoot={true} />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-6 opacity-40">
                                <Users size={120} strokeWidth={0.5} />
                                <div className="text-center">
                                    <p className="text-xs font-black uppercase tracking-[0.6em]">Command Center Standby</p>
                                    <p className="text-[10px] font-bold mt-2">Select a user to initialize hierarchical mapping</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Metrics Panel */}
            {selectedUser && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                    <div className="bg-[#111114] border border-slate-800/50 p-10 rounded-[3rem] shadow-2xl flex items-center gap-10 group transition-all hover:bg-white/[0.01]">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-yellow-500/20 to-transparent border border-yellow-500/20 flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform">
                            <UserCircle size={48} className="text-yellow-500" />
                        </div>
                        <div className="flex-1 space-y-6">
                            <div>
                                <h4 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                                    {selectedUser.username || selectedUser.email.split('@')[0]}
                                    <span className="text-[10px] not-italic font-black text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">ROOT NODE</span>
                                </h4>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">Direct Referral Level (L1)</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-[#0c0c0e] p-5 rounded-3xl border border-slate-800/50 shadow-inner">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Direct Invites</p>
                                    <p className="text-2xl font-black text-white uppercase">{networkTree.directsCount || 0}</p>
                                </div>
                                <div className="bg-[#0c0c0e] p-5 rounded-3xl border border-slate-800/50 shadow-inner">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Team</p>
                                    <p className="text-2xl font-black text-white uppercase">{countTotalTeam(networkTree)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111114] border border-slate-800/50 p-10 rounded-[3rem] shadow-2xl space-y-8 backdrop-blur-2xl">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-3">
                                <Zap size={14} className="fill-yellow-500" />
                                Performance Breakdown
                            </p>
                            <TrendingUp size={20} className="text-slate-700" />
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-4 max-h-[160px] overflow-y-auto pr-2 scrollbar-none">
                                {levelBreakdown.length > 0 ? levelBreakdown.map(breakdown => (
                                    <div key={breakdown.level} className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">Level {breakdown.level} ({breakdown.percent}%)</span>
                                            <span className="text-green-500">+${breakdown.commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="h-1.5 bg-[#0c0c0e] rounded-full overflow-hidden border border-slate-800/50">
                                            <div
                                                className="h-full bg-yellow-500/80 rounded-full shadow-[0_0_10px_#eab30833]"
                                                style={{ width: `${Math.min((breakdown.commission / (levelBreakdown.reduce((s, b) => s + b.commission, 0) || 1)) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center py-4">No volumes in network</p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-800/50 flex items-end justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1">Total Comm. Yield</p>
                                    <p className="text-4xl font-black text-white italic tracking-tighter">
                                        ${levelBreakdown.reduce((s, b) => s + b.commission, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                                    <Target className="text-yellow-500" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const VerticalTreeNode: React.FC<{ node: NetworkNode; isRoot?: boolean }> = ({ node, isRoot }) => {
    return (
        <div className="flex flex-col items-center">
            {/* Card del Nodo */}
            <div className={`
                relative p-8 rounded-[2.5rem] border-2 transition-all min-w-[300px] shadow-2xl group
                ${isRoot ? 'bg-slate-900 border-yellow-500 shadow-yellow-500/10' : 'bg-[#111114] border-slate-800 hover:border-yellow-500/50'}
            `}>
                {isRoot && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-yellow-500 px-5 py-1.5 rounded-full text-[9px] font-black text-slate-950 uppercase tracking-[0.2em] shadow-[0_4px_15px_#eab30833] border-2 border-[#0c0c0e] whitespace-nowrap">
                        Master Partner
                    </div>
                )}

                <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg border transition-all ${isRoot ? 'bg-yellow-500 text-slate-950 border-yellow-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        {node.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 space-y-1">
                        <p className="text-sm font-black text-white uppercase italic tracking-tight">{node.name}</p>
                        <p className="text-[9px] font-black text-yellow-500/80 uppercase tracking-widest">{node.rank || 'MEMBER'}</p>
                        <p className="text-[10px] font-bold text-slate-600 italic">ID: {node.id.substring(0, 8)}</p>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Team Vol.</p>
                        <p className="text-lg font-black text-white italic">${node.totalVolume?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</p>
                    </div>
                    {node.level > 0 && (
                        <div className="px-3 py-1 bg-slate-800 rounded-lg border border-slate-700">
                            <p className="text-[9px] font-black text-slate-500 uppercase">LVL {node.level}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Conectores y Hijos */}
            {node.children && node.children.length > 0 && (
                <>
                    <div className="w-0.5 h-16 bg-gradient-to-b from-yellow-500 to-slate-800" />
                    <div className="relative flex gap-12">
                        {/* Línea horizontal de conexión */}
                        {node.children.length > 1 && (
                            <div className="absolute top-0 h-0.5 bg-slate-800" style={{ left: '150px', right: '150px' }} />
                        )}
                        {node.children.map((child, i) => (
                            <div key={child.id} className="relative flex flex-col items-center">
                                {/* Conector vertical hacia el hijo */}
                                <div className="w-0.5 h-12 bg-slate-800" />
                                <VerticalTreeNode node={child} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default Network;
