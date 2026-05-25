/**
 * Floating "for you now" suggestion surface for the chat.
 *
 * Two variants:
 *   - `floating` (default, desktop ≥lg): a fixed bottom-right card that
 *     slides in only when a suggestion exists and slides out on
 *     accept/dismiss. Nothing rendered when empty — no persistent rail.
 *   - `sheet` (mobile <lg): bottom drawer opened by the floating pill.
 *
 * Suppressed entirely when the latest turn was a crisis.
 *
 * The visual language follows the chat's existing surface tokens
 * (--accent-sage / --warmth-50) rather than the Sanctuary palette, since
 * AmbienceProvider doesn't currently wrap the chat surface. If/when it
 * does, this card will inherit ambient colors automatically.
 */
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMindGymTool, type ActivitySuggestion } from "@/lib/chat/activitySuggestion";
import type { SuggestionHistoryItem } from "@/hooks/useActivitySuggestion";
import { cn } from "@/lib/utils";

interface ActivitySuggestionPanelProps {
  current: ActivitySuggestion | null;
  history: SuggestionHistoryItem[];
  urgency: number;
  onAccept: (s: ActivitySuggestion) => void;
  onDismiss: (s: ActivitySuggestion) => void;
  /** Mobile drawer state — owned by the parent so the pill can open it. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  /** `floating` = desktop bottom-right popup; `sheet` = mobile drawer. */
  variant?: "floating" | "sheet";
  className?: string;
}

export default function ActivitySuggestionPanel(props: ActivitySuggestionPanelProps) {
  const variant = props.variant ?? "floating";

  // Crisis kill switch (defense-in-depth — the hook also clears state on crisis).
  if (props.urgency === 3) return null;

  if (variant === "sheet") {
    return (
      <Sheet open={!!props.mobileOpen} onOpenChange={(open) => props.onMobileOpenChange?.(open)}>
        <SheetContent side="bottom" className="rounded-t-3xl border-t border-border p-0">
          <SheetHeader className="px-5 pt-5 pb-2">
            <SheetTitle className="text-base font-medium text-ink-7">
              <ActivitySuggestionHeading />
            </SheetTitle>
          </SheetHeader>
          <div className="px-5 pb-8 space-y-4">
            <PanelBody {...props} compact />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className={cn(
        "hidden lg:block fixed z-30 right-6 bottom-6 w-[22rem] pointer-events-none",
        props.className,
      )}
      aria-label="Suggested activity"
    >
      <AnimatePresence mode="popLayout">
        {props.current && (
          <motion.div
            key={props.current.activity_id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto shadow-lg rounded-2xl"
            role="status"
            aria-live="polite"
          >
            <PrimaryCard
              suggestion={props.current}
              onAccept={props.onAccept}
              onDismiss={props.onDismiss}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActivitySuggestionHeading() {
  const { t } = useTranslation("sanctuary");
  return <>{t("activitySuggestion.heading", "for you now")}</>;
}

function PanelBody({
  current,
  history,
  onAccept,
  onDismiss,
  compact = false,
}: ActivitySuggestionPanelProps & { compact?: boolean }) {
  const { t } = useTranslation("sanctuary");

  if (!current && history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t("activitySuggestion.empty", "nothing to suggest yet — keep going")}
      </p>
    );
  }

  return (
    <>
      <AnimatePresence mode="popLayout">
        {current && (
          <motion.div
            key={current.activity_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
          >
            <PrimaryCard suggestion={current} onAccept={onAccept} onDismiss={onDismiss} compact={compact} />
          </motion.div>
        )}
      </AnimatePresence>

      {history.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-2 mt-2">
            {t("activitySuggestion.recently", "recently shown")}
          </p>
          <div className="flex flex-wrap gap-2">
            {history
              .filter((item) => item.suggestion.activity_id !== current?.activity_id)
              .map((item) => (
                <HistoryChip
                  key={`${item.suggestion.activity_id}-${item.shown_at}`}
                  item={item}
                  onAccept={onAccept}
                />
              ))}
          </div>
        </div>
      )}
    </>
  );
}

function PrimaryCard({
  suggestion,
  onAccept,
  onDismiss,
  compact,
}: {
  suggestion: ActivitySuggestion;
  onAccept: (s: ActivitySuggestion) => void;
  onDismiss: (s: ActivitySuggestion) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation("sanctuary");
  const tool = getMindGymTool(suggestion.activity_id);
  const Icon = tool?.icon;
  const minutes = suggestion.minutes ?? tool?.minutes;
  const section = suggestion.section ?? tool?.section;

  return (
    <div className="rounded-2xl bg-[hsl(var(--warmth-50))] p-4 shadow-sm border border-border/40">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-background/70 shrink-0">
            <Icon className="w-5 h-5 text-ink-7" aria-hidden="true" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-background/70 shrink-0">
            <span className="text-base">✦</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink-9 leading-tight">{suggestion.title}</p>
          <p className="text-[12px] text-ink-5 mt-0.5">
            {[minutes ? `${minutes} min` : null, section ? `· ${section}` : null]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(suggestion)}
          className="text-ink-5 hover:text-ink-7 transition-colors p-1 -m-1"
          aria-label={t("activitySuggestion.dismissAria", "dismiss suggestion")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className={cn("flex gap-2 mt-4", compact ? "flex-col" : "")}>
        <button
          type="button"
          onClick={() => onAccept(suggestion)}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-background text-sm font-medium px-3.5 py-2",
            "hover:opacity-90 transition-opacity",
            compact ? "w-full" : "flex-1",
          )}
        >
          {t("activitySuggestion.beginCta", "begin")}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDismiss(suggestion)}
          className={cn(
            "inline-flex items-center justify-center rounded-xl text-sm font-medium px-3.5 py-2 text-ink-7",
            "hover:bg-background/60 transition-colors",
            compact ? "w-full" : "",
          )}
        >
          {t("activitySuggestion.dismissCta", "not now")}
        </button>
      </div>
    </div>
  );
}

function HistoryChip({
  item,
  onAccept,
}: {
  item: SuggestionHistoryItem;
  onAccept: (s: ActivitySuggestion) => void;
}) {
  const tool = getMindGymTool(item.suggestion.activity_id);
  const Icon = tool?.icon;
  const isDismissed = item.status === "dismissed";
  return (
    <button
      type="button"
      onClick={() => onAccept(item.suggestion)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[12px]",
        "hover:bg-background/90 transition-colors",
        isDismissed ? "opacity-60" : "",
      )}
      title={item.suggestion.title}
    >
      {Icon ? <Icon className="w-3.5 h-3.5 text-ink-7" aria-hidden="true" /> : null}
      <span className="truncate max-w-[10rem]">{item.suggestion.title}</span>
    </button>
  );
}

/* Floating pill that opens the mobile sheet. Rendered by ChatGPTInterface on <lg. */
export function ActivitySuggestionPill({
  current,
  onOpen,
}: {
  current: ActivitySuggestion | null;
  onOpen: () => void;
}) {
  const { t } = useTranslation("sanctuary");
  if (!current) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "lg:hidden fixed z-30 left-1/2 -translate-x-1/2",
        "bottom-[calc(5rem+env(safe-area-inset-bottom))]",
        "inline-flex items-center gap-2 rounded-full bg-foreground text-background",
        "px-4 py-2 text-[13px] shadow-md hover:opacity-90",
      )}
      aria-label={t("activitySuggestion.pillAria", "open suggested activity")}
    >
      <span className="opacity-70">{t("activitySuggestion.pillPrefix", "for you")}</span>
      <span className="font-medium truncate max-w-[12rem]">{current.title}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}
