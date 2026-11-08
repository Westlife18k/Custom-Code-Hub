import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearch } from 'wouter';
import { z } from 'zod';
import { ArrowRight, CircleHelp, Copy, Loader2, LockKeyhole, ShieldCheck, Ticket } from 'lucide-react';
import { useLookupOrder, type OrderCode } from '@workspace/api-client-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { readLastOrder, readLookupQuery } from '@/lib/last-order';

const lookupSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  reference: z.string().min(1, 'Enter your payment reference.'),
});

type LookupFormValues = z.infer<typeof lookupSchema>;

function describeLookupError(error: unknown): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { error?: unknown } | null }).data;
    if (data && typeof data.error === 'string' && data.error.length > 0) {
      return data.error;
    }
  }
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: number }).status;
    if (status === 404) return 'We could not find an order with that reference and email address.';
    if (status === 409) return 'That order has not been paid yet. Finish the payment, then try again.';
    if (status === 503) return 'Order lookup is temporarily unavailable. Please try again shortly.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'We could not look up that order. Please try again.';
}

export default function MyCodes() {
  const search = useSearch();
  const [order, setOrder] = useState<OrderCode | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoLookupRef = useRef<string | null>(null);

  const form = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { email: '', reference: '' },
  });

  const lookupOrder = useLookupOrder();

  const runLookup = (values: LookupFormValues) => {
    setLookupError(null);
    setOrder(null);
    setCopied(false);
    lookupOrder.mutate(
      { data: { email: values.email.trim(), reference: values.reference.trim() } },
      {
        onSuccess: (result) => setOrder(result),
        onError: (error) => setLookupError(describeLookupError(error)),
      },
    );
  };

  // Paystack returns buyers to /my-codes?reference=…&email=…, so prefill and
  // look the order up immediately when those parameters are present.
  useEffect(() => {
    const remembered = readLookupQuery(search) ?? readLastOrder();
    if (!remembered) return;
    const key = `${remembered.reference}|${remembered.email}`;
    if (autoLookupRef.current === key) return;
    autoLookupRef.current = key;

    form.setValue('email', remembered.email);
    form.setValue('reference', remembered.reference);
    if (remembered.email) {
      runLookup({ email: remembered.email, reference: remembered.reference });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const submitLookup = form.handleSubmit((values) => runLookup(values));

  const copyCode = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setLookupError('Copying failed — select the code and copy it manually.');
    }
  };

  return (
    <main className="bch">
      <div className="bch-topline">
        <span className="bch-topline-dot" />
        A Ghana-focused home for football insights
      </div>
      <div className="bch-shell">
        <header className="bch-header">
          <Link className="bch-brand" href="/" aria-label="Bet Code Hub home" data-testid="link-home-brand">
            <span className="bch-mark"><ShieldCheck size={18} strokeWidth={1.8} /></span>
            <span className="bch-brand-name">BET <span>CODE</span> HUB</span>
          </Link>
          <nav className="bch-nav bch-nav-static" aria-label="Main navigation">
            <Link href="/" data-testid="link-home">Home</Link>
            <Link href="/wallet" data-testid="link-wallet">Wallet</Link>
            <Link className="bch-nav-cta" href="/#packages" data-testid="link-browse-packages">
              Browse packages <ArrowRight size={14} />
            </Link>
          </nav>
        </header>

        <section className="bch-customer-page">
          <div className="bch-customer-head">
            <div className="bch-kicker"><span className="bch-kicker-line" /> Your purchases</div>
            <h1>My betting codes</h1>
            <p>
              Enter the email you paid with and the payment reference from your receipt. Paid orders unlock their
              betting code here — unpaid references stay locked.
            </p>
          </div>

          <section className="bch-customer-card" aria-labelledby="lookup-title">
            <div className="bch-section-overline">Customer lookup</div>
            <h2 id="lookup-title">Reveal your code</h2>
            <p>
              Codes are released only after Paystack confirms your payment. We match the email and reference to
              the order we created at checkout.
            </p>
            <Form {...form}>
              <form className="bch-customer-form" onSubmit={submitLookup} noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="bch-form-field">
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          data-testid="input-customer-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reference"
                  render={({ field }) => (
                    <FormItem className="bch-form-field">
                      <FormLabel>Payment reference</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          type="text"
                          autoComplete="off"
                          placeholder="BCH-…"
                          data-testid="input-payment-reference"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  className="bch-button"
                  type="submit"
                  disabled={lookupOrder.isPending}
                  data-testid="button-check-lookup"
                >
                  {lookupOrder.isPending ? (
                    <>
                      Checking payment… <Loader2 className="bch-spin" size={14} />
                    </>
                  ) : (
                    <>
                      Reveal my code <ArrowRight size={14} />
                    </>
                  )}
                </button>

                {lookupError && (
                  <div className="bch-preview-alert" role="alert" data-testid="notice-lookup-error">
                    <CircleHelp size={15} /> {lookupError}
                  </div>
                )}

                {order && (
                  <div className="bch-code-reveal" role="status" data-testid="notice-lookup-success">
                    <span className="bch-code-reveal-label"><Ticket size={14} /> {order.title}</span>
                    <code data-testid="text-betting-code">{order.code}</code>
                    <button className="bch-card-button" type="button" onClick={() => void copyCode()} data-testid="button-copy-code">
                      <Copy size={12} /> {copied ? 'Copied' : 'Copy code'}
                    </button>
                    <p>Use this code on your betting slip before kick-off. Predictions are not guaranteed.</p>
                  </div>
                )}
              </form>
            </Form>
            <div className="bch-customer-footnote">
              <ShieldCheck size={14} />
              We only use your email and reference to find your paid order.
            </div>
          </section>

          <section className="bch-customer-card" aria-labelledby="help-title">
            <div className="bch-section-overline">Before you ask</div>
            <h2 id="help-title">Where is my reference?</h2>
            <p>
              Every order gets a reference that starts with <strong>BCH-</strong>. It is on the Paystack receipt
              emailed to you and on the confirmation screen after payment.
            </p>
            <div className="bch-preview-alert" role="note" data-testid="notice-lookup-help">
              <LockKeyhole size={15} />
              Unpaid, failed or unknown references cannot release a code. If payment completed but the lookup still
              fails, wait a moment and try again — the confirmation can take a few seconds to reach us.
            </div>
            <Link className="bch-text-link" href="/#packages" data-testid="link-back-to-packages">
              Browse packages <ArrowRight size={14} />
            </Link>
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
        </section>
      </div>

      <footer className="bch-footer">
        <div className="bch-shell bch-footer-row">
          <span className="bch-footer-brand">BET <span>CODE</span> HUB</span>
          <span className="bch-footer-copy">© {new Date().getFullYear()} Bet Code Hub · Secure checkout by Paystack.</span>
          <Link className="bch-footer-link" href="/" data-testid="link-footer-home">Return home <ArrowRight size={12} /></Link>
        </div>
      </footer>
    </main>
  );
}
