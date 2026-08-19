import { supabase } from '../lib/supabase';
import { Profile, Deposit, Withdrawal, Investment, Transaction, NetworkMember, NetworkNode } from '../types';

// ==========================================
// SYSTEM SETTINGS
// ==========================================
export async function getSystemSettings() {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
}

// ==========================================
// DEPOSITS
// ==========================================
export async function createDeposit(userId: string, amount: number, method: string = 'USDT', txHash?: string) {
  try {
    // 1. Insert deposit record
    const { data: deposit, error: depositError } = await supabase
      .from('deposits')
      .insert({
        user_id: userId,
        amount,
        method,
        transaction_hash: txHash, // Use transaction_hash as in types/index.ts, or check if DB uses tx_hash
        status: 'PENDING' // standardized to uppercase PENDING
      })
      .select()
      .single();

    if (depositError) throw depositError;

    // 2. Create pending transaction (Ledger)
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'DEPOSIT',
        amount: amount,
        status: 'PENDING',
        description: `Depósito: $${amount} vía ${method} (Ref: ${deposit.id})`,
        // reference_id omitted intentionally due to fk_transactions_investments constraint
      });

    if (txError) throw txError;

    return { success: true, deposit };
  } catch (error: any) {
    console.error('Error creating deposit:', error);
    return { success: false, error };
  }
}

// ==========================================
// PLANS
// ==========================================
export async function getActivePlans() {
  try {
    const [plansRes, usageRes] = await Promise.all([
      supabase.from('plans').select('*').eq('status', 'active').order('min_amount', { ascending: true }),
      supabase.from('plan_unit_usage').select('plan_id, units_used, units_remaining')
    ]);

    if (plansRes.error) throw plansRes.error;

    const usageMap: Record<string, { units_used: number; units_remaining: number }> = {};
    if (usageRes.data) {
      for (const row of usageRes.data) {
        usageMap[row.plan_id] = { units_used: row.units_used, units_remaining: row.units_remaining };
      }
    }

    return (plansRes.data || []).map((p: any) => ({
      ...p,
      units_used: usageMap[p.id]?.units_used ?? 0,
      units_remaining: p.max_units != null ? (usageMap[p.id]?.units_remaining ?? p.max_units) : null,
    }));
  } catch (error) {
    console.error('Error fetching plans:', error);
    return [];
  }
}

// ==========================================
// INVESTMENTS
// ==========================================
export async function createInvestment(userId: string, amount: number, planId?: string) {
  try {
    // 1. Get default plan if not provided
    if (!planId) {
      const { data: plan } = await supabase
        .from('plans')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .single();

      planId = plan?.id;
    }

    if (!planId) throw new Error("No active plan found");

    // 2. Call the Atomic RPC to process the investment in a single transaction
    const { data, error: rpcError } = await supabase.rpc('process_investment', {
      p_user_id: userId,
      p_amount: amount,
      p_plan_id: planId
    });

    if (rpcError) throw rpcError;

    // The RPC returns a JSONB object from PostgreSQL
    if (!data.success) {
      throw new Error(data.error || "Error desconocido al procesar la inversión");
    }

    return { success: true, investment: data.investment };
  } catch (error: any) {
    console.error('Error creating investment:', error);
    return { success: false, error: error.message || error };
  }
}


// ==========================================
// WITHDRAWALS
// ==========================================
export async function createWithdrawal(
  userId: string,
  amount: number,
  method: string,
  walletAddress: string
) {
  try {
    // RPC atómico: una sola solicitud en lugar de 3+ llamadas secuenciales.
    // Evita "TypeError: Load failed" en iOS Safari por múltiples fetch fallidos.
    const { data, error } = await supabase.rpc('create_withdrawal_request', {
      p_user_id:        userId,
      p_amount:         amount,
      p_method:         method,
      p_wallet_address: walletAddress,
      // Usuarios normales nunca deben enviar bypass de ventana. El backend
      // rechaza p_bypass_window=true con "Parámetro no permitido.".
      p_bypass_window:  false,
    });

    if (error) {
      // Error de red o de Supabase
      if (error.message?.includes('Load failed') || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return { success: false, error: 'Error de conexión. Verifica tu internet e intenta de nuevo.' };
      }
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Error al procesar el retiro.' };
    }

    // Retornamos un objeto compatible con el código existente en App.tsx
    return {
      success: true,
      withdrawal: { id: data.withdrawal_id, amount: data.amount }
    };
  } catch (error: any) {
    console.error('Error creating withdrawal:', error);
    const msg: string = error?.message || String(error);
    if (msg.includes('Load failed') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { success: false, error: 'Error de conexión. Verifica tu internet e intenta de nuevo.' };
    }
    return { success: false, error: msg };
  }
}

