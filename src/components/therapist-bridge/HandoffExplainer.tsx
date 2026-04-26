import { Card, CardContent } from "@/components/ui/card";
import { FileText, Brain, MessageSquare } from "lucide-react";

const cards = [
  {
    icon: FileText,
    title: "Structured summary",
    desc: "A one-page clinician brief with assessments and risk flags.",
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=600&q=70",
  },
  {
    icon: Brain,
    title: "Pattern context",
    desc: "Trends in mood, sleep, and recurring themes from your check-ins.",
    image: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=600&q=70",
  },
  {
    icon: MessageSquare,
    title: "Your own words",
    desc: "Optional excerpts you star — never raw transcripts.",
    image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=70",
  },
];

export function HandoffExplainer() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <Card key={c.title} className="overflow-hidden rounded-2xl border-border/60 tb-shadow-card">
          <img
            src={c.image}
            alt=""
            loading="lazy"
            className="h-32 w-full object-cover"
          />
          <CardContent className="p-6">
            <span className="grid h-10 w-10 place-content-center rounded-xl bg-accent text-accent-foreground">
              <c.icon className="h-5 w-5" />
            </span>
            <h4 className="mt-4 text-base font-semibold text-foreground">{c.title}</h4>
            <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
