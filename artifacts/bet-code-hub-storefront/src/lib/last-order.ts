const LAST_ORDER_STORAGE_KEY = 'bch:last-order';

export type LastOrder = { reference: string; email: string };

/** Remembers the most recent checkout so My codes can offer a one-click lookup. */
export function rememberLastOrder(order: LastOrder): void {
  try {
    window.sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Storage may be unavailable (private mode); the Paystack callback URL carries the reference anyway.
  }
}

export function readLastOrder(): LastOrder | null {
  try {
    const raw = window.sessionStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastOrder> | null;
    if (!parsed || typeof parsed.reference !== 'string' || typeof parsed.email !== 'string') {
      return null;
    }
    return { reference: parsed.reference, email: parsed.email };
  } catch {
    return null;
  }
}

/** Reads the `reference` / `email` query parameters Paystack appends to the callback URL. */
export function readLookupQuery(search: string): LastOrder | null {
  const params = new URLSearchParams(search);
  const reference = params.get('reference')?.trim() ?? '';
  const email = params.get('email')?.trim() ?? '';
  if (!reference) return null;
  return { reference, email };
}
