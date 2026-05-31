#!/usr/bin/env node
/**
 * fill-locales.mjs — machine-translate the chat/UI locale files.
 *
 * WHAT IT DOES
 *   Reads src/i18n/locales/en.json (the source of truth) and produces a
 *   fully-populated translation for each target locale that is currently a
 *   stub (ta / te / kn / ja). Keys and ICU/i18next interpolation tokens
 *   (e.g. {{name}}, {{companion}}) are preserved verbatim — only the human
 *   text is translated.
 *
 *   Every generated file is tagged with an `_authoring_note` flagging it as
 *   MACHINE-TRANSLATED, PENDING NATIVE REVIEW. The runtime already sets
 *   `fallbackLng: "en"`, so until this script is run (or a human edits the
 *   files) the UI simply shows English for those locales — nothing breaks.
 *
 * WHY A SCRIPT (not hand-authored JSON)
 *   The decision on this change was "machine-translate now + flag for native
 *   review". Hand-producing ~150 keys × 4 scripts is error-prone; this keeps
 *   en.json the single source and makes re-running cheap whenever en.json
 *   grows.
 *
 * USAGE
 *   GEMINI_API_KEY=...  node scripts/i18n/fill-locales.mjs            # all targets
 *   GEMINI_API_KEY=...  node scripts/i18n/fill-locales.mjs ta te      # subset
 *   I18N_MODEL=gemini-2.0-flash  node scripts/i18n/fill-locales.mjs   # override model
 *
 *   Provide GEMINI_API_KEY (Google AI Studio). To use a different provider,
 *   replace `translateJson()` — the rest of the script is provider-agnostic.
 *
 * SAFETY
 *   - Does NOT touch en / hi / hinglish (those are human-authored).
 *   - Validates that the translated tree has the SAME key shape as en.json
 *     before writing; aborts that locale on mismatch.
 *   - Re-checks that every {{token}} present in a source string survives.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = resolve(__dirname, "../../src/i18n/locales");

const TARGETS = {
  ta: { name: "Tamil", script: "Tamil script" },
  te: { name: "Telugu", script: "Telugu script" },
  kn: { name: "Kannada", script: "Kannada script" },
  ja: { name: "Japanese", script: "natural Japanese" },
};

const MODEL = process.env.I18N_MODEL || "gemini-2.0-flash";
const API_KEY = process.env.GEMINI_API_KEY;

// ── helpers ───────────────────────────────────────────────────────────────
const TOKEN_RE = /\{\{[^}]+\}\}/g;

function tokensOf(s) {
  return (String(s).match(TOKEN_RE) || []).sort();
}

/** Recursively assert two objects have the same key structure. */
function sameShape(a, b, path = "") {
  const ak = Object.keys(a).filter((k) => k !== "_authoring_note").sort();
  const bk = Object.keys(b).filter((k) => k !== "_authoring_note").sort();
  if (ak.join("|") !== bk.join("|")) {
    throw new Error(`key mismatch at "${path || "(root)"}": [${ak}] vs [${bk}]`);
  }
  for (const k of ak) {
    if (typeof a[k] === "object" && a[k] !== null) {
      sameShape(a[k], b[k], path ? `${path}.${k}` : k);
    } else if (tokensOf(a[k]).join() !== tokensOf(b[k]).join()) {
      throw new Error(`token mismatch at "${path}.${k}": kept ${tokensOf(b[k])}`);
    }
  }
}

/** One-shot translate the whole JSON via Gemini. */
async function translateJson(source, target) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is not set");
  const sys =
    `You are a professional localizer for a warm, informal Indian mental-health ` +
    `companion app for college students. Translate the JSON VALUES into ${target.name} ` +
    `(${target.script}). Rules:\n` +
    `- Return ONLY a JSON object with the EXACT same keys and nesting.\n` +
    `- Never translate or alter interpolation tokens like {{name}} or {{companion}}.\n` +
    `- Keep tone gentle, conversational, non-clinical; avoid literary/formal register.\n` +
    `- Do not translate keys, brand names (MindMitra, Mitra), or file-format names (PDF/JSON/CSV).\n` +
    `- Preserve punctuation/emoji.`;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(source) }] }],
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("empty model response");
  return JSON.parse(text);
}

// ── main ──────────────────────────────────────────────────────────────────
const wanted = process.argv.slice(2);
const codes = wanted.length ? wanted : Object.keys(TARGETS);

const en = JSON.parse(await readFile(resolve(LOCALES_DIR, "en.json"), "utf8"));
delete en._authoring_note;

for (const code of codes) {
  const target = TARGETS[code];
  if (!target) {
    console.error(`skip "${code}": not a machine-translation target`);
    continue;
  }
  try {
    console.log(`translating → ${code} (${target.name}) via ${MODEL} …`);
    const translated = await translateJson(en, target);
    sameShape(en, translated);
    const out = {
      _authoring_note: `${target.name} copy — MACHINE-TRANSLATED (${MODEL}), PENDING NATIVE REVIEW before production.`,
      ...translated,
    };
    const path = resolve(LOCALES_DIR, `${code}.json`);
    await writeFile(path, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(`  ✓ wrote ${path}`);
  } catch (e) {
    console.error(`  ✗ ${code} failed: ${e.message}`);
    process.exitCode = 1;
  }
}
