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
import { Toaster } from "@/components/ui/sonner";
import { FadeUp } from "@/components/layout/FadeUp";
import { Eyebrow } from "@/components/layout/Eyebrow";
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
    <section
      id={id}
      ref={innerRef}
      className="mx-auto max-w-[1200px] px-6 py-16 sm:px-8 sm:py-24"
    >
      {(eyebrow || title) && (
        <FadeUp className="mb-12">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          {title && (
            <h2 className="qc-display mt-3 text-4xl text-[#2D2A24] sm:text-5xl">
              {title}
            </h2>
          )}
        </FadeUp>
      )}
      <FadeUp>{children}</FadeUp>
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
          className="qc-canvas relative min-h-screen"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 80% 10%, rgba(232, 201, 176, 0.32) 0%, transparent 60%)",
            }}
          />
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
            <div className="space-y-6">
              <EmotionalProfileSection />
              <ClinicalActions onPreview={() => setPreviewOpen(true)} />
            </div>
          </Section>

          <Section id="intake" eyebrow="Step one" title="Intake preferences">
            <IntakeForm onApply={setPrefs} />
          </Section>

          <Section
            id="directory"
            eyebrow="Step two"
            title="Matched therapists"
            innerRef={directoryRef}
          >
            <Suspense
              fallback={
                <p className="py-16 text-center text-[15px] italic text-[#7A736A]">
                  finding therapists who feel like a fit…
                </p>
              }
            >
              <TherapistDirectory prefs={prefs} onBook={handleBook} />
            </Suspense>
          </Section>

          <Section
            id="consent"
            eyebrow="Step three"
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

          <footer className="border-t border-[rgba(0,0,0,0.04)]">
            <div className="mx-auto max-w-[1200px] px-6 py-16 text-center sm:px-8">
              <p className="qc-display text-2xl text-[#4A4640]">
                <span className="mitra-voice">you stay in control. always.</span>
              </p>
              <p className="mt-6 text-xs tracking-wide text-[#7A736A]">
                MindMitra · Therapist Bridge demo. All data shown is illustrative.
              </p>
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
