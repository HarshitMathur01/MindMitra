import { motion, useReducedMotion } from "framer-motion";
import type { ConsentKey } from "./BridgeContext";

export const consentNodes: { key: ConsentKey; label: string; x: number }[] = [
  { key: "assessments", label: "Assessments", x: 60 },
  { key: "patterns", label: "Patterns", x: 180 },
  { key: "summaries", label: "Summaries", x: 300 },
  { key: "words", label: "Your words", x: 420 },
];

export function PrivacyFlowVisualization({ consent }: { consent: Record<ConsentKey, boolean> }) {
  const reduced = useReducedMotion();

  return (
    <svg
      viewBox="0 0 480 190"
      className="w-full"
      role="img"
      aria-label="A diagram showing which kinds of information flow from you to your therapist."
    >
      <text x={240} y={22} textAnchor="middle" className="fill-current text-ink" style={{ fontSize: 13 }}>
        YOU
      </text>
      <circle cx={240} cy={40} r={5} fill="var(--primary)" />

      {consentNodes.map((node) => {
        const on = consent[node.key];
        const d = `M 240 46 C 240 100, ${node.x} 96, ${node.x} 140`;
        return (
          <g key={node.key}>
            <path
              d={d}
              fill="none"
              stroke={on ? "var(--primary)" : "var(--border)"}
              strokeWidth={on ? 1.4 : 1}
              strokeDasharray={on ? "none" : "3 4"}
              opacity={on ? 0.85 : 0.5}
              style={{ transition: "stroke 400ms ease, opacity 400ms ease" }}
            />
            {on && !reduced ? (
              <motion.circle
                r={2.6}
                fill="var(--primary)"
                initial={{ offsetDistance: "0%" }}
                animate={{ offsetDistance: "100%" }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                style={{ offsetPath: `path("${d}")` }}
              />
            ) : null}
            <circle
              cx={node.x}
              cy={144}
              r={on ? 6 : 4}
              fill={on ? "var(--primary)" : "var(--muted-foreground)"}
              opacity={on ? 1 : 0.35}
              style={{ transition: "all 400ms ease" }}
            />
            <text
              x={node.x}
              y={168}
              textAnchor="middle"
              className={on ? "fill-current text-ink" : "fill-current text-muted-foreground"}
              style={{ fontSize: 11, opacity: on ? 1 : 0.6 }}
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
