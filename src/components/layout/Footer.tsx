import { Phone, Heart, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Footer = () => {
  const navigate = useNavigate();

  const links = {
    product: [
      { label: "AI Chat", path: "/chat" },
      { label: "MindGym", path: "/mindgym" },
      { label: "Healthy Habits", path: "/healthy-habits" },
      { label: "Therapist Bridge", path: "/therapist-bridge" },
    ],
    support: [
      { label: "Peer Community", path: "/peer-support" },
      { label: "Resources", path: "/psychological-content" },
      { label: "Q&A Tests", path: "/qa-tests" },
    ],
    legal: [
      { label: "Privacy Policy", path: "#" },
      { label: "Terms of Service", path: "#" },
    ],
  };

  const helplines = [
    { name: "Vandrevala Foundation", number: "1860 2662 345" },
    { name: "iCall", number: "9152 987 821" },
    { name: "AASRA", number: "9820 466 726" },
  ];

  return (
    <footer className="border-t border-border/40 bg-[hsl(var(--ink-1))]">
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2">
              <img src="/image.png" alt="MindMitra" className="h-8 w-8" />
              <span className="font-display text-lg text-foreground">MindMitra</span>
            </div>
            <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
              A quiet companion for the loud days. Mental wellness made
              continuous, accessible, and stigma-free.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Heart className="h-3 w-3 text-[hsl(var(--accent-500))]" />
              Made with care in India
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </p>
            <ul className="mt-4 space-y-2.5">
              {links.product.map((l) => (
                <li key={l.label}>
                  <button
                    type="button"
                    onClick={() => navigate(l.path)}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Support
            </p>
            <ul className="mt-4 space-y-2.5">
              {links.support.map((l) => (
                <li key={l.label}>
                  <button
                    type="button"
                    onClick={() => navigate(l.path)}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5">
              {links.legal.map((l) => (
                <li key={l.label}>
                  <button
                    type="button"
                    onClick={() => navigate(l.path)}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="mt-12 overflow-hidden rounded-2xl border border-border/40 bg-background"
          style={{
            borderLeft: "3px solid hsl(var(--bad-500))",
          }}
        >
          <div className="px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Phone className="h-4 w-4 text-[hsl(var(--bad-500))]" />
              Crisis helplines — you're never alone
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {helplines.map((h) => (
                <a
                  key={h.name}
                  href={`tel:${h.number.replace(/\s/g, "")}`}
                  className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                >
                  <span className="font-medium">{h.name}:</span> {h.number}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MindMitra. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Your data is encrypted &amp; private
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
