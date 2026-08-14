import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { topics, type Topic } from "@/lib/therapist-bridge/data";
import { BottomSheet } from "./BottomSheet";

export function TopicConstellation() {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<Topic | null>(null);

  return (
    <section aria-labelledby="topics-heading" className="panel rounded-2xl p-5">
      <h2 id="topics-heading" className="display text-2xl text-ink">
        What you've been talking about
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Themes only — nothing you wrote is shown here.
      </p>
      <ul className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        {topics.map((topic, i) => (
          <motion.li
            key={topic.id}
            animate={
              reduced
                ? {}
                : { y: [0, i % 2 ? -1.5 : 1.5, 0], x: [0, i % 3 ? 1 : -1, 0] }
            }
            transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}
          >
            <button
              type="button"
              onClick={() => setOpen(topic)}
              className="rounded-full px-1 text-foreground transition-colors hover:text-primary"
              style={{ fontSize: `${0.85 + topic.weight * 0.55}rem`, opacity: 0.55 + topic.weight * 0.45 }}
            >
              {topic.label}
            </button>
          </motion.li>
        ))}
      </ul>

      <BottomSheet
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.label ?? ""}
        description={open?.insight}
      >
        <p className="hand text-sm text-muted-foreground">
          Frequency, not content. Your conversations stay yours unless you choose to share them.
        </p>
      </BottomSheet>
    </section>
  );
}
