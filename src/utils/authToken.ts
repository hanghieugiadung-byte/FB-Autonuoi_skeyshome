const TOKEN_STORAGE_KEY = 'spfb_session_token';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const ss = window.sessionStorage?.getItem(TOKEN_STORAGE_KEY);
    if (ss) {
      memoryToken = ss;
      return ss;
    }
  } catch {
    // ignore storage restriction inside strict iframes
  }
  try {
    const ls = window.localStorage?.getItem(TOKEN_STORAGE_KEY);
    if (ls) {
      memoryToken = ls;
      return ls;
    }
  } catch {
    // ignore storage restriction inside strict iframes
  }
  return null;
}

export function saveAuthToken(token: string): void {
  const clean = token.trim();
  if (!clean) return;
  memoryToken = clean;
  try {
    window.sessionStorage?.setItem(TOKEN_STORAGE_KEY, clean);
  } catch {
    // ignore
  }
  try {
    window.localStorage?.setItem(TOKEN_STORAGE_KEY, clean);
  } catch {
    // ignore
  }
}

export function clearAuthToken(): void {
  memoryToken = null;
  try {
    window.sessionStorage?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    window.localStorage?.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
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
    credentials: init?.credentials ?? 'include',
    headers,
  });
}
