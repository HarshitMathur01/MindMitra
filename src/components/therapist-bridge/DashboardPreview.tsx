import { Card } from "@/components/ui/card";

const DashboardPreview = () => {
  return (
    <section className="mb-12">
      <h2 className="text-2xl md:text-3xl font-bold mb-2">Sample: What Your Therapist Sees</h2>
      <p className="text-muted-foreground mb-6">A focused, structured view of your emotional journey and priorities for first-session planning.</p>

      <Card className="p-6 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
        <div className="relative rounded-xl border bg-card p-5">
          <div className="mb-4 h-32 rounded-lg bg-gradient-to-r from-primary/20 to-accent/20" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <h3 className="font-semibold mb-2">Top 5 Conversation Themes</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Academic Stress</li>
                <li>• Family Pressure</li>
                <li>• Career Anxiety</li>
                <li>• Loneliness</li>
                <li>• Self-Doubt</li>
              </ul>
            </div>
            <div className="rounded-md border p-3">
              <h3 className="font-semibold mb-2">Clinical Snapshot</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• PHQ-9: Moderate depression</li>
                <li>• GAD-7: Moderate anxiety</li>
                <li>• Recommended: CBT + ACT</li>
                <li>• First-session focus: sleep + anxious loops</li>
              </ul>
            </div>
          </div>

          <div className="absolute inset-0 backdrop-blur-sm bg-background/30 pointer-events-none" aria-hidden="true" />
        </div>
      </Card>
    </section>
  );
};

export default DashboardPreview;