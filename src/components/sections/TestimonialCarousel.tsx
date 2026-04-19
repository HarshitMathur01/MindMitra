import { motion } from "framer-motion";
import { DURATION, EASE } from "@/lib/redesign/tokens";

/**
 * "In your words" — typographic quote stack. Replaces the previous
 * star-rating testimonial grid. No headshots, no five-star theatre;
 * just three voices that match the calm direction.
 *
 * Component name kept as `TestimonialCarousel` to preserve the public
 * import path used by `PublicLanding.tsx`.
 */

const voices = [
  {
    quote:
      "It actually remembered what I told it last week. That sounds small but I've never had that with an app.",
    attribution: "Priya, second-year undergrad",
  },
  {
    quote:
      "I open it at 2am instead of doom-scrolling. Within ten minutes my chest feels less tight.",
    attribution: "Arjun, first job",
  },
  {
    quote:
      "When I finally booked a counsellor through MindMitra, she already knew the shape of my month. We skipped the awkward part.",
    attribution: "Sneha, graduate student",
  },
];

const TestimonialCarousel = () => {
  return (
    <section
      id="about"
      className="relative py-20 sm:py-28"
    >
      <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: DURATION.long, ease: EASE.outExpo }}
          className="max-w-2xl"
        >
          <span className="quiet-label">In your words</span>
          <h2 className="mt-4 font-display text-balance text-3xl tracking-tight text-foreground sm:text-4xl">
            Quiet wins, mostly.
          </h2>
        </motion.div>

        <ul className="mt-14 space-y-10 sm:mt-16 sm:space-y-14">
          {voices.map((v, i) => (
            <motion.li
              key={v.attribution}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: DURATION.long,
                delay: i * 0.06,
                ease: EASE.outExpo,
              }}
              className="grid gap-4 border-b border-border/40 pb-10 last:border-b-0 last:pb-0 sm:grid-cols-[auto_1fr] sm:gap-12 sm:pb-14"
            >
              <span className="text-sm tabular text-muted-foreground sm:pt-2">
                0{i + 1}
              </span>
              <div className="max-w-2xl">
                <p className="font-display text-balance text-2xl leading-snug tracking-tight text-foreground sm:text-3xl">
                  &ldquo;{v.quote}&rdquo;
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {v.attribution}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default TestimonialCarousel;
