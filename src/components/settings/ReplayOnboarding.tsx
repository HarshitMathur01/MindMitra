/**
 * ReplayOnboarding — Settings component to re‑run the onboarding flow.
 *
 * - Confirmation dialog before triggering replay
 * - Resets onboarding state in user_onboarding (step = 0, completed = false)
 * - Launches FirstTimeExperience in a full-screen overlay
 * - Bilingual copy (en/hi based on current settings language)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import FirstTimeExperience from '@/components/onboarding/FirstTimeExperience';

export function ReplayOnboarding() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [confirming, setConfirming] = useState(false);
    const [replaying, setReplaying] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleReplay = async () => {
        if (!user) return;
        setResetting(true);

        try {
            // Reset onboarding row so the orchestrator starts from scratch
            await supabase
                .from('user_onboarding')
                .update({
                    onboarding_step: 0,
                    onboarding_completed: false,
                    steps_skipped: [] as unknown as never,
                })
                .eq('user_id', user.id);
        } catch {
            // Best-effort — still launch replay even if DB write fails
        }

        setResetting(false);
        setConfirming(false);
        setReplaying(true);
    };

    const handleReplayComplete = () => {
        setReplaying(false);
        toast({
            title: 'Onboarding complete ✨',
            description: 'Welcome back! Your preferences have been updated.',
        });
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 p-4 bg-background/50 rounded-xl border border-border/50">
                <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                        <RotateCcw className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <Label className="text-sm font-medium text-text-primary cursor-pointer">
                            Replay Onboarding
                        </Label>
                        <p className="text-xs text-text-secondary mt-0.5">
                            Re-experience the introduction and update your companion match —
                            Introduction dubara dekhein aur apna companion chunein
                        </p>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirming(true)}
                    className="rounded-xl border-border hover:border-primary/30 text-xs flex-shrink-0"
                >
                    Replay
                </Button>
            </div>

            {/* Confirmation dialog */}
            <AnimatePresence>
                {confirming && (
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[250] p-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl flex flex-col gap-4"
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <h3 className="text-text-primary text-lg font-semibold">
                                Replay onboarding?
                            </h3>
                            <p className="text-text-secondary text-sm leading-relaxed">
                                This will restart the introduction from the beginning. Your existing
                                companion and preferences will be updated based on your new choices.
                            </p>
                            <div className="flex gap-3 mt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setConfirming(false)}
                                    className="flex-1 rounded-xl"
                                    disabled={resetting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleReplay}
                                    className="flex-1 rounded-xl"
                                    disabled={resetting}
                                >
                                    {resetting ? 'Resetting…' : 'Yes, replay'}
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Full-screen onboarding overlay */}
            {replaying && (
                <div className="fixed inset-0 z-[300]">
                    <FirstTimeExperience initialStep={0} onComplete={handleReplayComplete} />
                </div>
            )}
        </>
    );
}
