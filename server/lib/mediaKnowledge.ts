import path from 'node:path';
import zlib from 'node:zlib';
import type { KnowledgeSourceType } from '../../shared/types.ts';

const EXTENSION_MIME_MAP: Record<string, string> = {
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.weba': 'audio/webm',
  '.wma': 'audio/x-ms-wma',
  // Video
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.m4v': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg',
  '.3gp': 'video/3gpp',
  '.wmv': 'video/x-ms-wmv',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  // Documents & Text
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.csv': 'text/csv',
  '.tsv': 'text/tab-separated-values',
  '.json': 'application/json',
  '.xml': 'text/xml',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.log': 'text/plain',
  '.rtf': 'application/rtf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.html',
  '.htm',
  '.log',
  '.svg',
  '.yaml',
  '.yml',
  '.ini',
  '.conf',
]);

const OFFICE_ZIP_EXTENSIONS = new Set(['.docx', '.xlsx', '.pptx']);

export function inferMimeType(fileName: string, declaredMime?: string): string {
  const cleanDeclared = (declaredMime ?? '').split(';')[0].trim().toLowerCase();
  const ext = path.extname(fileName || '').toLowerCase();

  if (cleanDeclared && cleanDeclared !== 'application/octet-stream') {
    if (cleanDeclared === 'audio/mp3') return 'audio/mpeg';
    if (cleanDeclared === 'audio/x-m4a') return 'audio/mp4';
    return cleanDeclared;
  }

  if (ext && EXTENSION_MIME_MAP[ext]) {
    return EXTENSION_MIME_MAP[ext];
  }

  return 'application/octet-stream';
}

export function classifyMediaKind(fileName: string, mimeType: string): KnowledgeSourceType {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(fileName || '').toLowerCase();

  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/') && ext !== '.svg') return 'image';

  if (
    ext === '.pdf' ||
    mime === 'application/pdf' ||
    OFFICE_ZIP_EXTENSIONS.has(ext) ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('presentationml')
  ) {
    return 'document';
  }

  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return 'text';
  }

  return 'document';
}

export function isPlainTextSource(fileName: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(fileName || '').toLowerCase();
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'image/svg+xml' ||
    TEXT_EXTENSIONS.has(ext)
  );
}

export function isOfficeOpenXmlSource(fileName: string, mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  const ext = path.extname(fileName || '').toLowerCase();
  return (
    OFFICE_ZIP_EXTENSIONS.has(ext) ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('presentationml')
  );
}

export function decodePlainTextBuffer(buffer: Buffer, fileName: string, mimeType: string): string {
  const raw = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!raw) return '';

  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.json' || mimeType === 'application/json') {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }

  if (ext === '.html' || ext === '.htm' || ext === '.xml' || ext === '.svg' || mimeType === 'text/html') {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return raw;
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)));
}

/**
 * Pure Node.js ZIP entry reader + XML text extractor for .docx / .pptx / .xlsx
 * without requiring external unzip packages.
 */
export function extractTextFromZipOfficeXml(buffer: Buffer): string {
  // Check PK local header signature
  if (buffer.length < 30 || buffer.readUInt32LE(0) !== 0x04034b50) {
    return '';
  }

  const collectedTexts: string[] = [];
  let offset = 0;

  // Locate End of Central Directory (0x06054b50) from the end for accurate compressed sizes
  let eocdOffset = -1;
  const minScan = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minScan; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const cdSize = buffer.readUInt32LE(eocdOffset + 12);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    offset = cdOffset;
    const cdEnd = Math.min(buffer.length, cdOffset + cdSize);

    while (offset + 46 <= cdEnd) {
      if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

      const compressionMethod = buffer.readUInt16LE(offset + 10);
      const compressedSize = buffer.readUInt32LE(offset + 20);
      const nameLen = buffer.readUInt16LE(offset + 28);
      const extraLen = buffer.readUInt16LE(offset + 30);
      const commentLen = buffer.readUInt16LE(offset + 32);
      const localHeaderOffset = buffer.readUInt32LE(offset + 42);

      const entryName = buffer.toString('utf8', offset + 46, offset + 46 + nameLen);
      offset += 46 + nameLen + extraLen + commentLen;

      const isTargetXml =
        entryName === 'word/document.xml' ||
        entryName === 'xl/sharedStrings.xml' ||
        /^ppt\/slides\/slide\d+\.xml$/.test(entryName);

      if (!isTargetXml) continue;
      if (localHeaderOffset + 30 > buffer.length) continue;
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = Math.min(buffer.length, dataStart + compressedSize);
      const rawSlice = buffer.subarray(dataStart, dataEnd);

      let xmlText = '';
      try {
        if (compressionMethod === 0) {
          xmlText = rawSlice.toString('utf8');
        } else if (compressionMethod === 8) {
          xmlText = zlib.inflateRawSync(rawSlice).toString('utf8');
        }
      } catch {
        xmlText = '';
      }

      if (xmlText) {
        const plain = decodeXmlEntities(
          xmlText
            .replace(/<\/w:p>/g, '\n')
            .replace(/<\/a:p>/g, '\n')
            .replace(/<\/si>/g, '\n')
            .replace(/<\/t>/g, ' ')
            .replace(/<[^>]+>/g, '')
        )
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (plain) collectedTexts.push(plain);
      }
    }
  }

  return collectedTexts.join('\n\n').trim();
}

export function isMostlyPrintableText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) {
      nonPrintable++;
    }
  }
  return nonPrintable / sample.length < 0.05;
}
