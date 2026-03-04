import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SaveBarProps {
    show: boolean;
    saving: boolean;
    saved?: boolean;
    onSave: () => void;
    onDiscard?: () => void;
    className?: string;
}

export function SaveBar({ show, saving, saved, onSave, onDiscard, className }: SaveBarProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={cn(
                        'fixed bottom-0 left-0 right-0 z-50 md:relative md:mt-6',
                        'bg-surface/95 backdrop-blur-md border-t border-border md:border md:rounded-2xl',
                        'px-4 py-3 md:px-6 md:py-4',
                        'flex items-center justify-between gap-3',
                        'shadow-lg md:shadow-md',
                        className
                    )}
                >
                    <p className="text-sm text-text-secondary hidden sm:block">
                        You have unsaved changes
                    </p>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {onDiscard && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDiscard}
                                disabled={saving}
                                className="flex-1 sm:flex-none"
                            >
                                Discard
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={onSave}
                            disabled={saving}
                            className={cn(
                                'flex-1 sm:flex-none gap-2 transition-all duration-300',
                                'bg-primary hover:bg-primary/90 text-white rounded-xl',
                                saved && 'bg-success hover:bg-success/90'
                            )}
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : saved ? (
                                <>
                                    <Check className="h-4 w-4" />
                                    Saved!
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
