// ============================================================
// Shared TypeScript Types
// ============================================================

export type UserRole = 'participant' | 'organizer' | 'admin';
export type UserStatus = 'pending' | 'active' | 'suspended' | 'banned';
export type DrawStatus = 'draft' | 'open' | 'closed' | 'completed' | 'cancelled';
export type TokenStatus = 'issued' | 'used' | 'expired' | 'revoked';
export type EntryStatus = 'active' | 'disqualified' | 'withdrawn';
export type WinnerStatus = 'selected' | 'notified' | 'claimed' | 'forfeited';
export type NotificationType = 'win' | 'draw_open' | 'draw_closing' | 'announcement' | 'verification' | 'claim' | 'system' | 'confirmation' | 'reminder' | 'draw';
export type PrizeType = 'cash' | 'product' | 'voucher' | 'service' | 'other';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  full_name: string;
  phone?: string;
  national_id?: string;
  profile_image_url?: string;
  company_name?: string;
  organizer_license?: string;
  email_verified: boolean;
  email_verified_at?: Date;
  phone_verified: boolean;
  identity_verified: boolean;
  totp_secret?: string;
  totp_enabled: boolean;
  backup_codes?: string[];
  login_attempts: number;
  locked_until?: Date;
  last_login_at?: Date;
  last_login_ip?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Draw {
  id: string;
  organizer_id: string;
  title: string;
  description?: string;
  status: DrawStatus;
  registration_start: Date;
  registration_end: Date;
  draw_date: Date;
  max_participants?: number;
  max_entries_per_user: number;
  min_age?: number;
  eligibility_notes?: string;
  tokens_per_entry: number;
  total_token_pool: number;
  winners_count: number;
  draw_algorithm: string;
  draw_seed?: string;
  draw_executed_at?: Date;
  draw_executed_by?: string;
  image_url?: string;
  terms_url?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Token {
  id: string;
  draw_id: string;
  participant_id: string;
  token_code: string;
  status: TokenStatus;
  issued_by: string;
  issued_at: Date;
  used_at?: Date;
  expires_at?: Date;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface DrawEntry {
  id: string;
  draw_id: string;
  participant_id: string;
  token_id: string;
  status: EntryStatus;
  submitted_at: Date;
  disqualified_at?: Date;
  disqualified_reason?: string;
  ip_address?: string;
}

export interface Winner {
  id: string;
  draw_id: string;
  participant_id: string;
  entry_id: string;
  prize_id?: string;
  rank: number;
  status: WinnerStatus;
  selected_at: Date;
  notified_at?: Date;
  claimed_at?: Date;
  claim_deadline?: Date;
  verification_code?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  read_at?: Date;
  data?: Record<string, unknown>;
  created_at: Date;
}

export interface Prize {
  id: string;
  draw_id: string;
  rank: number;
  title: string;
  description?: string;
  prize_type: PrizeType;
  value?: number;
  currency?: string;
  quantity: number;
  image_url?: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Augmented Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
