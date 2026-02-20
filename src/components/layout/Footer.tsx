import { Brain, Heart, MessageCircle, Phone, Shield, ExternalLink, Mail, Github } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Footer = () => {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();

    const quickLinks = [
        { label: 'AI Chat', path: '/chat', icon: MessageCircle },
        { label: 'Wellness Check-in', path: '/wellness-checkin', icon: Heart },
        { label: 'Mindfulness Games', path: '/games', icon: Brain },
        { label: 'Q&A Assessments', path: '/qa-tests', icon: Shield },
    ];

    const crisisResources = [
        { name: 'KIRAN Helpline', number: '1800-599-0019', note: '24/7 Toll-free' },
        { name: 'iCall', number: '9152987821', note: 'Mon-Sat 8am-10pm' },
        { name: 'Vandrevala Foundation', number: '1860-2662-345', note: '24/7' },
        { name: 'AASRA', number: '91-22-27546669', note: '24/7' },
    ];

    return (
        <footer className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white overflow-hidden">
            {/* Decorative top wave */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

            {/* Subtle background orbs */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-20 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

            <div className="container mx-auto px-4 py-16 relative z-10">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-1">
                        <motion.div
                            className="flex items-center gap-3 mb-5"
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                        >
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <Brain className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                    MindMitra
                                </h3>
                                <p className="text-xs text-slate-400">AI & Psychology Hub</p>
                            </div>
                        </motion.div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                            A safe, confidential AI companion designed for Indian youth — combining professional psychology with cultural understanding to support your mental wellness journey.
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Shield className="h-3.5 w-3.5 text-green-400" />
                            <span>End-to-end encrypted & DPDP compliant</span>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-5">Explore</h4>
                        <ul className="space-y-3">
                            {quickLinks.map((link) => (
                                <li key={link.path}>
                                    <button
                                        onClick={() => navigate(link.path)}
                                        className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-blue-400 transition-colors group"
                                    >
                                        <link.icon className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                        {link.label}
                                    </button>
                                </li>
                            ))}
                            <li>
                                <button
                                    onClick={() => navigate('/therapist-bridge')}
                                    className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-blue-400 transition-colors group"
                                >
                                    <Phone className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                    Therapist Bridge
                                </button>
                            </li>
                        </ul>
                    </div>

                    {/* Crisis Helplines */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-5 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                            Crisis Helplines
                        </h4>
                        <ul className="space-y-3">
                            {crisisResources.map((resource, i) => (
                                <li key={i} className="text-sm">
                                    <a
                                        href={`tel:${resource.number.replace(/[^0-9+]/g, '')}`}
                                        className="group"
                                    >
                                        <span className="text-slate-300 font-medium group-hover:text-red-400 transition-colors">
                                            {resource.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Phone className="h-3 w-3 text-red-400/70" />
                                            <span className="text-slate-400 group-hover:text-red-300 transition-colors">{resource.number}</span>
                                            <span className="text-[10px] text-slate-500">({resource.note})</span>
                                        </div>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Wellness Reminder */}
                    <div>
                        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-5">Daily Reminder</h4>
                        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-slate-700/50 rounded-xl p-4 mb-5">
                            <p className="text-sm text-slate-300 italic leading-relaxed">
                                "Your mental health is a priority. Your happiness is essential. Your self-care is a necessity."
                            </p>
                            <p className="text-xs text-slate-500 mt-2 text-right">— Wellness wisdom</p>
                        </div>
                        <div className="space-y-2 text-xs text-slate-500">
                            <p className="flex items-center gap-2">
                                <Heart className="h-3 w-3 text-pink-400" />
                                Remember: It's okay to not be okay
                            </p>
                            <p className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-green-400" />
                                Your conversations are always private
                            </p>
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="mt-12 pt-8 border-t border-slate-800">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>&copy; {currentYear} MindMitra. Built with care for Indian youth.</span>
                        </div>
                        <div className="flex items-center gap-6 text-xs text-slate-500">
                            <span className="hover:text-slate-300 cursor-pointer transition-colors">Privacy Policy</span>
                            <span className="hover:text-slate-300 cursor-pointer transition-colors">Terms of Service</span>
                            <span className="hover:text-slate-300 cursor-pointer transition-colors">Accessibility</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
