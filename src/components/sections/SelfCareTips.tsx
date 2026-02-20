import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, Moon, Dumbbell, BookOpen, Music, Leaf, Users, Palette, ChevronLeft, ChevronRight } from 'lucide-react';

const tips = [
    {
        icon: Droplets,
        title: 'Stay Hydrated',
        description: 'Dehydration can worsen anxiety and fatigue. Keep a water bottle nearby and aim for 8 glasses a day.',
        color: 'from-cyan-400 to-blue-500',
        bg: 'bg-cyan-50',
    },
    {
        icon: Moon,
        title: 'Prioritize Sleep',
        description: 'Sleep is when your brain processes emotions. Try a calming routine: no screens 30 minutes before bed.',
        color: 'from-indigo-400 to-purple-500',
        bg: 'bg-indigo-50',
    },
    {
        icon: Dumbbell,
        title: 'Move Your Body',
        description: 'Even a 10-minute walk releases endorphins. You don\'t need a gym — just get moving however feels good.',
        color: 'from-orange-400 to-red-500',
        bg: 'bg-orange-50',
    },
    {
        icon: BookOpen,
        title: 'Journal Your Thoughts',
        description: 'Writing for just 5 minutes a day can reduce stress and help you understand your emotions better.',
        color: 'from-amber-400 to-yellow-500',
        bg: 'bg-amber-50',
    },
    {
        icon: Music,
        title: 'Listen to Calming Music',
        description: 'Music at 60 BPM can reduce heart rate and anxiety. Create a "calm" playlist for stressful moments.',
        color: 'from-pink-400 to-rose-500',
        bg: 'bg-pink-50',
    },
    {
        icon: Leaf,
        title: 'Spend Time in Nature',
        description: 'Even 20 minutes outdoors can lower cortisol. Find a park bench, garden, or just stand in sunlight.',
        color: 'from-green-400 to-emerald-500',
        bg: 'bg-green-50',
    },
    {
        icon: Users,
        title: 'Connect With Someone',
        description: 'Share how you\'re feeling with a friend, family member, or MindMitra. Connection is healing.',
        color: 'from-violet-400 to-purple-500',
        bg: 'bg-violet-50',
    },
    {
        icon: Palette,
        title: 'Express Creatively',
        description: 'Art, doodling, cooking, or crafting — creative expression helps process emotions you can\'t put into words.',
        color: 'from-fuchsia-400 to-pink-500',
        bg: 'bg-fuchsia-50',
    },
];

const SelfCareTips = () => {
    const [currentPage, setCurrentPage] = useState(0);
    const tipsPerPage = 4;
    const totalPages = Math.ceil(tips.length / tipsPerPage);

    const currentTips = tips.slice(currentPage * tipsPerPage, (currentPage + 1) * tipsPerPage);

    const nextPage = () => setCurrentPage((p) => (p + 1) % totalPages);
    const prevPage = () => setCurrentPage((p) => (p - 1 + totalPages) % totalPages);

    // Auto-rotate
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentPage((p) => (p + 1) % totalPages);
        }, 8000);
        return () => clearInterval(timer);
    }, [totalPages]);

    return (
        <section className="py-16 relative overflow-hidden">
            {/* Subtle background */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-50/20 to-transparent" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-full text-sm text-green-700 font-medium mb-4 border border-green-200/50">
                        <Leaf className="h-4 w-4" />
                        Daily Self-Care
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gradient mb-3">
                        Small Steps, Big Impact
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Simple evidence-based self-care practices you can start right now
                    </p>
                </motion.div>

                {/* Tips Grid with Navigation */}
                <div className="relative max-w-5xl mx-auto">
                    <button
                        onClick={prevPage}
                        className="absolute -left-2 md:-left-12 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                        <ChevronLeft className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                        onClick={nextPage}
                        className="absolute -right-2 md:-right-12 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                        <ChevronRight className="h-4 w-4 text-gray-600" />
                    </button>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentPage}
                            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.4 }}
                        >
                            {currentTips.map((tip, i) => (
                                <motion.div
                                    key={`${currentPage}-${i}`}
                                    className={`${tip.bg} rounded-2xl p-5 border border-white/60 hover:shadow-lg transition-all duration-300 group cursor-default`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    whileHover={{ y: -4 }}
                                >
                                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tip.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm`}>
                                        <tip.icon className="h-5 w-5 text-white" />
                                    </div>
                                    <h3 className="font-semibold text-gray-800 mb-2 text-sm">{tip.title}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">{tip.description}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </AnimatePresence>

                    {/* Page dots */}
                    <div className="flex justify-center gap-2 mt-8">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`w-2 h-2 rounded-full transition-all ${i === currentPage ? 'bg-green-500 w-6' : 'bg-gray-300 hover:bg-gray-400'
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SelfCareTips;
