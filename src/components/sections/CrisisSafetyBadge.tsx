import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Shield, AlertTriangle, Clock } from 'lucide-react';

const CrisisSafetyBadge = () => {
    return (
        <motion.div
            className="fixed bottom-4 right-4 z-50"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5, type: 'spring' }}
        >
            <div className="bg-red-600 text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 cursor-pointer hover:bg-red-700 transition-colors group relative">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <Phone className="h-4 w-4" />
                <span className="text-sm font-semibold">24/7 Crisis Support</span>

                {/* Expanded panel on hover */}
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-2xl border border-red-100 p-4 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 transform group-hover:translate-y-0 translate-y-2">
                    <h4 className="text-red-700 font-bold text-sm mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Emergency Resources
                    </h4>
                    <div className="space-y-2 text-xs text-gray-700">
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                            <Phone className="h-3 w-3 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">iCall: 9152987821</p>
                                <p className="text-gray-500">Mon-Sat, 8am-10pm</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                            <Phone className="h-3 w-3 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">Vandrevala Foundation: 1860-2662-345</p>
                                <p className="text-gray-500">24/7 Available</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                            <Phone className="h-3 w-3 text-red-600 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">AASRA: 91-22-27546669</p>
                                <p className="text-gray-500">24/7 Available</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                            <Clock className="h-3 w-3 text-orange-600 flex-shrink-0" />
                            <div>
                                <p className="font-semibold">Snehi: 044-24640050</p>
                                <p className="text-gray-500">24/7 Available</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-red-100">
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            State-specific resources available during chat
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default CrisisSafetyBadge;
