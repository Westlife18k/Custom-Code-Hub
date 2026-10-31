import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
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
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

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

type ModalKind = 'package' | 'codes' | null;
const formatGhs = (priceKobo: number) => (priceKobo / 100).toFixed(2);

function Storefront() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modal) {
      lastFocusedRef.current?.focus();
      return;
    }
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => {
      (modal === 'codes' ? referenceInputRef.current : closeButtonRef.current)?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
      if (event.key === 'Tab') {
        const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [modal]);

  const openPackage = (item: Package) => {
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedPackage(item);
    setModal('package');
  };

  const openCodes = () => {
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLookupMessage('');
    setMobileMenuOpen(false);
    setModal('codes');
  };

  const submitLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setLookupMessage(
      'Lookup is unavailable until the order data service is connected. No order or code has been retrieved.',
    );
  };

  return (
    <main className="bch" data-testid="page-storefront">
      <div className="bch-topline" data-testid="text-storefront-notice">
        <span className="bch-topline-dot" aria-hidden="true" />
        A Ghana-focused home for football insights
      </div>
      <div className="bch-shell">
        <header className="bch-header">
          <a className="bch-brand" href="#top" aria-label="Bet Code Hub home" data-testid="link-home">
            <span className="bch-mark"><ShieldCheck size={18} strokeWidth={1.8} /></span>
            <span className="bch-brand-name">BET <span>CODE</span> HUB</span>
          </a>
          <button
            className="bch-menu-button"
            type="button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
            aria-controls="bch-main-nav"
            data-testid="button-mobile-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <nav id="bch-main-nav" className={`bch-nav${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
            <a href="#packages" onClick={() => setMobileMenuOpen(false)} data-testid="link-packages-nav">Packages</a>
            <button type="button" onClick={openCodes} data-testid="button-my-codes-nav">My codes</button>
            <a className="bch-nav-cta" href="#packages" onClick={() => setMobileMenuOpen(false)} data-testid="link-browse-nav">
              Browse packages <ArrowRight size={14} />
            </a>
          </nav>
        </header>

        <section className="bch-hero" id="top">
          <div>
            <div className="bch-kicker"><span className="bch-kicker-line" /> Football insights · Premium picks</div>
            <h1>Make your next<br /><em>pick count.</em></h1>
            <p className="bch-hero-copy">
              Browse football prediction packages, review the details and one-time price.
              In a live storefront, a code is revealed only after payment has been verified.
            </p>
            <div className="bch-actions">
              <a className="bch-button" href="#packages" data-testid="link-explore-packages">Explore packages <ArrowDown size={15} /></a>
              <a className="bch-text-link" href="#how-it-works" data-testid="link-how-it-works">How it works <ArrowRight size={14} /></a>
            </div>
            <div className="bch-hero-note"><LockKeyhole size={13} /> Payment and code access are not connected in this prototype.</div>
          </div>
          <div className="bch-feature-visual" aria-label="Illustrative football pitch graphic" role="img" data-testid="visual-matchday-notebook">
            <div className="bch-visual-head">
              <span className="bch-visual-label">The matchday notebook</span>
              <span className="bch-demo-tag">DEMO VIEW</span>
            </div>
            <div className="bch-pitch" aria-hidden="true"><span className="bch-pitch-box left" /><span className="bch-pitch-box right" /></div>
            <div className="bch-visual-foot">
              <span className="bch-visual-caption">Read the game.<br />Choose with care.</span>
              <span className="bch-visual-index">01 — 03</span>
            </div>
          </div>
        </section>

        <div className="bch-stat-strip" aria-label="Storefront details">
          <div className="bch-stat"><span className="bch-stat-label">A considered selection</span><span className="bch-stat-value">Details before decisions</span></div>
          <div className="bch-stat"><span className="bch-stat-label">Pricing</span><span className="bch-stat-value">One-time · GH₵</span></div>
          <div className="bch-stat"><span className="bch-stat-label">Code access</span><span className="bch-stat-value">After verified payment</span></div>
        </div>

        <section className="bch-section" id="packages">
          <div className="bch-section-head">
            <div><div className="bch-section-overline">Package examples</div><h2>Find your matchday read.</h2></div>
            <p className="bch-section-description">Review the fixture count, total odds and one-time price. These examples are illustrative only; no package shown here is live.</p>
          </div>
          <div className="bch-example-banner" data-testid="status-demo-disclaimer">
            <CircleHelp size={15} />
            Demo content for this visual prototype. Prices and package details are examples, not active offers.
          </div>
          <div className="bch-packages">
            {packages.map((item, index) => (
              <article className={`bch-card${item.featured ? ' featured' : ''}`} key={item.id} data-testid={`card-package-${item.id}`}>
                <div className="bch-card-top"><span className="bch-package-type"><i /> Illustrative demo</span><span className="bch-index">0{index + 1}</span></div>
                <h3>{item.title}</h3>
                <p className="bch-card-copy">{item.description}</p>
                <span className="bch-package-note">{item.note}</span>
                <div className="bch-card-stats">
                  <div className="bch-card-stat"><span className="bch-card-stat-label">Matches</span><strong>{item.match_count}</strong></div>
                  <div className="bch-card-stat"><span className="bch-card-stat-label">Total odds</span><strong>{item.total_odds}</strong></div>
                </div>
                <div className="bch-card-bottom">
                  <div className="bch-price" data-testid={`text-price-${item.id}`}>GH₵ {formatGhs(item.price_kobo)}<small>One-time price</small></div>
                  <button className="bch-card-button" type="button" onClick={() => openPackage(item)} data-testid={`button-review-${item.id}`}>
                    Review details <ArrowRight size={12} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bch-how" id="how-it-works">
          <div className="bch-how-lead">
            <div className="bch-section-overline">A clear process</div><h2>Know what comes next.</h2>
            <p>Package information first. Code access only after a payment is verified in a connected storefront.</p>
          </div>
          <div className="bch-steps">
            <div className="bch-step"><span className="bch-step-num">01</span><h3>Review the package</h3><p>Check the match count, total odds, description and listed one-time price.</p></div>
            <div className="bch-step"><span className="bch-step-num">02</span><h3>Payment is verified</h3><p>A production checkout confirms payment before access is made available.</p></div>
            <div className="bch-step"><span className="bch-step-num">03</span><h3>Access your code</h3><p>In a live service, verified package codes can be found through My codes.</p></div>
          </div>
        </section>

        <aside className="bch-responsible" data-testid="notice-responsible-gambling">
          <ShieldCheck className="bch-responsible-icon" size={19} />
          <div><h3>Take part responsibly.</h3><p>Betting involves risk and predictions are not guaranteed. Only users of legal age in their location should participate. Never stake money you cannot afford to lose.</p></div>
          <span className="bch-responsible-mark">PLEASE PLAY RESPONSIBLY</span>
        </aside>
      </div>

      <footer className="bch-footer">
        <div className="bch-shell bch-footer-row">
          <span className="bch-footer-brand">BET <span>CODE</span> HUB</span>
          <span className="bch-footer-copy">© {new Date().getFullYear()} Bet Code Hub · Demo storefront, not connected to checkout.</span>
          <button className="bch-footer-link" type="button" onClick={openCodes} data-testid="button-my-codes-footer">My codes <ArrowRight size={12} /></button>
        </div>
      </footer>

      {modal && (
        <div className="bch-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }} data-testid="dialog-backdrop">
          <section className="bch-modal" role="dialog" aria-modal="true" aria-labelledby="bch-modal-title" aria-describedby="bch-modal-description" data-testid={`dialog-${modal}`}>
            <button ref={closeButtonRef} className="bch-modal-close" type="button" aria-label="Close dialog" onClick={() => setModal(null)} data-testid="button-close-dialog"><X size={16} /></button>
            {modal === 'package' && selectedPackage ? (
              <>
                <div className="bch-modal-label">Package review · demo</div>
                <h2 id="bch-modal-title">{selectedPackage.title}</h2>
                <p className="bch-modal-copy" id="bch-modal-description">{selectedPackage.description}</p>
                <div className="bch-order-row"><span>Match count</span><strong>{selectedPackage.match_count}</strong></div>
                <div className="bch-order-row"><span>Total odds</span><strong>{selectedPackage.total_odds}</strong></div>
                <div className="bch-order-row"><span>One-time price</span><strong>GH₵ {formatGhs(selectedPackage.price_kobo)}</strong></div>
                <div className="bch-preview-alert"><CircleHelp size={15} />Checkout preview only — not connected. No payment is being taken and this package is not live.</div>
                <p className="bch-modal-copy">In a live storefront, access to a code would follow verified payment. Your code is never shown before server-side payment verification.</p>
                <div className="bch-modal-actions">
                  <button className="bch-unavailable-button" type="button" disabled data-testid="button-payment-unavailable">Payment not connected</button>
                  <button className="bch-button" type="button" onClick={() => setModal(null)} data-testid="button-dismiss-review">Understood <Check size={14} /></button>
                </div>
              </>
            ) : (
              <>
                <div className="bch-modal-label">My codes · preview</div>
                <h2 id="bch-modal-title">Look up your code.</h2>
                <p className="bch-modal-copy" id="bch-modal-description">Enter the email used at checkout and your payment reference to retrieve a verified purchase.</p>
                <div className="bch-preview-alert"><LockKeyhole size={15} />Lookup is unavailable until the order data service is connected. No order or code will be retrieved.</div>
                <form className="bch-code-form" onSubmit={submitLookup}>
                  <label className="bch-code-label" htmlFor="bch-email">Email address</label>
                  <input className="bch-code-input" id="bch-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" data-testid="input-lookup-email" />
                  <label className="bch-code-label" htmlFor="bch-reference">Payment reference</label>
                  <input ref={referenceInputRef} className="bch-code-input" id="bch-reference" autoComplete="off" required minLength={4} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="BCH_…" data-testid="input-order-reference" />
                  <button className="bch-button" type="submit" data-testid="button-submit-lookup">Check lookup availability <ArrowRight size={14} /></button>
                  {lookupMessage && <p className="bch-lookup-message" role="status" data-testid="status-lookup">{lookupMessage}</p>}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Storefront} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
