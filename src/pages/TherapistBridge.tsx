import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import TherapistBridgeLanding from "@/components/therapist-bridge/TherapistBridgeLanding";
import { Hero } from "@/components/therapist-bridge/Hero";
import { EmotionalProfileSection } from "@/components/therapist-bridge/EmotionalProfile";
import { ClinicalActions } from "@/components/therapist-bridge/ClinicalActions";
import { IntakeForm } from "@/components/therapist-bridge/IntakeForm";
import { ConsentForm } from "@/components/therapist-bridge/ConsentForm";
import { ProcessTimeline } from "@/components/therapist-bridge/ProcessTimeline";
import { HandoffExplainer } from "@/components/therapist-bridge/HandoffExplainer";
import { BookingModal } from "@/components/therapist-bridge/BookingModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import {
  defaultConsent,
  defaultIntake,
  minimumConsent,
  type ConsentState,
  type IntakePrefs,
  type Therapist,
} from "@/lib/mock/therapist-bridge";

const TherapistDirectory = lazy(
  () => import("@/components/therapist-bridge/TherapistDirectory"),
);
const DataPreviewModal = lazy(
  () => import("@/components/therapist-bridge/DataPreviewModal"),
);

const ENTERED_KEY = "mindmitra_therapist_bridge_entered_session";

function Section({
  id,
  eyebrow,
  title,
  children,
  innerRef,
}: {
  id: string;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  innerRef?: Ref<HTMLElement>;
}) {
  return (
    <section id={id} ref={innerRef} className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      {(eyebrow || title) && (
        <div className="mb-8">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </p>
          )}
          {title && (
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

const TherapistBridge = () => {
  const profileRef = useRef<HTMLElement | null>(null);
  const directoryRef = useRef<HTMLElement | null>(null);
  const consentRef = useRef<HTMLElement | null>(null);

  const [prefs, setPrefs] = useState<IntakePrefs>(defaultIntake);
  const [consent, setConsent] = useState<ConsentState>(defaultConsent);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [pendingTherapist, setPendingTherapist] = useState<Therapist | null>(null);
  const [entered, setEntered] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(ENTERED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const handleEnter = useCallback(() => {
    try {
      sessionStorage.setItem(ENTERED_KEY, "1");
    } catch {
      /* ignore */
    }
    setEntered(true);
  }, []);

  useEffect(() => {
    document.title = "Therapist Bridge — MindMitra";
  }, []);

  const scrollTo = useCallback((ref: RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleBook = useCallback(
    (t: Therapist) => {
      setPendingTherapist(t);
      if (!minimumConsent(consent)) {
        toast("One small step first", {
          description: "Let your therapist see a snapshot and how to reach you, and we're set.",
        });
        scrollTo(consentRef);
        return;
      }
      setBookingOpen(true);
    },
    [consent, scrollTo],
  );

  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div
          key="tb-landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <TherapistBridgeLanding onEnter={handleEnter} />
        </motion.div>
      ) : (
        <motion.main
          key="tb-hub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-screen bg-background"
        >
          <Toaster richColors position="top-center" />

          <Hero
        onProfile={() => scrollTo(profileRef)}
        onFind={() => scrollTo(directoryRef)}
      />

      <Section
        id="profile"
        eyebrow="Your signal"
        title="Emotional profile"
        innerRef={profileRef}
      >
        <div className="space-y-4">
          <EmotionalProfileSection />
          <ClinicalActions onPreview={() => setPreviewOpen(true)} />
        </div>
      </Section>

      <Section id="intake" eyebrow="Step 1" title="Intake preferences">
        <IntakeForm onApply={setPrefs} />
      </Section>

      <Section
        id="directory"
        eyebrow="Step 2"
        title="Matched therapists"
        innerRef={directoryRef}
      >
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          }
        >
          <TherapistDirectory prefs={prefs} onBook={handleBook} />
        </Suspense>
      </Section>

      <Section
        id="consent"
        eyebrow="Step 3"
        title="Your consent"
        innerRef={consentRef}
      >
        <ConsentForm consent={consent} onChange={setConsent} />
      </Section>

      <Section id="process" eyebrow="The flow" title="From signal to session">
        <ProcessTimeline />
      </Section>

      <Section id="handoff" eyebrow="Transparency" title="What gets handed off">
        <HandoffExplainer />
      </Section>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-10 text-center text-xs text-muted-foreground">
          MindMitra · Therapist Bridge demo. All data shown is illustrative.
        </div>
      </footer>

      <Suspense fallback={null}>
        {previewOpen && (
          <DataPreviewModal
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            consent={consent}
          />
        )}
      </Suspense>

      <BookingModal
        therapist={pendingTherapist}
        open={bookingOpen}
        onOpenChange={setBookingOpen}
      />
        </motion.main>
      )}
    </AnimatePresence>
  );
};

export default TherapistBridge;
