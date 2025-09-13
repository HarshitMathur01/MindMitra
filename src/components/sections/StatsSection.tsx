import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageCircle, TrendingUp, Heart } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/scroll-progress';
import { useIntersectionObserver } from '@/hooks/useScrollAnimations';

const statistics = [
  {
    icon: Users,
    value: 1250,
    suffix: "+",
    label: "Students Helped",
    description: "Indian youth finding their mental wellness path"
  },
  {
    icon: MessageCircle,
    value: 5240,
    suffix: "+",
    label: "Therapy Sessions",
    description: "Meaningful conversations and breakthroughs"
  },
  {
    icon: TrendingUp,
    value: 89,
    suffix: "%",
    label: "Improvement Rate",
    description: "Users report better mental health"
  },
  {
    icon: Heart,
    value: 98,
    suffix: "%",
    label: "Satisfaction Score",
    description: "Trust and positive feedback from our community"
  }
];

const StatsSection = () => {
  const [sectionRef, sectionInView] = useIntersectionObserver({ 
    threshold: 0.3, 
    triggerOnce: true 
  });

  return (
    <section ref={sectionRef} className="py-20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-50/50 via-purple-50/50 to-pink-50/50"></div>
      <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-200/20 to-purple-200/20 rounded-full blur-3xl transform -translate-y-1/2"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={sectionInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <motion.h2 
            className="text-4xl md:text-5xl font-bold text-gradient mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={sectionInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Making a Real Difference
          </motion.h2>
          <motion.p 
            className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={sectionInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Your mental wellness journey is supported by proven results and a growing community of Indian youth finding their path to better mental health.
          </motion.p>
        </motion.div>

        {/* Statistics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {statistics.map((stat, index) => (
            <motion.div
              key={index}
              className="text-center group"
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={sectionInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ 
                duration: 0.8, 
                delay: 0.6 + index * 0.1,
                type: "spring",
                stiffness: 100
              }}
            >
              {/* Icon Container */}
              <motion.div 
                className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300"
                whileHover={{ rotate: 5, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <stat.icon className="h-10 w-10 text-white" />
              </motion.div>

              {/* Counter */}
              <motion.div 
                className="text-4xl md:text-5xl font-bold text-gradient mb-2"
                initial={{ opacity: 0 }}
                animate={sectionInView ? { opacity: 1 } : {}}
                transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
              >
                <AnimatedCounter 
                  value={stat.value} 
                  suffix={stat.suffix}
                  duration={2000 + index * 200}
                />
              </motion.div>

              {/* Label */}
              <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                {stat.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 30 }}
          animate={sectionInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          <motion.p 
            className="text-lg text-muted-foreground mb-6"
            whileHover={{ scale: 1.02 }}
          >
            Join thousands of Indian students on their journey to better mental health
          </motion.p>
          <motion.div
            className="flex justify-center space-x-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={sectionInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 1.8 }}
          >
            <div className="flex -space-x-2">
              {[1,2,3,4,5].map((i) => (
                <motion.div 
                  key={i}
                  className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full border-2 border-white flex items-center justify-center text-white font-semibold text-sm"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={sectionInView ? { scale: 1, rotate: 0 } : {}}
                  transition={{ duration: 0.5, delay: 2 + i * 0.1 }}
                  whileHover={{ scale: 1.2, zIndex: 10 }}
                >
                  {i === 5 ? '👋' : '😊'}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default StatsSection;
