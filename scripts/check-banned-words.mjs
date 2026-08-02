#!/usr/bin/env node
/**
 * Quiet Companion copy guard. Greps src/pages and src/components for
 * the banned words from the design language (saas / growth-marketing
 * vocabulary that breaks the bookshop tone). Emits a non-zero exit
 * code so it can run in CI as `npm run lint:copy` if wired in later.
 *
 * Usage: node scripts/check-banned-words.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SCAN_DIRS = ["src/pages", "src/components"];
const EXTS = new Set([".tsx", ".ts", ".jsx", ".js"]);

const BANNED = [
  "unlock",
  "boost",
  "supercharge",
  "journey",
  "leverage",
  "seamless",
  "robust",
  "empower",
  "optimize",
  "transform",
];

/** Words inside string literals only — code-level identifiers like
 *  `transform` / `optimize` (CSS, function names) are fine. */
const STRING_RE = /(["'`])((?:\\.|(?!\1).)*?)\1/g;

/** Heuristic: skip strings that look like Tailwind classNames or CSS.
 *  Real copy contains spaces and natural punctuation; class strings
 *  are dense with `-`, `:`, and tokens like `flex`, `rounded`, `bg-`.
 */
/** CSS property names that collide with the banned list. */
const CSS_VALUE_TOKEN =
  "transform|opacity|scale|rotate|color|filter|none|auto|inherit|initial|unset";

function looksLikeCss(literal) {
  // Bare CSS value tokens (e.g. willChange: 'transform')
  if (new RegExp(`^(?:${CSS_VALUE_TOKEN})$`).test(literal)) return true;
  // Multi-token CSS *values*, where the collision is the first token:
  //   willChange: "transform, opacity"
  //   transition: "transform 900ms cubic-bezier(.22,1,.36,1)"
  // Prose never opens with a bare property name followed by a duration,
  // an easing function, or another comma-separated property.
  if (
    new RegExp(
      `^(?:${CSS_VALUE_TOKEN})(?:\\s*,\\s*[a-z-]+)*(?:\\s+[\\d.]+m?s|\\s+(?:linear|ease|ease-in|ease-out|ease-in-out|steps|cubic-bezier)\\b)?[\\s,\\w.()-]*$`,
    ).test(literal.trim())
  )
    return true;
  // Many tailwind-shaped tokens — e.g. "rounded-full bg-[#3F6B47] px-7 py-3"
  const tw = literal.match(/[a-z]+-(?:\[[^\]]+\]|[a-z0-9._/-]+)/g);
  if (tw && tw.length >= 3) return true;
  // Variant prefixes
  if (/(?:hover|focus|active|group|peer|sm|md|lg|xl|dark|aria|data|first|last):/.test(literal))
    return true;
  // Common Tailwind / CSS keywords
  if (/\b(?:flex|grid|inline|block|absolute|relative|fixed|sticky|rounded|bg|text|border|shadow|w|h|p|m|gap|space|leading|tracking|font|opacity|z|min|max)-/.test(literal))
    return true;
  if (/\b(?:translate|will-change|transition|animate|duration|ease|delay)\b/.test(literal))
    return true;
  // Short tokenless strings probably aren't prose
  if (!literal.includes(" ") && literal.length < 30) return true;
  return false;
}

const findings = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      walk(full);
    } else if (EXTS.has(extname(name))) {
      const text = readFileSync(full, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        let m;
        STRING_RE.lastIndex = 0;
        while ((m = STRING_RE.exec(line)) !== null) {
          const literal = m[2].toLowerCase();
          if (looksLikeCss(literal)) continue;
          for (const word of BANNED) {
            const re = new RegExp(`(?<![\\w-])${word}(?![\\w-])`);
            if (re.test(literal)) {
              findings.push({
                file: full.slice(ROOT.length + 1).replaceAll("\\", "/"),
                line: i + 1,
                word,
                snippet: line.trim().slice(0, 100),
              });
            }
          }
        }
      });
    }
  }
}

for (const dir of SCAN_DIRS) {
  const full = join(ROOT, dir);
  try {
    walk(full);
  } catch {
    /* dir may not exist yet */
  }
}

if (findings.length === 0) {
  console.log("copy guard: clean");
  process.exit(0);
}

console.log(`copy guard: ${findings.length} banned-word occurrence(s) found`);
console.table(findings);
process.exit(1);
