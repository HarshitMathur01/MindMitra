/**
 * QuickReplies — 2-3 suggestion chips below AI messages that ask questions.
 * Pill-shaped, outlined. Tapping sends text as the user's next message.
 * Disappear after any user input.
 *
 * These used to sit in an `overflow-x-auto` row with the scrollbar hidden.
 * With three chips at mobile widths the third was simply cut off at the edge
 * of the screen with nothing to indicate it could be reached — it read as a
 * clipping bug, not an affordance, and a suggestion you cannot see is a
 * suggestion that does not exist. There are never more than three, so they
 * wrap instead.
 */

import React from 'react';

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
    if (!visible || !suggestions.length) return null;

    return (
        <div
            className={`pt-3 ${className || ''}`}
            role="group"
            aria-label="Quick reply suggestions"
        >
            <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 3).map((text, i) => (
                    <button
                        key={`qr-${i}-${text.slice(0, 10)}`}
                        type="button"
                        onClick={() => onSelect(text)}
                        className="inline-flex max-w-full items-center rounded-full border border-ink-3 bg-ink-0 px-3 py-1.5 text-left text-[12.5px] text-ink-7 transition-colors duration-quick ease-out-expo hover:border-ink-5 hover:text-ink-9"
                    >
                        {text}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default React.memo(QuickReplies);
