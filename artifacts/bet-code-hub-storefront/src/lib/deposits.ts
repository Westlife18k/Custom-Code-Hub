export type DepositStatus = 'pending' | 'success' | 'failed';

export type DepositRecord = {
  reference: string;
  email: string;
  amountPesewas: number;
  status: DepositStatus;
  channel: string | null;
  paystackTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type DepositConfig = {
  currency: string;
  configured: boolean;
  publicKeyConfigured: boolean;
  keyMode: string;
  testModeOnly: boolean;
  liveEnabled: boolean;
  withdrawalsEnabled: boolean;
  minPesewas: number;
  maxPesewas: number;
};

export type DepositHistory = {
  email: string;
  currency: string;
  balancePesewas: number;
  deposits: DepositRecord[];
};

export type InitializeDepositResult = {
  reference: string;
  authorization_url: string;
  amountPesewas: number;
  currency: string;
  testMode: boolean;
};

export type VerifyDepositResult = {
  reference: string;
  status: DepositStatus;
  success: boolean;
  alreadyCredited?: boolean;
  amountPesewas: number;
  balancePesewas: number;
  currency: string;
  message?: string;
};

export const DEPOSIT_PRESETS_PESEWAS = [500, 1000, 2000, 5000, 10000];

/** Formats integer pesewas as Ghana cedis, e.g. 2500 -> "GH₵25.00". */
export function formatPesewas(pesewas: number): string {
  const cedis = (Number.isFinite(pesewas) ? pesewas : 0) / 100;
  return `GH₵${cedis.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export class DepositApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'DepositApiError';
    this.status = status;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
      payload && typeof payload === 'object' && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? ((payload as { error: string }).error)
        : `Request failed (${response.status}).`;
    throw new DepositApiError(message, response.status);
  }

  return payload as T;
}

export function fetchDepositConfig(): Promise<DepositConfig> {
  return requestJson<DepositConfig>('/api/deposits/config');
}

export function fetchDepositHistory(email: string): Promise<DepositHistory> {
  return requestJson<DepositHistory>(`/api/deposits?email=${encodeURIComponent(email)}`);
}

export function initializeDeposit(input: {
  email: string;
  amountPesewas: number;
}): Promise<InitializeDepositResult> {
  return requestJson<InitializeDepositResult>('/api/deposits/initialize', {
    method: 'POST',
    body: JSON.stringify({ email: input.email, amountPesewas: input.amountPesewas }),
  });
}

export function verifyDeposit(input: { email: string; reference: string }): Promise<VerifyDepositResult> {
  return requestJson<VerifyDepositResult>('/api/deposits/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
