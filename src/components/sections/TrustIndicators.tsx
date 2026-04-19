import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, CheckCircle, Award, Stethoscope, GraduationCap } from 'lucide-react';

const TrustIndicators = () => {
    const indicators = [
        {
            icon: Stethoscope,
            text: "Backed by Licensed Therapists",
            color: "text-primary",
            bg: "bg-primary/10",
            border: "border-primary/25"
        },
        {
            icon: Award,
            text: "Clinically Validated Techniques",
            color: "text-violet-600",
            bg: "bg-violet-50",
            border: "border-violet-200"
        },
        {
            icon: Lock,
            text: "End-to-End Encrypted",
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-200"
        },
        {
            icon: GraduationCap,
            text: "Trusted by 50+ Colleges",
            color: "text-orange-600",
            bg: "bg-orange-50",
            border: "border-orange-200"
        },
    ];

    return (
        <section className="py-8 bg-crushed-silk/60 backdrop-blur-sm border-y border-border">
            <div className="container mx-auto px-4">
                <motion.div
                    className="flex flex-wrap justify-center gap-4 md:gap-8"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    viewport={{ once: true }}
                >
                    {indicators.map((item, i) => (
                        <motion.div
                            key={i}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full ${item.bg} border ${item.border} text-sm`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            viewport={{ once: true }}
                            whileHover={{ scale: 1.05 }}
                        >
                            <item.icon className={`h-4 w-4 ${item.color}`} />
                            <span className={`font-medium ${item.color}`}>{item.text}</span>
                            <CheckCircle className={`h-3 w-3 ${item.color}`} />
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
};

export default TrustIndicators;
