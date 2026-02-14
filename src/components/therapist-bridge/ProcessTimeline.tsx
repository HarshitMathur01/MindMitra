import { Card } from "@/components/ui/card";
import { processSteps } from "@/lib/types/therapist-bridge";

const ProcessTimeline = () => {
  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">What Happens Next</h2>
      <Card className="p-6 shadow-md hover:shadow-lg transition-shadow">
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-primary/30" aria-hidden="true" />
          <div className="space-y-6">
            {processSteps.map((step) => (
              <div key={step.title} className="relative pl-12">
                <span className="absolute left-0 top-0 text-2xl" aria-hidden="true">
                  {step.number}
                </span>
                <h3 className="font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <p>💰 Investment: Rs 1,200-1,800 per session</p>
          <p>⏱️ Typical commitment: 6-8 sessions</p>
          <p>📈 Expected outcome: Measurable improvement</p>
        </div>
      </Card>
    </section>
  );
};

export default ProcessTimeline;