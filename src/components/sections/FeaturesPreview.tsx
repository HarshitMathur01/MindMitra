import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Puzzle, BarChart, Globe, ArrowRight, MessageCircle, Brain, BookOpen, Users, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useIntersectionObserver } from '@/hooks/useScrollAnimations';

const FeaturesPreview = () => {
  const navigate = useNavigate();
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const features = [
    {
      icon: MessageCircle,
      title: "AI Therapy Companion",
      description: "Professional psychology support with CBT, ACT, and MBCT techniques, delivered like a caring friend who understands Indian culture.",
      gradient: "from-blue-400 to-purple-600",
      action: () => navigate("/chat"),
      actionText: "Start Chatting",
      comingSoon: false,
    },
    {
      icon: Puzzle,
      title: "Mindfulness Games",
      description: "Interactive wellness activities designed to reduce stress, improve focus, and build emotional resilience through play.",
      gradient: "from-green-400 to-blue-500",
      action: () => navigate("/games"),
      actionText: "Play Games",
      comingSoon: false,
    },
    {
      icon: BarChart,
      title: "Wellness Check-ins",
      description: "Regular mood tracking and progress monitoring to understand your mental health journey and celebrate growth.",
      gradient: "from-purple-400 to-pink-600",
      action: () => navigate("/wellness-checkin"),
      actionText: "Check Progress",
      comingSoon: false,
    },
    {
      icon: Stethoscope,
      title: "Therapist Bridge",
      description: "Get a warm referral to a licensed therapist who understands Indian culture. Your emotional profile is shared securely with consent.",
      gradient: "from-orange-400 to-rose-500",
      action: () => navigate("/therapist-bridge"),
      actionText: "Connect Now",
      comingSoon: false,
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cardRefs.current.findIndex(ref => ref === entry.target);
            if (index !== -1 && !visibleCards.includes(index)) {
              setTimeout(() => {
                setVisibleCards(prev => [...prev, index]);
              }, index * 200); // Stagger animation
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    cardRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [visibleCards]);

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/30 to-purple-50/30"></div>
      <div className="absolute top-10 right-10 w-40 h-40 bg-gradient-to-r from-blue-200/10 to-purple-200/10 rounded-full"></div>
      <div className="absolute bottom-20 left-10 w-32 h-32 bg-gradient-to-r from-green-200/10 to-blue-200/10 rounded-full"></div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-6">
            Your Mental Wellness Toolkit
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Comprehensive support designed specifically for Indian youth, combining professional psychology with cultural understanding
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              ref={el => cardRefs.current[index] = el}
              className={`transform transition-all duration-700 ease-out ${visibleCards.includes(index)
                  ? 'translate-y-0 opacity-100 scale-100'
                  : 'translate-y-8 opacity-0 scale-95'
                }`}
            >
              <Card className="wellness-card group cursor-pointer h-full" onClick={feature.action}>
                <CardContent className="p-6 text-center h-full flex flex-col">
                  {/* Icon with Gentle Hover Effect */}
                  <div className="mb-6">
                    <div className={`mx-auto w-16 h-16 rounded-full bg-gradient-to-r ${feature.gradient} flex items-center justify-center text-2xl transform transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg`}>
                      <feature.icon className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-grow">
                    <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-gradient transition-all duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                      {feature.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  <Button
                    className={`w-full bg-gradient-to-r ${feature.gradient} hover:shadow-lg transform transition-all duration-300 group-hover:scale-105 text-white border-0`}
                    onClick={(e) => {
                      e.stopPropagation();
                      feature.action();
                    }}
                  >
                    {feature.actionText}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>


      </div>
    </section>
  );
};

export default FeaturesPreview;
