import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ROLE_PERMISSIONS,
  generateSessionToken,
  hashPassword,
  parseCookieValue,
  userHasPermission,
  verifyPassword,
} from './auth.ts';

test('hashPassword and verifyPassword validate matching and reject wrong passwords', () => {
  const stored = hashPassword('Admin@123456');
  assert.ok(stored.includes(':'));
  assert.equal(verifyPassword('Admin@123456', stored), true);
  assert.equal(verifyPassword('WrongPass!', stored), false);
  assert.equal(verifyPassword('Admin@123456', 'malformed'), false);
});

test('generateSessionToken creates unique 64-char hex strings', () => {
  const t1 = generateSessionToken();
  const t2 = generateSessionToken();
  assert.equal(t1.length, 64);
  assert.notEqual(t1, t2);
});

test('parseCookieValue extracts named cookie accurately', () => {
  const header = 'foo=bar; spfb_session=abc123def456; theme=light';
  assert.equal(parseCookieValue(header, 'spfb_session'), 'abc123def456');
  assert.equal(parseCookieValue(header, 'missing'), null);
  assert.equal(parseCookieValue(undefined, 'spfb_session'), null);
});

test('userHasPermission enforces active status, admin bypass, and granular permissions', () => {
  const admin = { role: 'admin' as const, permissions: [], active: true };
  assert.equal(userHasPermission(admin, 'manage_system_admin'), true);

  const inactiveAdmin = { role: 'admin' as const, permissions: ['manage_system_admin' as const], active: false };
  assert.equal(userHasPermission(inactiveAdmin, 'view_dashboard'), false);

  const operator = {
    role: 'operator' as const,
    permissions: DEFAULT_ROLE_PERMISSIONS.operator,
    active: true,
  };
  assert.equal(userHasPermission(operator, 'run_scanner'), true);
  assert.equal(userHasPermission(operator, 'manage_system_admin'), false);

  const viewer = {
    role: 'viewer' as const,
    permissions: DEFAULT_ROLE_PERMISSIONS.viewer,
    active: true,
  };
  assert.equal(userHasPermission(viewer, 'view_dashboard'), true);
  assert.equal(userHasPermission(viewer, 'manage_publisher'), false);
});
