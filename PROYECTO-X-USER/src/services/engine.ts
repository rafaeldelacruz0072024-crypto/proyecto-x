import {
  Transaction,
  TransactionType,
  TransactionStatus,
  Investment,
  NetworkNode
} from '../types';
import { COMMISSION_LEVELS } from '../constants';

export const DUPLICATION_LIMIT_FACTOR = 2.0; // 200%

/**
 * Calculates the current liquid balance.
 */
export const calculateBalance = (transactions: Transaction[]): number => {
  return transactions.reduce((acc, tx) => {
    const isWithdrawal = tx.type === TransactionType.WITHDRAWAL;

    if (isWithdrawal) {
      if (tx.status === TransactionStatus.FAILED) return acc;
      return acc + Number(tx.amount);
    }

    if (tx.status === TransactionStatus.COMPLETED || tx.status === TransactionStatus.CONFIRMED) {
      return acc + Number(tx.amount);
    }

    return acc;
  }, 0);
};

export const getCommissionPercentage = (level: number, residualConfig?: any[]): number => {
  if (residualConfig && residualConfig.length > 0) {
    const config = residualConfig.find(rc => rc.id === level);
    return config ? (config.percent / 100) : 0;
  }

  // Fallback to constants if config is missing
  const levelRule = COMMISSION_LEVELS.find(
    rule => level >= rule.start && level <= rule.end
  );
  return levelRule ? levelRule.percentage : 0;
};

/**
 * Calculates how much of a profit can be absorbed by active investments
 */
export const distributeProfitToInvestments = (
  investments: Investment[],
  profitAmount: number
): { updatedInvestments: Investment[], creditedAmount: number } => {
  let totalCredited = 0;
  const updated = investments.map(inv => {
    if (inv.status !== 'ACTIVE') return inv;

    const limit = Number(inv.amount) * DUPLICATION_LIMIT_FACTOR;
    const availableRoom = Math.max(0, limit - Number(inv.accumulated_earnings));

    // STRICT RULE: We only take what fits from the original profitAmount.
    // If we reach the cap, the rest of THIS specific distribution is lost.
    const canAbsorb = Math.min(profitAmount, availableRoom);

    const newAccumulated = Number(inv.accumulated_earnings) + canAbsorb;
    totalCredited += canAbsorb;

    return {
      ...inv,
      accumulated_earnings: newAccumulated,
      status: newAccumulated >= limit ? 'COMPLETED' : 'ACTIVE'
    } as Investment;
  });

  return {
    updatedInvestments: updated,
    creditedAmount: totalCredited
  };
};

/**
 * Generates referral commission transactions for simulation purposes.
 * Note: Real commissions are handled by database triggers/RPC.
 */
export const calculateReferralCommissions = (
  investorName: string,
  investedAmount: number,
  startLevel: number = 1,
  residualConfig?: any[]
): Transaction[] => {
  const commissions: Transaction[] = [];

  const percentage = getCommissionPercentage(startLevel, residualConfig);
  if (percentage > 0) {
    const amount = investedAmount * percentage;
    commissions.push({
      id: `ref_com_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      user_id: 'current',
      type: TransactionType.REFERRAL_COMMISSION,
      amount: amount,
      created_at: new Date().toISOString(),
      status: TransactionStatus.COMPLETED,
      description: `Comisión Nivel ${startLevel} de red: Inversión de ${investorName} ($${investedAmount})`
    } as Transaction);
  }

  return commissions;
};

/**
 * Helper to add a new node to the tree
 */
export const addNodeToNetwork = (root: NetworkNode, sponsorId: string, newNode: NetworkNode): NetworkNode => {
  if (root.id === sponsorId) {
    return {
      ...root,
      children: [...root.children, newNode],
      totalVolume: root.totalVolume + newNode.totalVolume
    };
  }

  return {
    ...root,
    totalVolume: root.totalVolume + newNode.totalVolume,
    children: root.children.map(child => addNodeToNetwork(child, sponsorId, newNode))
  };
};
