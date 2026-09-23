import { getPreferredLanguage, isAppLanguage } from '@/i18n/language';
import type { User } from '@/types';

export const USER_STORAGE_KEY = 'lf_user';

export function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<User> | null;
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.id !== 'string' ||
      typeof value.name !== 'string' ||
      typeof value.email !== 'string'
    ) {
      return null;
    }
    return {
      id: value.id,
      name: value.name,
      email: value.email,
      phone: typeof value.phone === 'string' ? value.phone : '',
      language: isAppLanguage(value.language) ? value.language : getPreferredLanguage(),
    };
  } catch {
    return null;
  }
}

export function readStoredUser(): User | null {
  try {
    return parseStoredUser(localStorage.getItem(USER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredUser(user: User): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Cache opsional, sesi tetap jalan lewat state dan token.
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Cache user opsional.
  }
}
