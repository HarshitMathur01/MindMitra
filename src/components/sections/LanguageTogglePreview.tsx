import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Check, Clock } from 'lucide-react';

interface Language {
    code: string;
    name: string;
    nativeName: string;
    status: 'active' | 'coming-soon';
}

const languages: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', status: 'active' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', status: 'coming-soon' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', status: 'coming-soon' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', status: 'coming-soon' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', status: 'coming-soon' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', status: 'coming-soon' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', status: 'coming-soon' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', status: 'coming-soon' },
];

const LanguageTogglePreview = () => {
    const [selected, setSelected] = useState('en');

    return (
        <motion.div
            className="py-10 bg-gradient-to-r from-indigo-50/50 via-blue-50/50 to-purple-50/50"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
        >
            <div className="container mx-auto px-4">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-indigo-100 px-4 py-2 rounded-full text-sm text-indigo-700 font-medium mb-3">
                        <Globe className="h-4 w-4" />
                        Regional Language Support
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">
                        Soon in your language
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Therapy that speaks your mother tongue — because healing hits different in your own language
                    </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto">
                    {languages.map(lang => (
                        <motion.button
                            key={lang.code}
                            onClick={() => lang.status === 'active' && setSelected(lang.code)}
                            className={`relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${selected === lang.code
                                    ? 'bg-primary text-white border-primary shadow-md'
                                    : lang.status === 'active'
                                        ? 'bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-primary/5'
                                        : 'bg-gray-50 text-gray-400 border-gray-100 cursor-default'
                                }`}
                            whileHover={lang.status === 'active' ? { scale: 1.05 } : {}}
                            whileTap={lang.status === 'active' ? { scale: 0.95 } : {}}
                        >
                            <span className="flex items-center gap-2">
                                <span>{lang.nativeName}</span>
                                <span className="text-xs opacity-70">({lang.name})</span>
                                {selected === lang.code && <Check className="h-3 w-3" />}
                                {lang.status === 'coming-soon' && (
                                    <Clock className="h-3 w-3 text-orange-400" />
                                )}
                            </span>
                            {lang.status === 'coming-soon' && (
                                <span className="absolute -top-2 -right-2 bg-orange-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                                    SOON
                                </span>
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

export default LanguageTogglePreview;
