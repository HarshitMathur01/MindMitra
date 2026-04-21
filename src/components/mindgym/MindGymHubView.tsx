import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import ForestBackdrop from "./ForestBackdrop";
import CrisisOverlay from "./CrisisOverlay";
import {
  MINDGYM_SECTIONS,
  MINDGYM_TOOLS,
  getToolsBySection,
} from "@/lib/mindgym/catalog";
import { getDailyRecommendation } from "@/lib/mindgym/storage";
import { cn } from "@/lib/utils";

const eyebrow = "text-[13px] font-medium uppercase tracking-[0.28em] text-[#9a4a2a] sm:text-[14px]";

export default function MindGymHubView() {
  const navigate = useNavigate();
  const [crisisOpen, setCrisisOpen] = useState(false);

  const recommendedId = useMemo(() => getDailyRecommendation(), []);
  const recommended = MINDGYM_TOOLS.find((t) => t.id === recommendedId);

  return (
    <div className="mindgym-root relative isolate min-h-screen overflow-hidden">
      <ForestBackdrop variant="faded" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="px-4 pt-6 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] text-[#5b4a3e] transition-colors hover:text-[#2a1c14]"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
            Home
          </button>
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <p className={eyebrow}>A quiet practice</p>
            <h1 className="mt-3 font-serif-display text-[clamp(2.5rem,6.5vw,4.5rem)] font-light leading-[0.98] tracking-tight text-[#2a1c14]">
              Mind Gym
            </h1>
            <div className="mx-auto mt-5 h-px w-14 bg-gradient-to-r from-transparent via-[#b08a6a] to-transparent" />
            <p className="mx-auto mt-5 max-w-md bg-transparent px-0 py-0 text-[18px] leading-[1.7] text-[#f8f3eb] [text-shadow:0_2px_10px_rgba(0,0,0,0.45)]">
              Pick something small. Two minutes is enough.
            </p>
          </motion.section>

          {recommended ? (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-12 max-w-3xl"
            >
              <div className="group relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-[#f7efdf]/80 p-7 shadow-[0_14px_44px_rgba(80,60,40,0.07)] backdrop-blur-md sm:p-10">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(255, 180, 140, 0.28) 0%, rgba(255, 180, 140, 0) 70%)",
                  }}
                />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={eyebrow}>Today's invitation</p>
                    <h2 className="mt-3 font-serif-display text-[2rem] font-light leading-tight text-[#2a1c14] sm:text-[2.4rem]">
                      {recommended.title}
                    </h2>
                    <p className="mt-3 max-w-lg text-[14.5px] leading-[1.7] text-[#5b4a3e]">
                      {recommended.shortDesc}
                    </p>
                    <Button
                      onClick={() => navigate(`/mindgym/${recommended.id}`)}
                      className="mt-6 rounded-full bg-[#4f6b3f] px-6 py-5 text-[14px] font-medium text-white shadow-[0_6px_20px_rgba(79,107,63,0.28)] hover:bg-[#3f5833]"
                    >
                      Begin · {recommended.minutes} min
                    </Button>
                  </div>

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#4f6b3f] shadow-sm ring-1 ring-black/5">
                    <recommended.icon className="h-8 w-8" strokeWidth={1.4} />
                  </div>
                </div>
              </div>
            </motion.section>
          ) : null}

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-24 text-center"
          >
            <p className={eyebrow}>The library</p>
            <h2 className="mt-3 font-serif-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-light text-[#2a1c14]">
              Choose a section
            </h2>
            <div className="mx-auto mt-4 h-px w-10 bg-gradient-to-r from-transparent via-[#b08a6a]/70 to-transparent" />
            <p className="mt-4 text-[13.5px] text-[#7a6556]">
              Each holds a small set of practices.
            </p>
          </motion.section>

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } },
            }}
            className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {MINDGYM_SECTIONS.map((section) => {
              const tools = getToolsBySection(section.id);
              const Icon = tools[0]?.icon;
              const wellTone =
                section.tone === "sage"
                  ? "bg-[#d8e4cf] text-[#4f6b3f]"
                  : "bg-[#f3d9c8] text-[#b2613a]";

              return (
                <motion.button
                  key={section.id}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 70, damping: 22 },
                    },
                  }}
                  type="button"
                  onClick={() => navigate(`/mindgym/section/${section.id}`)}
                  className={cn(
                    "group relative flex items-start gap-4 overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/70 p-6 text-left shadow-[0_4px_20px_rgba(80,60,40,0.05)] backdrop-blur-md transition-all duration-300",
                    "hover:-translate-y-0.5 hover:bg-white/88 hover:shadow-[0_12px_30px_rgba(80,60,40,0.09)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5",
                      wellTone,
                    )}
                  >
                    {Icon ? <Icon className="h-5 w-5" strokeWidth={1.7} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif-display text-[1.3rem] font-normal leading-tight text-[#2a1c14]">
                        {section.title}
                      </h3>
                      <ArrowUpRight
                        className="mt-1 h-4 w-4 shrink-0 text-[#9a8674] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        strokeWidth={1.8}
                      />
                    </div>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[#7a6556]">
                      {section.blurb}
                    </p>
                    <p className="mt-3 text-[10.5px] font-medium uppercase tracking-[0.16em] text-[#9a8674]">
                      {tools.length} {tools.length === 1 ? "exercise" : "exercises"}
                    </p>
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
