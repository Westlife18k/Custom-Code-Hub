import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  FlaskConical,
  Loader2,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  Wallet as WalletIcon,
} from 'lucide-react';
import {
  DEPOSIT_PRESETS_PESEWAS,
  DepositApiError,
  fetchDepositConfig,
  fetchDepositHistory,
  formatPesewas,
  initializeDeposit,
  verifyDeposit,
  type DepositConfig,
  type DepositHistory,
  type DepositRecord,
} from '@/lib/deposits';
import { readLastOrder } from '@/lib/last-order';

type Notice = { tone: 'success' | 'error' | 'info'; text: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusLabel(status: DepositRecord['status']): string {
  if (status === 'success') return 'Credited';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Wallet() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('20');
  const [config, setConfig] = useState<DepositConfig | null>(null);
  const [history, setHistory] = useState<DepositHistory | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const verifiedRef = useRef(false);

  const amountPesewas = useMemo(() => {
    const parsed = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed * 100);
  }, [amount]);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const minPesewas = config?.minPesewas ?? 100;
  const maxPesewas = config?.maxPesewas ?? 1_000_000;
  const amountValid = amountPesewas >= minPesewas && amountPesewas <= maxPesewas;

  const loadHistory = useCallback(async (targetEmail: string) => {
    if (!EMAIL_PATTERN.test(targetEmail)) {
      setHistory(null);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await fetchDepositHistory(targetEmail);
      setHistory(data);
    } catch (error) {
      setHistory(null);
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Could not load deposit history.',
      });
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Prefill the email used for the last order so returning customers only pay.
  useEffect(() => {
    const last = readLastOrder();
    if (last?.email) {
      setEmail(last.email);
      void loadHistory(last.email);
    }
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await fetchDepositConfig();
        if (active) setConfig(data);
      } catch {
        if (active) setConfig(null);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Paystack returns the customer to this page with ?reference=… (and ?trxref=…).
  useEffect(() => {
    if (verifiedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') ?? params.get('trxref');
    if (!reference || !reference.startsWith('DEP-')) return;

    verifiedRef.current = true;
    const emailParam = params.get('email');
    const remembered = readLastOrder()?.email ?? '';
    const targetEmail = emailParam ?? remembered ?? email;

    setVerifying(true);
    void (async () => {
      try {
        if (targetEmail) {
          setEmail(targetEmail);
        }
        const result = await verifyDeposit({ email: targetEmail, reference });
        setNotice({
          tone: result.success ? 'success' : 'error',
          text: result.success
            ? result.alreadyCredited
              ? `Deposit ${reference} was already credited to your wallet.`
              : `${formatPesewas(result.amountPesewas)} added to your wallet.`
            : result.message ?? 'This payment was not successful, so nothing was credited.',
        });
        await loadHistory(targetEmail);
      } catch (error) {
        setNotice({
          tone: 'error',
          text:
            error instanceof Error
              ? error.message
              : 'We could not verify that payment. Nothing was credited.',
        });
      } finally {
        setVerifying(false);
        window.history.replaceState({}, '', '/wallet');
      }
    })();
  }, [email, loadHistory]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailValid) {
      setNotice({ tone: 'error', text: 'Enter the email address you want on the deposit receipt.' });
      return;
    }
    if (!amountValid) {
      setNotice({
        tone: 'error',
        text: `Enter an amount between ${formatPesewas(minPesewas)} and ${formatPesewas(maxPesewas)}.`,
      });
      return;
    }
    if (config && !config.configured) {
      setNotice({
        tone: 'error',
        text: 'Deposits are not available yet: Paystack keys are not configured on the server.',
      });
      return;
    }

    setStarting(true);
    setNotice(null);
    void (async () => {
      try {
        const result = await initializeDeposit({ email: email.trim(), amountPesewas });
        // Hand off to Paystack Checkout. The wallet is only credited after the
        // server verifies the transaction (or the signed webhook arrives).
        window.location.assign(result.authorization_url);
      } catch (error) {
        setNotice({
          tone: 'error',
          text:
            error instanceof DepositApiError
              ? error.message
              : 'We could not start the payment. Please try again.',
        });
        setStarting(false);
      }
    })();
  };

  const deposits = history?.deposits ?? [];
  const balance = history?.balancePesewas ?? 0;
  const testMode = config?.testModeOnly !== false;

  return (
    <div className="bch">
      <div className="bch-topline">
        <span className="bch-topline-dot" />
        Test mode — no real money moves in this environment
      </div>

      <div className="bch-shell">
        <header className="bch-header">
          <Link href="/" className="bch-brand">
            <span className="bch-mark">
              <BadgeCheck size={18} />
            </span>
            <span className="bch-brand-name">
              BET CODE <span>HUB</span>
            </span>
          </Link>
          <nav className="bch-nav bch-nav-static">
            <Link href="/">Packages</Link>
            <Link href="/my-codes">My codes</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/my-codes" className="bch-nav-cta">
              Find a code <ArrowRight size={14} />
            </Link>
          </nav>
        </header>
      </div>

      <main className="bch-shell bch-customer-page">
        <div className="bch-customer-head">
          <div className="bch-kicker">
            <span className="bch-kicker-line" /> Wallet
          </div>
          <h1>
            Top up and <em>keep playing</em>
          </h1>
          <p>
            Fund your Bet Code Hub wallet with Mobile Money or card through Paystack. Your balance is
            credited only after Paystack confirms the payment on our server.
          </p>
        </div>

        {notice ? (
          <div
            className={
              notice.tone === 'success'
                ? 'bch-example-banner'
                : notice.tone === 'error'
                  ? 'bch-preview-alert'
                  : 'bch-example-banner'
            }
            role="status"
          >
            {notice.tone === 'success' ? <ShieldCheck size={15} /> : <CircleAlert size={15} />}
            <span>{notice.text}</span>
          </div>
        ) : null}

        {config && !config.configured ? (
          <div className="bch-preview-alert" role="alert">
            <CircleAlert size={15} />
            <span>
              Paystack is not configured on the server yet. Add <code>PAYSTACK_SECRET_KEY</code> (test
              key) to enable deposits.
            </span>
          </div>
        ) : null}

        <section className="bch-customer-card bch-wallet-card">
          <div className="bch-section-overline">Wallet balance</div>
          <div className="bch-wallet-balance">
            <span className="bch-wallet-amount">{formatPesewas(balance)}</span>
            {testMode ? (
              <span className="bch-mode-pill">
                <FlaskConical size={11} /> Test mode
              </span>
            ) : null}
          </div>
          <p>
            {emailValid
              ? `Showing the balance for ${email.trim()}.`
              : 'Enter your email below to see your balance and deposit history.'}
          </p>

          <form className="bch-customer-form" onSubmit={handleSubmit}>
            <div className="bch-form-field">
              <label htmlFor="deposit-email">Email for your receipt</label>
              <input
                id="deposit-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => {
                  if (EMAIL_PATTERN.test(email.trim())) void loadHistory(email.trim());
                }}
                required
              />
            </div>

            <div className="bch-form-field">
              <label htmlFor="deposit-amount">Amount (GHS)</label>
              <div className="bch-amount-chips">
                {DEPOSIT_PRESETS_PESEWAS.map((preset) => {
                  const selected = amountPesewas === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      className={selected ? 'bch-chip is-active' : 'bch-chip'}
                      aria-pressed={selected}
                      onClick={() => setAmount(String(preset / 100))}
                    >
                      {formatPesewas(preset)}
                    </button>
                  );
                })}
              </div>
              <input
                id="deposit-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </div>

            <button className="bch-button" type="submit" disabled={starting || verifying}>
              {starting ? (
                <>
                  <Loader2 size={15} className="bch-spin" /> Opening Paystack…
                </>
              ) : (
                <>
                  <WalletIcon size={15} /> Deposit {amountPesewas > 0 ? formatPesewas(amountPesewas) : ''}
                </>
              )}
            </button>
          </form>

          <div className="bch-customer-footnote">
            <LockKeyhole size={14} />
            <span>
              You are redirected to Paystack&apos;s secure checkout. Card and Mobile Money details never
              touch our servers, and secrets stay on the backend.
            </span>
          </div>
        </section>

        <section className="bch-customer-card">
          <div className="bch-section-head">
            <div>
              <div className="bch-section-overline">Deposit history</div>
              <h2>Recent top-ups</h2>
            </div>
            {loadingHistory ? <Loader2 size={16} className="bch-spin" /> : null}
          </div>

          {verifying ? (
            <p className="bch-lookup-message">
              <Loader2 size={13} className="bch-spin" /> Confirming your payment with Paystack…
            </p>
          ) : null}

          {deposits.length === 0 ? (
            <p className="bch-availability-message">
              {emailValid
                ? 'No deposits yet. Your first top-up will appear here.'
                : 'Add your email above to load your deposit history.'}
            </p>
          ) : (
            <ul className="bch-deposit-list">
              {deposits.map((deposit) => (
                <li className="bch-deposit-row" key={deposit.reference}>
                  <div className="bch-deposit-main">
                    <Receipt size={14} />
                    <div>
                      <strong>{formatPesewas(deposit.amountPesewas)}</strong>
                      <span className="bch-deposit-meta">
                        {formatDate(deposit.paidAt ?? deposit.createdAt)} · {deposit.reference}
                      </span>
                    </div>
                  </div>
                  <span className={`bch-status-pill is-${deposit.status}`}>{statusLabel(deposit.status)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="bch-customer-footnote">
            <ShieldCheck size={14} />
            <span>
              Each deposit is verified server-side against Paystack and credited once. Duplicate
              webhooks and repeated verifications cannot credit the same reference twice.
            </span>
          </div>
        </section>
      </main>

      <footer className="bch-footer">
        <div className="bch-shell bch-footer-row">
          <span className="bch-footer-brand">
            BET CODE <span>HUB</span>
          </span>
          <span className="bch-footer-copy">18+ only. Bet responsibly. Test-mode payments.</span>
          <Link href="/" className="bch-footer-link">
            Back to packages <ArrowRight size={12} />
          </Link>
        </div>
      </footer>
    </div>
  );
}