// ==========================================
// CREDIT MODULE (Professional Recording)
// ==========================================

export async function getProfileByEmail(email: string) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching profile by email:', error);
    return null;
  }
}

export async function searchUsers(query: string, limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, username')
      .or(`email.ilike.%${query}%,username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

export async function transferCredits(senderId: string, receiverEmail: string, amount: number) {
  try {
    // 1. Execute SQL RPC (Handles balances and credit_logs)
    const { data, error } = await supabase.rpc('transfer_credits', {
      sender_id: senderId,
      receiver_email: receiverEmail,
      amount: amount
    });

    if (error) throw error;
    // El RPC debe registrar balances y ledger de forma atÃ³mica.
    // El cliente no escribe directamente en transactions ni credit_logs.
    return data;
  } catch (error: any) {
    console.error('Error transferring credits:', error);
    return { success: false, message: error.message };
  }
}

export async function convertBalanceToCredit(userId: string, amount: number) {
  try {
    const { data, error } = await supabase.rpc('convert_balance_to_credit', {
      p_user_id: userId,
      p_amount: amount
    });

    if (error) throw error;
    // El RPC debe registrar balance y ledger en una sola transacciÃ³n.
    // El cliente no escribe directamente en transactions ni credit_logs.
    return data;
  } catch (error: any) {
    console.error('Error converting balance:', error);
    return { success: false, message: error.message };
  }
}



// ==========================================
// REFERRALS
// ==========================================
// ==========================================
// REFERRALS & NETWORK
// ==========================================
// import { NetworkMember, NetworkNode } from '../types'; // Removed duplicate

export async function createReferral(referrerId: string, referredId: string, level: number = 1) {
  // This logic usually happens on backend triggers or simpler insert.
  // Admin likely doesn't have a 'referrals' table but infers from 'profiles.referred_by'.
  try {
    // Assuming 'referrals' table exists or we just rely on profile link.
    return { success: true };
  } catch (error: any) {
    console.error('Error creating referral:', error);
    return { success: false, error };
  }
}

export async function getNetworkTree(userId: string): Promise<{ tree: NetworkNode, stats: { totalEarnings: number, teamVolume: number, activeNodes: number } } | null> {
  try {
    const { data: rpcMembers, error: rpcError } = await supabase.rpc('get_network_tree', { root_id: userId });
    let members: any[] = Array.isArray(rpcMembers) ? rpcMembers : [];

    // Algunas instalaciones no tienen todavía el RPC get_network_tree. En ese
    // caso reconstruimos el árbol desde profiles (solo lectura), conservando
    // los enlaces por UUID y también los enlaces antiguos guardados por código.
    if (rpcError || members.length === 0) {
      if (rpcError) console.warn('get_network_tree no disponible; usando fallback visual desde profiles:', rpcError.message);

      const [{ data: profileRows, error: profileError }, { data: rootProfile, error: rootError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, username, status, ref_code, referred_by, created_at')
          .neq('id', userId)
          .limit(5000),
        supabase
          .from('profiles')
          .select('id, ref_code')
          .eq('id', userId)
          .maybeSingle()
      ]);

      if (profileError) throw profileError;
      if (rootError) throw rootError;

      const rows = (profileRows || []) as any[];
      const idByReference = new Map<string, string>();
      idByReference.set(userId.toLowerCase().trim(), userId);
      rows.forEach(row => {
        if (row.id) idByReference.set(String(row.id).toLowerCase().trim(), row.id);
        if (row.ref_code) idByReference.set(String(row.ref_code).toLowerCase().trim(), row.id);
      });
      if (rootProfile?.ref_code) {
        idByReference.set(String(rootProfile.ref_code).toLowerCase().trim(), userId);
      }

      const canonicalRows = rows.map(row => ({
        ...row,
        referred_by: row.referred_by
          ? (idByReference.get(String(row.referred_by).toLowerCase().trim()) || row.referred_by)
          : null,
        joined_at: row.created_at,
        level: 1,
        personal_volume: Number(row.personal_volume || 0),
        direct_referrals_count: Number(row.direct_referrals_count || 0)
      }));

      const rowById = new Map<string, any>(canonicalRows.map(row => [String(row.id).toLowerCase().trim(), row]));
      const directCounts = new Map<string, number>();
      canonicalRows.forEach(row => {
        const parentId = row.referred_by ? String(row.referred_by).toLowerCase().trim() : '';
        if (parentId) directCounts.set(parentId, (directCounts.get(parentId) || 0) + 1);
      });

      const getLevel = (row: any, trail = new Set<string>()): number => {
        const rowId = String(row.id).toLowerCase().trim();
        if (trail.has(rowId)) return 1;
        const parentId = row.referred_by ? String(row.referred_by).toLowerCase().trim() : '';
        if (!parentId || parentId === userId.toLowerCase().trim()) return 1;
        const parent = rowById.get(parentId);
        return parent ? getLevel(parent, new Set([...trail, rowId])) + 1 : 1;
      };

      members = canonicalRows.map(row => ({
        ...row,
        level: getLevel(row),
        direct_referrals_count: directCounts.get(String(row.id).toLowerCase().trim()) || 0
      }));
    }

    const memberIds = members.length ? [userId, ...members.map(m => m.id)] : [userId];

    // 1. Fetch Referral Commissions for all members (to calculate "Total Earnings")
    const { data: commissionData } = await supabase
      .from('transactions')
      .select('user_id, amount')
      .eq('type', 'REFERRAL_COMMISSION')
      .in('user_id', memberIds);

    const commissionMap = new Map<string, number>();
    (commissionData || []).forEach(tx => {
      const current = commissionMap.get(tx.user_id) || 0;
      commissionMap.set(tx.user_id, current + (Number(tx.amount) || 0));
    });

    // 2. Fetch active INVESTMENTS for all members (to calculate "Business Volume")
    const { data: investmentData } = await supabase
      .from('investments')
      .select('user_id, amount')
      .eq('status', 'ACTIVE')
      .in('user_id', memberIds);

    const investmentMap = new Map<string, number>();
    (investmentData || []).forEach(inv => {
      const current = investmentMap.get(inv.user_id) || 0;
      investmentMap.set(inv.user_id, current + (Number(inv.amount) || 0));
    });

    // Update members' personal_volume with their real investment volume (Business Volume)
    const auditedMembers = (members || []).map((m: any) => ({
      ...m,
      personal_volume: investmentMap.get(m.id) || 0
    }));

    const rootInvestmentVolume = investmentMap.get(userId) || 0;
    const rootCommissionVolume = commissionMap.get(userId) || 0;

    // Aggregate Total Referral Earnings (for the leader personally)
    let totalEarnings = rootCommissionVolume;

    if (!auditedMembers || auditedMembers.length === 0) {
      return {
        tree: { id: userId, name: 'YOU', level: 0, totalVolume: rootInvestmentVolume, children: [], directsCount: 0 },
        stats: { totalEarnings, teamVolume: 0, activeNodes: 0 }
      };
    }

    // Transform flat list to Tree
    const tree = buildNetworkTreeStructure(auditedMembers as NetworkMember[], userId);

    // Calculate total volume for the root (Personal Investment + Team Investment)
    const teamVolumeSum = tree.children.reduce((acc, child) => acc + (Number(child.totalVolume) || 0), 0);
    tree.totalVolume = rootInvestmentVolume + teamVolumeSum;
    tree.directsCount = tree.children.length;

    // Calculate Global Stats
    const totalMembers = (auditedMembers as NetworkMember[]);
    const teamVolume = rootInvestmentVolume + totalMembers.reduce((acc, m) => acc + (Number(m.personal_volume) || 0), 0);
    const activeNodes = totalMembers.filter((m) => m.personal_volume > 0).length;

    return {
      tree,
      stats: {
        totalEarnings,
        teamVolume,
        activeNodes
      }
    };
  } catch (error) {
    console.error('CRITICAL: Error fetching network tree:', error);
    return null;
  }
}


function buildNetworkTreeStructure(members: NetworkMember[], rootId: string): NetworkNode {
  const normalizedRootId = rootId ? rootId.toLowerCase().trim() : '';

  // Consistently create the Root Node manually
  // Its status and other metadata could be fetched if needed, but 'YOU' is the standard label here.
  return {
    id: rootId,
    name: 'YOU',
    level: 0,
    totalVolume: 0, // Will be set in getNetworkTree
    children: processChildren(members, normalizedRootId),
    directsCount: 0 // Will be set in getNetworkTree
  };
}

function processChildren(members: NetworkMember[], normalizedRootId: string): NetworkNode[] {
  const map = new Map<string, NetworkNode>();
  const roots: NetworkNode[] = [];

  // 1. Create Nodes
  members.forEach(m => {
    const mId = m.id.toLowerCase().trim();
    map.set(mId, {
      id: mId,
      email: m.email,
      name: m.username || m.email.split('@')[0],
      level: m.level,
      totalVolume: m.personal_volume,
      children: [],
      status: m.status as any,
      joinedAt: m.joined_at,
      directsCount: m.direct_referrals_count,
      rank: (m as any).rank
    });
  });

  // 2. Link Children
  members.forEach(m => {
    const mId = m.id.toLowerCase().trim();
    const node = map.get(mId)!;

    let parentId = m.referred_by ? m.referred_by.toLowerCase().trim() : null;

    // If parent is the Root User (who is not in the map), add to 'roots' array
    if (parentId === normalizedRootId) {
      roots.push(node);
    } else if (parentId && map.has(parentId)) {
      // Link to parent in the map
      const parent = map.get(parentId)!;
      parent.children.push(node);
    } else {
      // Orphan: parent not in tree (data inconsistency or multi-level gap).
      // Attach to root so the user always appears in the network.
      roots.push(node);
    }
  });

  // 3. Calc Volume
  const visited = new Set<string>();
  roots.forEach(r => calculateRecursiveVolume(r, visited));

  return roots;
}

function calculateRecursiveVolume(node: NetworkNode, visited = new Set<string>()): number {
  if (visited.has(node.id)) {
    console.warn("Cycle detected in calculateRecursiveVolume for node:", node.id);
    return 0;
  }
  visited.add(node.id);

  let volume = Number(node.totalVolume) || 0; // Ensure number

  if (node.children && node.children.length > 0) {
    node.children.forEach(child => {
      volume += calculateRecursiveVolume(child, visited);
    });
  }

  node.totalVolume = volume;
  visited.delete(node.id);
  return volume;
}


// ==========================================
// PROFILE
// ==========================================
export async function createOrUpdateProfile(userId: string, email: string, referredBy?: string) {
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) {
      // Update existing
      // Only update what's necessary (e.g. login time? or nothing)
      // updating 'created_at' on login is wrong.
    } else {
      // Create new
      // Verify referrer if provided
      let finalReferredBy = null;
      if (referredBy) {
        // Resolve ref code or UUID to actual UUID
        const { data: refUser } = await supabase
          .from('profiles')
          .select('id')
          .or(`id.eq.${referredBy},ref_code.eq.${referredBy}`)
          .maybeSingle();
          
        if (refUser) finalReferredBy = refUser.id;
      }

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email,
          role: 'user',
          referred_by: finalReferredBy,
          credit_balance: 0,
          wallet_balance: 0,
          status: 'ACTIVE'
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating/updating profile:', error);
    return { success: false, error };
  }
}

export async function updateUserProfile(userId: string, updates: Partial<Profile>) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error updating profile in Supabase:', error);
    return { success: false, error: error.message };
  }
}

// ==========================================
// BALANCE CALCULATION
// ==========================================
export async function calculateBalance(userId: string): Promise<number> {
  try {
    // Option 1: Trust 'credit_balance' column in profiles (Faster)
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.wallet_balance || 0;

    // Option 2: Re-calculate from transactions (Slower but audit-proof)
    /*
    const { data: txs } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'COMPLETED');
    return (txs || []).reduce((sum, tx) => sum + tx.amount, 0);
    */
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}

// ==========================================
// LEGACY / PLACEHOLDER FUNCTIONS
// ==========================================
// The legacy weekly cash-salary flow is intentionally retired. Career rewards are
// non-monetary and must be validated by the NOVA team; this client never creates
// a withdrawal, transaction, or investment update for them.
export async function claimWeeklyBonus(_userId: string, _amount: number) {
  return {
    success: false,
    message: 'El salario monetario fue reemplazado por el Plan de Carrera NOVA.'
  };
}

export async function recordDailyROI(_userId: string, _amount: number) {
  return {
    success: false,
    message: 'El ROI se acredita únicamente al completar las tareas diarias del ciclo.'
  };
}

// ==========================================
// PROMOTIONS & EVENTS
// ==========================================

export async function getActivePromotions() {
  try {
    const now = new Date().toISOString();

    // Select promotions that are active, have started, and haven't ended yet
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('end_date', { ascending: true }); // Order by ending soonest

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('Error fetching active promotions:', error);
    return [];
  }
}
