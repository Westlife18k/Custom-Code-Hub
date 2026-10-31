import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  LockKeyhole,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";

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
    id: "weekend-watchlist",
    title: "Weekend watchlist",
    description:
      "A considered selection across a busy weekend of European fixtures.",
    price_kobo: 4200,
    total_odds: "8.64",
    match_count: 5,
    note: "A measured five-match format",
    featured: true,
  },
  {
    id: "midweek-edition",
    title: "Midweek edition",
    description:
      "A compact collection built around midweek league matchups.",
    price_kobo: 2800,
    total_odds: "5.18",
    match_count: 3,
    note: "Three match selections",
  },
  {
    id: "continental-notes",
    title: "Continental notes",
    description:
      "A longer-form example spanning selected continental fixtures.",
    price_kobo: 6700,
    total_odds: "12.42",
    match_count: 7,
    note: "Seven match selections",
  },
];

type ModalKind = "package" | "codes" | null;

function formatGhs(priceKobo: number) {
  return (priceKobo / 100).toFixed(2);
}

export function Storefront() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [reference, setReference] = useState("");
  const [lookupMessage, setLookupMessage] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal]);

  const openPackage = (item: Package) => {
    setSelectedPackage(item);
    setModal("package");
  };

  const openCodes = () => {
    setLookupMessage("");
    setModal("codes");
    setMobileMenuOpen(false);
  };

  const submitLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupMessage(
      reference.trim()
        ? "Code lookup is not connected in this visual prototype."
        : "Enter a reference to preview this lookup form.",
    );
  };

  return (
    <main className="bch">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .bch {
          --bch-bg: #0d100e;
          --bch-panel: #151a16;
          --bch-panel-soft: #1b211c;
          --bch-ink: #f2f0e8;
          --bch-muted: #a1aaa1;
          --bch-line: #2a332c;
          --bch-gold: #dfb95e;
          --bch-green: #89b98a;
          min-height: 100dvh;
          overflow: hidden;
          color: var(--bch-ink);
          background:
            radial-gradient(ellipse at 84% 1%, rgba(111, 82, 25, .17), transparent 30rem),
            radial-gradient(ellipse at 12% 48%, rgba(49, 84, 56, .10), transparent 34rem),
            var(--bch-bg);
          font-family: 'DM Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .bch * { box-sizing: border-box; }
        .bch button, .bch input { font: inherit; }
        .bch button { color: inherit; }
        .bch a { color: inherit; text-decoration: none; }
        .bch-shell { width: min(1160px, calc(100% - 48px)); margin-inline: auto; }
        .bch-topline {
          display: flex; align-items: center; justify-content: center; gap: 9px;
          min-height: 34px; padding: 7px 18px; border-bottom: 1px solid rgba(223,185,94,.15);
          background: rgba(223,185,94,.045); color: #cbbb8d; text-align: center;
          font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
        }
        .bch-topline-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--bch-green); }
        .bch-header {
          min-height: 76px; border-bottom: 1px solid var(--bch-line);
          display: flex; align-items: center; justify-content: space-between;
        }
        .bch-brand { display: inline-flex; gap: 10px; align-items: center; }
        .bch-mark {
          display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid #68572f;
          border-radius: 10px; color: var(--bch-gold); background: linear-gradient(145deg,#282317,#171913);
        }
        .bch-brand-name { font: 700 16px/1 'Space Grotesk', sans-serif; letter-spacing: .04em; }
        .bch-brand-name span { color: var(--bch-gold); }
        .bch-nav { display: flex; align-items: center; gap: 31px; color: #b1b9b1; font-size: 13px; }
        .bch-nav a, .bch-nav button { transition: color .18s ease; }
        .bch-nav a:hover, .bch-nav button:hover { color: var(--bch-gold); }
        .bch-nav button {
          padding: 0; border: 0; background: transparent; cursor: pointer;
        }
        .bch-nav-cta {
          display: inline-flex; align-items: center; gap: 9px; border: 1px solid #4d452d !important;
          padding: 10px 14px !important; border-radius: 8px; color: var(--bch-ink) !important;
        }
        .bch-nav-cta:hover { border-color: var(--bch-gold) !important; }
        .bch-menu-button { display: none; border: 1px solid var(--bch-line); background: var(--bch-panel); border-radius: 9px; padding: 9px; }
        .bch-hero {
          display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(310px, .88fr);
          align-items: center; gap: clamp(28px, 6vw, 85px); padding: 86px 0 58px;
        }
        .bch-kicker {
          display: flex; align-items: center; gap: 10px; color: var(--bch-gold);
          font-size: 10px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
        }
        .bch-kicker-line { width: 25px; height: 1px; background: var(--bch-gold); }
        .bch h1, .bch h2, .bch h3, .bch p { margin-top: 0; }
        .bch h1 {
          margin: 22px 0 18px; max-width: 720px; font: 500 clamp(48px, 6.5vw, 82px)/.99 'Space Grotesk', sans-serif;
          letter-spacing: -.068em;
        }
        .bch h1 em { color: var(--bch-gold); font-style: normal; }
        .bch-hero-copy { max-width: 535px; color: var(--bch-muted); font-size: 15px; line-height: 1.8; }
        .bch-actions { display: flex; align-items: center; gap: 20px; margin-top: 29px; flex-wrap: wrap; }
        .bch-button {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          min-height: 47px; border: 1px solid transparent; border-radius: 8px;
          padding: 0 17px; background: var(--bch-gold); color: #19170f !important;
          font-size: 13px; font-weight: 700; cursor: pointer; transition: transform .18s ease, background .18s ease;
        }
        .bch-button:hover { background: #edcb78; transform: translateY(-2px); }
        .bch-text-link { display: inline-flex; align-items: center; gap: 8px; color: #d5d8d0; font-size: 12px; }
        .bch-text-link:hover { color: var(--bch-gold); }
        .bch-hero-note { margin-top: 24px; display: flex; gap: 9px; align-items: center; color: #778279; font-size: 11px; }
        .bch-hero-note svg { color: var(--bch-green); flex: none; }
        .bch-feature-visual {
          position: relative; min-height: 355px; overflow: hidden; display: flex; flex-direction: column;
          justify-content: space-between; padding: 23px; border: 1px solid #343a2e; border-radius: 16px;
          background:
            radial-gradient(ellipse at 53% 46%, rgba(115,142,93,.12), transparent 45%),
            linear-gradient(150deg, #1c211a, #111511 75%);
          box-shadow: 0 24px 70px rgba(0,0,0,.18);
        }
        .bch-feature-visual:after {
          content: ""; position: absolute; inset: 0; opacity: .13; pointer-events: none;
          background-image: radial-gradient(#d8d0b3 0.6px, transparent .6px); background-size: 8px 8px;
          mask-image: linear-gradient(130deg, black, transparent 72%);
        }
        .bch-visual-head, .bch-visual-foot { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; }
        .bch-visual-label { color: #b0b7a9; font-size: 9px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
        .bch-demo-tag { padding: 6px 8px; border: 1px solid #4a4936; border-radius: 5px; color: var(--bch-gold); font-size: 9px; letter-spacing: .13em; }
        .bch-pitch {
          position: absolute; inset: 68px 21px 78px; border: 1px solid rgba(147,172,135,.26); border-radius: 8px;
          background: linear-gradient(90deg, transparent 49.8%, rgba(147,172,135,.24) 50%, transparent 50.2%),
            linear-gradient(rgba(80,112,81,.04),rgba(80,112,81,.04));
        }
        .bch-pitch:before {
          content: ""; position: absolute; width: 96px; height: 96px; border: 1px solid rgba(147,172,135,.25);
          border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%,-50%);
        }
        .bch-pitch:after {
          content: ""; position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; background: var(--bch-gold);
          border-radius: 50%; box-shadow: 0 0 0 7px rgba(223,185,94,.1), 0 0 23px rgba(223,185,94,.48);
        }
        .bch-pitch-box { position: absolute; width: 20%; height: 36%; top: 32%; border: 1px solid rgba(147,172,135,.23); }
        .bch-pitch-box.left { left: 0; border-left: 0; }
        .bch-pitch-box.right { right: 0; border-right: 0; }
        .bch-visual-foot { align-items: end; }
        .bch-visual-caption { max-width: 175px; font: 500 21px/1.22 'Space Grotesk',sans-serif; letter-spacing: -.04em; }
        .bch-visual-index { color: #849083; font: 10px 'Space Grotesk',sans-serif; letter-spacing: .13em; }
        .bch-stat-strip {
          display: grid; grid-template-columns: 1.4fr 1fr 1fr; border-top: 1px solid var(--bch-line);
          border-bottom: 1px solid var(--bch-line); margin-bottom: 74px;
        }
        .bch-stat { padding: 19px 22px; border-right: 1px solid var(--bch-line); }
        .bch-stat:last-child { border: 0; }
        .bch-stat-label { display: block; margin-bottom: 7px; color: #818b81; font-size: 9px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
        .bch-stat-value { color: #e8e4d7; font-size: 13px; font-weight: 600; }
        .bch-section { padding-bottom: 82px; scroll-margin-top: 28px; }
        .bch-section-head { display: flex; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 24px; }
        .bch-section-overline { margin-bottom: 10px; color: var(--bch-gold); font-size: 10px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
        .bch h2 { margin-bottom: 0; font: 500 clamp(27px, 3.2vw, 38px)/1.08 'Space Grotesk',sans-serif; letter-spacing: -.045em; }
        .bch-section-description { max-width: 420px; margin: 0; color: var(--bch-muted); font-size: 12px; line-height: 1.65; }
        .bch-example-banner {
          display: flex; align-items: center; gap: 11px; padding: 12px 14px; margin-bottom: 16px;
          border: 1px solid rgba(137,185,138,.25); border-radius: 8px; color: #b9c6b6;
          background: rgba(66,104,67,.09); font-size: 11px; line-height: 1.5;
        }
        .bch-example-banner svg { flex: none; color: var(--bch-green); }
        .bch-packages { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        .bch-card {
          position: relative; display: flex; min-height: 319px; flex-direction: column; padding: 21px;
          border: 1px solid var(--bch-line); border-radius: 12px;
          background: linear-gradient(145deg, rgba(27,33,28,.95), rgba(18,22,19,.98));
          transition: border-color .2s ease, transform .2s ease, background .2s ease;
        }
        .bch-card:hover { transform: translateY(-3px); border-color: #6b5b35; background: linear-gradient(145deg,#22281f,#151915); }
        .bch-card.featured { border-color: #65562f; }
        .bch-card-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .bch-package-type { display: inline-flex; align-items: center; gap: 7px; color: #d5be7b; font-size: 9px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
        .bch-package-type i { width: 5px; height: 5px; border-radius: 50%; background: var(--bch-gold); }
        .bch-index { color: #778077; font: 10px 'Space Grotesk',sans-serif; }
        .bch-card h3 { margin: 23px 0 8px; font: 500 21px/1.2 'Space Grotesk',sans-serif; letter-spacing: -.035em; }
        .bch-card-copy { min-height: 41px; margin-bottom: 16px; color: var(--bch-muted); font-size: 11px; line-height: 1.6; }
        .bch-package-note { color: #869286; font-size: 10px; }
        .bch-card-stats { display: grid; grid-template-columns: 1fr 1fr; padding: 13px 0; margin-top: 13px; border-top: 1px solid #2a322a; border-bottom: 1px solid #2a322a; }
        .bch-card-stat + .bch-card-stat { padding-left: 18px; border-left: 1px solid #2a322a; }
        .bch-card-stat-label { display: block; color: #839082; font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
        .bch-card-stat strong { display: block; margin-top: 4px; color: #e9e7df; font: 600 17px 'Space Grotesk',sans-serif; }
        .bch-card-bottom { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 17px; }
        .bch-price { font: 600 22px/1 'Space Grotesk',sans-serif; color: var(--bch-gold); letter-spacing: -.04em; }
        .bch-price small { display: block; margin-top: 6px; color: #849084; font: 10px 'DM Sans',sans-serif; letter-spacing: 0; }
        .bch-card-button { border: 1px solid #4a4e3b; border-radius: 7px; background: transparent; padding: 9px 10px; color: #dedccd; font-size: 10px; font-weight: 600; cursor: pointer; }
        .bch-card-button:hover { border-color: var(--bch-gold); color: var(--bch-gold); }
        .bch-how {
          display: grid; grid-template-columns: .78fr 1.22fr; gap: clamp(30px, 7vw, 100px); padding: 33px;
          border: 1px solid var(--bch-line); border-radius: 13px; background: linear-gradient(125deg,#191e19,#121612);
          margin-bottom: 78px;
        }
        .bch-how-lead { max-width: 300px; }
        .bch-how-lead p { margin: 15px 0 0; color: var(--bch-muted); font-size: 12px; line-height: 1.7; }
        .bch-steps { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
        .bch-step-num { display: grid; place-items: center; width: 26px; height: 26px; margin-bottom: 13px; border: 1px solid #68582f; border-radius: 50%; color: var(--bch-gold); font: 11px 'Space Grotesk',sans-serif; }
        .bch-step h3 { margin: 0 0 7px; font: 600 13px 'Space Grotesk',sans-serif; }
        .bch-step p { margin: 0; color: var(--bch-muted); font-size: 10px; line-height: 1.65; }
        .bch-responsible {
          display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: start;
          padding: 20px 22px; margin-bottom: 62px; border: 1px solid #54462a; border-radius: 10px;
          background: rgba(112,84,28,.09);
        }
        .bch-responsible-icon { color: var(--bch-gold); }
        .bch-responsible h3 { margin: 0 0 6px; color: #e3d3a5; font: 600 13px 'Space Grotesk',sans-serif; }
        .bch-responsible p { max-width: 810px; margin: 0; color: #b5ad93; font-size: 11px; line-height: 1.7; }
        .bch-responsible-mark { color: #b49b5a; font: 10px 'Space Grotesk',sans-serif; white-space: nowrap; }
        .bch-footer { border-top: 1px solid var(--bch-line); padding: 21px 0 30px; }
        .bch-footer-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
        .bch-footer-brand { color: #929b91; font: 600 10px 'Space Grotesk',sans-serif; letter-spacing: .08em; }
        .bch-footer-brand span { color: var(--bch-gold); }
        .bch-footer-copy { color: #747e75; font-size: 10px; }
        .bch-footer-link { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: #b5bdb3; font-size: 10px; cursor: pointer; }
        .bch-footer-link:hover { color: var(--bch-gold); }
        .bch-modal-backdrop {
          position: fixed; z-index: 50; inset: 0; display: grid; place-items: center; padding: 20px;
          background: rgba(3,5,4,.78); backdrop-filter: blur(6px);
        }
        .bch-modal {
          position: relative; width: min(100%, 470px); padding: 27px; border: 1px solid #3a4238;
          border-radius: 14px; background: #151a16; box-shadow: 0 28px 100px rgba(0,0,0,.52);
          animation: bch-in .2s ease-out both;
        }
        @keyframes bch-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .bch-modal-close { position: absolute; top: 15px; right: 15px; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--bch-line); border-radius: 7px; background: #1b211c; cursor: pointer; color: #b3b9b1; }
        .bch-modal-label { margin-bottom: 12px; color: var(--bch-gold); font-size: 9px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
        .bch-modal h2 { max-width: 360px; margin: 0 30px 9px 0; font-size: 27px; }
        .bch-modal-copy { margin: 0 0 20px; color: var(--bch-muted); font-size: 12px; line-height: 1.7; }
        .bch-preview-alert { display: flex; align-items: flex-start; gap: 10px; padding: 12px; margin: 16px 0; border: 1px solid #584a2c; border-radius: 8px; background: rgba(112,84,28,.1); color: #cbbb92; font-size: 11px; line-height: 1.55; }
        .bch-preview-alert svg { flex: none; margin-top: 1px; color: var(--bch-gold); }
        .bch-order-row { display: flex; justify-content: space-between; gap: 20px; padding: 13px 0; border-top: 1px solid var(--bch-line); border-bottom: 1px solid var(--bch-line); color: #b1b9b1; font-size: 11px; }
        .bch-order-row strong { color: var(--bch-ink); font-size: 13px; }
        .bch-modal-actions { display: flex; justify-content: end; margin-top: 19px; }
        .bch-modal .bch-button { min-height: 42px; }
        .bch-code-form { margin-top: 18px; }
        .bch-code-label { display: block; margin-bottom: 8px; color: #d3d7cf; font-size: 11px; font-weight: 600; }
        .bch-code-input { width: 100%; padding: 12px; border: 1px solid #394239; border-radius: 7px; outline: none; background: #0f130f; color: var(--bch-ink); font-size: 12px; }
        .bch-code-input:focus { border-color: #b89647; box-shadow: 0 0 0 3px rgba(223,185,94,.09); }
        .bch-code-form .bch-button { width: 100%; margin-top: 10px; }
        .bch-lookup-message { margin: 12px 0 0; color: #d0bd88; font-size: 11px; line-height: 1.5; }
        @media (max-width: 760px) {
          .bch-shell { width: min(100% - 36px, 600px); }
          .bch-hero { grid-template-columns: 1fr; padding: 62px 0 43px; }
          .bch-feature-visual { min-height: 295px; }
          .bch-stat-strip { margin-bottom: 58px; }
          .bch-packages { grid-template-columns: 1fr; }
          .bch-card { min-height: 282px; }
          .bch-how { grid-template-columns: 1fr; gap: 27px; padding: 25px; margin-bottom: 60px; }
          .bch-section { padding-bottom: 60px; }
        }
        @media (max-width: 560px) {
          .bch-topline { font-size: 8px; letter-spacing: .1em; }
          .bch-shell { width: calc(100% - 32px); }
          .bch-header { min-height: 65px; }
          .bch-menu-button { display: inline-grid; place-items: center; }
          .bch-nav {
            position: absolute; z-index: 5; top: 100px; right: 16px; left: 16px;
            display: none; align-items: stretch; flex-direction: column; gap: 0; padding: 8px;
            border: 1px solid var(--bch-line); border-radius: 10px; background: #171c18; box-shadow: 0 18px 40px #0008;
          }
          .bch-nav.is-open { display: flex; }
          .bch-nav a, .bch-nav button { padding: 13px !important; text-align: left; }
          .bch-nav-cta { margin-top: 5px; }
          .bch-hero { gap: 27px; padding: 52px 0 35px; }
          .bch h1 { margin-top: 19px; font-size: clamp(45px, 13vw, 65px); }
          .bch-hero-copy { font-size: 13px; }
          .bch-actions { gap: 16px; }
          .bch-feature-visual { min-height: 265px; padding: 17px; }
          .bch-pitch { inset: 62px 16px 69px; }
          .bch-stat-strip { grid-template-columns: 1fr; margin-bottom: 49px; }
          .bch-stat { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 12px 3px; border-right: 0; border-bottom: 1px solid var(--bch-line); }
          .bch-stat:last-child { border-bottom: 0; }
          .bch-stat-label { margin: 0; }
          .bch-section-head { align-items: start; flex-direction: column; gap: 11px; }
          .bch-example-banner { align-items: flex-start; }
          .bch-steps { grid-template-columns: 1fr; gap: 21px; }
          .bch-step { display: grid; grid-template-columns: 29px 1fr; column-gap: 12px; }
          .bch-step-num { grid-row: span 2; margin: 0; }
          .bch-step h3 { align-self: end; margin-bottom: 5px; }
          .bch-responsible { grid-template-columns: auto 1fr; padding: 17px; margin-bottom: 47px; }
          .bch-responsible-mark { display: none; }
          .bch-footer-row { align-items: flex-start; flex-direction: column; gap: 11px; }
          .bch-modal { padding: 23px 19px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bch *, .bch *:before, .bch *:after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
        }
      `}</style>

      <div className="bch-topline">
        <span className="bch-topline-dot" />
        A Ghana-focused home for football insights
      </div>
      <div className="bch-shell">
        <header className="bch-header">
          <a className="bch-brand" href="#top" aria-label="Bet Code Hub home">
            <span className="bch-mark"><ShieldCheck size={18} strokeWidth={1.8} /></span>
            <span className="bch-brand-name">BET <span>CODE</span> HUB</span>
          </a>
          <button
            className="bch-menu-button"
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <nav className={`bch-nav${mobileMenuOpen ? " is-open" : ""}`} aria-label="Main navigation">
            <a href="#packages" onClick={() => setMobileMenuOpen(false)}>Packages</a>
            <button type="button" onClick={openCodes}>My codes</button>
            <a className="bch-nav-cta" href="#packages" onClick={() => setMobileMenuOpen(false)}>
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
              <a className="bch-button" href="#packages">Explore packages <ArrowDown size={15} /></a>
              <a className="bch-text-link" href="#how-it-works">How it works <ArrowRight size={14} /></a>
            </div>
            <div className="bch-hero-note"><LockKeyhole size={13} /> Payment and code access are not connected in this prototype.</div>
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
            <span className="bch-stat-label">Pricing</span>
            <span className="bch-stat-value">One-time · GH₵</span>
          </div>
          <div className="bch-stat">
            <span className="bch-stat-label">Code access</span>
            <span className="bch-stat-value">After verified payment</span>
          </div>
        </div>

        <section className="bch-section" id="packages">
          <div className="bch-section-head">
            <div>
              <div className="bch-section-overline">Package examples</div>
              <h2>Find your matchday read.</h2>
            </div>
            <p className="bch-section-description">
              Review the fixture count, total odds and one-time price. These examples are
              illustrative only; no package shown here is live.
            </p>
          </div>
          <div className="bch-example-banner">
            <CircleHelp size={15} />
            Demo content for this visual prototype. Prices and package details are examples, not active offers.
          </div>
          <div className="bch-packages">
            {packages.map((item, index) => (
              <article className={`bch-card${item.featured ? " featured" : ""}`} key={item.id}>
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
                  <div className="bch-price">GH₵ {formatGhs(item.price_kobo)}<small>One-time price</small></div>
                  <button className="bch-card-button" type="button" onClick={() => openPackage(item)}>
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
            <p>Package information first. Code access only after a payment is verified in a connected storefront.</p>
          </div>
          <div className="bch-steps">
            <div className="bch-step">
              <span className="bch-step-num">01</span>
              <h3>Review the package</h3>
              <p>Check the match count, total odds, description and listed one-time price.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">02</span>
              <h3>Payment is verified</h3>
              <p>A production checkout confirms payment before access is made available.</p>
            </div>
            <div className="bch-step">
              <span className="bch-step-num">03</span>
              <h3>Access your code</h3>
              <p>In a live service, verified package codes can be found through My codes.</p>
            </div>
          </div>
        </section>

        <aside className="bch-responsible">
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
          <span className="bch-footer-copy">© {new Date().getFullYear()} Bet Code Hub · Demo storefront, not connected to checkout.</span>
          <button className="bch-footer-link" type="button" onClick={openCodes}>My codes <ArrowRight size={12} /></button>
        </div>
      </footer>

      {modal && (
        <div className="bch-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModal(null);
        }}>
          <section className="bch-modal" role="dialog" aria-modal="true" aria-labelledby="bch-modal-title">
            <button className="bch-modal-close" type="button" aria-label="Close preview" onClick={() => setModal(null)}>
              <X size={16} />
            </button>
            {modal === "package" && selectedPackage ? (
              <>
                <div className="bch-modal-label">Package review · demo</div>
                <h2 id="bch-modal-title">{selectedPackage.title}</h2>
                <p className="bch-modal-copy">{selectedPackage.description}</p>
                <div className="bch-order-row"><span>Match count</span><strong>{selectedPackage.match_count}</strong></div>
                <div className="bch-order-row"><span>Total odds</span><strong>{selectedPackage.total_odds}</strong></div>
                <div className="bch-order-row"><span>One-time price</span><strong>GH₵ {formatGhs(selectedPackage.price_kobo)}</strong></div>
                <div className="bch-preview-alert">
                  <CircleHelp size={15} />
                  Checkout preview only — not connected. No payment is being taken and this package is not live.
                </div>
                <p className="bch-modal-copy">
                  In a live storefront, access to a code would follow verified payment.
                </p>
                <div className="bch-modal-actions">
                  <button className="bch-button" type="button" onClick={() => setModal(null)}>
                    Understood <Check size={14} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bch-modal-label">My codes · preview</div>
                <h2 id="bch-modal-title">Look up your code.</h2>
                <p className="bch-modal-copy">
                  This form previews the code lookup experience. It is not connected to orders or a customer account.
                </p>
                <div className="bch-preview-alert">
                  <LockKeyhole size={15} />
                  Lookup is not connected in this visual prototype. No order or code will be retrieved.
                </div>
                <form className="bch-code-form" onSubmit={submitLookup}>
                  <label className="bch-code-label" htmlFor="bch-reference">Order reference</label>
                  <input
                    className="bch-code-input"
                    id="bch-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Enter your reference"
                  />
                  <button className="bch-button" type="submit">Preview lookup <ArrowRight size={14} /></button>
                  {lookupMessage && <p className="bch-lookup-message" role="status">{lookupMessage}</p>}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
