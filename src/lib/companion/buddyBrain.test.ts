import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMOTIONS,
  EMOTION_MAP,
  FACE_PRESETS,
  GESTURES,
  MICROS,
  generateResponse,
  parseBuddyResponse,
  parseCues,
  createBuddyBrain,
} from "./buddyBrain";
import { createRecentTracker } from "./personality";

// Deterministic stub deps: pick the first line, rand fixed at 0.
const deps = { rand: () => 0, pick: (p: readonly string[]) => p[0] };

describe("parseCues", () => {
  it("strips tags, keeps clean text, and schedules micro/beat/gesture in order", () => {
    const { clean, cues } = parseCues("Got 'em. [wink] Then [beat] gone. [shrug] [xyz]");
    expect(clean).toBe("Got 'em. Then gone.");
    expect(clean).not.toContain("[");
    expect(cues.map((c) => `${c.type}:${c.value}`)).toEqual([
      "micro:wink",
      "beat:beat",
      "gesture:Shrug", // [shrug] maps to the clip name
    ]);
    // unknown [xyz] is dropped silently
  });

  it("returns no cues for plain text and offsets are monotonic & in range", () => {
    const plain = parseCues("Just a normal line.");
    expect(plain.cues).toHaveLength(0);
    expect(plain.clean).toBe("Just a normal line.");

    const { clean, cues } = parseCues("a [wink] b [smirk] c");
    let prev = -1;
    for (const c of cues) {
      expect(c.at).toBeGreaterThanOrEqual(0);
      expect(c.at).toBeLessThanOrEqual(clean.length);
      expect(c.at).toBeGreaterThanOrEqual(prev);
      prev = c.at;
    }
  });
});

describe("parseBuddyResponse", () => {
  it("fills defaults for a minimal valid payload", () => {
    const r = parseBuddyResponse({ reply: "hey", emotion: "smug", gesture: "Shrug" });
    expect(r.reply).toBe("hey");
    expect(r.emotion).toBe("smug");
    expect(r.facialExpression).toBe("auto");
    expect(r.microExpression).toBe("none");
    expect(r.animationState).toBe("idle");
    expect(r.gesture).toBe("Shrug");
    expect(r.humorLevel).toBe(1);
    expect(r.intensity).toBeCloseTo(0.85);
    expect(r.timing).toEqual({ preDelayMs: 350, holdMs: 2600, gestureTimeScale: 1 });
  });

  it("falls back to a neutral response for garbage, preserving a string reply", () => {
    expect(parseBuddyResponse(null).emotion).toBe("neutral");
    expect(parseBuddyResponse(null).reply).toBe("…");
    const bad = parseBuddyResponse({ reply: "hi", emotion: "banana", gesture: "Moonwalk" });
    expect(bad.emotion).toBe("neutral"); // invalid enum → fallback
    expect(bad.reply).toBe("hi"); // but the string reply survives
  });
});

describe("generateResponse (stub)", () => {
  it("maps an event to the right emotion/face/gesture", async () => {
    const r = await generateResponse({ kind: "buddyWin", mood: "cheerful" }, deps);
    expect(r.emotion).toBe("elated");
    expect(r.gesture).toBe("Bhangra dance");
    expect(r.microExpression).toBe("browFlash");
    expect(r.animationState).toBe("celebrating");
    expect(r.reply).toContain("Three in a row");
  });

  it("clamps humor to the mood ceiling (cringe guardrail)", async () => {
    const cheerful = await generateResponse({ kind: "buddyWin", mood: "cheerful" }, deps);
    const supportive = await generateResponse({ kind: "buddyWin", mood: "supportive" }, deps);
    expect(cheerful.humorLevel).toBe(3); // elated wants 3, cheerful allows 3
    expect(supportive.humorLevel).toBe(1); // …but supportive caps at 1
  });

  it("uses time-aware greetings", async () => {
    const g = await generateResponse({ kind: "greeting", lastSeenMs: null }, deps);
    expect(g.emotion).toBe("happy");
    expect(g.reply).toContain("Hi! I'm your MindMitra buddy.");
  });

  it("leans in for a player move", async () => {
    const p = await generateResponse({ kind: "playerMove" }, deps);
    expect(p.emotion).toBe("curious");
    expect(p.gesture).toBe("Thinking pose");
    expect(p.animationState).toBe("leaning-in");
  });
});

