/**
 * MessageGroup — groups consecutive messages from same sender within 60s.
 * First message shows avatar, subsequent don't.
 * Between groups: 20px gap. Within group: 4px gap.
 */

import React, { useMemo } from 'react';
import ChatBubble from './ChatBubble';
import { Bot, User } from 'lucide-react';

interface Message {
    id: string;
    content: string;
    sender: 'user' | 'ai' | 'assistant';
    timestamp: Date | string;
}

interface MessageGroupProps {
    messages: Message[];
    /** Optional: render custom bubble content (e.g. StreamingText for last AI msg) */
    renderBubble?: (msg: Message, isFirst: boolean, isLast: boolean) => React.ReactNode;
    className?: string;
    /** Companion name for avatar tooltip */
    companionName?: string;
}

interface Group {
    sender: 'user' | 'ai' | 'assistant';
    messages: Message[];
}

const GROUP_THRESHOLD_MS = 60_000; // 60 seconds

function normalizeTimestamp(ts: Date | string): Date {
    return typeof ts === 'string' ? new Date(ts) : ts;
}

/** Group consecutive messages from same sender within 60s */
function groupMessages(messages: Message[]): Group[] {
    if (!messages.length) return [];

    const groups: Group[] = [];
    let current: Group = {
        sender: messages[0].sender === 'assistant' ? 'ai' : messages[0].sender,
        messages: [messages[0]],
    };

    for (let i = 1; i < messages.length; i++) {
        const msg = messages[i];
        const prevMsg = messages[i - 1];
        const normSender = msg.sender === 'assistant' ? 'ai' : msg.sender;
        const prevNormSender = prevMsg.sender === 'assistant' ? 'ai' : prevMsg.sender;

        const timeDiff =
            normalizeTimestamp(msg.timestamp).getTime() -
            normalizeTimestamp(prevMsg.timestamp).getTime();

        if (normSender === prevNormSender && timeDiff < GROUP_THRESHOLD_MS) {
            current.messages.push(msg);
        } else {
            groups.push(current);
            current = { sender: normSender, messages: [msg] };
        }
    }
    groups.push(current);

    return groups;
}

// ── Avatar components ──────────────────────────────────────────────

const AiAvatar: React.FC<{ name?: string }> = ({ name }) => (
    <div
        className="mm-avatar mm-avatar--ai"
        title={name || 'MindMitra'}
        aria-hidden="true"
    >
        <Bot className="w-4 h-4" />
    </div>
);

const UserAvatar: React.FC = () => (
    <div className="mm-avatar mm-avatar--user" aria-hidden="true">
        <User className="w-4 h-4" />
    </div>
);

// ── Component ──────────────────────────────────────────────────────

const MessageGroup: React.FC<MessageGroupProps> = ({
    messages,
    renderBubble,
    className,
    companionName,
}) => {
    const groups = useMemo(() => groupMessages(messages), [messages]);

    return (
        <div className={`mm-message-groups ${className || ''}`}>
            {groups.map((group, gi) => {
                const isUser = group.sender === 'user';

                return (
                    <div
                        key={`group-${gi}-${group.messages[0].id}`}
                        className={`mm-group ${isUser ? 'mm-group--user' : 'mm-group--ai'}`}
                    >
                        {/* Avatar on first message only */}
                        {!isUser && <AiAvatar name={companionName} />}
                        {isUser && <UserAvatar />}

                        <div className="mm-group-messages">
                            {group.messages.map((msg, mi) => {
                                const isFirst = mi === 0;
                                const isLast = mi === group.messages.length - 1;

                                if (renderBubble) {
                                    return (
                                        <div key={msg.id} className="mm-group-bubble">
                                            {renderBubble(msg, isFirst, isLast)}
                                        </div>
                                    );
                                }

                                return (
                                    <ChatBubble
                                        key={msg.id}
                                        content={msg.content}
                                        sender={msg.sender}
                                        timestamp={msg.timestamp}
                                        hideTimestamp={!isLast}
                                    />
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(MessageGroup);
