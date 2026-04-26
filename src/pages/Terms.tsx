import { Link } from "react-router-dom";
import { ScrollText, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PageShell from "@/components/layout/PageShell";

/**
 * STUB. Real legal copy must replace every "TODO" block before public
 * launch. Reviewed by counsel — not by an LLM.
 */
const LAST_UPDATED = "2026-04-24";

const Terms = () => {
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
              <ScrollText className="h-3.5 w-3.5 text-[hsl(var(--accent-500))]" />
              Draft — pending legal review
            </div>
            <h1 className="mt-5 font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </header>

          <div
            role="note"
            className="mt-8 overflow-hidden rounded-2xl border border-border/40 p-5"
            style={{ borderLeft: "3px solid hsl(var(--bad-500))" }}
          >
            <p className="text-sm leading-relaxed text-foreground">
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

          <div className="prose prose-neutral mt-12 max-w-none text-foreground">
            <h2>Acceptance</h2>
            <p>
              By using MindMitra you agree to these terms. If you do not agree,
              please don't use the product.
            </p>

            <h2>What MindMitra is</h2>
            <p>
              An AI companion that listens, remembers what you've shared, and
              helps you build self-awareness over time. It is{" "}
              <em>supportive</em>, not <em>medical</em>.
            </p>

            <h2>What it isn't</h2>
            <ul>
              <li>A licensed therapist or doctor.</li>
              <li>An emergency response service.</li>
              <li>A substitute for medication or treatment plans.</li>
            </ul>

            <h2>Acceptable use</h2>
            <p>
              Don't use MindMitra to harm yourself or others, to harass anyone,
              or to circumvent our safety features. We may suspend access if we
              detect abuse.
            </p>

            <h2>Account &amp; data</h2>
            <p>
              You retain ownership of what you share. We process it on your
              behalf as described in the{" "}
              <Link to="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, MindMitra is provided
              "as is" without warranty. The full clause will appear in the
              counsel-reviewed version.
            </p>

            <h2>Changes</h2>
            <p>
              We will update these terms as the product evolves. Material
              changes will be announced in-app.
            </p>

            <h2>Contact</h2>
            <p>
              <a href="mailto:hello@mindmitra.co.in">hello@mindmitra.co.in</a>
            </p>
          </div>
        </article>
      </PageShell>
      <Footer />
    </div>
  );
};

export default Terms;
