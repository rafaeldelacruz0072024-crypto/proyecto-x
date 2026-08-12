
export type UserRole = 'admin' | 'sub-admin' | 'user';
export type UserStatus = 'active' | 'blocked';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export type TransactionType = 'deposit' | 'withdrawal' | 'adjustment_add' | 'adjustment_sub' | 'roi' | 'bonus_weekly';

export interface Profile {
  id: string;
  email: string;
  username?: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  balance: number;
  wallet_address?: string;
  permissions?: string[]; // Array de slugs de módulos permitidos
  two_factor_enabled?: boolean;
  two_factor_secret?: string;
  withdrawals_blocked?: boolean;
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  status: 'active' | 'completed';
  roi_earned: number;
  created_at: string;
  profiles?: Profile;
  plans?: Plan;
}

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  status: TransactionStatus;
  proof_url?: string;
  created_at: string;
  profiles?: Profile;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: TransactionStatus;
  created_at: string;
  profiles?: Profile;
}

export interface Plan {
  id: string;
  name: string;
  roi_percentage: number;
  duration_days: number;
  min_amount: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  description: string;
  created_at: string;
  profiles?: Profile;
}

export interface SystemSettings {
  withdrawal_fee: number;
  deposit_fee: number;
  min_withdrawal: number;
  max_withdrawal_daily: number;
}

export interface GatewayConfig {
  id: string;
  provider: string; // e.g., 'Stripe', 'BinancePay', 'NowPayments'
  api_key: string;
  secret_key?: string;
  webhook_secret?: string;
  is_active: boolean;
  mode: 'test' | 'live';
  updated_at: string;
}
