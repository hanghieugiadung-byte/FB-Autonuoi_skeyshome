import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_APP_PASSCODE,
  generateSessionToken,
  hashPassword,
  validatePasscode,
  verifyPassword,
} from './auth.ts';

test('default passcode 8889 hashes and verifies accurately', () => {
  assert.equal(DEFAULT_APP_PASSCODE, '8889');
  const stored = hashPassword(DEFAULT_APP_PASSCODE);
  assert.ok(stored.includes(':'));
  assert.equal(verifyPassword('8889', stored), true);
  assert.equal(verifyPassword('8888', stored), false);
  assert.equal(verifyPassword('8889', 'malformed'), false);
});

test('validatePasscode allows 4+ char PINs like 8889 and rejects too-short/empty values', () => {
  assert.equal(validatePasscode('8889').ok, true);
  assert.equal(validatePasscode(' 8889 ').passcode, '8889');
  assert.equal(validatePasscode('123').ok, false);
  assert.equal(validatePasscode('').ok, false);
  assert.equal(validatePasscode('   ').ok, false);
});

test('generateSessionToken creates unique 64-char hex strings', () => {
  const t1 = generateSessionToken();
  const t2 = generateSessionToken();
  assert.equal(t1.length, 64);
  assert.notEqual(t1, t2);
});
