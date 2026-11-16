let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  return memoryToken;
}

export function saveAuthToken(token: string): void {
  const clean = token.trim();
  if (!clean) return;
  memoryToken = clean;
}

export function clearAuthToken(): void {
  memoryToken = null;
}

export function buildAuthUrl(url: string): string {
  const token = getAuthToken();
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return window.fetch(input, {
    ...init,
    headers,
  });
}
