export type AdminCode = {
  id: string;
  title: string;
  description: string | null;
  pricePesewas: number;
  totalOdds: string | null;
  matchCount: number | null;
  bettingCode: string;
  active: boolean;
  createdAt: string;
};

export type AdminCodeInput = {
  bettingCode: string;
  title: string;
  amountGhs: string;
  totalOdds?: string;
  matchCount?: string;
  description?: string;
  active?: boolean;
};

export type AdminCodePatch = {
  amountGhs?: string;
  bettingCode?: string;
  title?: string;
  totalOdds?: string | null;
  matchCount?: string | null;
  description?: string | null;
  active?: boolean;
};

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'bch-admin-token';

export function readAdminToken(): string | null {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeAdminToken(token: string): void {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* Private-mode storage failures just mean a shorter session. */
  }
}

export function clearAdminToken(): void {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function requestJson<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${response.status}).`;
    throw new AdminApiError(message, response.status);
  }

  return payload as T;
}

export function fetchAdminStatus(): Promise<{ configured: boolean }> {
  return requestJson<{ configured: boolean }>('/api/admin/status', null);
}

export async function adminLogin(password: string): Promise<string> {
  const result = await requestJson<{ token: string }>('/api/admin/login', null, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

  storeAdminToken(result.token);
  return result.token;
}

export async function listAdminCodes(token: string): Promise<AdminCode[]> {
  const result = await requestJson<{ codes: AdminCode[] }>('/api/admin/codes', token);
  return result.codes;
}

export function createAdminCode(token: string, input: AdminCodeInput): Promise<AdminCode> {
  return requestJson<AdminCode>('/api/admin/codes', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateAdminCode(
  token: string,
  id: string,
  patch: AdminCodePatch,
): Promise<AdminCode> {
  return requestJson<AdminCode>(`/api/admin/codes/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function deleteAdminCode(token: string, id: string): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(`/api/admin/codes/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}
