/**
 * TypewriterText — reusable typewriter animation component.
 *
 * Features:
 *  - Configurable character speed (ms per char)
 *  - Optional start delay
 *  - onComplete callback when full text is revealed
 *  - Instant mode (no animation) when `instant` prop is true — used for lite tier
 *  - Cursor blink during typing, hides after completion
 *  - Uses only transform + opacity — no layout-triggering props
 */

import React, { useEffect, useRef, useState } from 'react';

interface TypewriterTextProps {
    /** The full text to reveal character by character */
    text: string;
    /** Milliseconds per character (default: 35) */
    speed?: number;
    /** Delay in ms before typing starts (default: 0) */
    startDelay?: number;
    /** Skip animation entirely and show full text immediately */
    instant?: boolean;
    /** Called when the full text has been revealed */
    onComplete?: () => void;
    /** Additional className for the text container */
    className?: string;
    /** Whether to show a blinking cursor during typing (default: true) */
    showCursor?: boolean;
    /** HTML tag to render (default: 'p') */
    as?: keyof React.JSX.IntrinsicElements;
}

export default function TypewriterText({
    text,
    speed = 35,
    startDelay = 0,
    instant = false,
    onComplete,
    className = '',
    showCursor = true,
    as: Tag = 'p',
}: TypewriterTextProps) {
    const [displayText, setDisplayText] = useState(instant ? text : '');
    const [isTyping, setIsTyping] = useState(!instant);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const completedRef = useRef(instant);

    // Reset when text changes
    useEffect(() => {
        if (instant) {
            setDisplayText(text);
            setIsTyping(false);
            completedRef.current = true;
            onComplete?.();
            return;
        }

        // Clear previous timers
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (delayRef.current) clearTimeout(delayRef.current);

        setDisplayText('');
        setIsTyping(true);
        completedRef.current = false;

        let charIndex = 0;

        const startTyping = () => {
            intervalRef.current = setInterval(() => {
                charIndex++;
                setDisplayText(text.slice(0, charIndex));

                if (charIndex >= text.length) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsTyping(false);
                    completedRef.current = true;
                    onComplete?.();
                }
            }, speed);
        };

        if (startDelay > 0) {
            delayRef.current = setTimeout(startTyping, startDelay);
        } else {
            startTyping();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (delayRef.current) clearTimeout(delayRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, speed, startDelay, instant]);

    const Component = Tag as React.ElementType;

    return (
        <Component className={className}>
            {displayText}
            {showCursor && isTyping && (
                <span
                    className="inline-block w-[2px] h-[1em] bg-current align-text-bottom ml-0.5"
                    style={{
                        animation: 'mm-cursor-blink 0.8s step-end infinite',
                        opacity: 0.6,
                    }}
                />
            )}
            {showCursor && isTyping && (
                <style>{`
          @keyframes mm-cursor-blink {
            0%, 100% { opacity: 0.6; }
            50%      { opacity: 0;   }
          }
        `}</style>
            )}
        </Component>
    );
}
