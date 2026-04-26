import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PageShell from "@/components/layout/PageShell";

/**
 * STUB. Real legal copy must replace every "TODO" block before public
 * launch. Reviewed by counsel — not by an LLM.
 */
const LAST_UPDATED = "2026-04-24";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <PageShell tone="page" width="narrow" id="main-content">
        <article className="py-16 sm:py-24">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <header className="mt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-[hsl(var(--ink-1))] px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--accent-500))]" />
              Draft — pending legal review
            </div>
            <h1 className="mt-5 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div
            role="note"
            className="mt-8 overflow-hidden rounded-2xl border border-border/40 bg-[hsl(var(--warmth-50,40_30%_94%))]/40 p-5"
            style={{ borderLeft: "3px solid hsl(var(--warmth-500))" }}
          >
            <p className="text-sm leading-relaxed text-foreground">
              <strong className="font-semibold">This is placeholder copy.</strong>{" "}
              The full Privacy Policy is being prepared by counsel and is not yet
              authoritative. If you have an urgent question about your data,
              please write to us at{" "}
              <a
                href="mailto:privacy@mindmitra.co.in"
                className="underline decoration-[hsl(var(--accent-500))] underline-offset-4"
              >
                privacy@mindmitra.co.in
              </a>
              .
            </p>
          </div>

          <div className="prose prose-neutral mt-12 max-w-none text-foreground">
            <h2>Summary, in plain words</h2>
            <p>
              MindMitra is built around your trust. We collect the minimum
              information needed to support you — what you type, what mood you
              note, what helps you feel better — and we don't sell it.
            </p>

            <h2>What we collect</h2>
            <ul>
              <li>Account details (email, sign-in provider).</li>
              <li>
                Conversations you have with Mitra and the longitudinal memory
                derived from them.
              </li>
              <li>
                Mood check-ins, journal entries, and Mind Gym activity that you
                choose to record.
              </li>
              <li>
                Anonymous product analytics so we can find and fix things that
                are confusing.
              </li>
            </ul>

            <h2>What we do not do</h2>
            <ul>
              <li>We do not sell your data.</li>
              <li>
                We do not share identifiable information with advertisers.
              </li>
              <li>
                We do not train third-party models on your conversations.
              </li>
            </ul>

            <h2>Your controls</h2>
            <p>
              From{" "}
              <Link to="/settings" className="underline">
                Settings → Privacy
              </Link>{" "}
              you can change retention, download your data, or delete your
              account.
            </p>

            <h2>Compliance</h2>
            <p>
              We aim to align with India's DPDPA. The full policy will detail
              lawful bases, retention windows, sub-processors, transfers, and
              your rights as a data principal.
            </p>

            <h2>Contact</h2>
            <p>
              <a href="mailto:privacy@mindmitra.co.in">privacy@mindmitra.co.in</a>
            </p>
          </div>
        </article>
      </PageShell>
      <Footer />
    </div>
  );
};

export default Privacy;
