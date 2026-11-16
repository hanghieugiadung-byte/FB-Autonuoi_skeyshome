import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUtmUrl,
  chunkDocument,
  retrieveRelevantChunks,
  stripVietnameseDiacritics,
  tokenizeVietnamese,
} from './rag.ts';
import type { KnowledgeDoc } from '../../shared/types.ts';

test('stripVietnameseDiacritics handles đ and tone marks accurately', () => {
  assert.equal(stripVietnameseDiacritics('Đồ gia dụng thông minh'), 'Do gia dung thong minh');
});

test('tokenizeVietnamese removes stopwords and short tokens', () => {
  const tokens = tokenizeVietnamese('Mình đang cần tư vấn máy hút bụi gia đình giá tốt');
  assert.equal(tokens.includes('minh'), false);
  assert.equal(tokens.includes('dang'), false);
  assert.equal(tokens.includes('may'), true);
  assert.equal(tokens.includes('hut'), true);
  assert.equal(tokens.includes('bui'), true);
});

test('chunkDocument splits multi-paragraph documents into bounded chunks', () => {
  const doc = [
    'Đoạn 1: Robot hút bụi X10 Pro lực hút 8000Pa, tự giặt giẻ nước nóng 60 độ.',
    'Đoạn 2: Bảo hành chính hãng 24 tháng tại Hà Nội và TP.HCM. Miễn phí vận chuyển toàn quốc. '.repeat(6),
  ].join('\n\n');

  const chunks = chunkDocument(doc, 180);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((c) => c.length <= 180));
});

test('retrieveRelevantChunks ranks matching knowledge base document highest', () => {
  const docs: KnowledgeDoc[] = [
    {
      id: 'd1',
      title: 'Bảng giá Robot Hút Bụi X10',
      category: 'Sản phẩm',
      content: 'Robot hút bụi lau nhà X10 Pro giá niêm yết 11.900.000đ, đang ưu đãi còn 9.490.000đ, bảo hành 24 tháng.',
      chunkCount: 1,
      sourceType: 'text',
      fileName: null,
      mimeType: null,
      fileSize: null,
      updatedAt: '2026-11-15T00:00:00Z',
    },
    {
      id: 'd2',
      title: 'Chính sách đại lý máy lọc không khí',
      category: 'Chính sách',
      content: 'Chiết khấu đại lý máy lọc không khí A5 lên đến 28% cho đơn đầu tiên từ 10 sản phẩm.',
      chunkCount: 1,
      sourceType: 'text',
      fileName: null,
      mimeType: null,
      fileSize: null,
      updatedAt: '2026-11-15T00:00:00Z',
    },
  ];

  const results = retrieveRelevantChunks('Ai biết giá robot hút bụi X10 Pro bảo hành bao lâu không?', docs, 2);
  assert.equal(results.length, 1);
  assert.equal(results[0].docId, 'd1');
  assert.ok(results[0].score > 0);
});

test('buildUtmUrl appends UTM parameters cleanly', () => {
  const url = buildUtmUrl('https://giadungsmart.vn/x10-pro?ref=fb', {
    source: 'facebook_group',
    medium: 'organic_comment',
    campaign: 'q4_leadgen',
  });
  assert.ok(url.includes('utm_source=facebook_group'));
  assert.ok(url.includes('utm_medium=organic_comment'));
  assert.ok(url.includes('utm_campaign=q4_leadgen'));
  assert.ok(url.includes('ref=fb'));
});
