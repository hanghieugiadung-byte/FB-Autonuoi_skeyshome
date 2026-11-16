import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvDocument,
  checkDuplicateCommentRisk,
  classifyPostIntent,
  computeRandomDelayMs,
  isInstantSeedingGroup,
  isWithinActiveHours,
  partitionItemsAcrossAccounts,
  shouldAutoJoinGroup,
} from './safety.ts';

test('computeRandomDelayMs respects min/max bounds (3-10s)', () => {
  assert.equal(computeRandomDelayMs(3, 10, () => 0), 3000);
  assert.equal(computeRandomDelayMs(3, 10, () => 1), 10000);
  assert.equal(computeRandomDelayMs(3, 10, () => 0.5), 6500);
});

test('shouldAutoJoinGroup auto-joins Public groups under quota and holds Private groups', () => {
  const pubOk = shouldAutoJoinGroup({
    groupType: 'Public',
    autoJoinEnabled: true,
    joinsToday: 4,
    maxJoinsPerDay: 10,
  });
  assert.equal(pubOk.join, true);
  assert.equal(pubOk.status, 'Đã tham gia (Auto-Join)');

  const priv = shouldAutoJoinGroup({
    groupType: 'Private',
    autoJoinEnabled: true,
    joinsToday: 4,
    maxJoinsPerDay: 10,
  });
  assert.equal(priv.join, false);
  assert.equal(priv.status, 'Chờ duyệt (Private)');

  const quotaHit = shouldAutoJoinGroup({
    groupType: 'Public',
    autoJoinEnabled: true,
    joinsToday: 10,
    maxJoinsPerDay: 10,
  });
  assert.equal(quotaHit.join, false);
  assert.equal(quotaHit.status, 'Tạm hoãn (Quota)');
});

test('partitionItemsAcrossAccounts distributes groups evenly across parallel Facebook accounts', () => {
  const accounts = [{ id: 'acc_1' }, { id: 'acc_2' }, { id: 'acc_3' }];
  const groups = ['g1', 'g2', 'g3', 'g4', 'g5'];
  const buckets = partitionItemsAcrossAccounts(groups, accounts);
  assert.equal(buckets.length, 3);
  assert.deepEqual(buckets[0].items, ['g1', 'g4']);
  assert.deepEqual(buckets[1].items, ['g2', 'g5']);
  assert.deepEqual(buckets[2].items, ['g3']);
});

test('isInstantSeedingGroup identifies groups allowing posting or commenting without approval', () => {
  assert.equal(isInstantSeedingGroup('Không cần duyệt', 'Tự do bình luận'), true);
  assert.equal(isInstantSeedingGroup('Cần duyệt bài', 'Tự do bình luận'), true);
  assert.equal(isInstantSeedingGroup('Cần duyệt bài', 'Kiểm duyệt bình luận'), false);
});

test('classifyPostIntent detects buying, price comparison, and complaints', () => {
  assert.equal(classifyPostIntent('Mọi người cho em xin tư vấn mua ở đâu uy tín ạ?'), 'Hỏi mua / Cần tư vấn');
  assert.equal(classifyPostIntent('Mẫu này báo giá bao nhiêu vậy shop?'), 'So sánh giá');
  assert.equal(classifyPostIntent('Hàng mới mua bị lỗi không sạc được cần bảo hành'), 'Khiếu nại / Vấn đề');
  assert.equal(classifyPostIntent('Hôm nay trời mát mẻ quá mọi người ơi'), 'Thảo luận chung');
});

test('isWithinActiveHours handles normal daytime ranges', () => {
  assert.equal(isWithinActiveHours(9, 8, 22), true);
  assert.equal(isWithinActiveHours(23, 8, 22), false);
});

test('checkDuplicateCommentRisk flags near-duplicate spam comments', () => {
  const recent = [
    'Chào bạn, bên mình có dòng robot hút bụi X10 Pro lực hút 8000Pa giá ưu đãi 9.490k bảo hành 24 tháng nhé.',
  ];
  const nearDup = checkDuplicateCommentRisk(
    'Chào bạn bên mình có dòng robot hút bụi X10 Pro lực hút 8000Pa giá ưu đãi 9.490k bảo hành 24 tháng ạ.',
    recent
  );
  assert.equal(nearDup.safe, false);

  const unique = checkDuplicateCommentRisk(
    'Nếu nhà bạn có nhiều thảm và thú cưng thì nên ưu tiên loại chổi chống rối kèm trạm tự giặt nước nóng.',
    recent
  );
  assert.equal(unique.safe, true);
});

test('buildCsvDocument escapes commas and quotes properly with UTF-8 BOM', () => {
  const csv = buildCsvDocument(['Tên Group', 'Thành viên'], [['Hội "Nhà Đẹp", Hà Nội', 12500]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Hội ""Nhà Đẹp"", Hà Nội",12500'));
});
