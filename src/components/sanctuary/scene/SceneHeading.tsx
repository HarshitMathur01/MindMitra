import { motion } from "framer-motion";

interface SceneHeadingProps {
  eyebrow?: string;
  heading: string;
  sub?: string;
  headingId?: string;
}

/** Shared eyebrow + Caveat heading typography for scene intros. */
export function SceneHeading({ eyebrow, heading, sub, headingId }: SceneHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-xl"
    >
      {eyebrow && (
        <p
          className="mb-3 text-[0.7rem] uppercase tracking-[0.4em]"
          style={{ color: "var(--ink-faint)" }}
        >
          {eyebrow}
        </p>
      )}
      <h2
        id={headingId}
        className="leading-tight"
        style={{
          fontFamily: "var(--font-serif)",
          color: "var(--ink)",
          fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
          fontWeight: 500,
        }}
      >
        {heading}
      </h2>
      {sub && (
        <p
          className="mt-4 max-w-md text-base leading-relaxed"
          style={{ color: "var(--ink-soft)" }}
        >
          {sub}
        </p>
      )}
    </motion.div>
  );
}
