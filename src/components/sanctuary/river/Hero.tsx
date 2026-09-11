import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RiverImage } from "./RiverImage";
import {
  RIVER_MOODS,
  contextForHour,
  greetingForHour,
  moodFor,
  type MoodDoor,
  type RiverMood,
} from "./moods";

interface HeroProps {
  firstName: string;
  companionName: string;
  /** Index into MOOD_LABELS, or null when today has no log yet. */
  moodIndex: number | null;
  onMoodSelect: (index: number) => void;
  /** Yesterday's last logged mood, or null when there wasn't one. */
  yesterdayIndex: number | null;
  hour: number;
}

interface HeroAction {
  id: MoodDoor;
  /** `{companion}` is replaced with the user's companion name. */
  title: string;
  tag: string;
  blurb: string;
  to: string;
  /** In-page anchors can't be a <Link> — that would push a history entry. */
  anchor?: boolean;
}

const ACTIONS: readonly HeroAction[] = [
  {
    id: "companion",
    title: "Talk it out with {companion}",
    tag: "voice",
    blurb: "A patient ear, any hour. No advice unless you ask.",
    to: "/chat",
  },
  {
    id: "reset",
    title: "2-minute reset",
    tag: "breathe",
    blurb: "Four in, four hold, four out. That is the whole thing.",
    to: "#practice",
    anchor: true,
  },
];

/**
 * Arrival — paper and ink.
 *
 * Two columns: the greeting on the left, the check-in on the right. Tapping a
 * colour writes through to `mood_logs` via `onMoodSelect`, so it is a real
 * check-in that ambience, the constellation and the weekly trend all read
 * back — and it recolours the whole page through `--nr-mood`.
 *
 * Three departures from the design source this was ported from:
 *
 *  1. The name, the companion, yesterday's mood and the check-in itself are
 *     real. The source hardcoded "Jatin", "Diya" and a fixed "yesterday you
 *     felt lifting", and its dots were page-local `useState`.
 *  2. The reset row's blurb describes 4-4-4-4, because that is what the
 *     Practice section it scrolls to actually runs. The source said "four
 *     counts in, six counts out", which is a different exercise.
 *  3. The greeting keeps five hour buckets rather than three — see
 *     `greetingForHour`. "Evening" at 04:00 is wrong for this product.
 *
 * The hillside photograph that used to back this section is gone with it, and
 * so is the measured per-scene contrast table it needed. Copy here sits on the
 * page's own paper, so it inherits `nr-fg` like everything below it.
 */
