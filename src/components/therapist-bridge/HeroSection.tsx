import { Button } from "@/components/ui/button";

interface HeroSectionProps {
  onViewProfile: () => void;
  onFindTherapist: () => void;
}

const HeroSection = ({ onViewProfile, onFindTherapist }: HeroSectionProps) => {
  return (
    <section className="mb-12 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/15 to-primary/10 p-6 md:p-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">Ready to Take the Next Step?</h1>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">Connect with a Professional Therapist</h2>
        <p className="text-muted-foreground text-base md:text-lg mb-6">
          Your MindMitra has been supporting you. Now let's connect you with a human expert who can help you go deeper.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" className="transition-all duration-300" onClick={onViewProfile}>
            View My Emotional Profile
          </Button>
          <Button className="gradient-primary hover-glow transition-all duration-300" onClick={onFindTherapist}>
            Find a Therapist
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;