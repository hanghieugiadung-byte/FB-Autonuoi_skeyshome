export function formatNumberVi(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function formatCompactMembers(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export function formatShortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function parseKeywordList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,;\n]+/)
        .map((k) => k.trim())
        .filter(Boolean)
    )
  );
}
