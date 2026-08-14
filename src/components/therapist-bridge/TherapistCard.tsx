import { motion } from "framer-motion";
import type { Match } from "@/lib/therapist-bridge/matching";

export function TherapistCard({
  match,
  onWhy,
}: {
  match: Match;
  onWhy: () => void;
}) {
  const t = match.therapist;
  return (
    <article className="lift group h-full w-[19rem] shrink-0 snap-center overflow-hidden rounded-2xl border border-border bg-card sm:w-auto">
      <div className="flex gap-4 p-4">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl">
          <img
            src={t.photo}
            alt={`Portrait of ${t.name}`}
            loading="lazy"
            width={512}
            height={640}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <h3 className="display text-2xl leading-tight text-ink">{t.name}</h3>
          <p className="text-xs text-muted-foreground">{t.credentials}</p>
          <p className="mt-2 text-sm text-primary">
            {match.phrase}
            <span className="ml-2 text-xs text-muted-foreground">{match.score}%</span>
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-border/70 px-4 py-4">
        <p className="hand text-sm leading-relaxed text-muted-foreground">{t.note}</p>
        <ul className="flex flex-wrap gap-1.5">
          {t.specialties.slice(0, 3).map((s) => (
            <li
              key={s}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {s}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em]">Approach</dt>
            <dd className="text-foreground">{t.approach.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em]">Language</dt>
            <dd className="text-foreground">{t.languages.join(", ")}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em]">Session</dt>
            <dd className="text-foreground">${t.price}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.14em]">Next open</dt>
            <dd className="text-foreground">{t.nextAvailable}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onWhy}
          className="min-h-11 text-sm text-primary underline-offset-4 hover:underline"
        >
          Why this match?
        </button>
      </div>
    </article>
  );
}

export function TherapistCardReveal({
  match,
  index,
  onWhy,
  reduced,
}: {
  match: Match;
  index: number;
  onWhy: () => void;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(6px)" }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: reduced ? 0 : index * 0.18, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <TherapistCard match={match} onWhy={onWhy} />
    </motion.div>
  );
}
