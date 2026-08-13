export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    username: string | null;
    role: 'user' | 'admin' | 'sub-admin';
    status: 'active' | 'inactive' | 'suspended';
    ref_code: string | null;
    referred_by: string | null;
    credit_balance: number;
    wallet_balance: number;
    referral_commission_balance?: number;
    wallet_address: string | null;
    rank: 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Black Crown';
    team_volume: number;

    created_at: string;
    phone?: string;
    country?: string;
    kyc_verified?: boolean;
    withdrawal_wallet?: string | null;
    two_factor_enabled?: boolean;
    withdrawals_blocked?: boolean;
    roi_blocked?: boolean;
    transfer_blocked?: boolean;
    geminix_card_address?: string | null;
    geminix_card_user?: string | null;
}

export enum TransactionType {
    DEPOSIT = 'DEPOSIT',
    WITHDRAWAL = 'WITHDRAWAL',
    WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
    DAILY_RETURN = 'DAILY_RETURN',
    REFERRAL_COMMISSION = 'REFERRAL_COMMISSION',
    WEEKLY_SALARY = 'WEEKLY_SALARY',
    WEEKLY_BONUS = 'WEEKLY_BONUS',
    BONUS_WEEKLY = 'bonus_weekly',
    INVESTMENT_COST = 'INVESTMENT_COST',
    BONUS = 'BONUS',
    DEPOSIT_BONUS = 'DEPOSIT_BONUS',
    TRANSFER_IN = 'TRANSFER_IN',
    TRANSFER_OUT = 'TRANSFER_OUT',
    CONVERSION = 'CONVERSION',
    PRODUCT_PURCHASE = 'PRODUCT_PURCHASE',
    GAME_STAKE = 'GAME_STAKE',
    GAME_WIN = 'GAME_WIN'
}


export enum TransactionStatus {
    COMPLETED = 'COMPLETED',
    CONFIRMED = 'CONFIRMED',
    PENDING = 'PENDING',
    FAILED = 'FAILED',
    REJECTED = 'REJECTED'
}

export type DepositStatus = 'pending' | 'approved' | 'rejected' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Deposit {
    id: string;
    user_id: string;
    amount: number;
    method: string;
    status: DepositStatus;
    transaction_hash?: string;
    blockchain_tx_hash?: string;
    created_at: string;
    approved_at?: string;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface Withdrawal {
    id: string;
    user_id: string;
    amount: number;
    status: WithdrawalStatus;
    wallet_address: string;
    method?: string;
    blockchain_tx_hash?: string;
    rejection_reason?: string;
    created_at: string;
    approved_at?: string;
    completed_at?: string;
}

export type InvestmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Investment {
    id: string;
    user_id: string;
    plan_id?: string;
    amount: number;
    status: InvestmentStatus;
    accumulated_earnings: number;
    assigned_roi_percentage: number;
    business_days_elapsed: number;
    last_accrual_on: string;
    matures_on?: string | null;
    capital_returned: boolean;
    plans?: Plan;
    created_at: string;
    completed_at?: string;
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
    status: 'active' | 'inactive';
    created_at?: string;
    // Software Package Fields
    is_software_package?: boolean;
    software_url?: string;
    membership_days?: number;
    fixed_amount?: number;
}

export interface SalaryRange {
    teamVolume: number;
    bonus: number;
}

export interface CreditLog {
    id: string;
    user_id: string;
    amount: number;
    type: 'ADMIN_ADJUSTMENT' | 'CONVERSION' | 'TRANSFER_IN' | 'TRANSFER_OUT';
    description?: string;
    performed_by?: string;
    created_at: string;
    profiles?: Profile;
}

export interface Transaction {
    id: string;
    user_id: string;
    type: TransactionType | string;
    amount: number;
    status: TransactionStatus | string;
    description: string | null;
    reference_id: string | null;
    created_at: string;
}

export interface NetworkMember {
    id: string;
    email: string;
    username: string;
    level: number;
    ref_code: string;
    status: 'active' | 'inactive' | 'suspended';
    referred_by: string | null;
    joined_at: string;
    personal_volume: number;
    direct_referrals_count: number;
    // Computed on frontend
    team_volume?: number;
    children?: NetworkMember[];
}

export interface NetworkNode {
    id: string;
    email?: string;
    name: string;
    level: number;
    totalVolume: number;
    children: NetworkNode[];
    status?: 'active' | 'inactive' | 'suspended';
    joinedAt?: string;
    directsCount?: number;
    rank?: string;
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
    updated_at: string;
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
