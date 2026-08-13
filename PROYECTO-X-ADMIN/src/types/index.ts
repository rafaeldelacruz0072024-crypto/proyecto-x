export interface Profile {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  username?: string;
  role: 'user' | 'admin' | 'sub-admin';
  status?: 'active' | 'inactive' | 'suspended';
  organizational_rank?: string;
  rank?: 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Black Crown';
  team_volume?: number;
  is_2fa_enabled?: boolean;
  wallet_address?: string;
  credit_balance?: number;
  wallet_balance?: number;
  user_tag?: 'REAL' | 'ADM' | 'DEMO' | 'SYSTEM';
  transfer_blocked?: boolean;
  withdrawals_blocked?: boolean;
  roi_blocked?: boolean;
  geminix_card_address?: string;
  geminix_card_user?: string;

  created_at?: string;
}

export type DepositStatus = 'pending' | 'approved' | 'rejected' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  status: DepositStatus;
  method?: string;
  transaction_hash?: string;
  blockchain_tx_hash?: string;
  proof_url?: string;
  created_at: string;
  approved_at?: string;
  profiles?: Profile;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee?: number;
  net_amount?: number;
  status: WithdrawalStatus;
  wallet_address?: string;
  method?: string;
  blockchain_tx_hash?: string;
  rejection_reason?: string;
  created_at: string;
  approved_at?: string;
  completed_at?: string;
  profiles?: Profile;
}

export type InvestmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Investment {
  id: string;
  user_id: string;
  plan_id?: string;
  amount: number;
  status: InvestmentStatus;
  accumulated_earnings: number;
  assigned_roi_percentage?: number;
  business_days_elapsed?: number;
  last_accrual_on?: string;
  matures_on?: string | null;
  capital_returned?: boolean;
  is_referral_commission_paid?: boolean;
  created_at: string;
  completed_at?: string;
  profiles?: Profile;
}

export interface Plan {
  id: string;
  name: string;
  code: 'DAILY' | 'D17' | 'D33' | string;
  description: string;
  roi_min_percentage: number;
  roi_max_percentage: number;
  duration_business_days: number | null;
  payout_mode: 'daily' | 'maturity';
  capital_release_mode: 'on_close' | 'maturity';
  min_amount: number;
  max_amount?: number | null;
  display_order: number;
  roi_percentage?: number;
  duration_days?: number;
  daily_roi_percent?: number;
  max_return_percent?: number;
  max_units?: number | null;
  status: 'active' | 'inactive';
  created_at?: string;
  // from plan_unit_usage view (joined client-side)
  units_used?: number;
  units_remaining?: number;
}

export interface GatewayConfig {
  id: string;
  provider: string;
  api_key: string;
  secret_key?: string;
  webhook_secret?: string;
  mode: 'test' | 'live';
  is_active: boolean;
  updated_at: string;
}

export interface SystemSettings {
  id: number;
  withdrawal_fee: number;
  min_withdrawal: number;
  credit_transfer_fee: number;
  min_investment: number;
  max_investment: number;
  daily_roi: number;
  roi_cap: number;
  residual_config: any;
  // Telegram Settings
  telegram_reward_amount?: number;
  telegram_link_connect?: string;
  telegram_link_bot?: string;
  telegram_link_channel?: string;
  telegram_enabled?: boolean;
  telegram_bot_token?: string;
  telegram_welcome_en?: string;
  telegram_welcome_es?: string;
  telegram_welcome_fr?: string;
  telegram_welcome_it?: string;
  telegram_welcome_ja?: string;
  telegram_welcome_pt?: string;
  telegram_welcome_zh?: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
  reference_id?: string;
  created_at: string;
}

export interface CreditLog {
  id: string;
  user_id: string;
  amount: number;
  type: 'ADMIN_ADJUSTMENT' | 'CONVERSION' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'REFERRAL_COMMISSION' | 'DAILY_ROI' | 'DAILY_RETURN' | 'WEEKLY_BONUS' | 'bonus_weekly' | 'BONUS' | 'DEPOSIT';
  description?: string;
  performed_by?: string;
  created_at: string;
  profiles?: Profile; // Joined profile
}
export interface NetworkMember {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  level: number;
  ref_code: string;
  status: 'active' | 'inactive' | 'suspended';
  referred_by: string | null;
  joined_at: string;
  personal_volume: number;
  direct_referrals_count: number;
  team_volume?: number;
  children?: NetworkMember[];
}

export interface NetworkNode {
  id: string;
  name: string;
  level: number;
  totalVolume: number;
  children: NetworkNode[];
  status?: 'active' | 'inactive' | 'suspended';
  joinedAt?: string;
  directsCount?: number;
  rank?: string;
}

export type PromotionType = 'CASHBACK' | 'DISCOUNT' | 'BONUS' | 'EVENT';

export interface Promotion {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  type: PromotionType;
  reward_value: number;
  min_investment: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  coupon_code: string | null;
  is_flash_offer: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  stock: number | null;
  myfxbook_url: string | null;
  category: string;
  is_active: boolean;
  is_flagship: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPurchase {
  id: string;
  user_id: string;
  product_id: string | null;
  amount: number;
  payment_method: 'BALANCE' | 'USDT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  details: any;
  created_at: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  content_type: 'VIDEO' | 'PDF' | 'DOCUMENT';
  url: string;
  thumbnail_url: string | null;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  game_url: string | null;
  game_code: string | null;
  is_active: boolean;
  min_bet: number;
  max_bet: number;
  created_at: string;
  updated_at: string;
}
