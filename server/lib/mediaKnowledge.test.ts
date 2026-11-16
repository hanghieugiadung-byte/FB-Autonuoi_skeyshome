import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  classifyMediaKind,
  decodePlainTextBuffer,
  extractTextFromZipOfficeXml,
  inferMimeType,
  isOfficeOpenXmlSource,
  isPlainTextSource,
} from './mediaKnowledge.ts';

function createMinimalZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const rawBuf = Buffer.from(entry.content, 'utf8');
    const compressed = zlib.deflateRawSync(rawBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuf, compressed]);
    localChunks.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt32LE(offset, 42);

    centralChunks.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localRecord.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

test('inferMimeType resolves audio, video, image, and document extensions cleanly', () => {
  assert.equal(inferMimeType('call-sale.mp3', 'application/octet-stream'), 'audio/mpeg');
  assert.equal(inferMimeType('voice-note.m4a', ''), 'audio/mp4');
  assert.equal(inferMimeType('review-demo.mp4', ''), 'video/mp4');
  assert.equal(inferMimeType('bang-gia.png', ''), 'image/png');
  assert.equal(inferMimeType('catalog.pdf', ''), 'application/pdf');
  assert.equal(inferMimeType('audio.ogg', 'audio/mp3'), 'audio/mpeg');
});

test('classifyMediaKind maps files into audio, video, image, document, and text buckets', () => {
  assert.equal(classifyMediaKind('tu-van.wav', 'audio/wav'), 'audio');
  assert.equal(classifyMediaKind('unbox.mov', 'video/quicktime'), 'video');
  assert.equal(classifyMediaKind('poster.webp', 'image/webp'), 'image');
  assert.equal(classifyMediaKind('hop-dong.pdf', 'application/pdf'), 'document');
  assert.equal(classifyMediaKind('playbook.docx', inferMimeType('playbook.docx')), 'document');
  assert.equal(classifyMediaKind('faq.md', 'text/markdown'), 'text');
  assert.equal(isPlainTextSource('data.csv', 'text/csv'), true);
  assert.equal(isOfficeOpenXmlSource('spec.docx', 'application/octet-stream'), true);
});

test('decodePlainTextBuffer strips UTF-8 BOM, parses JSON, and cleans HTML tags', () => {
  const jsonBuf = Buffer.from('\uFEFF{"product":"X10 Pro","price":"9.490.000đ"}', 'utf8');
  const decodedJson = decodePlainTextBuffer(jsonBuf, 'price.json', 'application/json');
  assert.match(decodedJson, /"product": "X10 Pro"/);

  const htmlBuf = Buffer.from('<html><body><h1>Robot X10 Pro</h1><p>Bảo hành 24 tháng</p></body></html>', 'utf8');
  const decodedHtml = decodePlainTextBuffer(htmlBuf, 'landing.html', 'text/html');
  assert.equal(decodedHtml, 'Robot X10 Pro Bảo hành 24 tháng');
});

test('extractTextFromZipOfficeXml extracts Vietnamese text from compressed DOCX word/document.xml', () => {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document><w:body>' +
    '<w:p><w:r><w:t>Bảng giá Robot hút bụi X10 Pro</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Ưu đãi còn 9.490.000đ &amp; bảo hành 24 tháng</w:t></w:r></w:p>' +
    '</w:body></w:document>';

  const docxZip = createMinimalZip([{ name: 'word/document.xml', content: xml }]);
  const extracted = extractTextFromZipOfficeXml(docxZip);
  assert.match(extracted, /Bảng giá Robot hút bụi X10 Pro/);
  assert.match(extracted, /Ưu đãi còn 9\.490\.000đ & bảo hành 24 tháng/);
});
