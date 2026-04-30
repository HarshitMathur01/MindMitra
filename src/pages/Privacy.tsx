import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";

/**
 * STUB. Real legal copy must replace every "TODO" block before public
 * launch. Reviewed by counsel — not by an LLM.
 */
const LAST_UPDATED = "2026-04-24";

const Privacy = () => {
  return (
    <>
      <Header />
      <PageShell width="narrow" id="main-content">
        <article className="py-16 sm:py-24">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--qc-ink-muted)] transition-colors hover:text-[color:var(--qc-ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <header className="mt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--qc-border-stronger)] bg-[color:var(--qc-surface)] px-3 py-1 text-xs text-[color:var(--qc-ink-muted)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
              Draft — pending legal review
            </div>
            <p className="qc-eyebrow mt-8">Privacy</p>
            <h1 className="qc-display mt-4 text-4xl sm:text-5xl">
              How we hold your data.
            </h1>
            <p className="mt-3 text-sm text-[color:var(--qc-ink-muted)]">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div
            role="note"
            className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-5"
            style={{ borderLeft: "3px solid var(--qc-sage)" }}
          >
            <p className="text-sm leading-relaxed text-[color:var(--qc-ink)]">
              <strong className="font-medium">This is placeholder copy.</strong>{" "}
              The full Privacy Policy is being prepared by counsel and is not yet
              authoritative. If you have an urgent question about your data,
              please write to us at{" "}
              <a
                href="mailto:privacy@mindmitra.co.in"
                className="underline decoration-[color:var(--qc-forest)] underline-offset-4"
              >
                privacy@mindmitra.co.in
              </a>
              .
            </p>
          </div>

          <div className="prose prose-neutral mt-12 max-w-[60ch] text-[color:var(--qc-ink)]">
            <h2 className="qc-display">Summary, in plain words</h2>
            <p>
              MindMitra is built around your trust. We collect the minimum
              information needed to support you — what you type, what mood you
              note, what helps you feel better — and we don't sell it.
            </p>

            <h2 className="qc-display">What we collect</h2>
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

            <h2 className="qc-display">What we do not do</h2>
            <ul>
              <li>We do not sell your data.</li>
              <li>
                We do not share identifiable information with advertisers.
              </li>
              <li>
                We do not train third-party models on your conversations.
              </li>
            </ul>

            <h2 className="qc-display">Your controls</h2>
            <p>
              From{" "}
              <Link to="/settings" className="underline">
                Settings → Privacy
              </Link>{" "}
              you can change retention, download your data, or delete your
              account.
            </p>

            <h2 className="qc-display">Compliance</h2>
            <p>
              We aim to align with India's DPDPA. The full policy will detail
              lawful bases, retention windows, sub-processors, transfers, and
              your rights as a data principal.
            </p>

            <h2 className="qc-display">Contact</h2>
            <p>
              <a href="mailto:privacy@mindmitra.co.in">privacy@mindmitra.co.in</a>
            </p>
          </div>
        </article>
      </PageShell>
      <HillsFooter />
    </>
  );
};

export default Privacy;
