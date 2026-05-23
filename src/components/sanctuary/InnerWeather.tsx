import { motion } from "framer-motion";

export function InnerWeather() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.9 }}
      className="mx-auto w-full max-w-6xl px-6 md:px-12"
    >
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border px-4 py-2 text-xs"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "color-mix(in oklab, var(--accent-sky) 8%, var(--paper-soft))",
          color: "var(--ink-soft)",
          width: "fit-content",
        }}
      >
        <span aria-hidden className="text-base">⛅</span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "var(--ink)",
          }}
        >
          inner weather:
        </span>
        <span>overcast with patches of clarity · gusts of doubt after 9pm</span>
        <span
          className="ml-2 rounded-full px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.3em]"
          style={{ backgroundColor: "var(--paper-deep)", color: "var(--ink-faint)" }}
        >
          based on last 7 logs
        </span>
      </div>
    </motion.aside>
  );
}
