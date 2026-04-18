import { Phone, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const helplines = [
  { name: "iCall", info: "Mon–Sat · 8am–10pm", tel: "9152987821" },
  { name: "Vandrevala Foundation", info: "24/7", tel: "18602662345" },
  { name: "AASRA", info: "24/7", tel: "912227546669" },
  { name: "KIRAN", info: "24/7 · Toll-free", tel: "18005990019" },
];
const Footer = ({ className }: { className?: string }) => {
  return (
    <footer className={cn("mx-auto mt-16 max-w-6xl px-4 pb-16 sm:px-6", className)}>
      <div className="overflow-hidden rounded-[2rem] border border-border bg-card/60 p-8 shadow-soft sm:p-12">
        <div className="flex flex-col items-start gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
            <Heart className="h-3 w-3" /> If you need someone
          </span>
          <h3 className="font-display text-3xl text-foreground sm:text-4xl">
            A real human is one call away.
          </h3>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            You don't have to go through this alone. These are free, confidential
            lines staffed by people trained to listen.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {helplines.map((h) => (
            <a
              key={h.name}
              href={`tel:${h.tel}`}
              className="group rounded-2xl border border-border bg-background/60 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-foreground">{h.name}</p>
                <Phone className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{h.info}</p>
              <p className="mt-3 font-display text-lg text-primary">{h.tel}</p>
            </a>
          ))}
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        MindMitra · Made with care · Your words stay here.
      </p>
    </footer>
  );
};

export default Footer;
