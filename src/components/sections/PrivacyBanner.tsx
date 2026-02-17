import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Shield, Eye, EyeOff, Server } from 'lucide-react';

const PrivacyBanner = () => {
    return (
        <section className="py-6 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-y border-green-100">
            <div className="container mx-auto px-4">
                <motion.div
                    className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    viewport={{ once: true }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Lock className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                            <p className="font-semibold text-green-800 text-sm">Your Conversations are Confidential</p>
                            <p className="text-xs text-green-600">End-to-end encrypted • No data shared with third parties</p>
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-green-200" />

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <EyeOff className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                            <p className="font-semibold text-green-800 text-sm">Anonymous by Default</p>
                            <p className="text-xs text-green-600">No personal info required to start chatting</p>
                        </div>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-green-200" />

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Server className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                            <p className="font-semibold text-green-800 text-sm">India Data Residency</p>
                            <p className="text-xs text-green-600">Your data stays in India • DPDP Act compliant</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default PrivacyBanner;
