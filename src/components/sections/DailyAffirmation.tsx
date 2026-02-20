import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, CloudSun, Sparkles, Heart, RefreshCw, Copy, Check } from 'lucide-react';

const affirmations = [
    { text: "You are worthy of love and kindness — especially from yourself.", icon: Heart, theme: 'rose' },
    { text: "Every step forward, no matter how small, is still progress.", icon: Sparkles, theme: 'amber' },
    { text: "It's okay to rest. You don't have to earn your right to take a break.", icon: CloudSun, theme: 'sky' },
    { text: "Your feelings are valid. You don't need to justify how you feel.", icon: Heart, theme: 'violet' },
    { text: "You've survived 100% of your hardest days. You're stronger than you think.", icon: Sparkles, theme: 'emerald' },
    { text: "Healing isn't linear — and that's perfectly okay.", icon: Heart, theme: 'rose' },
    { text: "You are not your thoughts. You are the awareness behind them.", icon: Sun, theme: 'amber' },
    { text: "Asking for help is a sign of strength, not weakness.", icon: CloudSun, theme: 'sky' },
    { text: "Be gentle with yourself — you're doing the best you can.", icon: Heart, theme: 'violet' },
    { text: "This moment is temporary. Brighter days are ahead.", icon: Sun, theme: 'emerald' },
    { text: "You don't have to have it all figured out to move forward.", icon: Sparkles, theme: 'amber' },
    { text: "Your journey is unique — comparison steals joy.", icon: Heart, theme: 'rose' },
];

const themeMap: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    rose: { bg: 'from-rose-50 to-pink-50', border: 'border-rose-200/60', text: 'text-rose-700', glow: 'bg-rose-200/30' },
    amber: { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200/60', text: 'text-amber-700', glow: 'bg-amber-200/30' },
    sky: { bg: 'from-sky-50 to-blue-50', border: 'border-sky-200/60', text: 'text-sky-700', glow: 'bg-sky-200/30' },
    violet: { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200/60', text: 'text-violet-700', glow: 'bg-violet-200/30' },
    emerald: { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200/60', text: 'text-emerald-700', glow: 'bg-emerald-200/30' },
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: 'Good Morning', icon: Sun, emoji: '🌅' };
    if (hour < 17) return { greeting: 'Good Afternoon', icon: CloudSun, emoji: '☀️' };
    return { greeting: 'Good Evening', icon: Moon, emoji: '🌙' };
};

const DailyAffirmation = () => {
    const [index, setIndex] = useState(() => {
        // Pick a deterministic index for today so it feels like a "daily" affirmation
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        return dayOfYear % affirmations.length;
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [copied, setCopied] = useState(false);

    const affirmation = affirmations[index];
    const theme = themeMap[affirmation.theme];
    const { greeting, emoji } = getGreeting();
    const Icon = affirmation.icon;

    const refresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setIndex((prev) => (prev + 1) % affirmations.length);
            setIsRefreshing(false);
        }, 300);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(`"${affirmation.text}" — MindMitra`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="py-10">
            <div className="container mx-auto px-4">
                <motion.div
                    className={`max-w-3xl mx-auto bg-gradient-to-r ${theme.bg} border ${theme.border} rounded-2xl p-6 md:p-8 relative overflow-hidden`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    {/* Background glow */}
                    <div className={`absolute -top-10 -right-10 w-40 h-40 ${theme.glow} rounded-full blur-3xl`} />
                    <div className={`absolute -bottom-10 -left-10 w-32 h-32 ${theme.glow} rounded-full blur-3xl`} />

                    <div className="relative z-10">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">{emoji}</span>
                                <div>
                                    <p className={`text-xs font-medium ${theme.text} opacity-70 uppercase tracking-wider`}>
                                        {greeting} — Today's Affirmation
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <motion.button
                                    onClick={copyToClipboard}
                                    className={`p-2 rounded-full hover:bg-white/60 transition-colors ${theme.text}`}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title={copied ? 'Copied!' : 'Copy affirmation'}
                                >
                                    <AnimatePresence mode="wait">
                                        {copied ? (
                                            <motion.span
                                                key="check"
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Check className="h-4 w-4" />
                                            </motion.span>
                                        ) : (
                                            <motion.span
                                                key="copy"
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <Copy className="h-4 w-4" />
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                                <motion.button
                                    onClick={refresh}
                                    className={`p-2 rounded-full hover:bg-white/60 transition-colors ${theme.text}`}
                                    whileHover={{ rotate: 180 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="New affirmation"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                </motion.button>
                            </div>
                        </div>

                        {/* Affirmation Text */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="flex items-start gap-4"
                            >
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-white/60 flex items-center justify-center ${theme.text}`}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <p className={`text-lg md:text-xl font-medium ${theme.text} leading-relaxed italic`}>
                                    "{affirmation.text}"
                                </p>
                            </motion.div>
                        </AnimatePresence>

                        {/* Subtle separator and take-a-breath CTA */}
                        <div className="mt-5 pt-4 border-t border-white/40 flex items-center justify-between">
                            <p className={`text-xs ${theme.text} opacity-60`}>
                                Take a deep breath. You've got this. 🌿
                            </p>
                            <div className="flex gap-1">
                                {affirmations.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setIndex(i)}
                                        className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? `${theme.text} bg-current scale-125` : 'bg-gray-300/50'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default DailyAffirmation;
