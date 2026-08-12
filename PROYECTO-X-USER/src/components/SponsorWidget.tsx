import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';

interface SponsorWidgetProps {
    sponsorId: string | null;
}

const SponsorWidget: React.FC<SponsorWidgetProps> = ({ sponsorId }) => {
    const { t } = useTranslation();
    const [sponsorName, setSponsorName] = useState<string | null>(null);
    const [sponsorUsername, setSponsorUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sponsorId) {
            setLoading(false);
            return;
        }

        const fetchSponsorLabel = async () => {
            try {
                // Try RPC first (bypasses RLS)
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_sponsor_info', { p_sponsor_id: sponsorId });

                if (!rpcError && rpcData) {
                    setSponsorName(rpcData.full_name || rpcData.email?.split('@')[0] || rpcData.username || 'Patrocinador');
                    setSponsorUsername(rpcData.username || 'user_' + sponsorId.substring(0, 4));
                    return;
                }

                // Fallback: direct query
                const { data, error } = await supabase
                    .from('profiles')
                    .select('full_name, username, email')
                    .eq('id', sponsorId)
                    .maybeSingle();

                if (!error && data) {
                    setSponsorName(data.full_name || data.email?.split('@')[0] || data.username || 'Patrocinador');
                    setSponsorUsername(data.username || 'user_' + sponsorId.substring(0, 4));
                } else {
                    setSponsorName('Patrocinador');
                    setSponsorUsername('user_' + sponsorId.substring(0, 4));
                }
            } catch (err) {
                console.error('Error fetching sponsor details:', err);
                setSponsorName('Patrocinador');
                setSponsorUsername('user_' + sponsorId.substring(0, 4));
            } finally {
                setLoading(false);
            }
        };

        fetchSponsorLabel();
    }, [sponsorId]);

    if (!sponsorId) return null;

    return (
        <div className="holo-card p-6 rounded-none clip-corner relative group overflow-hidden border-geminix-accent/20 hover:border-geminix-accent/50 transition-colors">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-60 transition-opacity">
                <svg className="w-10 h-10 text-geminix-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-slate-400 text-[10px] font-orbitron uppercase tracking-widest mb-4 opacity-80">{t('profile.identity.sponsor', 'SPONSOR DE RED')}</p>

            {loading ? (
                <div className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800"></div>
                    <div className="space-y-2">
                        <div className="h-3 w-24 bg-slate-800 rounded"></div>
                        <div className="h-2 w-16 bg-slate-800 rounded"></div>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center text-xl font-orbitron font-bold text-white border border-geminix-accent/20 shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                        {sponsorName ? sponsorName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                        <p className="text-sm font-orbitron font-bold text-white text-glow-cyan uppercase tracking-wider relative z-10 truncate max-w-[150px]">
                            {sponsorName}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] font-mono-tech text-geminix-accent uppercase tracking-widest truncate max-w-[150px]">@{sponsorUsername}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SponsorWidget;
