import { Play, Film } from "lucide-react";

export function GuidedVideoCard() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 pb-12 md:px-12">
      <div
        className="group relative grid grid-cols-1 overflow-hidden rounded-3xl border md:grid-cols-[1.1fr_1fr]"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--paper-soft)",
        }}
      >
        <div
          className="relative aspect-video md:aspect-auto"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--accent-sky) 40%, var(--paper-deep)), color-mix(in oklab, var(--accent-sage) 35%, var(--paper-deep)))",
          }}
        >
          <span
            aria-hidden
            className="absolute -left-6 -top-6 h-32 w-32 rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--accent-amber) 60%, transparent), transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          <span
            aria-hidden
            className="absolute bottom-0 right-0 h-40 w-40 rounded-full opacity-50"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--accent-blush) 70%, transparent), transparent 70%)",
              filter: "blur(24px)",
            }}
          />
          <span
            className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6rem] uppercase tracking-[0.3em] backdrop-blur"
            style={{
              backgroundColor: "color-mix(in oklab, var(--paper) 70%, transparent)",
              color: "var(--ink-soft)",
            }}
          >
            <Film className="h-3 w-3" strokeWidth={1.6} />
            video · 3:14 · placeholder
          </span>

          <button
            type="button"
            className="absolute inset-0 grid place-items-center"
            aria-label="Play guided grounding video"
          >
            <span
              className="grid h-16 w-16 place-items-center rounded-full backdrop-blur transition-transform group-hover:scale-110"
              style={{
                backgroundColor: "color-mix(in oklab, var(--paper) 85%, transparent)",
                boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
              }}
            >
              <Play
                className="h-6 w-6 translate-x-0.5"
                strokeWidth={1.8}
                style={{ color: "var(--ink)" }}
              />
            </span>
          </button>
        </div>

        <div className="flex flex-col justify-center p-7 md:p-10">
          <p
            className="mb-3 text-[0.7rem] uppercase tracking-[0.35em]"
            style={{ color: "var(--ink-faint)" }}
          >
            tonight's guided sit · 3 min
          </p>
          <h3
            className="leading-tight"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--ink)",
              fontSize: "clamp(1.5rem, 2.4vw, 2rem)",
              fontWeight: 500,
            }}
          >
            <span style={{ fontStyle: "italic" }}>"the room you're in"</span> — a body-scan
            for when the chest is loud.
          </h3>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            Watercolor visuals, soft voice. No data sent — the clip lives on your device
            once cached.
          </p>
          <div
            className="mt-5 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.3em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              grounding
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              body-scan
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              voice · soft
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
