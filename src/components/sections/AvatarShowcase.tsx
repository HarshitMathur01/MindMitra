import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Video, Mic, Volume2, MessageCircle, ArrowRight,
    Sparkles, Camera, User, Heart, Brain, Stethoscope, Flower2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AvatarOption {
    id: string;
    name: string;
    role: string;
    description: string;
    image: string;
    gradient: string;
    gradientBg: string;
    fallbackIcon: React.ElementType;
    fallbackEmoji: string;
    speciality: string[];
}

const avatarOptions: AvatarOption[] = [
    {
        id: 'counselor',
        name: 'Dr. Meera',
        role: 'AI Counselor',
        description: 'A warm, empathetic counselor who specializes in academic stress, family dynamics, and career anxiety. Perfect for deep, structured conversations.',
        image: '/avatars/Screenshot 2026-02-17 200939.png',
        gradient: 'from-blue-500 to-indigo-600',
        gradientBg: 'from-blue-100 via-indigo-50 to-blue-200',
        fallbackIcon: Stethoscope,
        fallbackEmoji: '👩‍⚕️',
        speciality: ['Career Guidance', 'Family Issues', 'Academic Stress'],
    },
    {
        id: '3d-avatar',
        name: 'Ananya',
        role: '3D Interactive Avatar',
        description: 'A friendly 3D animated companion who reacts with real-time facial expressions, gestures, and emotional mirroring. Feels like talking to a real friend.',
        image: '/avatars/Screenshot 2026-02-17 201059.png',
        gradient: 'from-purple-500 to-pink-600',
        gradientBg: 'from-purple-100 via-pink-50 to-purple-200',
        fallbackIcon: Sparkles,
        fallbackEmoji: '🧑‍💻',
        speciality: ['Emotional Support', 'Daily Check-ins', 'Mindfulness'],
    },
    {
        id: 'wellness',
        name: 'Priya',
        role: 'Wellness Guide',
        description: 'A calming presence guiding you through meditation, breathing exercises, and mindfulness practices. Ideal for stress relief and building inner peace.',
        image: '/avatars/Screenshot 2026-02-17 201358.png',
        gradient: 'from-green-500 to-teal-600',
        gradientBg: 'from-green-100 via-emerald-50 to-teal-200',
        fallbackIcon: Flower2,
        fallbackEmoji: '🧘‍♀️',
        speciality: ['Meditation', 'Breathing', 'Yoga Nidra'],
    },
];

