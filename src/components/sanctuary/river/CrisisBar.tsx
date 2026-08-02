import { ShieldCheck, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Reveal } from "./Reveal";
import { ROUND_THE_CLOCK_HELPLINE, helplineHref } from "@/lib/helplines";
import { useAmbience } from "@/components/sanctuary/AmbienceProvider";

/**
 * The crisis rail.
 *
 * Two things here are deliberately NOT ported from the design source:
 *
 *  1. The number. That version hardcoded `tel:+919152987821`. Helplines live in
 *     src/lib/helplines.ts precisely so a user who taps "call" in chat and
 *     "call" here reaches the same vetted, operational line.
 *  2. The safety-plan link went to `#doors` — an anchor, not the safety plan.
 *     It points at /safety-plan.
 *
 * The framing copy stays on the `sanctuary` i18n namespace: these keys already
 * exist in all seven locales, and English-only crisis copy for a Hindi-speaking
 * user in distress is the one regression this page must not ship.
 *
 * The operator name and hours are read from the constant rather than from
 * translation, because the translated strings name iCall while
 * ROUND_THE_CLOCK_HELPLINE resolves to KIRAN — a button that says one operator
 * and dials another is worse than an untranslated proper noun.
 */
export function CrisisBar() {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const helpline = ROUND_THE_CLOCK_HELPLINE;

  return (
    <div className="mx-auto max-w-6xl px-6">
      <Reveal
        className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border bg-nr-card px-8 py-6 md:rounded-full"
        // During a crisis cooldown the rail gets a steady, slow halo instead of
        // sitting flat — present without being alarming. Matches what the old
        // SafetyStrip did with `crisisQuiet`.
        style={
          ambience.crisisQuiet
            ? {
                borderColor: "color-mix(in oklab, var(--nr-clay) 55%, transparent)",
                boxShadow: "0 0 0 6px color-mix(in oklab, var(--nr-clay) 12%, transparent)",
              }
            : { borderColor: "var(--nr-border)" }
        }
      >
        <div className="flex items-center gap-4">
          <ShieldCheck className="size-5 text-nr-moss" aria-hidden />
          <div>
            <p className="font-nr-display text-xl text-nr-fg">{t("safety.headline")}</p>
            <p className="text-sm text-nr-muted">
              {helpline.name} · {helpline.hours} · {helpline.description}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={helplineHref(helpline)}
            className="inline-flex items-center gap-2 rounded-full bg-nr-ink px-6 py-3 font-nr-display text-lg text-nr-paper transition-opacity duration-700 hover:opacity-90"
          >
            <Phone className="size-4" aria-hidden /> call {helpline.name}
          </a>
          <Link
            to="/safety-plan"
            data-prefetch="/safety-plan"
            className="inline-flex items-center rounded-full border border-nr-border px-6 py-3 font-nr-display text-lg text-nr-fg transition-colors duration-700 hover:border-nr-mood"
          >
            {t("safety.planAction")}
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
