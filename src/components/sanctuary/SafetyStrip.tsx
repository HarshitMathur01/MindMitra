import { ShieldCheck, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUND_THE_CLOCK_HELPLINE } from "@/lib/helplines";

export function SafetyStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10 md:px-12 md:py-14">
      <div
        className="flex flex-col items-start gap-4 rounded-2xl border p-5 md:flex-row md:items-center md:justify-between md:p-6"
        style={{
          borderColor: "var(--border)",
          backgroundColor:
            "color-mix(in oklab, var(--accent-blush) 10%, var(--paper-soft))",
        }}
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
              Not okay tonight?
            </p>
            <p
              className="mt-1 text-xs leading-relaxed"
              style={{ color: "var(--ink-soft)" }}
            >
              Round-the-clock listeners. Free. Confidential. Available right now.
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
            Call {ROUND_THE_CLOCK_HELPLINE.name}
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
            Open my safety plan
          </Link>
        </div>
      </div>
    </section>
  );
}
