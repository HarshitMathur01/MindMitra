import { motion } from "framer-motion";
import { Phone, HandHelping } from "lucide-react";
import { duration, ease } from "@/lib/motion";

const resources = [
  { name: "iCall", number: "9152987821", note: "Mon–Sat · 8am–10pm" },
  { name: "Vandrevala Foundation", number: "1860-2662-345", note: "24/7" },
  { name: "AASRA", number: "91-22-27546669", note: "24/7" },
  { name: "KIRAN", number: "1800-599-0019", note: "24/7 · Toll-free" },
];

/**
 * Crisis affordance — a warm coral pill, never black, never alarming.
 * The visual language is a held hand, not a siren.
 */
const CrisisSafetyBadge = () => {
  return (
    <motion.div
      className="fixed bottom-5 right-5 z-50"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: duration.long, ease: ease.outExpo }}
    >
      <div className="group relative">
        {/* Trigger — warm blush, gently visible, never flashing */}
        <button
          type="button"
          className="flex items-center gap-2 rounded-full bg-[hsl(var(--warmth-100))] px-4 py-2.5 text-[13.5px] font-medium text-[hsl(var(--warmth-500))] shadow-e1 transition-colors duration-base hover:bg-[hsl(var(--warmth-200))]"
          aria-haspopup="true"
        >
          <HandHelping className="h-4 w-4" strokeWidth={1.6} />
          <span>If you need someone</span>
        </button>

        {/* Panel — editorial cards, never bright red, warm text */}
        <div
          className="pointer-events-none absolute bottom-full right-0 mb-3 w-80 translate-y-2 rounded-3xl bg-[hsl(var(--ink-0))] p-6 opacity-0 shadow-e3 transition-all duration-base ease-out-expo group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100"
          role="tooltip"
        >
          <div className="text-[13px] text-ink-5">
            You don't have to go through this alone
          </div>
          <h4 className="mt-2 font-display text-[20px] font-normal leading-tight text-ink-8">
            A real human is one call away.
          </h4>

          <ul className="mt-5 space-y-1">
            {resources.map((r) => (
              <li key={r.name}>
                <a
                  href={`tel:${r.number.replace(/[^0-9+]/g, "")}`}
                  className="flex items-start justify-between gap-3 rounded-xl px-3 py-3 text-[13.5px] transition-colors hover:bg-[hsl(var(--ink-1))]"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink-8">{r.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-ink-5">{r.note}</div>
                  </div>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] tabular-nums text-[hsl(var(--accent-600))]">
                    <Phone className="h-3 w-3" strokeWidth={1.8} />
                    {r.number}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-[12.5px] leading-relaxed text-ink-5">
            If you're in immediate danger, please call your local emergency
            number. You won't be a burden.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default CrisisSafetyBadge;
