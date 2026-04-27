import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  innerRef?: Ref<HTMLElement>;
  className?: string;
  tone?: "default" | "tight";
  align?: "left" | "center";
}

export function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  innerRef,
  className,
  tone = "default",
  align = "left",
}: SectionProps) {
  const padding =
    tone === "tight"
      ? "px-6 py-12 sm:px-8 sm:py-16"
      : "px-6 py-16 sm:px-8 sm:py-24";

  return (
    <section
      id={id}
      ref={innerRef}
      className={cn(
        "mx-auto max-w-[1200px]",
        padding,
        align === "center" && "text-center",
        className,
      )}
    >
      {(eyebrow || title || subtitle) && (
        <FadeUp className={cn("mb-12", align === "center" && "mx-auto")}>
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {title && (
            <h2
              className={cn(
                "qc-display mt-3 text-4xl sm:text-5xl",
                "text-[color:var(--qc-ink)]",
              )}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-4 max-w-[60ch] text-base leading-[1.6] text-[color:var(--qc-ink-soft)]">
              {subtitle}
            </p>
          )}
        </FadeUp>
      )}
      <FadeUp>{children}</FadeUp>
    </section>
  );
}

export default Section;
