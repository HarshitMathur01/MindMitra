/**
 * MessageRenderer — takes raw AI text and renders formatted React elements.
 * Detects therapeutic patterns (breathing exercises, affirmations, grounding,
 * emotion tags, action items) and renders them with warm, readable styling.
 * Devanagari script detection → Noto Sans Devanagari font fallback.
 * Memoized on content string.
 */

import React, { useMemo, createElement } from 'react';
import {
    parseMarkdown,
    parseInline,
    renderInline,
    resetKeyCounter,
    type ParsedBlock,
    type ParsedInline,
} from './utils/markdownParser';

// ── Helpers ────────────────────────────────────────────────────────

/** Detect Devanagari script (Hindi / Marathi / Sanskrit) */
const DEVANAGARI_RE = /[\u0900-\u097F]/;
const hasDevanagari = (text: string) => DEVANAGARI_RE.test(text);

/** Detect breathing exercise lines */
const BREATHING_RE =
    /\b(breathe|inhale|exhale|hold|breath)\b.*\d|^\s*\d+\s*\.\.\./i;

/** Detect emotion words in *italics* (already parsed as italic nodes) */
const EMOTION_WORDS = new Set([
    'anxiety', 'stress', 'fear', 'anger', 'sadness', 'grief', 'loneliness',
    'shame', 'guilt', 'worry', 'panic', 'overwhelm', 'burnout', 'exhaustion',
    'frustration', 'helplessness', 'hopelessness', 'despair', 'trauma',
    'depression', 'nervous', 'restless', 'insecurity', 'jealousy',
    // Hindi emotion words
    'चिंता', 'तनाव', 'डर', 'गुस्सा', 'उदासी', 'अकेलापन', 'शर्म',
]);

/** Affirmation line markers */
const AFFIRMATION_RE = /^(?:✦|💡|🌱)/u;

/** Grounding exercise sense icons */
const GROUNDING_ICONS: Record<string, string> = {
    '👁️': '👁️', '👁': '👁️', '👂': '👂', '✋': '✋', '👃': '👃', '👅': '👅',
};
const GROUNDING_RE = /^(👁️|👁|👂|✋|👃|👅)/;

/** Numbered action item */
const ACTION_ITEM_RE = /^\d+[.)]\s+/;

// ── Key counter ────────────────────────────────────────────────────
let _rk = 0;
function rk() { return `mr-${++_rk}`; }

// ── Inline renderers with therapeutic detection ────────────────────

function renderTherapeuticInline(nodes: ParsedInline[]): React.ReactNode[] {
    return nodes.map((node) => {
        // Emotion words in italics → pill/tag style
        if (node.type === 'italic' && EMOTION_WORDS.has(node.content.toLowerCase().trim())) {
            return createElement('span', {
                key: rk(),
                className: 'mm-emotion-tag',
            }, node.content);
        }

        switch (node.type) {
            case 'bold':
                return createElement('strong', { key: rk(), className: 'mm-bold' }, node.content);
            case 'italic':
                return createElement('em', { key: rk(), className: 'mm-italic' }, node.content);
            case 'bold-italic':
                return createElement('strong', { key: rk(), className: 'mm-bold' },
                    createElement('em', { className: 'mm-italic' }, node.content)
                );
            case 'link':
                return createElement('a', {
                    key: rk(),
                    href: node.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'mm-link',
                }, node.content);
            case 'linebreak':
                return createElement('br', { key: rk() });
            default:
                return createElement('span', { key: rk() }, node.content);
        }
    });
}

// ── Block renderers with therapeutic detection ─────────────────────

function renderBreathingLine(text: string): React.ReactNode {
    // Split breathing phases into individual centered lines
    const phases = text.split(/\.\.\.|…/).map(p => p.trim()).filter(Boolean);
    return createElement('div', { key: rk(), className: 'mm-breathing' },
        ...phases.map((phase, i) =>
            createElement('div', {
                key: rk(),
                className: 'mm-breathing-phase',
                style: { animationDelay: `${i * 0.3}s` },
            }, phase + (i < phases.length - 1 ? '...' : ''))
        )
    );
}

function renderAffirmationCard(nodes: ParsedInline[]): React.ReactNode {
    return createElement('div', { key: rk(), className: 'mm-affirmation' },
        ...renderTherapeuticInline(nodes)
    );
}

function renderGroundingLine(icon: string, nodes: ParsedInline[]): React.ReactNode {
    return createElement('div', { key: rk(), className: 'mm-grounding-line' },
        createElement('span', { className: 'mm-grounding-icon', key: rk() }, icon),
        createElement('span', { className: 'mm-grounding-text', key: rk() },
            ...renderTherapeuticInline(nodes)
        ),
    );
}

