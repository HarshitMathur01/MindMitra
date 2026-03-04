import { Lock, Unlock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PrivacyToggleProps {
    isPrivate: boolean;
    onToggle: (value: boolean) => void;
    label?: string;
    className?: string;
}

export function PrivacyToggle({ isPrivate, onToggle, label, className }: PrivacyToggleProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={() => onToggle(!isPrivate)}
                    className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105',
                        isPrivate
                            ? 'bg-primary/10 text-primary'
                            : 'bg-warning/10 text-warning',
                        className
                    )}
                >
                    {isPrivate ? (
                        <Lock className="h-3 w-3" />
                    ) : (
                        <Unlock className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">
                        {isPrivate ? 'Private' : 'Visible'}
                    </span>
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px] text-center">
                <p className="text-xs">
                    {isPrivate
                        ? 'Only you can see this — sirf aap dekh sakte hain 🔒'
                        : 'This may be shared with your therapist'}
                </p>
                {label && <p className="text-xs text-muted-foreground mt-1">{label}</p>}
            </TooltipContent>
        </Tooltip>
    );
}
