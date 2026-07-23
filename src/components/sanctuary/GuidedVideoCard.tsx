import { useState } from "react";
import { Play, Film } from "lucide-react";
import { useTranslation } from "react-i18next";
import { stopSoundscape } from "@/lib/sanctuary/soundscape";

// A short hand-painted loop with soft ambient audio (no narration) served
// from /public/videos/. Nothing loads until the user presses play; the
// native controls handle pause/volume/fullscreen and keyboard access.
const VIDEO_SRC = "/videos/meditating_calming.mp4";

export function GuidedVideoCard() {
  const { t } = useTranslation("sanctuary");
  const [playing, setPlaying] = useState(false);

  const startVideo = () => {
    // One sound at a time — the room's ambience yields to the video.
    stopSoundscape();
    setPlaying(true);
  };

  return (
    <div className="w-full">
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
          {playing ? (
            <video
              src={VIDEO_SRC}
              className="absolute inset-0 h-full w-full object-cover"
              controls
              autoPlay
              loop
              playsInline
              preload="none"
            />
          ) : (
            <>
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
                {t("guidedVideo.eyebrow")} · {t("guidedVideo.length")}
              </span>

              <button
                type="button"
                onClick={startVideo}
                className="absolute inset-0 grid place-items-center"
                aria-label={t("guidedVideo.heading")}
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
            </>
          )}
        </div>

        <div className="flex flex-col justify-center p-7 md:p-10">
          <p
            className="mb-3 text-[0.7rem] uppercase tracking-[0.35em]"
            style={{ color: "var(--ink-faint)" }}
          >
            {t("guidedVideo.eyebrow")} · {t("guidedVideo.length")}
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
            <span style={{ fontStyle: "italic" }}>{t("guidedVideo.heading")}</span>
          </h3>
          <p
            className="mt-3 max-w-sm text-sm leading-relaxed"
            style={{ color: "var(--ink-soft)" }}
          >
            {t("guidedVideo.noDialogue")}
          </p>
          <div
            className="mt-5 flex flex-wrap gap-2 text-[0.65rem] uppercase tracking-[0.3em]"
            style={{ color: "var(--ink-faint)" }}
          >
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              {t("guidedVideo.tagGrounding")}
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              {t("guidedVideo.tagStillness")}
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: "var(--border)" }}
            >
              {t("guidedVideo.tagNoWords")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
