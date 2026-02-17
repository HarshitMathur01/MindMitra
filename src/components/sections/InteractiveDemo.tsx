import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, Send, Mic, Brain, Heart, Shield,
    ChevronRight, Sparkles, Activity, AlertTriangle,
    BookOpen, Users, ArrowRight, Play, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface DemoMessage {
    role: 'user' | 'ai';
    text: string;
    technique?: string;
    emotion?: string;
    culturalFlag?: string;
    stressLevel?: number;
    stage: number;
}

const demoConversation: DemoMessage[] = [
    // Stage 1: Engage
    {
        role: 'user',
        text: "I can't sleep at night. My mind keeps racing about board exams and what my parents will think if I don't get into a good college.",
        stage: 1,
    },
    {
        role: 'ai',
        text: "I hear you — that feeling of your thoughts racing at night can be really exhausting. The pressure from board exams, and worrying about your parents' expectations on top of it… that's a heavy load to carry. You're not alone in feeling this way. 💙",
        technique: 'Active Listening + Validation',
        emotion: 'Empathetic concern',
        culturalFlag: 'Board exam pressure + Parental expectations',
        stressLevel: 72,
        stage: 1,
    },
    // Stage 2: Understand
    {
        role: 'user',
        text: "Everyone in my family is a doctor or engineer. I like art, but there's no way I can tell them that.",
        stage: 2,
    },
    {
        role: 'ai',
        text: "That sounds like you're caught between what you love and what's expected of you — and that conflict can feel really isolating. Many Indian students face this exact struggle between family traditions and personal passion. Let's explore this together: what happens in your body when you imagine telling your family about your love for art?",
        technique: 'CBT Cognitive Restructuring',
        emotion: 'Compassionate curiosity',
        culturalFlag: 'Career pressure + Family tradition conflict',
        stressLevel: 65,
        stage: 2,
    },
    // Stage 3: Profile
    {
        role: 'user',
        text: "My chest gets tight and I feel like I'm going to cry. Sometimes I just shut down completely.",
        stage: 3,
    },
    {
        role: 'ai',
        text: "Thank you for sharing that — noticing those physical sensations takes real awareness. That tightness in your chest and the urge to shut down are your body's way of protecting you from something that feels threatening. Let me share a quick grounding technique: try placing your hand on your chest right now and taking 3 slow breaths. This is called 'self-compassion touch' — it activates your body's calming system. 🧘",
        technique: 'ACT Acceptance + Somatic Awareness',
        emotion: 'Warm, grounding',
        culturalFlag: 'Emotional suppression pattern',
        stressLevel: 55,
        stage: 3,
    },
    // Stage 4: Connect
    {
        role: 'user',
        text: "That actually helped a little. But I don't know what to do about the bigger problem.",
        stage: 4,
    },
    {
        role: 'ai',
        text: "I'm glad that helped. 🌱 Here's something important: you don't have to solve everything at once. Based on our conversation, I'd love to connect you with Priya — she's a counselor who specializes in helping students navigate family expectations around career choices. She's helped many students just like you find a path that honors both their passion and their family's values. Would you like me to schedule a session?",
        technique: 'Therapist Bridge + Solution-Focused',
        emotion: 'Hopeful, empowering',
        culturalFlag: 'Family-inclusive approach',
        stressLevel: 38,
        stage: 4,
    },
];

const stages = [
    { name: 'Engage', icon: MessageCircle, color: 'from-blue-400 to-blue-600' },
    { name: 'Understand', icon: Brain, color: 'from-purple-400 to-purple-600' },
    { name: 'Profile', icon: Activity, color: 'from-orange-400 to-orange-600' },
    { name: 'Connect', icon: Users, color: 'from-green-400 to-green-600' },
];

