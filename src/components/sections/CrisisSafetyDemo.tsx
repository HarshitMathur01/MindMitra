import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, Shield, Phone, ArrowRight, CheckCircle,
    Clock, Bell, Eye, XCircle, MapPin, Activity,
    UserCheck, MessageCircle, FileWarning, ChevronDown, ChevronUp
} from 'lucide-react';

const CrisisSafetyDemo = () => {
    const [activeTab, setActiveTab] = useState<'detection' | 'escalation' | 'resources'>('detection');
    const [showFlowchart, setShowFlowchart] = useState(false);

    const crisisKeywords = [
        { word: 'suicide', severity: 'critical', action: 'Immediate escalation' },
        { word: 'self-harm', severity: 'critical', action: 'Immediate escalation' },
        { word: 'end my life', severity: 'critical', action: 'Immediate escalation' },
        { word: 'hurt myself', severity: 'high', action: 'Safety assessment' },
        { word: 'no reason to live', severity: 'high', action: 'Safety assessment' },
        { word: 'hopeless', severity: 'moderate', action: 'Enhanced monitoring' },
        { word: 'can\'t go on', severity: 'moderate', action: 'Enhanced monitoring' },
        { word: 'worthless', severity: 'moderate', action: 'Enhanced monitoring' },
    ];

    const stateResources = [
        { state: 'Maharashtra', helpline: 'Vandrevala Foundation: 1860-2662-345', available: '24/7' },
        { state: 'Delhi NCR', helpline: 'iCall: 9152987821', available: 'Mon-Sat 8am-10pm' },
        { state: 'Karnataka', helpline: 'SAHAI: 080-25497777', available: '24/7' },
        { state: 'Tamil Nadu', helpline: 'Snehi: 044-24640050', available: '24/7' },
        { state: 'Kerala', helpline: 'Maithri: 0484-2540530', available: '24/7' },
        { state: 'West Bengal', helpline: 'Lifeline: 033-24637401', available: '24/7' },
        { state: 'Telangana', helpline: 'Roshni: 040-66202000', available: '11am-9pm' },
        { state: 'All India', helpline: 'KIRAN: 1800-599-0019', available: '24/7 (Toll-free)' },
    ];

    const escalationSteps = [
        { step: 1, title: 'Keyword Detection', desc: 'AI detects crisis-related language patterns', icon: Eye, status: 'complete' },
        { step: 2, title: 'Context Validation', desc: 'AI validates intent to reduce false positives (e.g., "I killed that exam")', icon: CheckCircle, status: 'complete' },
        { step: 3, title: 'Safety Assessment', desc: 'Structured questions to assess immediate risk level', icon: Activity, status: 'complete' },
        { step: 4, title: 'Resource Display', desc: 'Immediate display of localized helpline numbers', icon: Phone, status: 'active' },
        { step: 5, title: 'Therapist Alert', desc: 'On-call professional notified with conversation context', icon: Bell, status: 'pending' },
        { step: 6, title: 'Follow-up Protocol', desc: 'Automated check-in scheduled within 2 hours', icon: Clock, status: 'pending' },
    ];

    const boundaryExamples = [
        { input: 'Can you prescribe medication for my anxiety?', response: 'I understand you\'re looking for relief. While I can\'t prescribe medication, I can connect you with Dr. Sharma, a psychiatrist who specializes in anxiety disorders. Would you like me to arrange that?' },
        { input: 'Do I have ADHD?', response: 'I\'ve noticed some patterns in our conversation, but I\'m not qualified to diagnose conditions. A clinical assessment would give you clear answers. Would you like help finding a specialist near you?' },
        { input: 'Should I stop taking my medication?', response: 'I\'d strongly encourage you to discuss any medication changes with your prescribing doctor first. Would you like to talk about what\'s prompting this thought?' },
    ];

    return (
        <section className="py-20 bg-gradient-to-b from-white to-red-50/30 relative">
            <div className="container mx-auto px-4">
                {/* Section Header */}
                <motion.div
                    className="text-center mb-12"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <div className="inline-flex items-center gap-2 bg-red-100 px-4 py-2 rounded-full text-sm text-red-700 font-medium mb-4">
                        <Shield className="h-4 w-4" />
                        Safety First
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
                        Crisis Safety Protocols
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Transparent, multi-layered safety systems designed to protect every student
                    </p>
                </motion.div>

                {/* Tab Navigation */}
                <div className="flex justify-center gap-3 mb-10">
                    {[
                        { key: 'detection' as const, label: 'Crisis Detection', icon: AlertTriangle },
                        { key: 'escalation' as const, label: 'Escalation Protocol', icon: ArrowRight },
                        { key: 'resources' as const, label: 'Regional Resources', icon: MapPin },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.key
                                    ? 'bg-red-600 text-white shadow-lg'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-red-200 hover:bg-red-50'
                                }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {/* Detection Tab */}
                    {activeTab === 'detection' && (
                        <motion.div
                            key="detection"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8"
                        >
                            {/* Crisis Keywords */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                                    <Eye className="h-5 w-5 text-red-500" />
                                    Crisis Detection Keywords
                                </h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Our AI monitors for these patterns in real-time for your safety:
                                </p>
                                <div className="space-y-2">
                                    {crisisKeywords.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            className="flex items-center justify-between p-3 rounded-lg border"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            style={{
                                                borderColor: item.severity === 'critical' ? '#fee2e2' : item.severity === 'high' ? '#ffedd5' : '#fef9c3',
                                                backgroundColor: item.severity === 'critical' ? '#fef2f2' : item.severity === 'high' ? '#fff7ed' : '#fefce8',
                                            }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                                                    }`} />
                                                <span className="text-sm font-medium text-gray-700">"{item.word}"</span>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.severity === 'critical' ? 'bg-red-200 text-red-800' : item.severity === 'high' ? 'bg-orange-200 text-orange-800' : 'bg-yellow-200 text-yellow-800'
                                                }`}>
                                                {item.action}
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* False Positive Handling + Boundaries */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                    <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                                        <XCircle className="h-5 w-5 text-blue-500" />
                                        False Positive Handling
                                    </h3>
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                        <p className="text-sm text-blue-800 mb-3">
                                            <strong>Example:</strong> "I killed that exam!"
                                        </p>
                                        <div className="flex items-start gap-2">
                                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-blue-700">
                                                AI validates context before escalating. Positive/colloquial usage detected → No escalation triggered. Conversation continues normally.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                    <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                                        <FileWarning className="h-5 w-5 text-purple-500" />
                                        Safety Boundaries
                                    </h3>
                                    <div className="space-y-3">
                                        {boundaryExamples.map((ex, i) => (
                                            <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs text-gray-500 mb-1.5">User: "{ex.input}"</p>
                                                <p className="text-xs text-gray-700 bg-white rounded p-2 border border-gray-200">
                                                    <span className="text-purple-600 font-medium">MindMitra:</span> {ex.response}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Escalation Tab */}
                    {activeTab === 'escalation' && (
                        <motion.div
                            key="escalation"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-3xl mx-auto"
                        >
                            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                                <h3 className="font-bold text-lg text-gray-800 mb-6 text-center">
                                    Escalation Pathway: From Detection to Professional Help
                                </h3>

                                <div className="space-y-1">
                                    {escalationSteps.map((step, i) => (
                                        <React.Fragment key={i}>
                                            <motion.div
                                                className={`flex items-start gap-4 p-4 rounded-xl transition-all ${step.status === 'active'
                                                        ? 'bg-red-50 border-2 border-red-200 shadow-md'
                                                        : step.status === 'complete'
                                                            ? 'bg-green-50 border border-green-200'
                                                            : 'bg-gray-50 border border-gray-200'
                                                    }`}
                                                initial={{ opacity: 0, x: -30 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${step.status === 'complete' ? 'bg-green-500 text-white' :
                                                        step.status === 'active' ? 'bg-red-500 text-white animate-pulse' :
                                                            'bg-gray-300 text-white'
                                                    }`}>
                                                    <step.icon className="h-5 w-5" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-400 font-mono">Step {step.step}</span>
                                                        {step.status === 'active' && (
                                                            <span className="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                                                                ACTIVE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="font-semibold text-gray-800">{step.title}</h4>
                                                    <p className="text-sm text-gray-500">{step.desc}</p>
                                                </div>
                                            </motion.div>
                                            {i < escalationSteps.length - 1 && (
                                                <div className="flex justify-start ml-9">
                                                    <div className={`w-0.5 h-4 ${step.status === 'complete' ? 'bg-green-300' : 'bg-gray-200'
                                                        }`} />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Safety Dashboard Preview */}
                                <div className="mt-8 bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-6 text-white">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity className="h-5 w-5 text-green-400" />
                                        <h4 className="font-semibold text-sm">Safety Monitoring Dashboard (Backend View)</h4>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-white/10 rounded-lg p-3">
                                            <p className="text-2xl font-bold text-green-400">0</p>
                                            <p className="text-xs text-gray-300">Active Alerts</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-3">
                                            <p className="text-2xl font-bold text-blue-400">24/7</p>
                                            <p className="text-xs text-gray-300">Monitoring</p>
                                        </div>
                                        <div className="bg-white/10 rounded-lg p-3">
                                            <p className="text-2xl font-bold text-yellow-400">&lt;30s</p>
                                            <p className="text-xs text-gray-300">Response Time</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                                        <Bell className="h-3 w-3" />
                                        <span>Therapist notification system active • Follow-up: check in within 2 hours</span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Resources Tab */}
                    {activeTab === 'resources' && (
                        <motion.div
                            key="resources"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-3xl mx-auto"
                        >
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-red-500" />
                                    Regional Emergency Resources
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Localized crisis resources automatically shown based on user location
                                </p>

                                <div className="grid md:grid-cols-2 gap-3">
                                    {stateResources.map((resource, i) => (
                                        <motion.div
                                            key={i}
                                            className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 hover:border-red-300 transition-colors"
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                <Phone className="h-4 w-4 text-red-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm text-gray-800">{resource.state}</p>
                                                <p className="text-xs text-red-700 font-medium">{resource.helpline}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <Clock className="h-3 w-3" />
                                                    {resource.available}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div className="mt-6 bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-semibold text-yellow-800">Important Note</p>
                                            <p className="text-xs text-yellow-700 mt-1">
                                                MindMitra is an AI companion and does not replace professional mental health care.
                                                If you or someone you know is in immediate danger, please call your local emergency services (112) immediately.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default CrisisSafetyDemo;
