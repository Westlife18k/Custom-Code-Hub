import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  useInitializePayment,
  useListPackages,
  type PublicPackage,
  type PaymentInitializeInputChannel,
} from '@workspace/api-client-react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleHelp,
  LockKeyhole,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const LAST_ORDER_STORAGE_KEY = 'bch:last-order';

function formatGhs(priceKobo: number) {
  return (priceKobo / 100).toFixed(2);
}

function describeMatches(matchCount?: number | null) {
  if (countMatches(matchCount) === 0) return 'Selections confirmed per slip';
  return `${matchCount} match selections`;
}

function countMatches(matchCount?: number | null) {
  return matchCount === undefined || matchCount === null ? 0 : Number(matchCount);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: unknown } | null }).data;
    if (data && typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function Storefront() {
  const [selectedPackage, setSelectedPackage] = useState<PublicPackage | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState<PaymentInitializeInputChannel>('mobile_money');
  const [formError, setFormError] = useState<string | null>(null);

  const packagesQuery = useListPackages();
  const initializePayment = useInitializePayment();

  const packages = useMemo(() => packagesQuery.data ?? [], [packagesQuery.data]);

  useEffect(() => {
    if (!selectedPackage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPackage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPackage]);

  const closeMenu = () => setMobileMenuOpen(false);

  const openPackage = (item: PublicPackage) => {
    setSelectedPackage(item);
    setFormError(null);
  };

  const closePackage = () => {
    setSelectedPackage(null);
    setFormError(null);
  };

  const startCheckout = () => {
    if (!selectedPackage) return;
    const trimmedEmail = email.trim();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setFormError('Enter a valid email address so we can match your payment to your code.');
      return;
    }

    setFormError(null);
    initializePayment.mutate(
      { data: { packageId: selectedPackage.id, email: trimmedEmail, channel } },
      {
        onSuccess: (result) => {
          try {
            window.sessionStorage.setItem(
              LAST_ORDER_STORAGE_KEY,
              JSON.stringify({ reference: result.reference, email: trimmedEmail }),
            );
          } catch {
            // Storage can be unavailable in private modes; the callback URL still carries the reference.
          }
          window.location.href = result.authorization_url;
        },
        onError: (error) => {
          setFormError(errorMessage(error));
        },
      },
    );
  };

  return (
    <main className="bch">
      <div className="bch-topline">
        <span className="bch-topline-dot" />
        A Ghana-focused home for football insights
      </div>
      <div className="bch-shell">
        <header className="bch-header">
          <a className="bch-brand" href="#top" aria-label="Bet Code Hub home" data-testid="link-home-brand">
            <span className="bch-mark"><ShieldCheck size={18} strokeWidth={1.8} /></span>
            <span className="bch-brand-name">BET <span>CODE</span> HUB</span>
          </a>
          <button
            className="bch-menu-button"
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <nav className={`bch-nav${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <a href="#packages" onClick={closeMenu} data-testid="link-packages">Packages</a>
            <Link href="/my-codes" onClick={closeMenu} data-testid="link-my-codes">My codes</Link>
            <a className="bch-nav-cta" href="#packages" onClick={closeMenu} data-testid="link-browse-packages">
              Browse packages <ArrowRight size={14} />
            </a>
          </nav>
        </header>

        <section className="bch-hero" id="top">
          <div>
            <div className="bch-kicker"><span className="bch-kicker-line" /> Football insights · Premium picks</div>
            <h1>Make your next<br /><em>pick count.</em></h1>
            <p className="bch-hero-copy">
              Browse football prediction packages, check the match count and total odds, then pay securely with
              mobile money or card. Your betting code is released on the My codes page as soon as your payment clears.
            </p>
            <div className="bch-actions">
              <a className="bch-button" href="#packages" data-testid="link-explore-packages">Explore packages <ArrowDown size={15} /></a>
              <a className="bch-text-link" href="#how-it-works" data-testid="link-how-it-works">How it works <ArrowRight size={14} /></a>
            </div>
            <div className="bch-hero-note"><LockKeyhole size={13} /> Checkout runs on Paystack · codes unlock after payment.</div>
          </div>
          <div className="bch-feature-visual" aria-label="Football pitch graphic">
            <div className="bch-visual-head">
              <span className="bch-visual-label">The matchday notebook</span>
              <span className="bch-demo-tag">LIVE OFFERS</span>
            </div>
            <div className="bch-pitch" aria-hidden="true">
              <span className="bch-pitch-box left" />
              <span className="bch-pitch-box right" />
            </div>
            <div className="bch-visual-foot">
              <span className="bch-visual-caption">Read the game.<br />Choose with care.</span>
              <span className="bch-visual-index">01 — 03</span>
            </div>
          </div>
        </section>

        <div className="bch-stat-strip" aria-label="Storefront details">
          <div className="bch-stat">
            <span className="bch-stat-label">A considered selection</span>
            <span className="bch-stat-value">Details before decisions</span>
          </div>
          <div className="bch-stat">
            <span className="bch-stat-label">Pricing</span>
            <span className="bch-stat-value">One-time · GH₵</span>
          </div>
          <div className="bch-stat">
            <span className="bch-stat-label">Code access</span>
            <span className="bch-stat-value">Unlocked after payment</span>
          </div>
        </div>

        <section className="bch-section" id="packages">
          <div className="bch-section-head">
            <div>
              <div className="bch-section-overline">Live packages</div>
              <h2>Find your matchday read.</h2>
            </div>
            <p className="bch-section-description">
              Every package lists its fixture count, total odds and one-time price. Pay with mobile money or card and
              the betting code appears on the My codes page.
            </p>
          </div>

          {packagesQuery.isPending && (
            <div className="bch-example-banner" role="status" data-testid="notice-packages-loading">
              <CircleHelp size={15} />
              Loading available packages…
            </div>
          )}

          {packagesQuery.isError && (
            <div className="bch-example-banner" role="alert" data-testid="notice-packages-error">
              <CircleHelp size={15} />
              We could not load the packages right now. {errorMessage(packagesQuery.error)}{' '}
              <button className="bch-card-button" type="button" onClick={() => void packagesQuery.refetch()}>
                Try again
              </button>
            </div>
          )}

          {!packagesQuery.isPending && !packagesQuery.isError && packages.length === 0 && (
            <div className="bch-example-banner" role="status" data-testid="notice-packages-empty">
              <CircleHelp size={15} />
              No packages are on sale at the moment. Please check back before the next matchday.
            </div>
          )}

          <div className="bch-packages">
            {packages.map((item, index) => (
              <article className={`bch-card${index === 0 ? ' featured' : ''}`} key={item.id} data-testid={`card-package-${item.id}`}>
                <div className="bch-card-top">
                  <span className="bch-package-type"><i /> Available now</span>
                  <span className="bch-index">0{index + 1}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="bch-card-copy">{item.description ?? 'Full match analysis with a ready-to-use booking code.'}</p>
                <span className="bch-package-note">{describeMatches(item.match_count)}</span>
                <div className="bch-card-stats">
                  <div className="bch-card-stat">
                    <span className="bch-card-stat-label">Matches</span>
                    <strong>{item.match_count ?? '—'}</strong>
                  </div>
                  <div className="bch-card-stat">
                    <span className="bch-card-stat-label">Total odds</span>
                    <strong>{item.total_odds ?? '—'}</strong>
                  </div>
                </div>
                <div className="bch-card-bottom">
                  <div className="bch-price">GH₵ {formatGhs(item.price_kobo)}<small>One-time price</small></div>
                  <button className="bch-card-button" type="button" onClick={() => openPackage(item)} data-testid={`button-review-${item.id}`}>
                    Buy this package <ArrowRight size={12} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bch-how" id="how-it-works">
          <div className="bch-how-lead">
            <div className="bch-section-overline">A clear process</div>
            <h2>Know what comes next.</h2>
            <p>Pay for the slip you want, then use your email and payment reference to unlock the code.</p>
          </div>
          <div className="bch-steps">
            <div className="bch-step">
              <span className="bch-step-num">01</span>
              <h3>Review the package</h3>
              <p>Check the match count, total odds, description and one-time price before you pay.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">02</span>
              <h3>Pay with Paystack</h3>
              <p>Mobile money and card are accepted. We keep a reference for every order.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">03</span>
              <h3>Unlock your code</h3>
              <p>Open My codes, enter the same email and reference, and the booking code is revealed.</p>
            </div>
          </div>
        </section>

        <aside className="bch-responsible" data-testid="notice-responsible-participation">
          <ShieldCheck className="bch-responsible-icon" size={19} />
          <div>
            <h3>Take part responsibly.</h3>
            <p>
              Betting involves risk and predictions are not guaranteed. Only users of legal age in
              their location should participate. Never stake money you cannot afford to lose.
            </p>
          </div>
          <span className="bch-responsible-mark">PLEASE PLAY RESPONSIBLY</span>
        </aside>
      </div>

      <footer className="bch-footer">
        <div className="bch-shell bch-footer-row">
          <span className="bch-footer-brand">BET <span>CODE</span> HUB</span>
          <span className="bch-footer-copy">© {new Date().getFullYear()} Bet Code Hub · Secure checkout by Paystack.</span>
          <Link className="bch-footer-link" href="/my-codes" data-testid="link-footer-my-codes">My codes <ArrowRight size={12} /></Link>
        </div>
      </footer>

      {selectedPackage && (
        <div className="bch-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePackage();
        }}>
          <section className="bch-modal" role="dialog" aria-modal="true" aria-labelledby="bch-modal-title">
            <button className="bch-modal-close" type="button" aria-label="Close package review" onClick={closePackage} data-testid="button-close-review">
              <X size={16} />
            </button>
            <div className="bch-modal-label">Package checkout</div>
            <h2 id="bch-modal-title">{selectedPackage.title}</h2>
            <p className="bch-modal-copy">{selectedPackage.description ?? 'Full match analysis with a ready-to-use booking code.'}</p>
            <div className="bch-order-row"><span>Match count</span><strong>{selectedPackage.match_count ?? '—'}</strong></div>
            <div className="bch-order-row"><span>Total odds</span><strong>{selectedPackage.total_odds ?? '—'}</strong></div>
            <div className="bch-order-row"><span>One-time price</span><strong>GH₵ {formatGhs(selectedPackage.price_kobo)}</strong></div>

            <div className="bch-customer-form">
              <div className="bch-form-field">
                <label htmlFor="bch-checkout-email">Email for your code</label>
                <input
                  id="bch-checkout-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  data-testid="input-checkout-email"
                />
              </div>
              <div className="bch-form-field">
                <label htmlFor="bch-checkout-channel">Payment method</label>
                <select
                  id="bch-checkout-channel"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as PaymentInitializeInputChannel)}
                  data-testid="select-checkout-channel"
                >
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </div>
              {formError && (
                <p className="bch-preview-alert" role="alert" data-testid="notice-checkout-error">{formError}</p>
              )}
              <button
                className="bch-button"
                type="button"
                onClick={startCheckout}
                disabled={initializePayment.isPending}
                data-testid="button-start-checkout"
              >
                {initializePayment.isPending ? 'Starting checkout…' : 'Continue to payment'} <ArrowRight size={14} />
              </button>
            </div>

            <p className="bch-modal-copy">
              You will be redirected to Paystack to complete payment. After paying, return to My codes with your
              reference to reveal the betting code. Predictions are not guaranteed.
            </p>
            <div className="bch-modal-actions">
              <button className="bch-button" type="button" onClick={closePackage} data-testid="button-close-review-understood">
                Understood <Check size={14} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
