import { Phone, Shield, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const quickLinks = [
  { label: "Chat", path: "/chat" },
  { label: "Check in", path: "/wellness-checkin" },
  { label: "A quiet practice", path: "/games" },
  { label: "Find a therapist", path: "/therapist-bridge" },
];

const crisisResources = [
  { name: "KIRAN Helpline", number: "1800-599-0019", note: "24/7 · toll-free" },
  { name: "iCall", number: "9152987821", note: "Mon–Sat · 8am–10pm" },
  { name: "Vandrevala Foundation", number: "1860-2662-345", note: "24/7" },
  { name: "AASRA", number: "91-22-27546669", note: "24/7" },
];

const legal = [
  { label: "Privacy", path: "#" },
  { label: "Terms", path: "#" },
  { label: "Accessibility", path: "#" },
];

/**
 * Footer — a warm goodbye, not a sitemap.
 * Crisis numbers are first and legible. Nothing is in caps tracking.
 * The closing line reads like a note slipped under a door.
 */
const Footer = () => {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-24 bg-[hsl(var(--ink-0))] text-ink-8">
      <div className="mx-auto max-w-page px-gutter">
        <div className="h-px bg-[hsl(var(--ink-3))]" aria-hidden />

        {/* Crisis block — warm blush card, lifted above the rest */}
        <div className="py-14 md:py-20">
          <div className="mx-auto max-w-xl rounded-[28px] bg-[hsl(var(--warmth-50))] px-7 py-9 md:px-10 md:py-12">
            <p className="text-center text-[13px] text-[hsl(var(--warmth-500))]">
              If you need someone right now
            </p>
            <h2 className="mt-2 text-center font-display text-[24px] font-normal leading-[1.35] text-ink-8 md:text-[28px]">
              A real human is a phone call away.
              <br />
              <span className="text-ink-6">You won't be a burden.</span>
            </h2>

            <ul className="mt-7 space-y-1">
              {crisisResources.map((r) => (
                <li key={r.name}>
                  <a
                    href={`tel:${r.number.replace(/[^0-9+]/g, "")}`}
                    className="flex items-start justify-between gap-4 rounded-xl px-3 py-3 text-[14px] transition-colors hover:bg-[hsl(var(--warmth-100))]"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-ink-8">{r.name}</div>
                      <div className="mt-0.5 text-[12.5px] text-ink-5">
                        {r.note}
                      </div>
                    </div>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-[13.5px] tabular-nums text-[hsl(var(--accent-700))]">
                      <Phone className="h-3.5 w-3.5" strokeWidth={1.8} />
                      {r.number}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Soft sitemap + brand column */}
        <div className="grid gap-10 border-t border-[hsl(var(--ink-3))] py-14 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2.5 text-left"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--accent-100))] text-[hsl(var(--accent-700))]">
                <img
                  src="/image.png"
                  alt=""
                  aria-hidden
                  className="h-5 w-5 object-contain opacity-90"
                />
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="font-display text-[18px] font-medium tracking-tight-1 text-ink-8">
                  MindMitra
                </span>
                <span className="text-[12px] text-ink-5">· beta</span>
              </span>
            </button>

            <p className="mt-6 max-w-prose text-[15.5px] leading-[1.75] text-ink-6">
              A quiet companion for the moments no one sees — built alongside
              clinicians, so you can be honest without consequence.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 text-[12.5px] text-ink-5">
              <Shield className="h-3.5 w-3.5 text-[hsl(var(--accent-500))]" strokeWidth={1.6} />
              <span>Encrypted. DPDP compliant. Your words stay here.</span>
            </div>
          </div>

          <div className="md:col-span-3">
            <p className="text-[13.5px] text-ink-6">Visit</p>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => navigate(link.path)}
                    className="group inline-flex items-center gap-1.5 text-[14.5px] text-ink-7 transition-colors hover:text-ink-8"
                  >
                    <span>{link.label}</span>
                    <ArrowUpRight
                      className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-70"
                      strokeWidth={1.8}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <p className="text-[13.5px] text-ink-6">Fine print</p>
            <ul className="mt-4 space-y-2.5">
              {legal.map((l) => (
                <li key={l.label}>
                  <button
                    onClick={() => navigate(l.path)}
                    className="text-[14.5px] text-ink-7 transition-colors hover:text-ink-8"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Closing line */}
        <div className="border-t border-[hsl(var(--ink-3))] py-8">
          <p className="mx-auto max-w-2xl text-center font-display text-[17px] font-normal italic leading-[1.55] text-ink-6">
            It's okay to not be okay. What you feel matters — and so do you.
          </p>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-[hsl(var(--ink-3))] py-6 text-[12.5px] text-ink-5 md:flex-row md:items-center">
          <div>© {year} MindMitra. Made with care.</div>
          <div>You can always come back.</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
