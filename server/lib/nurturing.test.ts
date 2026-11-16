import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFallbackPostDraft,
  buildWarmupPlan,
  calculateNextTrustScore,
  computeNextScheduledIso,
  generatePersonaDraft,
  isPostDue,
} from './nurturing.ts';

test('generatePersonaDraft produces deterministic realistic Vietnamese profile with proxy and 2FA', () => {
  const a = generatePersonaDraft(0);
  const b = generatePersonaDraft(1);

  assert.notEqual(a.fbUid, b.fbUid);
  assert.ok(a.fbUid.startsWith('100089'));
  assert.ok(a.cookieData.includes(`c_user=${a.fbUid}`));
  assert.ok(a.proxyEndpoint.startsWith('socks5://'));
  assert.ok(a.recoveryEmail.includes('@mailcare.vn'));
  assert.equal(a.warmupStage, 'Mới (1-7 ngày)');
  assert.equal(a.twoFactorSecret.replace(/\s+/g, '').length, 16);
});

test('calculateNextTrustScore caps at 100 and promotes ad readiness properly', () => {
  const early = calculateNextTrustScore(40, 3, 2);
  assert.equal(early.trustScore, 44);
  assert.equal(early.adAccountStatus, 'Chưa sẵn sàng Ads');
  assert.equal(early.fanpageStage, 'Mới tạo (1-7 ngày)');

  const mid = calculateNextTrustScore(58, 10, 4);
  assert.equal(mid.trustScore, 66);
  assert.equal(mid.adAccountStatus, 'Đang nuôi Ads');
  assert.equal(mid.fanpageStage, 'Đang nuôi tương tác (8-21 ngày)');

  const ready = calculateNextTrustScore(95, 22, 5);
  assert.equal(ready.trustScore, 100);
  assert.equal(ready.adAccountStatus, 'Sẵn sàng chạy Ads');
  assert.equal(ready.fanpageStage, 'Sẵn sàng chạy Ads');
  assert.equal(ready.accountWarmupStage, 'Tin cậy (>21 ngày)');
});

test('computeNextScheduledIso handles once, daily, every_2_days, and weekly cleanly', () => {
  const base = '2026-11-16T09:00:00.000Z';
  assert.equal(computeNextScheduledIso(base, 'once'), null);
  assert.equal(computeNextScheduledIso(base, 'daily'), '2026-11-17T09:00:00.000Z');
  assert.equal(computeNextScheduledIso(base, 'every_2_days'), '2026-11-18T09:00:00.000Z');
  assert.equal(computeNextScheduledIso(base, 'weekly'), '2026-11-23T09:00:00.000Z');
});

test('isPostDue compares scheduled timestamp accurately', () => {
  const now = new Date('2026-11-16T10:00:00.000Z').getTime();
  assert.equal(isPostDue('2026-11-16T09:59:00.000Z', now), true);
  assert.equal(isPostDue('2026-11-16T10:00:00.000Z', now), true);
  assert.equal(isPostDue('2026-11-16T10:05:00.000Z', now), false);
});

test('buildWarmupPlan & buildFallbackPostDraft return tailored outputs', () => {
  const profilePlan = buildWarmupPlan('profile', 3);
  const pagePlan = buildWarmupPlan('page', 16);
  assert.ok(profilePlan.length >= 3);
  assert.ok(pagePlan.length >= 3);

  const draft = buildFallbackPostDraft({
    topic: 'Robot hút bụi X10 Pro',
    goal: 'Bán hàng / Chốt đơn',
    tone: 'Chuyên gia đáng tin cậy',
    utmLink: 'https://giadungsmart.vn/uu-dai?utm_source=fb',
  });
  assert.ok(draft.postText.includes('Robot hút bụi X10 Pro'));
  assert.ok(draft.postText.includes('https://giadungsmart.vn/uu-dai'));
  assert.ok(draft.hashtags.length >= 2);
});
