import { motion } from "framer-motion";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import chatImg from "@/assets/sanctuary/door-chat.jpg";
import mindgymImg from "@/assets/sanctuary/door-mindgym.jpg";
import journalImg from "@/assets/sanctuary/door-journal.jpg";
import peerImg from "@/assets/sanctuary/door-peer.jpg";
import therapistImg from "@/assets/sanctuary/door-therapist.jpg";
import readsImg from "@/assets/sanctuary/door-reads.jpg";
import { useDoorOrder, type DoorId } from "@/hooks/useDoorOrder";
import { usePersonality } from "@/hooks/usePersonality";

interface Door {
  id: DoorId;
  to: string;
  img: string;
  accent: string;
}

const DOOR_CONFIG: Record<DoorId, Door> = {
  chat: {
    id: "chat",
    to: "/chat",
    img: chatImg,
    accent: "var(--accent-sage)",
  },
  mindgym: {
    id: "mindgym",
    to: "/mindgym",
    img: mindgymImg,
    accent: "var(--accent-sky)",
  },
  journal: {
    id: "journal",
    to: "/journal",
    img: journalImg,
    accent: "var(--accent-amber)",
  },
  peer: {
    id: "peer",
    to: "/peer-support",
    img: peerImg,
    accent: "var(--accent-blush)",
  },
  therapist: {
    id: "therapist",
    to: "/therapist-bridge",
    img: therapistImg,
    accent: "var(--accent-sky)",
  },
  reads: {
    id: "reads",
    to: "/psychological-content",
    img: readsImg,
    accent: "var(--accent-sage)",
  },
};

export function DoorsGrid() {
  const { t } = useTranslation("sanctuary");
  const { order } = useDoorOrder();
  const { companionName } = usePersonality();

  const doors = useMemo(() => order.map((id) => DOOR_CONFIG[id]), [order]);

  return (
    <section
      id="doors"
      className="mx-auto w-full max-w-6xl px-6 py-16 md:px-12 md:py-20"
    >
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <p
            className="mb-3 text-[0.7rem] uppercase tracking-[0.4em]"
            style={{ color: "var(--ink-faint)" }}
          >
            {t("doors.eyebrow")}
          </p>
          <h2
            className="leading-tight"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--ink)",
              fontSize: "clamp(1.7rem, 3vw, 2.4rem)",
              fontWeight: 500,
            }}
          >
            {t("doors.heading")}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {doors.map((door, i) => {
          const label = t(`doors.items.${door.id}.label`, {
            companion: companionName,
          });
          const blurb = t(`doors.items.${door.id}.blurb`);
          return (
            <motion.div
              key={door.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link
                to={door.to}
                aria-label={label}
                className="group relative flex h-full flex-col overflow-hidden rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)]"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--paper)",
                }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={door.img}
                    alt=""
                    loading="lazy"
                    width={768}
                    height={768}
                    className="h-full w-full object-cover mix-blend-multiply transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, color-mix(in oklab, var(--paper) 35%, transparent), transparent 55%)",
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute left-4 top-4 h-2 w-2 rounded-full"
                    style={{ backgroundColor: door.accent }}
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3
                    className="text-lg leading-tight"
                    style={{
                      fontFamily: "var(--font-serif)",
                      color: "var(--ink)",
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </h3>
                  <p
                    className="mt-1.5 text-sm leading-relaxed"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {blurb}
                  </p>
                  <span
                    className="mt-4 inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.3em] transition-all group-hover:gap-3"
                    style={{ color: "var(--ink)" }}
                  >
                    {t("doors.enter")}
                    <span aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
