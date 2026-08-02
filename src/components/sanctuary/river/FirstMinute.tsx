import { Reveal } from "./Reveal";

interface Step {
  n: string;
  time: string;
  title: string;
  /** `{companion}` is replaced with the user's companion name. */
  copy: string;
}

/**
 * Showing the whole path in three short steps makes the commitment feel finite
 * and already half-started — and step 03 is where this page states, plainly,
 * that the bridge to a real clinician is the user's call and nobody else's.
 */
const STEPS: Step[] = [
  {
    n: "01",
    time: "10 seconds",
    title: "Tap a colour",
    copy: "That's the whole check-in. No scale from one to ten, no clinical wording.",
  },
  {
    n: "02",
    time: "2 minutes",
    title: "Take the door that fits",
    copy: "Breathe, write a line, or say the thing out loud to {companion}. You choose the room.",
  },
  {
    n: "03",
    time: "when you're ready",
    title: "Cross the bridge — or don't",
    copy: "If it gets heavy, we hand you a clean summary for a real clinician. Only if you ask.",
  },
];

export function FirstMinute({ companionName }: { companionName: string }) {
  return (
    <section className="mx-auto max-w-5xl px-6 md:px-10">
      <Reveal className="relative">
        {/* The river line the three steps sit on. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-8 hidden h-px md:block"
          style={{
            background:
              "linear-gradient(to right, transparent, color-mix(in oklab, var(--nr-river) 40%, transparent), transparent)",
          }}
        />
        <ol className="relative flex flex-col gap-12 md:flex-row md:items-start md:justify-between md:gap-14">
          {STEPS.map((s, i) => (
            <li key={s.n} className="relative flex-1">
              <span
                className="block font-nr-display text-5xl italic"
                style={{ color: i === 1 ? "var(--nr-lavender)" : "var(--nr-river)" }}
              >
                {s.n}
              </span>
              <span className="nr-label mt-4 block text-nr-fg">{s.time}</span>
              <h3 className="mt-2 text-xl font-medium text-nr-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-nr-muted">
                {s.copy.replace("{companion}", companionName)}
              </p>
            </li>
          ))}
        </ol>
      </Reveal>
    </section>
  );
}
