import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import Header from "@/components/layout/Header";
import HillsFooter from "@/components/layout/HillsFooter";
import PageShell from "@/components/layout/PageShell";
import { PeachBlush } from "@/components/layout/PeachBlush";
import { DURATION, EASE } from "@/lib/redesign/tokens";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <>
      <Header />
      <PageShell width="page" as="main">
        <section className="relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden py-24 text-center sm:py-32">
          <PeachBlush position="top-center" size="md" className="-z-10" />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.long, ease: EASE.outExpo }}
            className="mx-auto max-w-xl"
          >
            <p className="qc-eyebrow">Lost the path</p>
            <h1 className="qc-display mt-4 text-[clamp(2.25rem,5vw,3.25rem)]">
              It's okay to feel lost.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[color:var(--qc-ink-soft)]">
              <span className="mitra-voice">
                The page you were looking for isn't here — but you are.
              </span>{" "}
              Take a slow breath. We'll get you home.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="qc-pill-primary"
              >
                Go home
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/chat")}
                className="qc-pill-outline"
              >
                Talk to Mitra
              </button>
            </div>
          </motion.div>
        </section>
      </PageShell>
      <HillsFooter
        scene="companions"
        message="every wrong turn still leads somewhere."
      />
    </>
  );
};

export default NotFound;
