import type { KnowledgeDoc, RagChunkMatch } from '../../shared/types.ts';

const VIETNAMESE_STOPWORDS = new Set([
  'va', 'la', 'cua', 'cho', 'voi', 'cac', 'nhung', 'mot', 'hai', 'ba',
  'nay', 'kia', 'do', 'thi', 'ma', 'neu', 'khi', 'tai', 'vi', 'de',
  'trong', 'ngoai', 'tren', 'duoi', 'tu', 'den', 'da', 'dang', 'se',
  'duoc', 'bi', 'khong', 'co', 'nhu', 'rat', 'qua', 'nhat', 'hay', 'hoac',
  'minh', 'ban', 'anh', 'chi', 'em', 'shop', 'oi', 'ad', 'nha', 'nhe', 'a',
]);

export function stripVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function tokenizeVietnamese(input: string): string[] {
  const normalized = stripVietnameseDiacritics(input.toLowerCase())
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();

  if (!normalized) return [];

  return normalized
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !VIETNAMESE_STOPWORDS.has(token));
}

export function chunkDocument(text: string, maxChars = 420): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      chunks.push(para);
      continue;
    }

    // Split long paragraphs by sentence boundaries or newline
    const sentences = para.split(/(?<=[.!?。\n])\s+/);
    let buffer = '';

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if ((buffer + ' ' + sentence).trim().length <= maxChars) {
        buffer = (buffer + ' ' + sentence).trim();
      } else {
        if (buffer) chunks.push(buffer);
        if (sentence.length <= maxChars) {
          buffer = sentence.trim();
        } else {
          // Hard split oversized sentence safely
          for (let i = 0; i < sentence.length; i += maxChars) {
            chunks.push(sentence.slice(i, i + maxChars).trim());
          }
          buffer = '';
        }
      }
    }

    if (buffer) chunks.push(buffer);
  }

  return chunks;
}

export function retrieveRelevantChunks(
  query: string,
  docs: KnowledgeDoc[],
  topK = 3
): RagChunkMatch[] {
  const queryTokens = tokenizeVietnamese(query);
  if (docs.length === 0) return [];

  const allChunks: Array<{ docId: string; docTitle: string; snippet: string; tokens: string[] }> = [];

  for (const doc of docs) {
    const snippets = chunkDocument(doc.content);
    for (const snippet of snippets) {
      const tokens = tokenizeVietnamese(`${doc.title} ${doc.category} ${snippet}`);
      allChunks.push({
        docId: doc.id,
        docTitle: doc.title,
        snippet,
        tokens,
      });
    }
  }

  if (allChunks.length === 0) return [];

  if (queryTokens.length === 0) {
    return allChunks.slice(0, topK).map((c) => ({
      docId: c.docId,
      docTitle: c.docTitle,
      snippet: c.snippet,
      score: 0.1,
    }));
  }

  // Compute document frequency (DF) across chunks for TF-IDF weighting
  const df = new Map<string, number>();
  for (const chunk of allChunks) {
    const uniqueTokens = new Set(chunk.tokens);
    for (const t of uniqueTokens) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  const totalChunks = allChunks.length;
  const queryTokenSet = new Set(queryTokens);

  const scored: RagChunkMatch[] = allChunks.map((chunk) => {
    const tf = new Map<string, number>();
    for (const t of chunk.tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    let score = 0;
    for (const qt of queryTokenSet) {
      const freq = tf.get(qt) ?? 0;
      if (freq > 0) {
        const idf = Math.log(1 + totalChunks / (1 + (df.get(qt) ?? 0)));
        const tfNorm = freq / Math.sqrt(Math.max(1, chunk.tokens.length));
        score += tfNorm * idf;
      }
    }

    // Bonus for exact phrase substring overlap
    const normQuery = stripVietnameseDiacritics(query.toLowerCase());
    const normSnippet = stripVietnameseDiacritics(chunk.snippet.toLowerCase());
    for (const qt of queryTokenSet) {
      if (qt.length >= 4 && normSnippet.includes(qt) && normQuery.includes(qt)) {
        score += 0.08;
      }
    }

    return {
      docId: chunk.docId,
      docTitle: chunk.docTitle,
      snippet: chunk.snippet,
      score: Number(score.toFixed(4)),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const positive = scored.filter((item) => item.score > 0);
  if (positive.length > 0) {
    return positive.slice(0, topK);
  }

  // Fallback to top general product overview chunks if no lexical overlap
  return scored.slice(0, Math.min(topK, scored.length)).map((item) => ({
    ...item,
    score: 0.05,
  }));
}

export function buildUtmUrl(
  baseUrl: string,
  utm: { source: string; medium: string; campaign: string; content?: string }
): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (utm.source) url.searchParams.set('utm_source', utm.source);
    if (utm.medium) url.searchParams.set('utm_medium', utm.medium);
    if (utm.campaign) url.searchParams.set('utm_campaign', utm.campaign);
    if (utm.content) url.searchParams.set('utm_content', utm.content);
    return url.toString();
  } catch {
    return trimmed;
  }
}