/** Renders avatar image with a rich gradient + icon fallback when the image can't load */
const AvatarImage = ({ avatar, className = '' }: { avatar: AvatarOption; className?: string }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const Icon = avatar.fallbackIcon;

    if (imgFailed) {
        return (
            <div className={`bg-gradient-to-br ${avatar.gradientBg} flex flex-col items-center justify-center ${className}`}>
                <span className="text-5xl mb-2">{avatar.fallbackEmoji}</span>
                <div className={`w-14 h-14 rounded-full bg-gradient-to-r ${avatar.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="h-7 w-7 text-white" />
                </div>
                <p className="mt-3 text-sm font-bold text-gray-700">{avatar.name}</p>
                <p className="text-xs text-gray-500">{avatar.role}</p>
            </div>
        );
    }

    return (
        <img
            src={avatar.image}
            alt={avatar.name}
            className={`${className} object-top`}
            onError={() => setImgFailed(true)}
        />
    );
};

/** Small circular avatar with fallback */
const AvatarThumb = ({ avatar, isSelected }: { avatar: AvatarOption; isSelected: boolean }) => {
    const [imgFailed, setImgFailed] = useState(false);
    const Icon = avatar.fallbackIcon;

    return (
        <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${isSelected ? 'border-primary' : 'border-gray-200'
            }`}>
            {imgFailed ? (
                <div className={`w-full h-full bg-gradient-to-br ${avatar.gradientBg} flex items-center justify-center`}>
                    <span className="text-2xl">{avatar.fallbackEmoji}</span>
                </div>
            ) : (
                <img
                    src={avatar.image}
                    alt={avatar.name}
                    className="w-full h-full object-cover object-top"
                    onError={() => setImgFailed(true)}
                />
            )}
        </div>
    );
};

const AvatarShowcase = () => {
    const navigate = useNavigate();
    const [selectedAvatar, setSelectedAvatar] = useState<string>('3d-avatar');
    const selected = avatarOptions.find(a => a.id === selectedAvatar)!;

    return (
        <section className="py-14 bg-gradient-to-b from-white via-purple-50/30 to-white relative overflow-hidden">
            {/* Background blobs */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-64 h-64 bg-blue-200/20 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 relative z-10">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-14"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 px-5 py-2 rounded-full text-sm text-purple-700 font-medium mb-4 border border-purple-200/50">
                        <Video className="h-4 w-4" />
                        Face-to-Face AI Therapy
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
                        Talk to a 3D Avatar — Like a Real Conversation
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                        Choose your AI companion and have a face-to-face conversation with voice, video,
                        and real-time emotional expressions. It's like talking to a friend who truly listens.
                    </p>
                </motion.div>

                <div className="max-w-6xl mx-auto">
                    {/* Avatar Selection + Preview */}
                    <div className="grid lg:grid-cols-5 gap-8 items-start">

                        {/* Avatar Cards - Left Column */}
                        <div className="lg:col-span-2 space-y-4">
                            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Choose your companion</p>
                            {avatarOptions.map((avatar, i) => (
                                <motion.div
                                    key={avatar.id}
                                    onClick={() => setSelectedAvatar(avatar.id)}
                                    className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all duration-300 ${selectedAvatar === avatar.id
                                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                                        }`}
                                    initial={{ opacity: 0, x: -30 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                    viewport={{ once: true }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar Thumbnail */}
                                        <div className="relative flex-shrink-0">
                                            <AvatarThumb avatar={avatar} isSelected={selectedAvatar === avatar.id} />
                                            {selectedAvatar === avatar.id && (
                                                <motion.div
                                                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center"
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring' }}
                                                >
                                                    <div className="w-2 h-2 bg-white rounded-full" />
                                                </motion.div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-gray-800">{avatar.name}</h4>
                                            <p className={`text-xs font-medium bg-gradient-to-r ${avatar.gradient} bg-clip-text text-transparent`}>
                                                {avatar.role}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {avatar.speciality.map((s, j) => (
                                                    <span key={j} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Main Preview - Right Column */}
                        <div className="lg:col-span-3">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={selected.id}
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                                    transition={{ duration: 0.4, type: 'spring' }}
                                >
                                    {/* Video Call Frame */}
                                    <div className="bg-gray-900 rounded-2xl p-3 shadow-2xl relative overflow-hidden">
                                        {/* Glow */}
                                        <div className={`absolute -inset-2 bg-gradient-to-r ${selected.gradient} rounded-[2rem] blur-xl opacity-20`} />

                                        <div className="relative z-10">
                                            {/* Top bar */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                                </div>
                                                <div className="flex items-center gap-2 text-white/60 text-xs">
                                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    <span>Live Session</span>
                                                </div>
                                                <div className="text-white/40 text-xs font-mono">
                                                    00:14:32
                                                </div>
                                            </div>

                                            {/* Avatar Image */}
                                            <div className="relative rounded-2xl overflow-hidden aspect-video bg-gray-800">
                                                <AvatarImage avatar={selected} className="w-full h-full object-cover" />

                                                {/* Overlay info */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                    <div className="flex items-end justify-between">
                                                        <div>
                                                            <p className="text-white font-bold text-lg">{selected.name}</p>
                                                            <p className="text-white/70 text-sm">{selected.role}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {/* Voice waveform visualization */}
                                                            <div className="flex items-end gap-0.5 h-6">
                                                                {[3, 5, 7, 4, 6, 8, 5, 3, 6, 4, 7, 5].map((h, i) => (
                                                                    <motion.div
                                                                        key={i}
                                                                        className="w-1 bg-green-400 rounded-full"
                                                                        animate={{ height: [`${h * 2}px`, `${h * 4}px`, `${h * 2}px`] }}
                                                                        transition={{
                                                                            repeat: Infinity,
                                                                            duration: 0.8 + Math.random() * 0.4,
                                                                            delay: i * 0.05,
                                                                            ease: 'easeInOut',
                                                                        }}
                                                                    />
                                                                ))}
                                                            </div>
                                                            <Volume2 className="h-4 w-4 text-green-400" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Emotion badge */}
                                                <motion.div
                                                    className="absolute top-3 left-3 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5"
                                                    animate={{ scale: [1, 1.05, 1] }}
                                                    transition={{ repeat: Infinity, duration: 3 }}
                                                >
                                                    <Heart className="h-3 w-3 text-pink-400" />
                                                    <span className="text-white text-xs font-medium">Empathetic & Attentive</span>
                                                </motion.div>

                                                {/* Technique badge */}
                                                <motion.div
                                                    className="absolute top-3 right-3 bg-purple-500/80 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5"
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.5 }}
                                                >
                                                    <Brain className="h-3 w-3 text-white" />
                                                    <span className="text-white text-xs font-medium">Using CBT</span>
                                                </motion.div>

                                                {/* Small self-view */}
                                                <div className="absolute bottom-14 right-3 w-20 h-14 rounded-lg bg-gray-700 border-2 border-white/30 overflow-hidden shadow-lg">
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center">
                                                        <User className="h-6 w-6 text-gray-400" />
                                                    </div>
                                                    <div className="absolute bottom-1 left-1 right-1 flex justify-center">
                                                        <div className="bg-black/50 rounded-full px-2 py-0.5 text-[9px] text-white/80">
                                                            You
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Controls bar */}
                                            <div className="flex items-center justify-center gap-3 mt-3">
                                                <button className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
                                                    <Camera className="h-4 w-4 text-white" />
                                                </button>
                                                <button className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
                                                    <Mic className="h-4 w-4 text-white" />
                                                </button>
                                                <button className="w-11 h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/30">
                                                    <MessageCircle className="h-5 w-5 text-white" />
                                                </button>
                                                <button className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
                                                    <Volume2 className="h-4 w-4 text-white" />
                                                </button>
                                                <button className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors">
                                                    <Sparkles className="h-4 w-4 text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description Card */}
                                    <motion.div
                                        className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        <p className="text-gray-600 leading-relaxed mb-4">{selected.description}</p>

                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <Button
                                                onClick={() => navigate('/chat')}
                                                className={`flex-1 bg-gradient-to-r ${selected.gradient} text-white rounded-full hover:shadow-lg transition-all`}
                                            >
                                                <Video className="h-4 w-4 mr-2" />
                                                Start Video Session with {selected.name}
                                            </Button>
                                            <Button
                                                onClick={() => navigate('/chat')}
                                                variant="outline"
                                                className="rounded-full"
                                            >
                                                <MessageCircle className="h-4 w-4 mr-2" />
                                                Text Chat Instead
                                            </Button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Feature highlights */}
                    <motion.div
                        className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        {[
                            { icon: Video, text: 'Real-time Video Interaction', desc: 'Face-to-face with your AI companion' },
                            { icon: Mic, text: 'Voice Conversations', desc: 'Just speak naturally, no typing needed' },
                            { icon: Heart, text: 'Emotional Mirroring', desc: 'Avatar reacts to your emotions in real-time' },
                            { icon: Brain, text: 'Adaptive Therapy', desc: 'Switches techniques based on your needs' },
                        ].map((feat, i) => (
                            <motion.div
                                key={i}
                                className="text-center p-4 rounded-xl bg-white border border-gray-100 hover:border-primary/30 hover:shadow-md transition-all"
                                whileHover={{ y: -4 }}
                            >
                                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 flex items-center justify-center">
                                    <feat.icon className="h-5 w-5 text-primary" />
                                </div>
                                <p className="text-sm font-semibold text-gray-800">{feat.text}</p>
                                <p className="text-xs text-gray-500 mt-1">{feat.desc}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default AvatarShowcase;
