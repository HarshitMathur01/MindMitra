import { useEffect, useRef, useState } from "react";

/**
 * Reveals `text` word-by-word — used for the avatar caption overlay.
 * `maxVisibleWords` keeps the on-screen caption short (sliding window)
 * so subtitles never grow into a wall of text.
 */
const TypewriterText = ({
    text,
    speed = 350,
    onComplete,
    className,
    maxVisibleWords,
}: {
    text: string;
    speed?: number;
    onComplete?: () => void;
    className?: string;
    maxVisibleWords?: number;
}) => {
    const [visibleCount, setVisibleCount] = useState(0);
    const wordsRef = useRef<string[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        wordsRef.current = text.split(" ");
        setVisibleCount(0);

        if (intervalRef.current) clearInterval(intervalRef.current);

        let count = 0;
        intervalRef.current = setInterval(() => {
            count++;
            setVisibleCount(count);
            if (count >= wordsRef.current.length) {
                clearInterval(intervalRef.current!);
                intervalRef.current = null;
                onCompleteRef.current?.();
            }
        }, speed);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [text, speed]);

    const allVisible = wordsRef.current.slice(0, visibleCount);
    const displayedWords = maxVisibleWords ? allVisible.slice(-maxVisibleWords) : allVisible;
    const displayedText = displayedWords.join(" ");
    const isComplete = visibleCount >= wordsRef.current.length;

    return (
        <span className={className}>
            {displayedText}
            {!isComplete && (
                <span className="inline-block w-[2px] h-[1em] bg-primary ml-1 animate-pulse align-middle" />
            )}
        </span>
    );
};

export default TypewriterText;
