import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import reflectionImg from "@/assets/sanctuary/reflection.jpg";

/**
 * The trust statement, absorbed from the old standalone ReflectionScene.
 * Parallax now belongs to the parent SceneSection, so this is a static
 * two-column block: framed lake plate + the "we never invent words" copy.
 */
export function ReflectionBlock() {
  const { t } = useTranslation("sanctuary");

  return (
    <div className="grid w-full grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-[3/2] w-full"
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[2rem]"
          style={{
            boxShadow:
              "0 30px 80px -40px color-mix(in oklab, var(--ink) 40%, transparent)",
          }}
        >
          <img
            src={reflectionImg}
            alt="Watercolor of a still lake at twilight with a small boat and glowing moon"
            loading="lazy"
            decoding="async"
            width={1536}
            height={1024}
            className="h-full w-full object-cover mix-blend-multiply"
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <p
          className="mb-4 text-[0.7rem] uppercase tracking-[0.4em]"
          style={{ color: "var(--ink-faint)" }}
        >
          {t("reflection.eyebrow")}
        </p>
        <h2
          className="leading-[1.1]"
          style={{
            fontFamily: "var(--font-serif)",
            color: "var(--ink)",
            fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)",
            fontWeight: 500,
          }}
        >
          {t("reflection.heading")}
        </h2>
        <p
          className="mt-5 max-w-md text-base leading-relaxed"
          style={{ color: "var(--ink-soft)" }}
        >
          {t("reflection.subcopy")}
        </p>
      </motion.div>
    </div>
  );
}
