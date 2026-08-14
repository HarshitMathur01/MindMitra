import { Link } from "react-router-dom";
import { useTheme } from "@/context/ThemeContext";
import { useDoorOrder, type DoorId } from "@/hooks/useDoorOrder";
import { Reveal } from "./Reveal";
import { RiverImage } from "./RiverImage";
import type { RiverImageName } from "@/assets/river/manifest";

interface DoorConfig {
  to: string;
  /** `{companion}` is replaced with the user's companion name. */
  title: string;
  kicker: string;
  copy: string;
  image: RiverImageName;
  imageDark: RiverImageName;
  dot: string;
  alt: string;
}

/**
 * Destinations match the previous DoorsGrid exactly — these are the six
 * surfaces the app has, and `useDoorOrder` keys off the same DoorId union.
 */
const DOORS: Record<DoorId, DoorConfig> = {
  chat: {
    to: "/chat",
    title: "Talk to {companion}",
    kicker: "Company",
    copy: "Voice or type · she remembers the through-line",
    image: "door-diya",
    imageDark: "door-diya-dark",
    dot: "var(--nr-moss)",
    alt: "Watercolour lotus leaf and closed bud on still water",
  },
  mindgym: {
    to: "/mindgym",
    title: "Mind Gym",
    kicker: "Focus",
    copy: "Two-minute tools when the loop won't quiet",
    image: "door-mindgym",
    imageDark: "door-mindgym-dark",
    dot: "var(--nr-river)",
    alt: "Watercolour path threading between trees into soft mist",
  },
  journal: {
    to: "/journal",
    title: "Journal",
    kicker: "Reflect",
    copy: "Private pages · no scoring, no streaks",
    image: "door-journal",
    imageDark: "door-journal-dark",
    dot: "var(--nr-gold)",
    alt: "Watercolour open notebook with blank pages and a fountain pen",
  },
  peer: {
    to: "/peer-support",
    title: "Peer Support",
    kicker: "Connect",
    copy: "Witnessed by people who get it",
    image: "door-peer",
    imageDark: "door-peer-dark",
    dot: "var(--nr-clay)",
    alt: "Watercolour cupped hands holding a small warm light between them",
  },
  therapist: {
    to: "/therapist-bridge",
    title: "Therapist Bridge",
    kicker: "Cross over",
    copy: "Share a clean summary with your clinician",
    image: "door-bridge",
    imageDark: "door-bridge-dark",
    dot: "var(--nr-lavender)",
    alt: "Watercolour arched stone footbridge reflected in still water",
  },
  reads: {
    to: "/psychological-content",
    title: "Reads & Explainers",
    kicker: "Rest",
    copy: "Short, gentle, evidence-shaped",
    image: "door-reads",
    imageDark: "door-reads-dark",
    dot: "var(--nr-moss)",
    alt: "Watercolour stack of books and a steaming cup on a windowsill",
  },
};

/**
 * The six doors as a bento grid: a 2x2 lead card and five compact rows.
 *
 * `useDoorOrder` decides the sequence, so the lead card is whichever surface
 * the user actually reaches for — the same quiet personalisation the previous
 * DoorsGrid had, now with somewhere prominent to put the winner.
 */
export function Doors({ companionName }: { companionName: string }) {
  const { theme } = useTheme();
  const { order } = useDoorOrder();
  const isDark = theme === "dark";

  const [leadId, ...restIds] = order;
  const lead = DOORS[leadId];
  const leadTitle = lead.title.replace("{companion}", companionName);

  return (
    <section id="doors" className="mx-auto max-w-6xl scroll-mt-28 px-6 md:px-10">
      <Reveal className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="nr-label text-nr-fg">Doors · same private account</p>
          <h2 className="mt-3 max-w-xl font-nr-display text-4xl italic text-nr-fg md:text-5xl">
            What kind of company do you need today?
          </h2>
        </div>
        <p className="text-sm text-nr-muted md:pb-2 md:text-right">
          Pick one. You can change rooms
          <br className="hidden md:block" /> without starting over.
        </p>
      </Reveal>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:auto-rows-[164px] lg:grid-cols-3">
        {/* Lead door — whatever useDoorOrder put first. */}
        <Reveal as="li" className="sm:col-span-2 lg:row-span-2">
          <Link
            to={lead.to}
            data-prefetch={lead.to}
            className="group relative flex h-full min-h-[340px] flex-col justify-end overflow-hidden rounded-3xl border border-nr-border bg-nr-card transition-all duration-700 hover:-translate-y-1 hover:border-nr-mood"
          >
            <RiverImage
              name={isDark ? lead.imageDark : lead.image}
              alt={lead.alt}
              sizes="(min-width: 1024px) 640px, (min-width: 640px) 100vw, 100vw"
              className="absolute inset-0 size-full object-cover transition-transform duration-[1800ms] group-hover:scale-[1.04]"
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, var(--nr-bg) 4%, color-mix(in oklab, var(--nr-bg) 82%, transparent) 34%, transparent 78%)",
              }}
            />
            <div className="relative w-full p-7 md:p-8">
              <p className="nr-label flex items-center gap-2" style={{ color: lead.dot }}>
                <span
                  aria-hidden
                  className="size-1.5 rounded-full"
                  style={{ background: lead.dot }}
                />
                {lead.kicker}
              </p>
              <h3 className="mt-2 font-nr-display text-4xl italic text-nr-fg">{leadTitle}</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-nr-muted">{lead.copy}</p>
              <span
                aria-hidden
                className="mt-5 block h-px w-8 bg-nr-fg/30 transition-all duration-700 group-hover:w-24"
              />
            </div>
          </Link>
        </Reveal>

        {/* The rest — compact, legible, scannable. */}
        {restIds.map((id, i) => {
          const door = DOORS[id];
          const title = door.title.replace("{companion}", companionName);
          return (
            <Reveal as="li" key={id} delay={(i + 1) * 40}>
              <Link
                to={door.to}
                data-prefetch={door.to}
                className="group relative flex h-full min-h-[132px] items-center gap-4 overflow-hidden rounded-3xl border border-nr-border bg-nr-card p-3 pr-5 transition-all duration-500 hover:-translate-y-1 hover:border-nr-mood"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(120% 100% at 0% 50%, color-mix(in oklab, ${door.dot} 16%, transparent), transparent 70%)`,
                  }}
                />
                <span className="relative size-[108px] shrink-0 overflow-hidden rounded-2xl">
                  <RiverImage
                    name={isDark ? door.imageDark : door.image}
                    alt={door.alt}
                    sizes="108px"
                    className="size-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.06]"
                  />
                  {/* A shared wash so all six paintings read as one set. */}
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-nr-border transition-opacity duration-700 group-hover:opacity-0"
                    style={{
                      background: `linear-gradient(150deg, color-mix(in oklab, ${door.dot} 14%, transparent), transparent 65%)`,
                    }}
                  />
                </span>
                <div className="relative min-w-0">
                  <p className="nr-label flex items-center gap-2" style={{ color: door.dot }}>
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: door.dot }}
                    />
                    {door.kicker}
                  </p>
                  <h3 className="mt-1.5 font-nr-display text-2xl italic leading-tight text-nr-fg">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-nr-muted">{door.copy}</p>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
