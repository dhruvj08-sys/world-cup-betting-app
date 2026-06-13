import { LOCK_OFFSET_MINUTES } from './constants';

/**
 * Calculates the exact lock time for a given kickoff time.
 */
export function calculateLockTime(kickoffTime: Date | string | number): Date {
  const kickoff = new Date(kickoffTime);
  return new Date(kickoff.getTime() - LOCK_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Determines if a match is currently locked based on the current server time.
 */
export function isMatchLocked(lockTime: Date | string | number, currentTime: Date = new Date()): boolean {
  return new Date(lockTime).getTime() <= currentTime.getTime();
}

/**
 * Calculates time remaining until lock in milliseconds.
 * Returns 0 if already locked.
 */
export function timeUntilLock(lockTime: Date | string | number, currentTime: Date = new Date()): number {
  const diff = new Date(lockTime).getTime() - currentTime.getTime();
  return Math.max(0, diff);
}
