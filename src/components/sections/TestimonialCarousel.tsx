import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote, Star, ChevronLeft, ChevronRight, GraduationCap, Stethoscope } from 'lucide-react';

interface Testimonial {
    quote: string;
    name: string;
    role: string;
    institution: string;
    rating: number;
    type: 'student' | 'therapist';
    avatar: string;
}

const testimonials: Testimonial[] = [
    {
        quote: "MindMitra understood my board exam anxiety better than anyone. It didn't just say 'don't stress' — it actually helped me work through my fear of disappointing my parents.",
        name: "Priya S.",
        role: "Class 12 Student",
        institution: "Delhi Public School",
        rating: 5,
        type: 'student',
        avatar: "PS"
    },
    {
        quote: "I was skeptical about AI therapy, but MindMitra's CBT techniques genuinely helped me manage my college placement stress. It feels like talking to a friend who actually knows psychology.",
        name: "Arjun M.",
        role: "B.Tech Final Year",
        institution: "IIT Bombay",
        rating: 5,
        type: 'student',
        avatar: "AM"
    },
    {
        quote: "As a clinical psychologist, I'm impressed by MindMitra's culturally sensitive approach. It correctly identifies family pressure dynamics unique to Indian students and responds with validated therapeutic techniques.",
        name: "Dr. Kavitha R.",
        role: "Clinical Psychologist",
        institution: "NIMHANS, Bangalore",
        rating: 5,
        type: 'therapist',
        avatar: "KR"
    },
    {
        quote: "After my breakup, I didn't want to talk to anyone. MindMitra was there at 2 AM when I needed someone most. The way it gently guided me through acceptance was remarkable.",
        name: "Sneha K.",
        role: "BSc Psychology, 2nd Year",
        institution: "Christ University",
        rating: 5,
        type: 'student',
        avatar: "SK"
    },
    {
        quote: "MindMitra serves as an excellent first step for students hesitant to seek professional help. Its escalation protocols are well-designed and it knows when to refer to human therapists.",
        name: "Dr. Rajesh P.",
        role: "Psychiatrist & Counselor",
        institution: "Fortis Healthcare",
        rating: 5,
        type: 'therapist',
        avatar: "RP"
    },
    {
        quote: "The way MindMitra handles topics like ragging and peer pressure shows real understanding of the Indian college experience. It even helped me talk to my hostel warden about my issues.",
        name: "Vikram T.",
        role: "MBA First Year",
        institution: "IIM Ahmedabad",
        rating: 4,
        type: 'student',
        avatar: "VT"
    },
];

const TestimonialCarousel = () => {
    const [current, setCurrent] = useState(0);
    const [filter, setFilter] = useState<'all' | 'student' | 'therapist'>('all');
    const [autoPlay, setAutoPlay] = useState(true);

    const filteredTestimonials = filter === 'all'
        ? testimonials
        : testimonials.filter(t => t.type === filter);

    useEffect(() => {
        if (!autoPlay) return;
        const interval = setInterval(() => {
            setCurrent(prev => (prev + 1) % filteredTestimonials.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [autoPlay, filteredTestimonials.length]);

    useEffect(() => {
        setCurrent(0);
    }, [filter]);

    const next = () => {
        setAutoPlay(false);
        setCurrent(prev => (prev + 1) % filteredTestimonials.length);
    };

    const prev = () => {
        setAutoPlay(false);
        setCurrent(prev => (prev - 1 + filteredTestimonials.length) % filteredTestimonials.length);
    };

    const testimonial = filteredTestimonials[current];

    return (
        <section className="py-20 relative overflow-hidden bg-gradient-to-b from-white to-blue-50/30">
            <div className="container mx-auto px-4">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
                        Voices That Matter
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Hear from students and mental health professionals who trust MindMitra
                    </p>
                </motion.div>

                {/* Filter Tabs */}
                <div className="flex justify-center gap-3 mb-10">
                    {[
                        { key: 'all' as const, label: 'All', icon: null },
                        { key: 'student' as const, label: 'Students', icon: GraduationCap },
                        { key: 'therapist' as const, label: 'Therapists', icon: Stethoscope },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${filter === tab.key
                                    ? 'bg-primary text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {tab.icon && <tab.icon className="h-4 w-4" />}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Testimonial Card */}
                <div className="max-w-3xl mx-auto relative">
                    <button
                        onClick={prev}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                        <ChevronLeft className="h-5 w-5 text-gray-600" />
                    </button>

                    <button
                        onClick={next}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
                    >
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                    </button>

                    <AnimatePresence mode="wait">
                        {testimonial && (
                            <motion.div
                                key={`${filter}-${current}`}
                                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -50, scale: 0.95 }}
                                transition={{ duration: 0.4 }}
                                className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-gray-100 relative"
                            >
                                <Quote className="absolute top-6 left-6 h-8 w-8 text-primary/15" />

                                {/* Type badge */}
                                <div className="flex justify-end mb-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${testimonial.type === 'therapist'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-green-100 text-green-700'
                                        }`}>
                                        {testimonial.type === 'therapist' ? '🩺 Therapist Endorsement' : '🎓 Student Review'}
                                    </span>
                                </div>

                                <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-8 italic">
                                    "{testimonial.quote}"
                                </p>

                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${testimonial.type === 'therapist'
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                                            : 'bg-gradient-to-r from-green-500 to-teal-600'
                                        }`}>
                                        {testimonial.avatar}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-gray-900">{testimonial.name}</p>
                                        <p className="text-sm text-gray-500">{testimonial.role} • {testimonial.institution}</p>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`h-4 w-4 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Dots */}
                    <div className="flex justify-center gap-2 mt-6">
                        {filteredTestimonials.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => { setCurrent(i); setAutoPlay(false); }}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === current ? 'bg-primary w-6' : 'bg-gray-300 hover:bg-gray-400'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TestimonialCarousel;