const InteractiveDemo = () => {
    const navigate = useNavigate();
    const [visibleMessages, setVisibleMessages] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showPanel, setShowPanel] = useState(true);
    const chatRef = useRef<HTMLDivElement>(null);

    const currentStage = visibleMessages > 0
        ? demoConversation[Math.min(visibleMessages - 1, demoConversation.length - 1)].stage
        : 0;

    useEffect(() => {
        if (!isPlaying || visibleMessages >= demoConversation.length) {
            if (visibleMessages >= demoConversation.length) setIsPlaying(false);
            return;
        }

        const msg = demoConversation[visibleMessages];
        const delay = msg.role === 'user' ? 1500 : 2500;

        const timer = setTimeout(() => {
            setVisibleMessages(prev => prev + 1);
        }, delay);

        return () => clearTimeout(timer);
    }, [isPlaying, visibleMessages]);

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [visibleMessages]);

    const startDemo = () => {
        setVisibleMessages(0);
        setIsPlaying(true);
        setTimeout(() => setVisibleMessages(1), 500);
    };

    const resetDemo = () => {
        setVisibleMessages(0);
        setIsPlaying(false);
    };

    const lastAiMessage = [...demoConversation.slice(0, visibleMessages)]
        .reverse()
        .find(m => m.role === 'ai');

    return (
        <section className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
            <div className="container mx-auto px-4">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-full text-sm text-purple-700 font-medium mb-4">
                        <Play className="h-4 w-4" />
                        Guided Demo
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
                        See MindMitra in Action
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Watch a real conversation flow through all 4 therapeutic stages
                    </p>
                </motion.div>

                {/* Stage Progress Indicator */}
                <div className="max-w-3xl mx-auto mb-8">
                    <div className="flex items-center justify-between">
                        {stages.map((stage, i) => (
                            <React.Fragment key={i}>
                                <div className="flex flex-col items-center gap-2">
                                    <motion.div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${currentStage > i
                                                ? `bg-gradient-to-r ${stage.color} text-white shadow-lg`
                                                : currentStage === i + 1
                                                    ? `bg-gradient-to-r ${stage.color} text-white shadow-lg ring-4 ring-offset-2 ring-primary/30`
                                                    : 'bg-gray-100 text-gray-400'
                                            }`}
                                        animate={currentStage === i + 1 ? { scale: [1, 1.1, 1] } : {}}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                    >
                                        <stage.icon className="h-5 w-5" />
                                    </motion.div>
                                    <span className={`text-xs font-medium ${currentStage >= i + 1 ? 'text-gray-800' : 'text-gray-400'
                                        }`}>
                                        {stage.name}
                                    </span>
                                </div>
                                {i < stages.length - 1 && (
                                    <div className={`flex-1 h-1 mx-2 rounded-full transition-all duration-500 ${currentStage > i + 1 ? 'bg-gradient-to-r from-primary to-accent' : 'bg-gray-200'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="max-w-5xl mx-auto grid lg:grid-cols-3 gap-6">
                    {/* Chat Demo - Phone Mockup */}
                    <div className="lg:col-span-2">
                        <div className="max-w-md mx-auto">
                            {/* Phone Frame */}
                            <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                                {/* Notch */}
                                <div className="flex justify-center mb-1">
                                    <div className="w-24 h-5 bg-gray-900 rounded-b-2xl" />
                                </div>

                                <div className="bg-white rounded-[2rem] overflow-hidden">
                                    {/* Chat Header */}
                                    <div className="bg-gradient-to-r from-primary to-accent p-4 text-white">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                                <Brain className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">MindMitra</p>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                                                    <span className="text-xs text-white/80">
                                                        {isPlaying ? 'Listening carefully...' : 'Online'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Messages */}
                                    <div ref={chatRef} className="h-[400px] overflow-y-auto p-4 space-y-3 bg-gray-50/50 scroll-smooth">
                                        {visibleMessages === 0 && !isPlaying && (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center">
                                                    <Heart className="h-12 w-12 text-primary/20 mx-auto mb-3" />
                                                    <p className="text-gray-400 text-sm">Press play to see a demo conversation</p>
                                                </div>
                                            </div>
                                        )}

                                        <AnimatePresence>
                                            {demoConversation.slice(0, visibleMessages).map((msg, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    transition={{ duration: 0.4, type: 'spring' }}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed ${msg.role === 'user'
                                                            ? 'bg-primary text-white rounded-br-md'
                                                            : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm'
                                                        }`}>
                                                        {msg.text}
                                                        {msg.technique && (
                                                            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5">
                                                                <BookOpen className="h-3 w-3 text-purple-500" />
                                                                <span className="text-[10px] text-purple-600 font-medium">
                                                                    {msg.technique}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                        {/* Typing indicator */}
                                        {isPlaying && visibleMessages < demoConversation.length && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="flex items-center gap-2 text-xs text-gray-400"
                                            >
                                                <div className="bg-white rounded-2xl px-4 py-2 border border-gray-200 flex items-center gap-2">
                                                    <Heart className="h-3 w-3 text-pink-400 animate-pulse" />
                                                    <span className="text-gray-500 italic">
                                                        {demoConversation[visibleMessages]?.role === 'ai'
                                                            ? 'MindMitra is listening carefully...'
                                                            : 'Student is typing...'
                                                        }
                                                    </span>
                                                    <div className="flex gap-1">
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Input bar mockup */}
                                    <div className="p-3 border-t border-gray-100 bg-white">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm text-gray-400">
                                                Type your message...
                                            </div>
                                            <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center">
                                                <Mic className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center">
                                                <Send className="h-4 w-4 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Play Controls */}
                            <div className="flex justify-center gap-3 mt-4">
                                {!isPlaying && visibleMessages === 0 && (
                                    <Button
                                        onClick={startDemo}
                                        className="bg-gradient-to-r from-primary to-accent text-white px-6 rounded-full"
                                    >
                                        <Play className="h-4 w-4 mr-2" />
                                        Play Demo
                                    </Button>
                                )}
                                {(isPlaying || visibleMessages > 0) && (
                                    <Button
                                        onClick={resetDemo}
                                        variant="outline"
                                        className="rounded-full"
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" />
                                        Restart
                                    </Button>
                                )}
                                <Button
                                    onClick={() => navigate('/chat')}
                                    variant="outline"
                                    className="rounded-full border-primary text-primary hover:bg-primary hover:text-white"
                                >
                                    Try it yourself
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Side Panel - Real-time insights */}
                    <div className="space-y-4">
                        {/* Emotion Visualization */}
                        <motion.div
                            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                            viewport={{ once: true }}
                        >
                            <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-orange-500" />
                                Stress Level Detection
                            </h4>
                            <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
                                <motion.div
                                    className={`h-full rounded-full transition-all duration-1000 ${(lastAiMessage?.stressLevel || 0) > 60
                                            ? 'bg-gradient-to-r from-red-400 to-red-600'
                                            : (lastAiMessage?.stressLevel || 0) > 40
                                                ? 'bg-gradient-to-r from-orange-400 to-yellow-500'
                                                : 'bg-gradient-to-r from-green-400 to-emerald-500'
                                        }`}
                                    animate={{ width: `${lastAiMessage?.stressLevel || 0}%` }}
                                    transition={{ duration: 1 }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Calm</span>
                                <span className="font-semibold">{lastAiMessage?.stressLevel || 0}%</span>
                                <span>High Stress</span>
                            </div>
                        </motion.div>

                        {/* Avatar Emotion Wheel */}
                        <motion.div
                            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                            viewport={{ once: true }}
                        >
                            <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                                <Heart className="h-4 w-4 text-pink-500" />
                                Avatar Emotion
                            </h4>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={lastAiMessage?.emotion || 'neutral'}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    className="text-center py-2"
                                >
                                    <div className="text-3xl mb-1">
                                        {lastAiMessage?.emotion?.includes('Empathetic') ? '🤗' :
                                            lastAiMessage?.emotion?.includes('curiosity') ? '🧐' :
                                                lastAiMessage?.emotion?.includes('grounding') ? '🧘' :
                                                    lastAiMessage?.emotion?.includes('Hopeful') ? '🌟' : '😊'}
                                    </div>
                                    <p className="text-xs text-gray-600 font-medium">
                                        {lastAiMessage?.emotion || 'Awaiting interaction'}
                                    </p>
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>

                        {/* Therapeutic Technique */}
                        <motion.div
                            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            viewport={{ once: true }}
                        >
                            <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-blue-500" />
                                Technique Being Used
                            </h4>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={lastAiMessage?.technique || 'none'}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium ${lastAiMessage?.technique
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-gray-50 text-gray-400'
                                        }`}
                                >
                                    {lastAiMessage?.technique || 'Not yet started'}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>

                        {/* Cultural Context Highlights */}
                        <motion.div
                            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                            viewport={{ once: true }}
                        >
                            <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-orange-500" />
                                Cultural Context Detected
                            </h4>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={lastAiMessage?.culturalFlag || 'none'}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className={`px-3 py-2 rounded-lg text-xs font-medium ${lastAiMessage?.culturalFlag
                                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                            : 'bg-gray-50 text-gray-400'
                                        }`}
                                >
                                    {lastAiMessage?.culturalFlag
                                        ? `🇮🇳 ${lastAiMessage.culturalFlag}`
                                        : 'Awaiting conversation'}
                                </motion.div>
                            </AnimatePresence>
                        </motion.div>

                        {/* Response Reasoning ("Why I said this") */}
                        <motion.div
                            className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-5 shadow-sm"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            viewport={{ once: true }}
                        >
                            <h4 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-purple-500" />
                                Why I Said This
                            </h4>
                            <p className="text-xs text-gray-600 leading-relaxed">
                                {lastAiMessage?.technique
                                    ? `MindMitra detected cultural stress indicators and used ${lastAiMessage.technique} to provide a response that validates the student's experience while offering actionable support.`
                                    : 'Transparency panel: Shows the reasoning behind each AI response for full accountability.'}
                            </p>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default InteractiveDemo;
