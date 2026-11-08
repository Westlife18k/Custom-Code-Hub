import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  AdminApiError,
  adminLogin,
  clearAdminToken,
  createAdminCode,
  deleteAdminCode,
  fetchAdminStatus,
  listAdminCodes,
  readAdminToken,
  updateAdminCode,
  type AdminCode,
} from '@/lib/admin';
import { formatPesewas } from '@/lib/deposits';

type FormState = {
  bettingCode: string;
  title: string;
  amountGhs: string;
  totalOdds: string;
  matchCount: string;
  description: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  bettingCode: '',
  title: '',
  amountGhs: '',
  totalOdds: '',
  matchCount: '',
  description: '',
  active: true,
};

/** GH₵ input -> pesewa string for the API, or null when not a number. */
function ghsToPesewas(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const cedis = Number(cleaned);
  if (!Number.isFinite(cedis)) return null;
  return Math.round(cedis * 100);
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => readAdminToken());
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchAdminStatus()
      .then((result) => {
        if (!cancelled) setConfigured(result.configured);
      })
      .catch(() => {
        if (!cancelled) setConfigured(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback((message?: string) => {
    clearAdminToken();
    setToken(null);
    setCodes([]);
    setPassword('');
    setNotice(null);
    setError(message ?? null);
  }, []);

  const loadCodes = useCallback(
    async (activeToken: string) => {
      setLoading(true);
      setError(null);

      try {
        setCodes(await listAdminCodes(activeToken));
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          signOut('Your session expired. Please sign in again.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not load your codes.');
        }
      } finally {
        setLoading(false);
      }
    },
    [signOut],
  );

  useEffect(() => {
    if (token) void loadCodes(token);
  }, [token, loadCodes]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setError('Enter your owner password.');
      return;
    }

    setSigningIn(true);
    setError(null);

    try {
      setToken(await adminLogin(password));
      setPassword('');
      setNotice('Signed in. You can now add codes and change amounts.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setSigningIn(false);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();

    if (!form.bettingCode.trim()) {
      setError('Enter the code you want to sell.');
      return;
    }
    if (!form.title.trim()) {
      setError('Give the code a short title.');
      return;
    }

    const pesewas = ghsToPesewas(form.amountGhs);
    if (pesewas === null) {
      setError('Enter the amount in cedis, for example 25 or 25.50.');
      return;
    }

    if (!token) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const created = await createAdminCode(token, {
        bettingCode: form.bettingCode.trim(),
        title: form.title.trim(),
        amountGhs: form.amountGhs.trim(),
        totalOdds: form.totalOdds.trim() || undefined,
        matchCount: form.matchCount.trim() || undefined,
        description: form.description.trim() || undefined,
        active: form.active,
      });

      setCodes((current) => [created, ...current]);
      setForm(EMPTY_FORM);
      setNotice(`Added ${created.title} at ${formatPesewas(created.pricePesewas)}.`);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        signOut('Your session expired. Please sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not add that code.');
      }
    } finally {
      setSaving(false);
    }
  }

  function patchLocal(updated: AdminCode) {
    setCodes((current) => current.map((code) => (code.id === updated.id ? updated : code)));
  }

  async function handleSaveAmount(code: AdminCode) {
    if (!token) return;

    const draft = amountDrafts[code.id];
    if (draft === undefined) return;

    if (ghsToPesewas(draft) === null) {
      setError('Enter the new amount in cedis, for example 30.');
      return;
    }

    setBusyId(code.id);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateAdminCode(token, code.id, { amountGhs: draft });
      patchLocal(updated);
      setAmountDrafts((current) => {
        const next = { ...current };
        delete next[code.id];
        return next;
      });
      setNotice(`${updated.title} is now ${formatPesewas(updated.pricePesewas)}.`);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        signOut('Your session expired. Please sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not change that amount.');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(code: AdminCode) {
    if (!token) return;

    setBusyId(code.id);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateAdminCode(token, code.id, { active: !code.active });
      patchLocal(updated);
      setNotice(updated.active ? `${updated.title} is live again.` : `${updated.title} is hidden from the storefront.`);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        signOut('Your session expired. Please sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not update that code.');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(code: AdminCode) {
    if (!token) return;
    if (!window.confirm(`Delete "${code.title}"? This cannot be undone.`)) return;

    setBusyId(code.id);
    setError(null);
    setNotice(null);

    try {
      await deleteAdminCode(token, code.id);
      setCodes((current) => current.filter((entry) => entry.id !== code.id));
      setNotice(`${code.title} was deleted.`);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 401) {
        signOut('Your session expired. Please sign in again.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not delete that code.');
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!token) {
    return (
      <div className="bch">
        <main className="bch-admin-page">
          <Link href="/" className="bch-admin-back">
            <ArrowLeft size={16} aria-hidden /> Back to store
          </Link>

          <header className="bch-admin-head">
            <p className="bch-eyebrow">Owner access</p>
            <h1>Manage your codes</h1>
            <p className="bch-admin-sub">
              Sign in to add betting codes and set the amount each one sells for. Visitors never see this page.
            </p>
          </header>

          <section className="bch-customer-card bch-admin-card">
            {configured === false ? (
              <div className="bch-admin-empty">
                <CircleAlert size={18} aria-hidden />
                <div>
                  <strong>Owner password not set yet</strong>
                  <p>
                    Add an <code>ADMIN_PASSWORD</code> environment variable to this app in Settings, then reload this page.
                  </p>
                </div>
              </div>
            ) : (
              <form className="bch-customer-form" onSubmit={handleSignIn}>
                <label htmlFor="owner-password">Owner password</label>
                <input
                  id="owner-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  data-testid="input-admin-password"
                />

                <button className="bch-button" type="submit" disabled={signingIn} data-testid="button-admin-signin">
                  {signingIn ? <Loader2 className="bch-spin" size={18} aria-hidden /> : <LockKeyhole size={18} aria-hidden />}
                  {signingIn ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}

            {error ? (
              <p className="bch-admin-message is-error" role="alert" data-testid="text-admin-error">
                <CircleAlert size={16} aria-hidden /> {error}
              </p>
            ) : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="bch">
      <main className="bch-admin-page">
        <Link href="/" className="bch-admin-back">
          <ArrowLeft size={16} aria-hidden /> Back to store
        </Link>

        <header className="bch-admin-head">
          <p className="bch-eyebrow">Owner panel</p>
          <h1>Codes and amounts</h1>
          <p className="bch-admin-sub">
            Add a code, change what it sells for, or hide it from the storefront. Changes apply immediately.
          </p>
        </header>

        <div className="bch-admin-actions">
          <button
            type="button"
            className="bch-admin-ghost"
            onClick={() => token && void loadCodes(token)}
            disabled={loading}
            data-testid="button-admin-refresh"
          >
            {loading ? <Loader2 className="bch-spin" size={16} aria-hidden /> : <RefreshCw size={16} aria-hidden />}
            Refresh
          </button>
          <button type="button" className="bch-admin-ghost" onClick={() => signOut()} data-testid="button-admin-signout">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>

        {error ? (
          <p className="bch-admin-message is-error" role="alert" data-testid="text-admin-error">
            <CircleAlert size={16} aria-hidden /> {error}
          </p>
        ) : null}

        {notice ? (
          <p className="bch-admin-message is-ok" role="status" data-testid="text-admin-notice">
            <Check size={16} aria-hidden /> {notice}
          </p>
        ) : null}

        <section className="bch-customer-card bch-admin-card">
          <div className="bch-customer-head">
            <h2>
              <Plus size={18} aria-hidden /> Add a code
            </h2>
            <p>Paste the code you want to sell and set its price in cedis.</p>
          </div>

          <form className="bch-customer-form bch-admin-form" onSubmit={handleCreate}>
            <div className="bch-admin-grid">
              <div className="bch-admin-field">
                <label htmlFor="code-value">Betting code</label>
                <input
                  id="code-value"
                  value={form.bettingCode}
                  onChange={(event) => setForm({ ...form, bettingCode: event.target.value })}
                  placeholder="e.g. 4ABC9Z"
                  data-testid="input-admin-code"
                />
              </div>

              <div className="bch-admin-field">
                <label htmlFor="code-title">Title</label>
                <input
                  id="code-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="e.g. Weekend bankers"
                  data-testid="input-admin-title"
                />
              </div>

              <div className="bch-admin-field">
                <label htmlFor="code-amount">Amount (GH₵)</label>
                <input
                  id="code-amount"
                  inputMode="decimal"
                  value={form.amountGhs}
                  onChange={(event) => setForm({ ...form, amountGhs: event.target.value })}
                  placeholder="e.g. 25"
                  data-testid="input-admin-amount"
                />
              </div>

              <div className="bch-admin-field">
                <label htmlFor="code-odds">Total odds (optional)</label>
                <input
                  id="code-odds"
                  value={form.totalOdds}
                  onChange={(event) => setForm({ ...form, totalOdds: event.target.value })}
                  placeholder="e.g. 8.45"
                  data-testid="input-admin-odds"
                />
              </div>

              <div className="bch-admin-field">
                <label htmlFor="code-matches">Selections (optional)</label>
                <input
                  id="code-matches"
                  inputMode="numeric"
                  value={form.matchCount}
                  onChange={(event) => setForm({ ...form, matchCount: event.target.value })}
                  placeholder="e.g. 5"
                  data-testid="input-admin-matches"
                />
              </div>

              <div className="bch-admin-field bch-admin-field-wide">
                <label htmlFor="code-description">Description (optional)</label>
                <input
                  id="code-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Short note shown on the storefront"
                  data-testid="input-admin-description"
                />
              </div>
            </div>

            <label className="bch-admin-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
                data-testid="checkbox-admin-active"
              />
              Show on the storefront right away
            </label>

            <button className="bch-button" type="submit" disabled={saving} data-testid="button-admin-create">
              {saving ? <Loader2 className="bch-spin" size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
              {saving ? 'Adding…' : 'Add code'}
            </button>
          </form>
        </section>

        <section className="bch-admin-list" aria-busy={loading}>
          <div className="bch-admin-list-head">
            <h2>Your codes</h2>
            <span className="bch-admin-count" data-testid="text-admin-count">
              {codes.length} {codes.length === 1 ? 'code' : 'codes'}
            </span>
          </div>

          {loading && codes.length === 0 ? (
            <p className="bch-admin-empty">
              <Loader2 className="bch-spin" size={16} aria-hidden /> Loading your codes…
            </p>
          ) : null}

          {!loading && codes.length === 0 ? (
            <p className="bch-admin-empty" data-testid="text-admin-empty">
              No codes yet. Add your first one above.
            </p>
          ) : null}

          <ul className="bch-admin-rows">
            {codes.map((code) => {
              const draft = amountDrafts[code.id] ?? '';
              const busy = busyId === code.id;

              return (
                <li key={code.id} className="bch-admin-row" data-testid={`row-admin-code-${code.bettingCode}`}>
                  <div className="bch-admin-row-main">
                    <div className="bch-admin-row-title">
                      <strong>{code.title}</strong>
                      <span className={`bch-admin-badge${code.active ? ' is-live' : ''}`}>
                        {code.active ? 'Live' : 'Hidden'}
                      </span>
                    </div>

                    <p className="bch-admin-code">
                      <code>{code.bettingCode}</code>
                      <span className="bch-admin-price">{formatPesewas(code.pricePesewas)}</span>
                      {code.totalOdds ? <span className="bch-admin-meta">odds {code.totalOdds}</span> : null}
                      {code.matchCount !== null ? (
                        <span className="bch-admin-meta">{code.matchCount} selections</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="bch-admin-row-controls">
                    <label className="bch-admin-inline-field">
                      <span>New amount (GH₵)</span>
                      <input
                        inputMode="decimal"
                        value={draft}
                        placeholder={(code.pricePesewas / 100).toFixed(2)}
                        onChange={(event) =>
                          setAmountDrafts((current) => ({ ...current, [code.id]: event.target.value }))
                        }
                        data-testid={`input-admin-amount-${code.bettingCode}`}
                      />
                    </label>

                    <button
                      type="button"
                      className="bch-admin-ghost"
                      onClick={() => void handleSaveAmount(code)}
                      disabled={busy || draft.trim() === ''}
                      data-testid={`button-admin-save-${code.bettingCode}`}
                    >
                      {busy ? <Loader2 className="bch-spin" size={16} aria-hidden /> : <Save size={16} aria-hidden />}
                      Save
                    </button>

                    <button
                      type="button"
                      className="bch-admin-ghost"
                      onClick={() => void handleToggleActive(code)}
                      disabled={busy}
                      data-testid={`button-admin-toggle-${code.bettingCode}`}
                    >
                      {code.active ? 'Hide' : 'Show'}
                    </button>

                    <button
                      type="button"
                      className="bch-admin-ghost is-danger"
                      onClick={() => void handleDelete(code)}
                      disabled={busy}
                      data-testid={`button-admin-delete-${code.bettingCode}`}
                    >
                      <Trash2 size={16} aria-hidden /> Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="bch-customer-footnote">
          This page is password protected. Keep your owner password private, and never share a code before it is paid for.
        </p>
      </main>
    </div>
  );
}
