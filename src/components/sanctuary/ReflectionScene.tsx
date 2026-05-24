import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import reflectionImg from "@/assets/sanctuary/reflection.jpg";

export function ReflectionScene() {
  const { t } = useTranslation("sanctuary");
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-30px", "30px"]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.8, 1], [0, 1, 1, 0.3]);

  return (
    <section
      ref={ref}
      id="reflection"
      className="relative w-full overflow-hidden py-24 md:py-32"
      style={{ backgroundColor: "var(--paper-deep)" }}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 md:grid-cols-2 md:gap-16 md:px-12">
        <motion.div style={{ y }} className="relative aspect-[3/2] w-full">
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
              width={1536}
              height={1024}
              className="h-full w-full object-cover mix-blend-multiply"
            />
          </div>
        </motion.div>

        <motion.div style={{ opacity }}>
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
    </section>
  );
}
