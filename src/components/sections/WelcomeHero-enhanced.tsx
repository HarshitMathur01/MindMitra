import { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Shield, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const WelcomeHero = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Calming background themes for slideshow
  const heroSlides = [
    {
      gradient: "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
      title: "Welcome to MindMate",
      subtitle: "Your personal AI-powered psychological assistant for mental wellness"
    },
    {
      gradient: "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50", 
      title: "Break the Silence, Find Your Voice",
      subtitle: "Professional psychological support that understands your cultural context"
    },
    {
      gradient: "bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50",
      title: "You're Not Alone in This Journey",
      subtitle: "Compassionate AI companion trained in CBT, ACT, and mindfulness techniques"
    }
  ];

  useEffect(() => {
    setIsVisible(true);
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(slideInterval);
  }, []);

  return (
    <section className="relative py-20 overflow-hidden min-h-screen flex items-center">
      {/* Animated Background Slideshow */}
      {heroSlides.map((slide, index) => (
        <motion.div
          key={index}
          className={`absolute inset-0 ${slide.gradient}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ 
            opacity: currentSlide === index ? 1 : 0,
            scale: currentSlide === index ? 1 : 1.05
          }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />
      ))}

      {/* Background decoration with breathing animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="breathing-circle absolute top-10 right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        <div className="breathing-circle-delayed absolute bottom-20 left-20 w-40 h-40 bg-accent/10 rounded-full blur-3xl" />
        <div className="breathing-circle absolute top-1/3 left-10 w-24 h-24 bg-blue-200/30 rounded-full" />
        <div className="breathing-circle-delayed absolute bottom-1/3 right-10 w-28 h-28 bg-purple-200/20 rounded-full" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div 
            className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 hover-lift"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Sparkles className="h-4 w-4" />
            AI-Powered Psychology Hub
          </motion.div>

          {/* Dynamic Title with Slide Content */}
          <motion.h1 
            className="text-5xl md:text-6xl font-bold mb-6 text-gradient"
            key={currentSlide}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {heroSlides[currentSlide].title}
          </motion.h1>
          
          {/* Dynamic Subtitle */}
          <motion.p 
            className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed"
            key={`subtitle-${currentSlide}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {heroSlides[currentSlide].subtitle}
          </motion.p>

          {/* Breathing Indicator */}
          <motion.div 
            className="flex justify-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <div className="breathing-focus w-16 h-16 border-2 border-primary/50 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-primary/50 rounded-full breathing-pulse"></div>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Button 
              size="lg" 
              className="gradient-primary hover-glow text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300"
              onClick={() => navigate("/chat")}
            >
              Start Chatting
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-6 hover-lift bg-white/50 backdrop-blur-sm transform hover:scale-105 transition-all duration-300"
              onClick={() => navigate("/games")}
            >
              Explore Features
            </Button>
          </motion.div>

          {/* Feature Cards with staggered animation */}
          <motion.div 
            className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            {[
              {
                icon: Shield,
                title: "Safe & Confidential",
                description: "Your conversations are secure and private, creating a safe space for exploration.",
                delay: 0
              },
              {
                icon: Heart,
                title: "Culturally Aware",
                description: "Designed specifically for Indian youth, understanding cultural contexts and family dynamics.",
                delay: 0.1
              },
              {
                icon: Sparkles,
                title: "Interactive Learning",
                description: "Engage with wellness games, personality tests, and therapeutic activities.",
                delay: 0.2
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 + feature.delay }}
              >
                <Card className="wellness-card p-6 hover-lift bg-card/50 backdrop-blur-sm border-primary/20 h-full">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 mx-auto breathing-pulse">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Trust Indicators */}
          <motion.div 
            className="mt-12 flex justify-center space-x-8 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.4 }}
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Confidential & Safe</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              <span>Cultural Sensitivity</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span>Professional Support</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              currentSlide === index 
                ? 'bg-primary shadow-lg scale-125' 
                : 'bg-primary/30 hover:bg-primary/60'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

export default WelcomeHero;
