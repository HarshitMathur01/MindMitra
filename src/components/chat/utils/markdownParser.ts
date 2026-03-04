/**
 * Lightweight markdown-to-React-elements parser for MindMitra chat.
 * Handles: **bold**, *italic*, bullet/numbered lists, line breaks,
 * links, blockquotes. Headings render as bold (chat, not docs).
 * < 3KB bundle. No external dependencies.
 */

import { createElement, ReactNode } from 'react';

// ── Types ──────────────────────────────────────────────────────────
export interface ParsedNode {
    type: 'text' | 'bold' | 'italic' | 'bold-italic' | 'link' | 'linebreak';
    content: string;
    href?: string;
}

export interface ParsedBlock {
    type: 'paragraph' | 'bullet-list' | 'numbered-list' | 'blockquote' | 'heading';
    items?: ParsedInline[][]; // for lists
    content?: ParsedInline[]; // for paragraph / blockquote / heading
}

export type ParsedInline = ParsedNode;

// ── Inline parser ──────────────────────────────────────────────────
/** Parse inline markdown (bold, italic, links) into structured nodes */
export function parseInline(text: string): ParsedInline[] {
    const nodes: ParsedInline[] = [];
    // Regex: links, bold-italic, bold, italic
    // Order matters: bold-italic before bold before italic
    const inlineRe =
        /\[([^\]]+)\]\(([^)]+)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRe.exec(text)) !== null) {
        // Push preceding plain text
        if (match.index > lastIndex) {
            nodes.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }

        if (match[1] !== undefined && match[2] !== undefined) {
            // Link: [text](url)
            nodes.push({ type: 'link', content: match[1], href: match[2] });
        } else if (match[3] !== undefined) {
            // Bold-italic: ***text***
            nodes.push({ type: 'bold-italic', content: match[3] });
        } else if (match[4] !== undefined) {
            // Bold: **text**
            nodes.push({ type: 'bold', content: match[4] });
        } else if (match[5] !== undefined) {
            // Italic: *text*
            nodes.push({ type: 'italic', content: match[5] });
        } else if (match[6] !== undefined) {
            // Bold: __text__
            nodes.push({ type: 'bold', content: match[6] });
        } else if (match[7] !== undefined) {
            // Italic: _text_
            nodes.push({ type: 'italic', content: match[7] });
        }

        lastIndex = match.index + match[0].length;
    }

    // Remaining text
    if (lastIndex < text.length) {
        nodes.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return nodes.length > 0 ? nodes : [{ type: 'text', content: text }];
}

// ── Block parser ───────────────────────────────────────────────────
/** Parse raw markdown string into block-level structures */
export function parseMarkdown(raw: string): ParsedBlock[] {
    const blocks: ParsedBlock[] = [];
    // Normalize line endings
    const lines = raw.replace(/\r\n/g, '\n').split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (trimmed === '') {
            i++;
            continue;
        }

        // Headings → render as bold paragraph (chat-friendly)
        const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                content: parseInline(headingMatch[1]),
            });
            i++;
            continue;
        }

        // Blockquote
        if (trimmed.startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({
                type: 'blockquote',
                content: parseInline(quoteLines.join(' ')),
            });
            continue;
        }

        // Bullet list (-, *, •)
        const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
        if (bulletMatch) {
            const items: ParsedInline[][] = [];
            while (i < lines.length) {
                const bm = lines[i].trim().match(/^[-*•]\s+(.+)$/);
                if (!bm) break;
                items.push(parseInline(bm[1]));
                i++;
            }
            blocks.push({ type: 'bullet-list', items });
            continue;
        }

        // Numbered list (1. 2. etc)
        const numMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if (numMatch) {
            const items: ParsedInline[][] = [];
            while (i < lines.length) {
                const nm = lines[i].trim().match(/^\d+[.)]\s+(.+)$/);
                if (!nm) break;
                items.push(parseInline(nm[1]));
                i++;
            }
            blocks.push({ type: 'numbered-list', items });
            continue;
        }

        // Regular paragraph — collect consecutive non-empty, non-special lines
        const paraLines: string[] = [];
        while (i < lines.length) {
            const pl = lines[i].trim();
            if (
                pl === '' ||
                pl.startsWith('>') ||
                pl.match(/^[-*•]\s+/) ||
                pl.match(/^\d+[.)]\s+/) ||
                pl.match(/^#{1,6}\s+/)
            ) break;
            paraLines.push(pl);
            i++;
        }
        if (paraLines.length > 0) {
            // Join with spaces but preserve intentional double-space line breaks
            const text = paraLines.join('\n');
            blocks.push({ type: 'paragraph', content: parseInline(text) });
        }
    }

    return blocks;
}

// ── React element renderer ─────────────────────────────────────────
let _keyCounter = 0;
function k() { return `md-${++_keyCounter}`; }

/** Reset key counter (call before each full render pass) */
export function resetKeyCounter() { _keyCounter = 0; }

/** Convert ParsedInline[] → React elements */
export function renderInline(nodes: ParsedInline[]): ReactNode[] {
    return nodes.map((node) => {
        switch (node.type) {
            case 'bold':
                return createElement('strong', { key: k(), className: 'mm-bold' }, node.content);
            case 'italic':
                return createElement('em', { key: k(), className: 'mm-italic' }, node.content);
            case 'bold-italic':
                return createElement('strong', { key: k(), className: 'mm-bold' },
                    createElement('em', { className: 'mm-italic' }, node.content)
                );
            case 'link':
                return createElement('a', {
                    key: k(),
                    href: node.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    className: 'mm-link',
                }, node.content);
            case 'linebreak':
                return createElement('br', { key: k() });
            default:
                return createElement('span', { key: k() }, node.content);
        }
    });
}

/** Convert ParsedBlock[] → React elements */
export function renderBlocks(blocks: ParsedBlock[]): ReactNode[] {
    resetKeyCounter();
    return blocks.map((block) => {
        switch (block.type) {
            case 'heading':
                // Headings render as bold paragraphs in chat context
                return createElement('p', { key: k(), className: 'mm-heading' },
                    ...renderInline(block.content || [])
                );

            case 'blockquote':
                return createElement('blockquote', { key: k(), className: 'mm-blockquote' },
                    ...renderInline(block.content || [])
                );

            case 'bullet-list':
                return createElement('ul', { key: k(), className: 'mm-bullet-list' },
                    ...(block.items || []).map((item) =>
                        createElement('li', { key: k(), className: 'mm-bullet-item' },
                            ...renderInline(item)
                        )
                    )
                );

            case 'numbered-list':
                return createElement('ol', { key: k(), className: 'mm-numbered-list' },
                    ...(block.items || []).map((item) =>
                        createElement('li', { key: k(), className: 'mm-numbered-item' },
                            ...renderInline(item)
                        )
                    )
                );

            case 'paragraph':
            default:
                return createElement('p', { key: k(), className: 'mm-paragraph' },
                    ...renderInline(block.content || [])
                );
        }
    });
}

/** Convenience: raw markdown string → React elements */
export function markdownToReact(raw: string): ReactNode[] {
    return renderBlocks(parseMarkdown(raw));
}
