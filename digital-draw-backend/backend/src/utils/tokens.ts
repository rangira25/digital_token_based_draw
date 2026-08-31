import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a cryptographically secure token code (used for draw tokens)
 * Format: DRW-XXXXXXXX-XXXXXXXX (human-readable + URL safe)
 */
export const generateTokenCode = (): string => {
  const part1 = crypto.randomBytes(4).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DRW-${part1}-${part2}`;
};

/**
 * Generate a secure random hex token (for email verification, password reset, etc.)
 */
export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate a short verification code (for winner claims)
 */
export const generateVerificationCode = (): string => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

export { uuidv4 };
