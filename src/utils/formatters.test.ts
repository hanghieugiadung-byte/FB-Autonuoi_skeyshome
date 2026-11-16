import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCompactMembers, formatNumberVi, parseKeywordList } from './formatters.ts';

test('formatCompactMembers formats thousands and millions cleanly', () => {
  assert.equal(formatCompactMembers(850), '850');
  assert.equal(formatCompactMembers(14500), '14.5K');
  assert.equal(formatCompactMembers(1200000), '1.2M');
});

test('formatNumberVi formats numbers with locale grouping', () => {
  assert.equal(formatNumberVi(42500), '42.500');
});

test('parseKeywordList splits by comma, semicolon, or newline and deduplicates', () => {
  assert.deepEqual(
    parseKeywordList('tư vấn, báo giá; mua ở đâu\ntư vấn'),
    ['tư vấn', 'báo giá', 'mua ở đâu']
  );
});
