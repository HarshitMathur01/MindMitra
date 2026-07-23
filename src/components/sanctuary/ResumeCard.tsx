import { motion } from "framer-motion";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function ResumeCard() {
  const { t } = useTranslation("sanctuary");
  return (
    <div className="w-full">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          to="/chat"
          className="group relative flex flex-col items-start gap-5 overflow-hidden rounded-3xl border p-6 transition-all hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.25)] md:flex-row md:items-center md:gap-8 md:p-7"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--paper)",
          }}
        >
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5"
            style={{
              background:
                "linear-gradient(to bottom, var(--accent-sage), var(--accent-sky))",
            }}
          />
          <div className="flex items-center gap-4">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--accent-sage) 18%, transparent)",
              }}
            >
              <Clock
                className="h-5 w-5"
                strokeWidth={1.6}
                style={{ color: "var(--accent-sage)" }}
              />
            </div>
            <div className="md:hidden">
              <p
                className="text-[0.65rem] uppercase tracking-[0.35em]"
                style={{ color: "var(--ink-faint)" }}
              >
                {t("resume.label")}
              </p>
            </div>
          </div>

          <div className="flex-1">
            <p
              className="hidden text-[0.65rem] uppercase tracking-[0.35em] md:block"
              style={{ color: "var(--ink-faint)" }}
            >
              {t("resume.label")}
            </p>
          </div>

          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-all group-hover:gap-3"
            style={{ backgroundColor: "var(--paper-deep)", color: "var(--ink)" }}
          >
            {t("resume.action")}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
