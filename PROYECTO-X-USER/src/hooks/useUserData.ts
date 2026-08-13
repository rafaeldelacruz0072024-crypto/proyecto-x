import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getNetworkTree } from '../services/database';
import { Profile, Transaction, Investment, NetworkNode } from '../types';
import { updateUserProfile } from '../services/database';
import { generateUniqueRefCode } from '../lib/refCode';


export function useUserData(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [referralCommissionBalance, setReferralCommissionBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Network Data
  const [networkTree, setNetworkTree] = useState<NetworkNode | null>(null);
  const [networkStats, setNetworkStats] = useState({ totalEarnings: 0, teamVolume: 0, activeNodes: 0 });

  // Fetch profile
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setWalletBalance(0);
      setCreditBalance(0);
      setNetworkTree(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        let data: any = null;

        // Retry loop: up to 4 attempts with 800ms delay (max 3.2s total — avoids browser freeze)
        for (let attempt = 1; attempt <= 4; attempt++) {
          const { data: row, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (error) { console.error('Error fetching profile:', error); break; }
          if (row)   { data = row; break; }

          if (attempt < 4) {
            console.warn(`Profile not found (attempt ${attempt}/4), retrying in 800ms...`);
            await new Promise(r => setTimeout(r, 800));
          }
        }

        // If still missing after retries, attempt recovery via RPC then direct upsert
        if (!data) {
          console.warn('Profile missing after retries. Attempting emergency recovery...');
          const { data: authUser } = await supabase.auth.getUser();

          if (authUser?.user) {
            const newRefCode = await generateUniqueRefCode();

            // Try RPC first (SECURITY DEFINER — more reliable)
            const { data: rpcResult } = await supabase.rpc('complete_registration', {
              p_user_id:      userId,
              p_username:     authUser.user.user_metadata?.username || `user_${userId.slice(0, 6)}`,
              p_full_name:    authUser.user.user_metadata?.full_name || '',
              p_email:        authUser.user.email || '',
              p_country:      authUser.user.user_metadata?.country || null,
              p_phone:        authUser.user.user_metadata?.phone || null,
              p_ref_code:     newRefCode,
              p_sponsor_code: authUser.user.user_metadata?.sponsor_code || null,
              p_binary_side:  authUser.user.user_metadata?.binary_side || localStorage.getItem('nova_digital_binary_side') || 'LEFT',
            });

            if (rpcResult?.success) {
              // Fetch the freshly created profile
              const { data: recovered } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
              data = recovered;
            } else {
              // Last resort: direct upsert
              const { data: upserted, error: upsertError } = await supabase
                .from('profiles')
                .upsert({
                  id: userId,
                  email: authUser.user.email,
                  full_name: authUser.user.user_metadata?.full_name || null,
                  username: authUser.user.user_metadata?.username || null,
                  ref_code: newRefCode,
                  role: 'user',
                  status: 'active',
                  credit_balance: 0,
                  wallet_balance: 0
                }, { onConflict: 'id' })
                .select()
                .single();
              if (upsertError) console.error('Critical: Could not recover profile:', upsertError);
              else data = upserted;
            }
          }
        }

        if (data) {
          setProfile(data);
          setWalletBalance(data.wallet_balance || 0);
          setCreditBalance(data.credit_balance || 0);
          setReferralCommissionBalance(data.referral_commission_balance || 0);

          // Fix missing ref_code
          if (!data.ref_code) {
            const generatedCode = await generateUniqueRefCode();
            const res = await updateUserProfile(userId, { ref_code: generatedCode });
            if (res.success) {
              setProfile(prev => prev ? { ...prev, ref_code: generatedCode } : null);
            }
          }
        }
      } catch (err) {
        console.error('Unexpected error in fetchProfile:', err);
      }
    };

    // Fetch Network
    const fetchNetwork = async () => {
      const result = await getNetworkTree(userId);
      if (result) {
        setNetworkTree(result.tree);
        setNetworkStats(result.stats);
      }
    };

    const loadData = async () => {
      try {
        const timeout = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('load_timeout')), 10000)
        );
        await Promise.race([
          Promise.all([fetchProfile(), fetchNetwork()]),
          timeout
        ]);
      } catch (err) {
        console.error('Error loading user data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Subscribe to profile changes (balance updates)
    const channel = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          const newProfile = payload.new as Profile;
          setProfile(newProfile);
          setWalletBalance(newProfile.wallet_balance || 0);
          setCreditBalance(newProfile.credit_balance || 0);
          setReferralCommissionBalance(newProfile.referral_commission_balance || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Fetch transactions
  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      return;
    }

    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
      } else {
        setTransactions(data || []);
      }
    };

    fetchTransactions();

    const channel = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Fetch investments
  useEffect(() => {
    if (!userId) {
      setInvestments([]);
      return;
    }

    const fetchInvestments = async () => {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching investments:', error);
      } else {
        setInvestments(data || []);
      }
    };

    fetchInvestments();

    const channel = supabase
      .channel('investments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investments',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchInvestments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const refetch = async () => {
    if (!userId) return;
    // Realizamos la recarga en segundo plano sin activar el splash screen global
    // si el usuario ya está viendo la interfaz.

    const [profileRes, transactionsRes, investmentsRes, networkRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      getNetworkTree(userId)
    ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setWalletBalance(profileRes.data.wallet_balance || 0);
      setCreditBalance(profileRes.data.credit_balance || 0);
      setReferralCommissionBalance(profileRes.data.referral_commission_balance || 0);
    }

    if (transactionsRes.data) setTransactions(transactionsRes.data);
    if (investmentsRes.data) setInvestments(investmentsRes.data);
    if (networkRes) {
      setNetworkTree(networkRes.tree);
      setNetworkStats(networkRes.stats);
    }

    setLoading(false);
  };

  return {
    profile,
    transactions,
    investments,
    walletBalance,
    creditBalance,
    referralCommissionBalance,
    networkTree,
    networkStats,
    loading,
    refetch
  };
}

