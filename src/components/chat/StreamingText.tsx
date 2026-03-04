/**
 * StreamingText — token-by-token streaming display.
 * During streaming: inline formatting only (bold/italic) + pulsing cursor.
 * On stream complete: full MessageRenderer parse.
 * No layout shifts. No flickering. Handles 50+ tokens/sec on mobile.
 */

import React, { useMemo, useRef, useEffect, createElement } from 'react';
import { parseInline, type ParsedInline } from './utils/markdownParser';
import MessageRenderer from './MessageRenderer';

interface StreamingTextProps {
    tokens: string[];
    isStreaming: boolean;
    className?: string;
}

// ── Fast inline-only renderer for streaming ────────────────────────
// During streaming we only render bold/italic inline (no block parsing)
// to avoid layout shifts from lists/blockquotes popping in/out.

let _sk = 0;
function sk() { return `st-${++_sk}`; }

function renderStreamingInline(text: string): React.ReactNode[] {
    _sk = 0;
    // Only handle bold/italic during streaming — skip lists, blockquotes, etc.
    const inlineRe = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRe.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push(createElement('span', { key: sk() }, text.slice(lastIndex, match.index)));
        }
        if (match[1] !== undefined) {
            // bold-italic
            nodes.push(createElement('strong', { key: sk(), className: 'mm-bold' },
                createElement('em', { className: 'mm-italic' }, match[1])
            ));
        } else if (match[2] !== undefined) {
            // bold
            nodes.push(createElement('strong', { key: sk(), className: 'mm-bold' }, match[2]));
        } else if (match[3] !== undefined) {
            // italic
            nodes.push(createElement('em', { key: sk(), className: 'mm-italic' }, match[3]));
        }
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        nodes.push(createElement('span', { key: sk() }, text.slice(lastIndex)));
    }

    return nodes;
}

const StreamingText: React.FC<StreamingTextProps> = ({ tokens, isStreaming, className }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Join all tokens into a single string
    const fullText = useMemo(() => tokens.join(''), [tokens]);

    // Memoize final rendered content (only computed when streaming stops)
    const finalContent = useMemo(() => {
        if (isStreaming) return null;
        return fullText;
    }, [isStreaming, fullText]);

    // Memoize streaming inline content
    const streamingContent = useMemo(() => {
        if (!isStreaming) return null;
        return renderStreamingInline(fullText);
    }, [isStreaming, fullText]);

    // Keep scroll anchored during streaming
    useEffect(() => {
        if (isStreaming && containerRef.current) {
            const el = containerRef.current;
            const parent = el.closest('[data-scroll-area]') || el.parentElement;
            if (parent) {
                parent.scrollTop = parent.scrollHeight;
            }
        }
    }, [fullText, isStreaming]);

    if (!isStreaming && finalContent !== null) {
        // Stream complete → full MessageRenderer parse
        return (
            <div ref={containerRef} className={`mm-streaming-done ${className || ''}`}>
                <MessageRenderer content={finalContent} />
            </div>
        );
    }

    // Streaming in progress → inline formatting + cursor
    return (
        <div ref={containerRef} className={`mm-streaming ${className || ''}`}>
            <span className="mm-streaming-text">
                {streamingContent}
            </span>
            <span className="mm-cursor" aria-hidden="true" />
        </div>
    );
};

export default React.memo(StreamingText);