describe("board-aware reactions", () => {
  const analysis = (over: Partial<Record<string, boolean | number | string>> = {}) => ({
    cell: 4,
    player: "X" as const,
    tookCenter: false,
    tookCorner: false,
    blockedOpponent: false,
    createdFork: false,
    createsThreat: false,
    givesOpponentWin: false,
    ...over,
  });

  it("is impressed (surprised) when the player forks the buddy", async () => {
    const r = await generateResponse(
      { kind: "playerMove", analysis: analysis({ createdFork: true }) },
      deps,
    );
    expect(r.emotion).toBe("surprised");
    expect(r.reply.toLowerCase()).toContain("fork");
  });

  it("grumbles (focused) when the player blocks the buddy", async () => {
    const r = await generateResponse(
      { kind: "playerMove", analysis: analysis({ blockedOpponent: true }) },
      deps,
    );
    expect(r.emotion).toBe("focused");
  });

  it("gloats (smug) when the player leaves an opening", async () => {
    const r = await generateResponse(
      { kind: "playerMove", analysis: analysis({ givesOpponentWin: true }) },
      deps,
    );
    expect(r.emotion).toBe("smug");
  });

  it("gloats when the buddy's own move creates a threat", async () => {
    const r = await generateResponse(
      { kind: "buddyMove", analysis: analysis({ player: "O", createsThreat: true }) },
      deps,
    );
    expect(r.emotion).toBe("smug");
  });

  it("falls back to the generic emotion when nothing notable happened", async () => {
    const r = await generateResponse({ kind: "playerMove", analysis: analysis() }, deps);
    expect(r.emotion).toBe("curious");
  });
});

describe("mood machine", () => {
  it("goes smug after a win and decays to calm after the TTL", async () => {
    let t = 1000;
    const brain = createBuddyBrain(createRecentTracker(), () => t);
    await brain.respond({ kind: "buddyWin" });
    expect(brain.mood()).toBe("smug");
    t = 1000 + 20_000 + 1; // past the 20s smug window
    expect(brain.mood()).toBe("calm");
  });

  it("sulks after a loss", async () => {
    let t = 0;
    const brain = createBuddyBrain(createRecentTracker(), () => t);
    await brain.respond({ kind: "playerWin" });
    expect(brain.mood()).toBe("sulky");
    t = 16_000;
    expect(brain.mood()).toBe("calm");
  });

  it("drift('sleepy') stays sleepy (deep idle, not calm) past its TTL", () => {
    let t = 0;
    const brain = createBuddyBrain(createRecentTracker(), () => t);
    brain.drift("sleepy", 500);
    t = 1000;
    expect(brain.mood()).toBe("sleepy");
  });
});

describe("recent tracker (cooldown)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("avoids an immediate repeat when the pool has alternatives", () => {
    const seq = [0, 0, 0.6]; // pick 'a', then 'a' again (recent) → retry → 'b'
    let i = 0;
    vi.spyOn(Math, "random").mockImplementation(() => seq[i++] ?? 0);
    const rt = createRecentTracker(3);
    expect(rt.pick(["a", "b"])).toBe("a");
    expect(rt.pick(["a", "b"])).toBe("b");
  });

  it("returns the only item for a single-item pool and '' for an empty pool", () => {
    const rt = createRecentTracker();
    expect(rt.pick(["x"])).toBe("x");
    expect(rt.pick([])).toBe("");
  });
});

describe("EMOTION_MAP integrity", () => {
  it("covers every emotion and references only valid preset/micro/gesture names", () => {
    for (const e of EMOTIONS) {
      const spec = EMOTION_MAP[e];
      expect(spec, `missing EMOTION_MAP entry for ${e}`).toBeDefined();
      expect(FACE_PRESETS).toContain(spec.basePreset);
      for (const m of spec.micro) expect(MICROS).toContain(m);
      for (const g of spec.gestures) expect([...GESTURES, "none"]).toContain(g);
    }
  });
});
