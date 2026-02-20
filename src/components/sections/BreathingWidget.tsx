import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, X, Play, Pause } from 'lucide-react';

type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

const phaseConfig: Record<BreathPhase, { label: string; duration: number; color: string }> = {
    inhale: { label: 'Breathe In', duration: 4000, color: 'from-blue-400 to-cyan-400' },
    hold: { label: 'Hold', duration: 4000, color: 'from-cyan-400 to-teal-400' },
    exhale: { label: 'Breathe Out', duration: 6000, color: 'from-teal-400 to-green-400' },
    rest: { label: 'Rest', duration: 2000, color: 'from-green-400 to-blue-400' },
};

const phaseOrder: BreathPhase[] = ['inhale', 'hold', 'exhale', 'rest'];

const BreathingWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [phase, setPhase] = useState<BreathPhase>('inhale');
    const [cycleCount, setCycleCount] = useState(0);
    const [countdown, setCountdown] = useState(4);

    // Cycle through breathing phases
    useEffect(() => {
        if (!isActive) return;

        const currentDuration = phaseConfig[phase].duration;
        setCountdown(Math.ceil(currentDuration / 1000));

        // Countdown timer
        const countdownInterval = setInterval(() => {
            setCountdown((prev) => (prev > 1 ? prev - 1 : prev));
        }, 1000);

        // Phase transition
        const timer = setTimeout(() => {
            const currentIndex = phaseOrder.indexOf(phase);
            const nextIndex = (currentIndex + 1) % phaseOrder.length;
            if (nextIndex === 0) setCycleCount((c) => c + 1);
            setPhase(phaseOrder[nextIndex]);
        }, currentDuration);

        return () => {
            clearTimeout(timer);
            clearInterval(countdownInterval);
        };
    }, [isActive, phase]);

    const toggleExercise = () => {
        if (isActive) {
            setIsActive(false);
            setPhase('inhale');
            setCycleCount(0);
        } else {
            setIsActive(true);
            setPhase('inhale');
            setCycleCount(0);
        }
    };

    const circleScale = phase === 'inhale' ? 1.3 : phase === 'exhale' ? 0.8 : 1;

    return (
        <>
            {/* Floating Trigger Button */}
            <motion.button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 left-4 z-50 w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-full shadow-lg shadow-teal-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-teal-500/40 transition-shadow"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2, type: 'spring' }}
                title="Breathing exercise"
            >
                <Wind className="h-5 w-5" />
            </motion.button>

            {/* Breathing Exercise Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="fixed bottom-20 left-4 z-50 w-72 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100/50">
                            <div className="flex items-center gap-2">
                                <Wind className="h-4 w-4 text-teal-600" />
                                <span className="text-sm font-semibold text-teal-800">Breathing Exercise</span>
                            </div>
                            <button
                                onClick={() => { setIsOpen(false); setIsActive(false); setPhase('inhale'); setCycleCount(0); }}
                                className="p-1 rounded-full hover:bg-teal-100 transition-colors"
                            >
                                <X className="h-4 w-4 text-teal-600" />
                            </button>
                        </div>

                        {/* Breathing Circle */}
                        <div className="flex flex-col items-center py-8 px-4">
                            <div className="relative mb-6">
                                {/* Outer ring */}
                                <motion.div
                                    className={`w-32 h-32 rounded-full bg-gradient-to-br ${phaseConfig[phase].color} opacity-20`}
                                    animate={{ scale: isActive ? circleScale : 1 }}
                                    transition={{ duration: phaseConfig[phase].duration / 1000, ease: 'easeInOut' }}
                                />
                                {/* Inner circle */}
                                <motion.div
                                    className={`absolute inset-3 rounded-full bg-gradient-to-br ${phaseConfig[phase].color} flex items-center justify-center`}
                                    animate={{ scale: isActive ? circleScale : 1 }}
                                    transition={{ duration: phaseConfig[phase].duration / 1000, ease: 'easeInOut' }}
                                >
                                    <div className="text-center">
                                        {isActive ? (
                                            <>
                                                <p className="text-white text-xs font-medium opacity-90">{phaseConfig[phase].label}</p>
                                                <p className="text-white text-2xl font-bold">{countdown}</p>
                                            </>
                                        ) : (
                                            <p className="text-white text-xs font-medium px-2 text-center">Tap play to begin</p>
                                        )}
                                    </div>
                                </motion.div>
                            </div>

                            {/* Controls */}
                            <motion.button
                                onClick={toggleExercise}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${isActive
                                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                        : 'bg-teal-500 text-white hover:bg-teal-600'
                                    }`}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                            </motion.button>

                            {/* Cycle counter */}
                            {cycleCount > 0 && (
                                <motion.p
                                    className="mt-3 text-xs text-gray-400"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    {cycleCount} cycle{cycleCount > 1 ? 's' : ''} completed
                                </motion.p>
                            )}
                        </div>

                        {/* Tip */}
                        <div className="px-4 pb-4">
                            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                                4-4-6-2 breathing pattern reduces anxiety and activates your parasympathetic nervous system.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default BreathingWidget;
