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
            className={`mm-quick-replies ${className || ''}`}
            role="group"
            aria-label="Quick reply suggestions"
        >
            <div className="mm-quick-replies-scroll" ref={scrollRef}>
                {suggestions.slice(0, 3).map((text, i) => (
                    <button
                        key={`qr-${i}-${text.slice(0, 10)}`}
                        className="mm-quick-reply-chip"
                        onClick={() => onSelect(text)}
                        type="button"
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default React.memo(QuickReplies);
