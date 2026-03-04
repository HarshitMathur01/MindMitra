/**
 * ChatBubble — styled message bubble for AI and user messages.
 * AI: borderRadius 4px 18px 18px 18px, bg surface, max-width 85%
 * User: borderRadius 18px 18px 4px 18px, bg primary, white text, max-width 75%, align right
 * Subtle shadow. No tail/triangle. Timestamp below.
 */

import React from 'react';
import MessageRenderer from './MessageRenderer';

interface ChatBubbleProps {
    content: string;
    sender: 'user' | 'ai' | 'assistant';
    timestamp?: Date | string;
    /** When true, renders children instead of MessageRenderer (for streaming) */
    children?: React.ReactNode;
    className?: string;
    /** Hide timestamp (e.g. in grouped messages) */
    hideTimestamp?: boolean;
}

function formatTime(ts: Date | string): string {
    const d = typeof ts === 'string' ? new Date(ts) : ts;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
    content,
    sender,
    timestamp,
    children,
    className,
    hideTimestamp,
}) => {
    const isUser = sender === 'user';

    return (
        <div
            className={`mm-bubble-wrap ${isUser ? 'mm-bubble-wrap--user' : 'mm-bubble-wrap--ai'} ${className || ''}`}
        >
            <div
                className={`mm-bubble ${isUser ? 'mm-bubble--user' : 'mm-bubble--ai'}`}
            >
                {children ?? (
                    isUser
                        ? <span className="mm-user-text">{content}</span>
                        : <MessageRenderer content={content} />
                )}
            </div>

            {timestamp && !hideTimestamp && (
                <time
                    className={`mm-bubble-time ${isUser ? 'mm-bubble-time--user' : 'mm-bubble-time--ai'}`}
                    dateTime={typeof timestamp === 'string' ? timestamp : timestamp.toISOString()}
                >
                    {formatTime(timestamp)}
                </time>
            )}
        </div>
    );
};

export default React.memo(ChatBubble);
