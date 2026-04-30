import { Link } from "react-router-dom";
import { ScrollText, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";

/**
 * STUB. Real legal copy must replace every "TODO" block before public
 * launch. Reviewed by counsel — not by an LLM.
 */
const LAST_UPDATED = "2026-04-24";

const Terms = () => {
  return (
    <>
      <Header />
      <PageShell width="narrow" id="main-content">
        <article className="py-16 sm:py-24">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>

          <header className="mt-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--qc-border-stronger)] bg-[color:var(--qc-surface)] px-3 py-1 text-xs text-[color:var(--qc-ink-muted)]">
              <ScrollText className="h-3.5 w-3.5 text-[color:var(--qc-forest)]" />
              Draft — pending legal review
            </div>
            <p className="qc-eyebrow mt-8">Terms</p>
            <h1 className="qc-display mt-4 text-4xl sm:text-5xl">
              How we work together.
            </h1>
            <p className="mt-3 text-sm text-[color:var(--qc-ink-muted)]">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div
            role="note"
            className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--qc-border)] bg-[color:var(--qc-surface)] p-5"
            style={{ borderLeft: "3px solid var(--qc-forest)" }}
          >
            <p className="text-sm leading-relaxed text-[color:var(--qc-ink)]">
              <strong className="font-semibold">
                MindMitra is a companion, not a clinician.
              </strong>{" "}
              Mitra does not diagnose, treat, or replace professional mental
              healthcare. If you are in crisis or worried about your safety,
              please call one of the helplines listed in the footer or in your{" "}
              <Link to="/safety-plan" className="underline">
                safety plan
              </Link>
              .
            </p>
          </div>

          <div className="prose prose-neutral mt-12 max-w-[60ch] text-[color:var(--qc-ink)]">
            <h2 className="qc-display">Acceptance</h2>
            <p>
              By using MindMitra you agree to these terms. If you do not agree,
              please don't use the product.
            </p>

            <h2 className="qc-display">What MindMitra is</h2>
            <p>
              An AI companion that listens, remembers what you've shared, and
              helps you build self-awareness over time. It is{" "}
              <em>supportive</em>, not <em>medical</em>.
            </p>

            <h2 className="qc-display">What it isn't</h2>
            <ul>
              <li>A licensed therapist or doctor.</li>
              <li>An emergency response service.</li>
              <li>A substitute for medication or treatment plans.</li>
            </ul>

            <h2 className="qc-display">Acceptable use</h2>
            <p>
              Don't use MindMitra to harm yourself or others, to harass anyone,
              or to circumvent our safety features. We may suspend access if we
              detect abuse.
            </p>

            <h2 className="qc-display">Account &amp; data</h2>
            <p>
              You retain ownership of what you share. We process it on your
              behalf as described in the{" "}
              <Link to="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>

            <h2 className="qc-display">Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, MindMitra is provided
              "as is" without warranty. The full clause will appear in the
              counsel-reviewed version.
            </p>

            <h2 className="qc-display">Changes</h2>
            <p>
              We will update these terms as the product evolves. Material
              changes will be announced in-app.
            </p>

            <h2 className="qc-display">Contact</h2>
            <p>
              <a href="mailto:hello@mindmitra.co.in">hello@mindmitra.co.in</a>
            </p>
          </div>
        </article>
      </PageShell>
      <HillsFooter />
    </>
  );
};

export default Terms;
