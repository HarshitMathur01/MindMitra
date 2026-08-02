/**
 * Split text into user-perceived graphemes.
 *
 * A naive `.split("")` destroys Devanagari matras and conjuncts (ि, ्, ािं …),
 * which matters because the landing animates headline text character by
 * character and MindMitra's copy is Hindi / Hinglish as often as English.
 *
 * Uses `Intl.Segmenter` when available; falls back to `Array.from` (code
 * points), which is still safe for surrogate pairs.
 *
 * `Intl.Segmenter` is typed via the local shape below rather than the
 * built-in lib type: tsconfig targets the ES2020 lib, where the global
 * declaration doesn't exist yet.
 */

interface GraphemeSegmenter {
  segment(input: string): Iterable<{ segment: string }>;
}

type SegmenterCtor = new (
  locale: string,
  options: { granularity: "grapheme" },
) => GraphemeSegmenter;

export function splitGraphemes(input: string, locale = "hi"): string[] {
  if (!input) return [];

  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;

  if (typeof Segmenter === "function") {
    try {
      const seg = new Segmenter(locale, { granularity: "grapheme" });
      const out: string[] = [];
      for (const s of seg.segment(input)) out.push(s.segment);
      return out;
    } catch {
      /* fall through to code-point split */
    }
  }

  return Array.from(input);
}
