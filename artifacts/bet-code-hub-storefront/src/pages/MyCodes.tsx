import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { z } from 'zod';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const lookupSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  reference: z.string().min(1, 'Enter your payment reference.'),
});

type LookupFormValues = z.infer<typeof lookupSchema>;

export default function MyCodes() {
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<LookupFormValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      email: '',
      reference: '',
    },
  });

  const submitLookup = form.handleSubmit(() => setSubmitted(true));

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
              Enter the email and payment reference associated with a purchase to preview this lookup form.
              Code lookup is unavailable in this demo.
            </p>
          </div>

          <section className="bch-customer-card" aria-labelledby="lookup-title">
            <div className="bch-section-overline">Customer lookup</div>
            <h2 id="lookup-title">Check lookup availability</h2>
            <p>
              This page does not connect to orders or customer accounts. Submitting these fields will not
              verify a payment, find an order, or reveal a code.
            </p>
            <div className="bch-preview-alert" role="note" data-testid="notice-lookup-unavailable">
              <LockKeyhole size={15} />
              Order lookup is unavailable in this frontend demo. No order or betting code can be retrieved.
            </div>
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
                          placeholder="Enter your payment reference"
                          data-testid="input-payment-reference"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button className="bch-button" type="submit" data-testid="button-check-lookup">
                  Check lookup availability <ArrowRight size={14} />
                </button>
                {submitted && (
                  <p className="bch-availability-message" role="status" data-testid="status-lookup-unavailable">
                    Order lookup is unavailable. No payment has been verified, and no order or code was retrieved.
                  </p>
                )}
              </form>
            </Form>
            <div className="bch-customer-footnote">
              <ShieldCheck size={14} />
              Your details are only used to demonstrate the form; they are not sent or stored.
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
        </section>
      </div>

      <footer className="bch-footer">
        <div className="bch-shell bch-footer-row">
          <span className="bch-footer-brand">BET <span>CODE</span> HUB</span>
          <span className="bch-footer-copy">Illustrative demo · Order lookup is unavailable.</span>
          <Link className="bch-footer-link" href="/" data-testid="link-footer-home">Return home <ArrowRight size={12} /></Link>
        </div>
      </footer>
    </main>
  );
}
