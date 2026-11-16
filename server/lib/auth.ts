import crypto from 'node:crypto';

export const DEFAULT_APP_PASSCODE = '8889';
export const MIN_PASSCODE_LENGTH = 4;
export const MAX_PASSCODE_LENGTH = 64;

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function validatePasscode(rawPasscode: string): { ok: boolean; passcode: string; error?: string } {
  const passcode = String(rawPasscode ?? '').trim();
  if (!passcode) {
    return { ok: false, passcode: '', error: 'Vui lòng nhập mật mã truy cập.' };
  }
  if (passcode.length < MIN_PASSCODE_LENGTH) {
    return {
      ok: false,
      passcode,
      error: `Mật mã truy cập phải có tối thiểu ${MIN_PASSCODE_LENGTH} ký tự.`,
    };
  }
  if (passcode.length > MAX_PASSCODE_LENGTH) {
    return {
      ok: false,
      passcode,
      error: `Mật mã truy cập không được vượt quá ${MAX_PASSCODE_LENGTH} ký tự.`,
    };
  }
  return { ok: true, passcode };
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