export function Hero({
  firstName,
  companionName,
  moodIndex,
  onMoodSelect,
  yesterdayIndex,
  hour,
}: HeroProps) {
  // "Choose again" only reopens the dots — it never deletes the log. Picking
  // another colour writes a second check-in, and the day's latest wins, which
  // is the same rule the constellation already draws by.
  const [recheck, setRecheck] = useState(false);

  const [stamp, setStamp] = useState("");
  useEffect(() => {
    const now = new Date();
    const day = now.toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase();
    const time = now
      .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })
      .toLowerCase();
    setStamp(`${day}, ${time}`);
  }, []);

  const logged = moodFor(moodIndex);
  const chosen: RiverMood | null = recheck ? null : logged;
  const yesterday = moodFor(yesterdayIndex);

  const pick = (index: number) => {
    onMoodSelect(index);
    setRecheck(false);
  };

  return (
    <section id="top" className="mx-auto w-full max-w-4xl px-6 pt-32 sm:px-10 lg:pt-40">
      <div className="nr-fade grid gap-12 border-b border-nr-border pb-12 md:grid-cols-2 md:items-end">
        {/* ----- Greeting ----- */}
        <div>
          <p className="font-display text-[26px] leading-none text-nr-sage">
            {greetingForHour(hour)}, {firstName}
            {stamp ? ` — ${stamp}` : ""}
          </p>

          <h1 className="mt-3 text-balance font-serif-brand text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-nr-fg sm:text-[52px]">
            How is your
            <br />
            <span className="italic">inner world</span> today?
          </h1>

          <p className="nr-ink-70 mt-5 max-w-[34ch] text-[15px] leading-relaxed">
            {contextForHour(hour)}
          </p>

          {/* Only rendered when there is a real log to recall — never invented,
              and never a nudge about a day they skipped. */}
          {yesterday && (
            <p className="mt-4 max-w-[34ch] text-[13px] italic leading-relaxed text-nr-muted">
              Yesterday you arrived feeling{" "}
              <span
                className="not-italic underline decoration-2 underline-offset-2"
                style={{
                  textDecorationColor: "color-mix(in oklab, var(--nr-sage) 60%, transparent)",
                }}
              >
                {yesterday.label}
              </span>
              . However today finds you, that's fine.
            </p>
          )}
        </div>

        {/* ----- Check-in ----- */}
        <div className="flex min-h-[17rem] flex-col justify-end gap-4">
          {!chosen ? (
            <>
              <p className="nr-label text-nr-fg">How are you arriving?</p>
              <div className="flex flex-wrap gap-3">
                {RIVER_MOODS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => pick(m.index)}
                    aria-pressed={moodIndex === m.index}
                    className="group flex flex-col items-center gap-2"
                  >
                    <span
                      aria-hidden
                      className="size-10 rounded-full transition-transform duration-300 group-hover:scale-110"
                      style={{ background: m.accent }}
                    />
                    <span className="text-[11px] tracking-wide text-nr-muted transition-colors group-hover:text-nr-fg">
                      {m.title}
                    </span>
                  </button>
                ))}
              </div>
              <p className="nr-ink-60 mt-2 font-display text-[21px] leading-snug">
                Take your time. Nothing is waiting.
              </p>
            </>
          ) : (
            // Keyed on the mood so the fade replays on each change — the
            // painting arriving is the reward for the check-in.
            <div key={chosen.label} className="nr-fade" aria-live="polite">
              <RiverImage
                name={chosen.art}
                alt={chosen.alt}
                sizes="(min-width: 768px) 400px, 100vw"
                className="w-full rounded-sm object-cover"
              />
              <p className="nr-ink-70 mt-4 font-display text-[24px] leading-snug">
                {chosen.note}
              </p>
              <button
                type="button"
                onClick={() => setRecheck(true)}
                className="nr-label mt-3 text-nr-muted transition-colors hover:text-nr-fg"
              >
                Choose again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ----- The two doors this greeting can open ----- */}
      <div className="nr-fade mt-12" style={{ animationDelay: "150ms" }}>
        {chosen && (
          <p
            key={`why-${chosen.label}`}
            className="nr-fade mb-4 font-display text-[22px] leading-snug text-nr-sage"
          >
            For a {chosen.label} day, we would start here —{" "}
            <span className="nr-ink-60">
              {chosen.why.replace("{companion}", companionName)}
            </span>
          </p>
        )}

        {ACTIONS.map((action) => {
          const suggested = chosen?.door === action.id;
          const inner = (
            <>
              <span>
                <span
                  className={`block font-serif-brand text-[24px] font-medium tracking-tight transition-colors ${
                    suggested ? "text-nr-fg" : "nr-ink-80 nr-ink-sage"
                  }`}
                >
                  {action.title.replace("{companion}", companionName)}
                </span>
                <span className="mt-1 block text-[13px] italic text-nr-muted">
                  {action.blurb}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 pl-6">
                {suggested && (
                  <span className="hidden font-display text-[18px] text-nr-sage sm:inline">
                    suggested for today
                  </span>
                )}
                <span className="flex items-center gap-2 text-[12px] tracking-wide text-nr-muted transition-colors group-hover:text-nr-fg">
                  <span
                    aria-hidden
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: suggested ? "var(--nr-sage)" : "var(--nr-border)" }}
                  />
                  {action.tag}
                </span>
                <span
                  aria-hidden
                  className="nr-ink-30 nr-ink-lift text-[16px] transition-all duration-300 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </span>
            </>
          );

          const className =
            "group flex w-full items-center justify-between border-b py-6 text-left transition-colors";
          const style = {
            borderColor: suggested
              ? "color-mix(in oklab, var(--nr-sage) 60%, transparent)"
              : "var(--nr-border)",
          };

          return action.anchor ? (
            <a key={action.id} href={action.to} className={className} style={style}>
              {inner}
            </a>
          ) : (
            <Link
              key={action.id}
              to={action.to}
              data-prefetch={action.to}
              className={className}
              style={style}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
