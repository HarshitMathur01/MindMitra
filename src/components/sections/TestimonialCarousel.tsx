import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { duration, ease } from "@/lib/motion";

type Note = {
    quote: string;
    attribution: string;
};

const notes: Note[] = [
    {
        quote:
            "It didn't tell me not to stress. It actually helped me sit with why I was stressed in the first place.",
        attribution: "Priya, class 12",
    },
    {
        quote:
            "I didn't want to talk to anyone after my breakup. But talking here at 2 a.m. — something about it made space.",
        attribution: "Sneha, 19",
    },
    {
        quote:
            "It felt culturally aware in a way I didn't know I needed. The part about family pressure — it just got it.",
        attribution: "Arjun, engineering student",
    },
    {
        quote:
            "As a clinician, what I appreciate is how thoughtfully it escalates. It knows when to hand off — and it does so warmly.",
        attribution: "Dr. Kavitha, psychologist",
    },
    {
        quote:
            "I come back because it doesn't try to fix me every time. Sometimes it just lets me be heard.",
        attribution: "Vikram, 24",
    },
];

/**
 * Testimonial — a single overheard voice at a time.
 * No star ratings (performance pressure). No institution logos
 * (status pressure). No filter tabs (choice overload). Just a
 * quiet quote and a first name.
 */
const TestimonialCarousel = () => {
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrent((prev) => (prev + 1) % notes.length);
        }, 7000);
        return () => clearInterval(interval);
    }, []);

    const note = notes[current];

    return (
        <section className="py-24 md:py-32">
            <div className="mx-auto max-w-2xl px-gutter">
                <p className="text-center text-[13.5px] text-ink-6">
                    a few notes from people who've been here
                </p>

                <div className="mt-10 min-h-[220px]">
                    <AnimatePresence mode="wait">
                        <motion.figure
                            key={current}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{
                                duration: duration.long,
                                ease: ease.outExpo,
                            }}
                            className="text-center"
                        >
                            <blockquote className="font-display text-[22px] font-normal leading-[1.5] text-ink-8 md:text-[26px]">
                                &ldquo;{note.quote}&rdquo;
                            </blockquote>
                            <figcaption className="mt-6 text-[13.5px] text-ink-5">
                                — {note.attribution}
                            </figcaption>
                        </motion.figure>
                    </AnimatePresence>
                </div>

                <div className="mt-10 flex justify-center gap-1.5">
                    {notes.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrent(i)}
                            aria-label={`Show note ${i + 1}`}
                            className={`h-1 rounded-full transition-all duration-base ease-out-expo ${
                                i === current
                                    ? "w-8 bg-[hsl(var(--accent-500))]"
                                    : "w-1.5 bg-[hsl(var(--ink-4))]"
                            }`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default TestimonialCarousel;
