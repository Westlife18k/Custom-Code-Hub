import { useEffect, useState } from 'react';
import { Link } from 'wouter';
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

type Package = {
  id: string;
  title: string;
  description: string;
  price_kobo: number;
  total_odds: string;
  match_count: number;
  note: string;
  featured?: boolean;
};

const packages: Package[] = [
  {
    id: 'weekend-watchlist',
    title: 'Weekend watchlist',
    description: 'A considered selection across a busy weekend of European fixtures.',
    price_kobo: 4200,
    total_odds: '8.64',
    match_count: 5,
    note: 'A measured five-match format',
    featured: true,
  },
  {
    id: 'midweek-edition',
    title: 'Midweek edition',
    description: 'A compact collection built around midweek league matchups.',
    price_kobo: 2800,
    total_odds: '5.18',
    match_count: 3,
    note: 'Three match selections',
  },
  {
    id: 'continental-notes',
    title: 'Continental notes',
    description: 'A longer-form example spanning selected continental fixtures.',
    price_kobo: 6700,
    total_odds: '12.42',
    match_count: 7,
    note: 'Seven match selections',
  },
];

function formatGhs(priceKobo: number) {
  return (priceKobo / 100).toFixed(2);
}

export default function Storefront() {
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedPackage) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPackage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPackage]);

  const closeMenu = () => setMobileMenuOpen(false);

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
              Browse football prediction packages and review their details. The examples here are illustrative;
              this storefront has no live offers, checkout or payment service.
            </p>
            <div className="bch-actions">
              <a className="bch-button" href="#packages" data-testid="link-explore-packages">Explore packages <ArrowDown size={15} /></a>
              <a className="bch-text-link" href="#how-it-works" data-testid="link-how-it-works">How it works <ArrowRight size={14} /></a>
            </div>
            <div className="bch-hero-note"><LockKeyhole size={13} /> Payment and code access are unavailable in this demo.</div>
          </div>
          <div className="bch-feature-visual" aria-label="Illustrative football pitch graphic">
            <div className="bch-visual-head">
              <span className="bch-visual-label">The matchday notebook</span>
              <span className="bch-demo-tag">DEMO VIEW</span>
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
            <span className="bch-stat-label">Example pricing</span>
            <span className="bch-stat-value">One-time · GH₵</span>
          </div>
          <div className="bch-stat">
            <span className="bch-stat-label">Code access</span>
            <span className="bch-stat-value">Not available in this demo</span>
          </div>
        </div>

        <section className="bch-section" id="packages">
          <div className="bch-section-head">
            <div>
              <div className="bch-section-overline">Package examples</div>
              <h2>Find your matchday read.</h2>
            </div>
            <p className="bch-section-description">
              Review the fixture count, total odds and example one-time price. These examples are
              illustrative only; no package shown here is live.
            </p>
          </div>
          <div className="bch-example-banner" role="note" data-testid="notice-demo-packages">
            <CircleHelp size={15} />
            Demo content for this presentation storefront. Prices and package details are examples, not active offers.
          </div>
          <div className="bch-packages">
            {packages.map((item, index) => (
              <article className={`bch-card${item.featured ? ' featured' : ''}`} key={item.id} data-testid={`card-package-${item.id}`}>
                <div className="bch-card-top">
                  <span className="bch-package-type"><i /> Illustrative demo</span>
                  <span className="bch-index">0{index + 1}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="bch-card-copy">{item.description}</p>
                <span className="bch-package-note">{item.note}</span>
                <div className="bch-card-stats">
                  <div className="bch-card-stat">
                    <span className="bch-card-stat-label">Matches</span>
                    <strong>{item.match_count}</strong>
                  </div>
                  <div className="bch-card-stat">
                    <span className="bch-card-stat-label">Total odds</span>
                    <strong>{item.total_odds}</strong>
                  </div>
                </div>
                <div className="bch-card-bottom">
                  <div className="bch-price">GH₵ {formatGhs(item.price_kobo)}<small>Example one-time price</small></div>
                  <button className="bch-card-button" type="button" onClick={() => setSelectedPackage(item)} data-testid={`button-review-${item.id}`}>
                    Review details <ArrowRight size={12} />
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
            <p>This demo lets you review illustrative package details only. No purchase or code access is available here.</p>
          </div>
          <div className="bch-steps">
            <div className="bch-step">
              <span className="bch-step-num">01</span>
              <h3>Review the package</h3>
              <p>Check an example match count, total odds, description and one-time price.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">02</span>
              <h3>Checkout is not connected</h3>
              <p>These examples are not live offers. No payment can be started or taken.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">03</span>
              <h3>Codes are unavailable</h3>
              <p>The My codes page explains that purchase lookup is not available in this build.</p>
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
          <span className="bch-footer-copy">© {new Date().getFullYear()} Bet Code Hub · Illustrative demo, not connected to checkout.</span>
          <Link className="bch-footer-link" href="/my-codes" data-testid="link-footer-my-codes">My codes <ArrowRight size={12} /></Link>
        </div>
      </footer>

      {selectedPackage && (
        <div className="bch-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedPackage(null);
        }}>
          <section className="bch-modal" role="dialog" aria-modal="true" aria-labelledby="bch-modal-title">
            <button className="bch-modal-close" type="button" aria-label="Close package review" onClick={() => setSelectedPackage(null)} data-testid="button-close-review">
              <X size={16} />
            </button>
            <div className="bch-modal-label">Package review · illustrative demo</div>
            <h2 id="bch-modal-title">{selectedPackage.title}</h2>
            <p className="bch-modal-copy">{selectedPackage.description}</p>
            <div className="bch-order-row"><span>Match count</span><strong>{selectedPackage.match_count}</strong></div>
            <div className="bch-order-row"><span>Total odds</span><strong>{selectedPackage.total_odds}</strong></div>
            <div className="bch-order-row"><span>Example one-time price</span><strong>GH₵ {formatGhs(selectedPackage.price_kobo)}</strong></div>
            <div className="bch-preview-alert" role="note">
              <CircleHelp size={15} />
              Checkout is not connected. This is not a live offer, no payment is taken, and this package cannot be purchased here.
            </div>
            <p className="bch-modal-copy">
              This review does not create an order or provide a betting code. Predictions are not guaranteed.
            </p>
            <div className="bch-modal-actions">
              <button className="bch-button" type="button" onClick={() => setSelectedPackage(null)} data-testid="button-close-review-understood">
                Understood <Check size={14} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
