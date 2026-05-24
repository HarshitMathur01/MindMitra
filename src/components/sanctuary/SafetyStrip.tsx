import { ShieldCheck, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ROUND_THE_CLOCK_HELPLINE } from "@/lib/helplines";
import { useAmbience } from "./AmbienceProvider";

export function SafetyStrip() {
  const { t } = useTranslation("sanctuary");
  const ambience = useAmbience();
  const quiet = ambience.crisisQuiet;

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12 md:py-14">
      <motion.div
        className="flex flex-col items-start gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between md:p-6"
        style={{
          borderColor: "var(--border)",
          backgroundColor:
            "color-mix(in oklab, var(--accent-blush) 10%, var(--paper-soft))",
        }}
        animate={
          quiet
            ? {
                boxShadow: [
                  "0 0 0 0 color-mix(in oklab, var(--accent-blush) 35%, transparent)",
                  "0 0 0 12px color-mix(in oklab, var(--accent-blush) 0%, transparent)",
                ],
              }
            : undefined
        }
        transition={
          quiet
            ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      >
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 h-5 w-5 shrink-0"
            strokeWidth={1.6}
            style={{ color: "var(--ink)" }}
          />
          <div>
            <p
              className="text-sm leading-snug"
              style={{
                fontFamily: "var(--font-serif)",
                color: "var(--ink)",
                fontStyle: "italic",
                fontSize: "1.05rem",
              }}
            >
              {t("safety.headline")}
            </p>
            <p
              className="mt-1 text-xs leading-relaxed"
              style={{ color: "var(--ink-soft)" }}
            >
              {t("safety.callLine")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={`tel:${ROUND_THE_CLOCK_HELPLINE.phone}`}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all hover:scale-[1.02]"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            <Phone className="h-3.5 w-3.5" strokeWidth={2} />
            {t("safety.callAction")}
          </a>
          <Link
            to="/safety-plan"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors"
            style={{
              borderColor: "var(--border)",
              color: "var(--ink)",
              backgroundColor: "var(--paper)",
            }}
          >
            {t("safety.planAction")}
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
