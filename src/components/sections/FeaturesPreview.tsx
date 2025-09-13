import React, { useRef, useEffect, useState } from 'react';
import { MessageSquare, Puzzle, BarChart, Globe, ArrowRight, MessageCircle, Brain, BookOpen, Users } from 'lucide-react';
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
      icon: Brain,
      title: "Cultural Sensitivity",
      description: "Designed specifically for Indian youth, understanding family dynamics, academic pressure, and cultural contexts.",
      gradient: "from-orange-400 to-red-500",
      action: () => navigate("/chat"),
      actionText: "Learn More",
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
              className={`transform transition-all duration-700 ease-out ${
                visibleCards.includes(index)
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

        {/* Additional Features Row */}
        <motion.div 
          className="mt-16 grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
        >
          {/* Psychological Assessment */}
          <Card className="wellness-card group cursor-pointer" onClick={() => navigate("/qa-tests")}>
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-indigo-400 to-cyan-500 rounded-full flex items-center justify-center breathing-pulse">
                <BookOpen className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 group-hover:text-gradient transition-all duration-300">
                Psychological Assessments
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Take scientifically-backed personality tests and psychological assessments to better understand yourself and your mental health patterns.
              </p>
              <Button 
                className="bg-gradient-to-r from-indigo-500 to-cyan-600 hover:shadow-lg transform transition-all duration-300 group-hover:scale-105 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/qa-tests");
                }}
              >
                Take Assessment
              </Button>
            </CardContent>
          </Card>

          {/* Community Support */}
          <Card className="wellness-card group">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-pink-400 to-rose-500 rounded-full flex items-center justify-center breathing-pulse">
                <Users className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-4 group-hover:text-gradient transition-all duration-300">
                Community Support
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Connect with others on similar journeys in a safe, moderated community environment designed for Indian youth mental wellness.
              </p>
              <Button 
                variant="outline"
                className="border-2 border-pink-300 text-pink-600 hover:bg-pink-50 transform transition-all duration-300 group-hover:scale-105"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom CTA Section */}
        <motion.div 
          className="text-center mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="glass rounded-2xl p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Ready to Begin Your Healing Journey?
            </h3>
            <p className="text-muted-foreground mb-6 text-lg">
              Join thousands of Indian youth who have found support, understanding, and growth through MindMate
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                onClick={() => navigate("/chat")}
                className="group px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-full transition-all duration-300 ease-out transform hover:scale-105 hover:shadow-lg"
              >
                Start Free Session
              </Button>
              <Button 
                onClick={() => navigate("/games")}
                variant="outline"
                className="px-8 py-3 border-2 border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 font-semibold rounded-full transition-all duration-300 ease-out transform hover:scale-105 bg-white/50"
              >
                Explore Activities
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesPreview;
