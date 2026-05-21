import { PIECES, type PieceTypeKey } from "./pieces";
import type { Color } from "./chess";

const lookup = Object.fromEntries(PIECES.map((p) => [p.key, p]));

interface Props {
  type: PieceTypeKey;
  color: Color;
  size?: number;
}

export function PieceGlyph({ type, color, size = 36 }: Props) {
  const piece = lookup[type];
  const isWhite = color === "w";
  return (
    <div
      className="relative flex flex-col items-center justify-center select-none leading-none rounded-full"
      style={{
        width: size,
        height: size,
        color: isWhite ? "var(--ink)" : "var(--paper)",
        background: isWhite
          ? "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--paper) 100%, white), color-mix(in oklab, var(--paper) 70%, var(--chai)))"
          : "radial-gradient(circle at 35% 30%, color-mix(in oklab, var(--ink) 80%, var(--chai)), var(--ink))",
        border: `1.5px solid ${isWhite ? "color-mix(in oklab, var(--chai) 55%, transparent)" : "color-mix(in oklab, var(--gold) 50%, transparent)"}`,
        boxShadow: isWhite
          ? "inset 0 -2px 4px rgba(0,0,0,0.12), 0 2px 4px -1px rgba(0,0,0,0.3)"
          : "inset 0 -2px 4px rgba(255,255,255,0.08), 0 2px 4px -1px rgba(0,0,0,0.5)",
        fontFamily: '"Shippori Mincho B1", ui-serif, Georgia, "Times New Roman", serif',
      }}
    >
      <span style={{ fontSize: size * 0.36, opacity: 0.95, fontWeight: 800, lineHeight: 1 }}>
        {piece.kanji}
      </span>
      <span
        style={{ fontSize: size * 0.22, marginTop: 1, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.75, fontFamily: '"JetBrains Mono", ui-monospace, "Courier New", monospace' }}
      >
        {piece.glyph}
      </span>
    </div>
  );
}
