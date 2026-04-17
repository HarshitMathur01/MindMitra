import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  onViewProfile: () => void;
  onFindTherapist: () => void;
}

const HeroSection = ({ onViewProfile, onFindTherapist }: HeroSectionProps) => {
  return (
    <section
      className={cn(
        "relative mb-12 overflow-hidden rounded-[1.75rem] border border-ink-3/40 bg-[hsl(var(--card))] px-6 py-10 shadow-dashboard-soft",
        "dark:border-ink-3/30 dark:bg-[hsl(var(--ink-2))]",
      )}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[hsl(var(--accent-100))]/35 blur-3xl dark:bg-[hsl(var(--accent-500))]/10"
        aria-hidden
      />
      <div className="relative max-w-2xl space-y-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-5">Therapist bridge</p>
        <h1 className="font-display text-3xl font-normal tracking-tight text-ink-8 md:text-[2.35rem] md:leading-tight">
          Human care, when you&apos;re ready to go deeper
        </h1>
        <p className="text-base leading-relaxed text-ink-5 md:text-[17px]">
          MindMitra walks with you day to day. A licensed therapist can help you work through patterns, stress, and
          goals with continuity and clinical skill.
        </p>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-ink-3/50 bg-[hsl(var(--ink-1))] text-ink-8 hover:bg-[hsl(var(--ink-2))] dark:bg-[hsl(var(--ink-2))]/80"
            onClick={onViewProfile}
          >
            View emotional profile
          </Button>
          <Button
            type="button"
            className="h-11 rounded-full bg-[hsl(var(--accent-500))] px-6 text-white shadow-md hover:bg-[hsl(var(--accent-600))]"
            onClick={onFindTherapist}
          >
            Find a therapist
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
