import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Sparkles, Shield, Heart, Brain, Send, Mic, Play, MessageCircle, Stethoscope, Lock, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useIntersectionObserver } from "@/hooks/useScrollAnimations";

// Quick demo messages for the hero mini-chat
const miniDemoMessages = [
  { role: 'user' as const, text: "I'm really stressed about my JEE prep..." },
  { role: 'ai' as const, text: "I hear you — JEE prep pressure is intense, especially with family expectations. You're not alone in this. Let's talk about what's weighing on you most. 💙" },
  { role: 'user' as const, text: "My parents keep comparing me to my cousin who got into IIT" },
  { role: 'ai' as const, text: "That comparison can feel so heavy. Your journey is uniquely yours — let me share a technique that helps many students reframe these comparisons... 🌱" },
];

const WelcomeHero = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const [heroRef, heroInView] = useIntersectionObserver({ threshold: 0.3, triggerOnce: true });
  const [demoMsgIndex, setDemoMsgIndex] = useState(0);
  const [autoPlayDemo, setAutoPlayDemo] = useState(true);

  // Calming background themes for slideshow
  const heroSlides = [
    {
      gradient: "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50",
      title: "Your Safe Space to Talk",
      subtitle: "Built for Indian students who understand the pressure"
    },
    {
      gradient: "bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50",
      title: "Break the Silence, Find Your Voice",
      subtitle: "AI companion trained in CBT, ACT & mindfulness — backed by licensed therapists"
    },
    {
      gradient: "bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50",
      title: "You're Not Alone in This Journey",
      subtitle: "Confidential, culturally aware support available 24/7"
    }
  ];

  useEffect(() => {
    setIsVisible(true);
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(slideInterval);
  }, []);

  // Auto-play demo messages
  useEffect(() => {
    if (!autoPlayDemo) return;
    if (demoMsgIndex >= miniDemoMessages.length) {
      const resetTimer = setTimeout(() => setDemoMsgIndex(0), 3000);
      return () => clearTimeout(resetTimer);
    }
    const delay = miniDemoMessages[demoMsgIndex]?.role === 'user' ? 2000 : 3000;
    const timer = setTimeout(() => {
      setDemoMsgIndex(prev => prev + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [demoMsgIndex, autoPlayDemo]);

  return (
    <section ref={heroRef} className="relative py-12 md:py-20 overflow-hidden min-h-screen flex items-center">
      {/* Animated Background Slideshow with Parallax */}
      {heroSlides.map((slide, index) => (
        <motion.div
          key={index}
          className={`absolute inset-0 ${slide.gradient}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{
            opacity: currentSlide === index ? 1 : 0,
            scale: currentSlide === index ? 1 : 1.1
          }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ y: currentSlide === index ? y : 0 }}
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
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl mx-auto">
          {/* Left: Text Content */}
          <motion.div
            className="text-center lg:text-left z-20 relative"
            style={{ opacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: heroInView ? 1 : 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            {/* Cultural Context Badge */}
            <motion.div
              className="inline-flex items-center space-x-2 bg-orange-100/80 backdrop-blur-md rounded-full px-5 py-2 mb-6 border border-orange-200/50"
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: heroInView ? 1 : 0, y: heroInView ? 0 : -20, scale: heroInView ? 1 : 0.9 }}
              transition={{ duration: 0.8, delay: 0.5, type: "spring", stiffness: 100 }}
            >
              <span className="text-lg">🇮🇳</span>
              <span className="text-sm font-medium text-orange-800">Built for Indian students who understand the pressure</span>
            </motion.div>

            {/* Dynamic Title */}
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-gradient leading-tight"
              key={currentSlide}
              initial={{ opacity: 0, y: 50, rotateX: 15 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", type: "spring", stiffness: 80 }}
            >
              {heroSlides[currentSlide].title}
            </motion.h1>

            {/* Dynamic Subtitle */}
            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-6 leading-relaxed"
              key={`subtitle-${currentSlide}`}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3, type: "spring", stiffness: 80 }}
            >
              {heroSlides[currentSlide].subtitle}
            </motion.p>

            {/* Trust Badge Row */}
            <motion.div
              className="flex flex-wrap justify-center lg:justify-start gap-3 mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5 text-xs font-medium text-blue-700">
                <Stethoscope className="h-3 w-3" />
                Backed by Licensed Therapists
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 text-xs font-medium text-green-700">
                <Lock className="h-3 w-3" />
                100% Confidential
              </div>
              <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-3 py-1.5 text-xs font-medium text-purple-700">
                <GraduationCap className="h-3 w-3" />
                Clinically Validated
              </div>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8, type: "spring", stiffness: 100 }}
              >
                <Button
                  size="lg"
                  className="gradient-primary hover-glow text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300"
                  onClick={() => navigate("/chat")}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Start Free Session
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.9, type: "spring", stiffness: 100 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6 hover-lift bg-white/50 backdrop-blur-sm transform hover:scale-105 transition-all duration-300"
                  onClick={() => navigate("/games")}
                >
                  Explore Features
                </Button>
              </motion.div>
            </motion.div>

            {/* Compact Trust Indicators */}
            <motion.div
              className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.2 }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>No signup required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span>Available 24/7</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                <span>Hindi support coming soon</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Phone Mockup with Live Demo */}
          <motion.div
            className="relative mx-auto lg:mx-0"
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: heroInView ? 1 : 0, y: heroInView ? 0 : 40, scale: heroInView ? 1 : 0.9 }}
            transition={{ duration: 1, delay: 0.5, type: "spring" }}
          >
            {/* Phone Frame */}
            <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl max-w-[320px] mx-auto relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-[3rem] blur-xl opacity-60 animate-pulse" />

              {/* Notch */}
              <div className="relative flex justify-center mb-1 z-10">
                <div className="w-20 h-5 bg-gray-900 rounded-b-2xl" />
              </div>

              <div className="bg-white rounded-[2rem] overflow-hidden relative z-10">
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-primary to-accent p-3.5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                      <Brain className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">MindMitra</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
                        <span className="text-[11px] text-white/80">Listening carefully...</span>
                      </div>
                    </div>
                    <div className="text-[10px] bg-white/15 px-2 py-0.5 rounded-full">
                      Using CBT
                    </div>
                  </div>
                </div>

                {/* Demo Messages */}
                <div className="h-[280px] overflow-hidden p-3 space-y-2.5 bg-gray-50/50">
                  <AnimatePresence>
                    {miniDemoMessages.slice(0, demoMsgIndex).map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 15, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.4, type: 'spring' }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm'
                          }`}>
                          {msg.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  {demoMsgIndex < miniDemoMessages.length && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <div className="bg-white rounded-2xl px-3 py-1.5 border border-gray-200 flex items-center gap-1.5">
                        <Heart className="h-2.5 w-2.5 text-pink-400 animate-pulse" />
                        <span className="text-[10px] text-gray-400 italic">
                          {miniDemoMessages[demoMsgIndex]?.role === 'ai' ? 'MindMitra is listening carefully...' : 'typing...'}
                        </span>
                        <div className="flex gap-0.5">
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="p-2.5 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full px-3 py-2 text-[11px] text-gray-400">
                      Type how you're feeling...
                    </div>
                    <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                      <Mic className="h-3 w-3 text-gray-400" />
                    </div>
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center">
                      <Send className="h-3 w-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating labels around phone */}
            <motion.div
              className="absolute -left-4 top-1/4 hidden lg:block"
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border border-blue-200 text-xs text-blue-700 font-medium flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Encrypted & Private
              </div>
            </motion.div>

            <motion.div
              className="absolute -right-4 top-1/2 hidden lg:block"
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border border-orange-200 text-xs text-orange-700 font-medium flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Cultural Context AI
              </div>
            </motion.div>

            <motion.div
              className="absolute -left-8 bottom-1/4 hidden lg:block"
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 0.5 }}
            >
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-lg border border-green-200 text-xs text-green-700 font-medium flex items-center gap-1.5">
                <Heart className="h-3 w-3" />
                Empathy-First Design
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Slide Indicators */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${currentSlide === index
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