function renderActionItem(num: number, nodes: ParsedInline[]): React.ReactNode {
    return createElement('div', { key: rk(), className: 'mm-action-item' },
        createElement('span', { className: 'mm-action-badge', key: rk() }, String(num)),
        createElement('span', { className: 'mm-action-text', key: rk() },
            ...renderTherapeuticInline(nodes)
        ),
    );
}

// ── Main block renderer ────────────────────────────────────────────

function renderTherapeuticBlocks(blocks: ParsedBlock[]): React.ReactNode[] {
    return blocks.map((block) => {
        switch (block.type) {
            case 'heading':
                return createElement('p', { key: rk(), className: 'mm-heading' },
                    ...renderTherapeuticInline(block.content || [])
                );

            case 'blockquote':
                return createElement('blockquote', { key: rk(), className: 'mm-blockquote' },
                    ...renderTherapeuticInline(block.content || [])
                );

            case 'bullet-list':
                return createElement('ul', { key: rk(), className: 'mm-bullet-list' },
                    ...(block.items || []).map((item) =>
                        createElement('li', { key: rk(), className: 'mm-bullet-item' },
                            ...renderTherapeuticInline(item)
                        )
                    )
                );

            case 'numbered-list': {
                // Detect if these are action items (therapeutic numbered steps)
                const isActionItems = (block.items || []).length >= 2;
                if (isActionItems) {
                    return createElement('div', { key: rk(), className: 'mm-action-list' },
                        ...(block.items || []).map((item, idx) =>
                            renderActionItem(idx + 1, item)
                        )
                    );
                }
                return createElement('ol', { key: rk(), className: 'mm-numbered-list' },
                    ...(block.items || []).map((item) =>
                        createElement('li', { key: rk(), className: 'mm-numbered-item' },
                            ...renderTherapeuticInline(item)
                        )
                    )
                );
            }

            case 'paragraph':
            default: {
                const rawText = (block.content || []).map(n => n.content).join('');

                // Breathing exercise detection
                if (BREATHING_RE.test(rawText)) {
                    return renderBreathingLine(rawText);
                }

                // Affirmation card (✦ 💡 🌱)
                if (AFFIRMATION_RE.test(rawText.trim())) {
                    return renderAffirmationCard(block.content || []);
                }

                // Grounding exercise (sense icons)
                const groundMatch = rawText.trim().match(GROUNDING_RE);
                if (groundMatch) {
                    const icon = GROUNDING_ICONS[groundMatch[1]] || groundMatch[1];
                    // Remove the icon from content for cleaner rendering
                    const cleanedNodes = [...(block.content || [])];
                    if (cleanedNodes[0]?.type === 'text') {
                        cleanedNodes[0] = {
                            ...cleanedNodes[0],
                            content: cleanedNodes[0].content.replace(GROUNDING_RE, '').trim(),
                        };
                    }
                    return renderGroundingLine(icon, cleanedNodes);
                }

                // Default paragraph
                return createElement('p', { key: rk(), className: 'mm-paragraph' },
                    ...renderTherapeuticInline(block.content || [])
                );
            }
        }
    });
}

// ── Exported component ─────────────────────────────────────────────

interface MessageRendererProps {
    content: string;
    className?: string;
}

const MessageRenderer: React.FC<MessageRendererProps> = ({ content, className }) => {
    const rendered = useMemo(() => {
        if (!content || !content.trim()) return null;

        _rk = 0; // reset key counter

        // Check if content is simple text (no markdown markers at all)
        const isPlain = !/[*_#>\-•]|✦|💡|🌱|👁|👂|✋|👃|👅|\d+[.)\s]/u.test(content);

        if (isPlain) {
            // Simple message — render as plain paragraphs split by newlines
            const lines = content.split(/\n\n+/);
            return lines.map((line, i) => {
                const subLines = line.split('\n');
                return createElement('p', { key: `plain-${i}`, className: 'mm-paragraph' },
                    ...subLines.flatMap((sl, j) =>
                        j > 0
                            ? [createElement('br', { key: `br-${i}-${j}` }), sl]
                            : [sl]
                    )
                );
            });
        }

        const blocks = parseMarkdown(content);
        return renderTherapeuticBlocks(blocks);
    }, [content]);

    // Detect Devanagari for font class
    const fontClass = hasDevanagari(content) ? 'mm-devanagari' : '';

    return createElement('div', {
        className: `mm-message-content ${fontClass} ${className || ''}`.trim(),
    }, rendered);
};

export default React.memo(MessageRenderer);
