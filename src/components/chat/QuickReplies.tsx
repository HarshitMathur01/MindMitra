/**
 * QuickReplies — 2-3 suggestion chips below AI messages that ask questions.
 * Pill-shaped, outlined with primary color, horizontal scroll on mobile.
 * Tapping sends text as user's next message. Disappear after any user input.
 * Min tap target: 44x44px.
 */

import React, { useRef, useEffect } from 'react';

interface QuickRepliesProps {
    suggestions: string[];
    onSelect: (text: string) => void;
    visible: boolean;
    className?: string;
}

const QuickReplies: React.FC<QuickRepliesProps> = ({
    suggestions,
    onSelect,
    visible,
    className,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Reset scroll position when suggestions change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = 0;
        }
    }, [suggestions]);

    if (!visible || !suggestions.length) return null;

    return (
        <div
            className={`pt-3 ${className || ''}`}
            role="group"
            aria-label="Quick reply suggestions"
        >
            <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {suggestions.slice(0, 3).map((text, i) => (
                    <button
                        key={`qr-${i}-${text.slice(0, 10)}`}
                        type="button"
                        onClick={() => onSelect(text)}
                        className="flex-shrink-0 inline-flex items-center rounded-full border border-ink-3 bg-ink-0 px-3 py-1.5 text-[12.5px] text-ink-7 whitespace-nowrap transition-colors duration-quick ease-out-expo hover:border-ink-5 hover:text-ink-9"
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default React.memo(QuickReplies);
