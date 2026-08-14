import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const items = [
  {
    label: "Structured summary",
    detail: "Assessment scores, dates and bands — the same numbers you can see.",
  },
  {
    label: "Pattern context",
    detail: "How mood, energy and sleep moved together over the last two weeks.",
  },
  {
    label: "Your words",
    detail: "Only lines you explicitly attach. Off by default.",
  },
];

export function TransparencyDrawer() {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();

  return (
    <section className="panel rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="grid min-h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 text-left"
      >
        <span className="min-w-0">
          <span className="display block text-2xl text-ink">What gets handed off</span>
          <span className="block text-sm text-muted-foreground">
            Structured summary · Pattern context · Your words
          </span>
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-primary transition-transform duration-300"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          →
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="space-y-4 border-t border-border/70 px-5 py-5">
              {items.map((item, i) => (
                <motion.li
                  key={item.label}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduced ? 0 : 0.08 * i }}
                >
                  <p className="text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                </motion.li>
              ))}
            </ul>
            <p className="px-5 pb-5 text-sm text-primary">
              Never shared automatically: private chat transcripts.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
