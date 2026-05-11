import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Flame, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import ForestBackdrop from "@/components/mindgym/ForestBackdrop";
import CrisisOverlay from "@/components/mindgym/CrisisOverlay";
import {
  MINDGYM_SECTIONS,
  getToolsBySection,
} from "@/lib/mindgym/catalog";
import { SECTION_IDS, type SectionId } from "@/lib/mindgym/types";
import { getStreak, isCompletedToday, loadProgress } from "@/lib/mindgym/storage";
import { cn } from "@/lib/utils";

const eyebrow = "text-[11px] font-medium uppercase tracking-[0.28em] text-[#9a4a2a]";

export default function MindGymSectionPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const navigate = useNavigate();
  const [crisisOpen, setCrisisOpen] = useState(false);

  if (!sectionId || !SECTION_IDS.includes(sectionId as SectionId)) {
    return <Navigate to="/mindgym" replace />;
  }

  const section = MINDGYM_SECTIONS.find((s) => s.id === sectionId)!;
  const tools = getToolsBySection(section.id);
  const doneIds = new Set(loadProgress().completedToday);
  const doneInSection = tools.filter((t) => doneIds.has(t.id)).length;

  return (
    <div className="mindgym-root relative isolate min-h-screen overflow-hidden">
      <ForestBackdrop variant="faded" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="px-4 pt-6 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/mindgym")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] text-[#5b4a3e] transition-colors hover:text-[#2a1c14]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Mind Gym
          </button>
        </div>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4 sm:px-6">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <p className={eyebrow}>{section.blurb}</p>
            <h1 className="mt-3 font-serif-display text-[clamp(2.5rem,6vw,4rem)] font-light leading-[0.98] tracking-tight text-[#2a1c14]">
              {section.title}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-[1.65] text-[#7a6556]">
              {tools.length} {tools.length === 1 ? "practice" : "practices"} — open one when it feels right.
            </p>
            {doneInSection > 0 && (
              <p className="mx-auto mt-3 inline-flex items-center rounded-full bg-[#d8e4cf]/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#4f6b3f] ring-1 ring-[#4f6b3f]/15">
                {doneInSection} of {tools.length} done today
              </p>
            )}
          </motion.section>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
            }}
            className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {tools.map((tool) => {
              const streak = getStreak(tool.id);
              const done = isCompletedToday(tool.id);
              const wellTone =
                section.tone === "sage"
                  ? "bg-[#d8e4cf] text-[#4f6b3f]"
                  : "bg-[#f3d9c8] text-[#b2613a]";

              return (
                <motion.button
                  key={tool.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 70, damping: 22 },
                    },
                  }}
                  type="button"
                  onClick={() => navigate(`/mindgym/${tool.id}`)}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-[1.25rem] border border-white/60 bg-white/75 p-5 text-left shadow-[0_6px_24px_rgba(80,60,40,0.06)] backdrop-blur-sm transition-all",
                    "hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_10px_28px_rgba(80,60,40,0.1)]",
                  )}
                >
                  {done ? (
                    <span className="absolute right-0 top-0 inline-flex items-center rounded-bl-[14px] bg-[#d8e4cf] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#4f6b3f]">
                      Visited today
                    </span>
                  ) : null}

                  <div className="mb-4 flex items-start justify-between">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-black/5",
                        wellTone,
                      )}
                    >
                      <tool.icon className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <span className="rounded-full bg-[#efe6d2] px-2.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#7a6556]">
                      {tool.clinicalTag}
                    </span>
                  </div>

                  <h3 className="font-serif-display text-[1.2rem] font-normal leading-snug text-[#2a1c14]">
                    {tool.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.6] text-[#7a6556]">
                    {tool.shortDesc}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-3 text-[11.5px] text-[#9a8674]">
                    <span>{tool.minutes} min</span>
                    {streak > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[#b2613a]">
                        <Flame className="h-3 w-3" strokeWidth={1.8} />
                        {streak}
                      </span>
                    ) : null}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </main>
      </div>

      <div className="fixed bottom-6 right-6 z-40">
        <Button
          variant="warmth"
          size="sm"
          onClick={() => setCrisisOpen(true)}
          className="flex items-center gap-2 rounded-full shadow-md"
        >
          <Phone className="h-4 w-4" strokeWidth={1.8} />
          If you need someone
        </Button>
      </div>

      <CrisisOverlay open={crisisOpen} onClose={() => setCrisisOpen(false)} />
    </div>
  );
}
