import type {
  CommentApprovalPolicy,
  GroupType,
  JoinStatus,
  LeadIntent,
  PostApprovalPolicy,
} from '../../shared/types.ts';
import { tokenizeVietnamese } from './rag.ts';

export function computeRandomDelayMs(
  minSec: number,
  maxSec: number,
  rng: () => number = Math.random
): number {
  const safeMin = Math.max(1, Math.min(minSec, maxSec));
  const safeMax = Math.max(safeMin, maxSec);
  const seconds = safeMin + rng() * (safeMax - safeMin);
  return Math.round(seconds * 1000);
}

export function shouldAutoJoinGroup(params: {
  groupType: GroupType;
  autoJoinEnabled: boolean;
  joinsToday: number;
  maxJoinsPerDay: number;
}): { join: boolean; status: JoinStatus; reason: string } {
  const { groupType, autoJoinEnabled, joinsToday, maxJoinsPerDay } = params;

  if (groupType === 'Private') {
    return {
      join: false,
      status: 'Chờ duyệt (Private)',
      reason: 'Nhóm Private cần trả lời câu hỏi kiểm duyệt thủ công để tránh bị từ chối hoặc đánh dấu spam.',
    };
  }

  if (!autoJoinEnabled) {
    return {
      join: false,
      status: 'Chờ tham gia',
      reason: 'Tùy chọn Auto-Join nhóm Public đang tắt.',
    };
  }

  if (joinsToday >= maxJoinsPerDay) {
    return {
      join: false,
      status: 'Tạm hoãn (Quota)',
      reason: `Đã đạt giới hạn an toàn ${maxJoinsPerDay} lượt tham gia/ngày.`,
    };
  }

  return {
    join: true,
    status: 'Đã tham gia (Auto-Join)',
    reason: 'Nhóm Public hợp lệ — tự động thực hiện Join Group với độ trễ an toàn.',
  };
}

export function partitionItemsAcrossAccounts<T, A extends { id: string }>(
  items: T[],
  accounts: A[]
): Array<{ account: A; items: T[] }> {
  if (accounts.length === 0) return [];
  const buckets = accounts.map((account) => ({ account, items: [] as T[] }));
  items.forEach((item, index) => {
    buckets[index % accounts.length].items.push(item);
  });
  return buckets.filter((b) => b.items.length > 0);
}

export function isInstantSeedingGroup(
  postApproval: PostApprovalPolicy,
  commentApproval: CommentApprovalPolicy
): boolean {
  return postApproval === 'Không cần duyệt' || commentApproval === 'Tự do bình luận';
}

export function classifyPostIntent(content: string): LeadIntent {
  const lower = content.toLowerCase();

  if (
    /lỗi|hỏng|tệ|chậm|không nhận|bị khóa|khiếu nại|phốt|lừa|bảo hành|sửa/.test(lower)
  ) {
    return 'Khiếu nại / Vấn đề';
  }

  if (
    /bao nhiêu|giá sao|báo giá|giá thế nào|rẻ hơn|so sánh|đắt|chi phí|combo|khuyến mãi/.test(lower)
  ) {
    return 'So sánh giá';
  }

  if (
    /tư vấn|mua ở đâu|gợi ý|nên chọn|cần tìm|ai dùng rồi|review|xin link|inbox|chốt|đặt hàng|ship/.test(lower)
  ) {
    return 'Hỏi mua / Cần tư vấn';
  }

  return 'Thảo luận chung';
}

export function isWithinActiveHours(
  currentHour: number,
  startHour: number,
  endHour: number
): boolean {
  const h = ((currentHour % 24) + 24) % 24;
  if (startHour <= endHour) {
    return h >= startHour && h <= endHour;
  }
  return h >= startHour || h <= endHour;
}

export function checkDuplicateCommentRisk(
  newComment: string,
  recentComments: string[],
  threshold = 0.72
): { safe: boolean; maxSimilarity: number } {
  const newTokens = new Set(tokenizeVietnamese(newComment));
  if (newTokens.size === 0 || recentComments.length === 0) {
    return { safe: true, maxSimilarity: 0 };
  }

  let maxSimilarity = 0;

  for (const prev of recentComments) {
    const prevTokens = new Set(tokenizeVietnamese(prev));
    if (prevTokens.size === 0) continue;

    let intersection = 0;
    for (const t of newTokens) {
      if (prevTokens.has(t)) intersection++;
    }

    const union = new Set([...newTokens, ...prevTokens]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    if (jaccard > maxSimilarity) {
      maxSimilarity = jaccard;
    }
  }

  return {
    safe: maxSimilarity < threshold,
    maxSimilarity: Number(maxSimilarity.toFixed(3)),
  };
}

export function formatCsvRow(values: Array<string | number | null | undefined>): string {
  return values
    .map((val) => {
      const str = val === null || val === undefined ? '' : String(val);
      if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

export function buildCsvDocument(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [formatCsvRow(headers), ...rows.map((r) => formatCsvRow(r))];
  return '\uFEFF' + lines.join('\r\n');
}
