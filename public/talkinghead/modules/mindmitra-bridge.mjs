/**
 * MindMitra Therapeutic Avatar Bridge
 * ────────────────────────────────────
 * Integrates findings from "3DXTalker: Unifying Identity, Lip Sync, Emotion,
 * and Spatial Dynamics" (2026) into the TalkingHead library.
 *
 * 6 paper-backed features:
 *  1. Frame-wise amplitude embeddings for jaw aperture
 *  2. Frame-wise emotion timeline (mid-response expression changes)
 *  3. Disentangled 4-layer architecture (identity / expression / pose / lip sync)
 *  4. 7 core emotion templates mapped to therapeutic contexts
 *  5. Intensity scaling (6 levels: 1.0× → 2.0×)
 *  6. Natural head pose vs. controlled therapeutic gestures
 *
 * Usage:
 *   import { TalkingHead } from './talkinghead.mjs';
 *   import { MindMitraBridge } from './mindmitra-bridge.mjs';
 *
 *   const head = new TalkingHead(node, { ... });
 *   const bridge = new MindMitraBridge(head);
 *   await head.showAvatar({ ... });
 *   bridge.init();  // inject therapeutic moods + per-frame hook
 */

// ═══════════════════════════════════════════════════════════════════
//  1. AMPLITUDE ANALYZER — Frame-wise RMS for jaw aperture scaling
// ═══════════════════════════════════════════════════════════════════

class AmplitudeAnalyzer {

    /**
     * @param {number} frameRate  Frames per second (default 25 — matches paper)
     * @param {number} smoothingWindow  Moving average half-width
     */
    constructor(frameRate = 25, smoothingWindow = 3) {
        this.frameRate = frameRate;
        this.smoothingWindow = smoothingWindow;
    }

    /**
     * Extract amplitude envelope from a decoded AudioBuffer.
     * Returns array of { time, amplitude } where amplitude ∈ [0, 1].
     */
    extractFromAudioBuffer(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        return this._extract(channelData, sampleRate);
    }

    /**
     * Extract amplitude from raw PCM Float32 (for Azure TTS streaming).
     */
    extractFromPCM(pcmData, sampleRate) {
        return this._extract(pcmData, sampleRate);
    }

    /**
     * Lookup amplitude at a given time (seconds).
     */
    getAmplitudeAtTime(frames, timeSeconds) {
        if (!frames || frames.length === 0) return 0;
        const idx = Math.floor(timeSeconds * this.frameRate);
        const clamped = Math.max(0, Math.min(idx, frames.length - 1));
        return frames[clamped].amplitude;
    }

    /**
     * Paper finding #1: jaw opens MORE with louder speech.
     * baseJawOpen comes from the phoneme viseme; amplitude adds energy scaling.
     *   amplitude=0 → jaw at 50% of base
     *   amplitude=1 → jaw at 100% of base + 10% extra
     */
    scaleJawWithAmplitude(baseJawOpen, amplitude) {
        const scale = 0.5 + amplitude * 0.5;          // 0.5 – 1.0
        return Math.min(baseJawOpen * scale + amplitude * 0.10, 1.0);
    }

    // ── internals ────────────────────────────────────────────

    _extract(channelData, sampleRate) {
        const samplesPerFrame = Math.floor(sampleRate / this.frameRate);
        const raw = [];

        for (let i = 0; i < channelData.length; i += samplesPerFrame) {
            const end = Math.min(i + samplesPerFrame, channelData.length);
            let sumSq = 0;
            for (let j = i; j < end; j++) sumSq += channelData[j] * channelData[j];
            const rms = Math.sqrt(sumSq / (end - i));
            raw.push({ time: i / sampleRate, amplitude: rms });
        }

        return this._normalizeAndSmooth(raw);
    }

    _normalizeAndSmooth(frames) {
        const maxAmp = Math.max(...frames.map(f => f.amplitude), 0.001);
        const normalized = frames.map(f => ({
            ...f, amplitude: f.amplitude / maxAmp
        }));

        return normalized.map((frame, i) => {
            const lo = Math.max(0, i - this.smoothingWindow);
            const hi = Math.min(normalized.length - 1, i + this.smoothingWindow);
            let sum = 0, cnt = 0;
            for (let j = lo; j <= hi; j++) { sum += normalized[j].amplitude; cnt++; }
            return { ...frame, amplitude: sum / cnt };
        });
    }
}


// ═══════════════════════════════════════════════════════════════════
//  4 + 5. EMOTION TEMPLATES — 7 core emotions × 6 intensity levels
// ═══════════════════════════════════════════════════════════════════

/**
 * Paper validated 7 core emotions. We map them to therapeutic contexts:
 *   Happy    → encouragement   (celebrate progress)
 *   Sad      → empathy         (mirror user's pain)
 *   Fear     → concern         (show worry)
 *   Surprise → acknowledgment  ("I hear you")
 *   Neutral  → neutral / calm  (baseline / de-escalation)
 *   Angry    → not used therapeutically
 *   Disgust  → not used therapeutically
 *   Contempt → not used therapeutically
 *
 * Plus two therapy-specific additions:
 *   listening — subtle open expression while user speaks
 *   calm      — minimal, soft — used during breathing exercises
 */

const THERAPEUTIC_MOODS = {

    // ── empathy: mirrors user's pain ─────────────────────
    // Upper: raised inner brows + slight furrow → anguished concern
    // Lower: downturned mouth corners + pressed lips + subtle lip-roll
    // Eyes:  soft squint (warmth) + gentle downward gaze
    'empathy': {
        baseline: {
            browInnerUp: 0.72,
            browDownLeft: 0.18, browDownRight: 0.18,
            browOuterUpLeft: 0.06, browOuterUpRight: 0.06,
            eyeSquintLeft: 0.28, eyeSquintRight: 0.28,
            eyeWideLeft: 0.06, eyeWideRight: 0.06,
            eyeLookDownLeft: 0.05, eyeLookDownRight: 0.05,
            mouthFrownLeft: 0.20, mouthFrownRight: 0.20,
            mouthPressLeft: 0.12, mouthPressRight: 0.12,   // suppressed emotion
            mouthRollLower: 0.08,                           // bitten lower lip
            mouthShrugLower: 0.06,
            cheekSquintLeft: 0.16, cheekSquintRight: 0.16,
            noseSneerLeft: 0.05, noseSneerRight: 0.05,      // micro-crinkle
        },
        speech: { deltaRate: -0.10, deltaPitch: -0.05, deltaVolume: 0 },
        anims: null,  // filled at init from TalkingHead's 'sad' mood anims
    },

    // ── concern: "I'm worried about you" ─────────────────
    // Upper: furrowed brows + wide eyes → alert worry
    // Lower: downturned + tense mouth corners
    // Eyes:  wide (alert), slight downward lean
    'concern': {
        baseline: {
            browInnerUp: 0.50,
            browDownLeft: 0.35, browDownRight: 0.35,
            browOuterUpLeft: 0.38, browOuterUpRight: 0.38,
            eyeWideLeft: 0.38, eyeWideRight: 0.38,
            eyeSquintLeft: 0.05, eyeSquintRight: 0.05,
            eyeLookDownLeft: 0.04, eyeLookDownRight: 0.04,
            mouthFrownLeft: 0.20, mouthFrownRight: 0.20,
            mouthStretchLeft: 0.10, mouthStretchRight: 0.10, // tense corners
            mouthPressLeft: 0.06, mouthPressRight: 0.06,
            cheekSquintLeft: 0.07, cheekSquintRight: 0.07,
            noseSneerLeft: 0.04, noseSneerRight: 0.04,
        },
        speech: { deltaRate: -0.08, deltaPitch: -0.03, deltaVolume: 0 },
        anims: null,  // filled from 'fear' mood anims
    },

    // ── encouragement: genuine Duchenne warm smile ────────
    // Upper: relaxed brows + strong eye squint (Duchenne marker)
    // Lower: full smile + dimples + raised cheeks
    // Avoids plastic smile by capping mouthSmile and adding cheek involvement
    'encouragement': {
        baseline: {
            browInnerUp: 0.12,
            browDownLeft: 0.02, browDownRight: 0.02,
            browOuterUpLeft: 0.22, browOuterUpRight: 0.22,
            eyeSquintLeft: 0.48, eyeSquintRight: 0.48,   // Duchenne — essential
            eyeWideLeft: 0.05, eyeWideRight: 0.05,
            eyeLookDownLeft: 0.02, eyeLookDownRight: 0.02,
            mouthSmileLeft: 0.44, mouthSmileRight: 0.44,
            mouthDimpleLeft: 0.14, mouthDimpleRight: 0.14,
            mouthShrugUpper: 0.06,                       // slight upper lip lift
            cheekSquintLeft: 0.40, cheekSquintRight: 0.40, // cheek rise = real smile
            cheekPuff: 0.05,
        },
        speech: { deltaRate: -0.02, deltaPitch: 0.08, deltaVolume: 0 },
        anims: null,  // filled from 'happy' mood anims
    },

    // ── acknowledgment: "I hear that, tell me more" ──────
    // Upper: raised outer brows (open/receptive) + soft eyes
    // Lower: tiny smile + relaxed mouth → attentive openness
    'acknowledgment': {
        baseline: {
            browInnerUp: 0.32,
            browOuterUpLeft: 0.42, browOuterUpRight: 0.42,
            browDownLeft: 0.00, browDownRight: 0.00,
            eyeWideLeft: 0.28, eyeWideRight: 0.28,
            eyeSquintLeft: 0.08, eyeSquintRight: 0.08,
            eyeLookDownLeft: 0.03, eyeLookDownRight: 0.03,
            mouthSmileLeft: 0.12, mouthSmileRight: 0.12,
            mouthStretchLeft: 0.06, mouthStretchRight: 0.06, // slight part
            mouthDimpleLeft: 0.04, mouthDimpleRight: 0.04,
            cheekSquintLeft: 0.08, cheekSquintRight: 0.08,
        },
        speech: { deltaRate: -0.04, deltaPitch: 0.05, deltaVolume: 0 },
        anims: null,  // filled from 'surprised' mood anims
    },

    // ── calm: breathing exercises / grounding ────────────
    // Minimal, soft half-lidded expression. No shock, no drama.
    // Slight downward gaze = introspective / meditative
    'calm': {
        baseline: {
            browInnerUp: 0.06,
            browDownLeft: 0.02, browDownRight: 0.02,
            eyeSquintLeft: 0.18, eyeSquintRight: 0.18,  // soft-lidded
            eyeWideLeft: 0.00, eyeWideRight: 0.00,
            eyeLookDownLeft: 0.08, eyeLookDownRight: 0.08, // soft downward gaze
            mouthSmileLeft: 0.09, mouthSmileRight: 0.09,
            mouthPucker: 0.04,                            // very slight collect
            mouthRollLower: 0.05,                         // lower lip gently inward
            cheekSquintLeft: 0.08, cheekSquintRight: 0.08,
        },
        speech: { deltaRate: -0.12, deltaPitch: -0.05, deltaVolume: -0.05 },
        anims: null,  // filled from 'neutral' mood anims
    },

    // ── listening: subtle open, fully present ────────────
    // Very restrained — signals active attention without emotion overlay
    'listening': {
        baseline: {
            browInnerUp: 0.20,
            browOuterUpLeft: 0.10, browOuterUpRight: 0.10,
            browDownLeft: 0.00, browDownRight: 0.00,
            eyeWideLeft: 0.07, eyeWideRight: 0.07,
            eyeSquintLeft: 0.07, eyeSquintRight: 0.07,
            eyeLookDownLeft: 0.03, eyeLookDownRight: 0.03,
            mouthSmileLeft: 0.07, mouthSmileRight: 0.07,
            mouthDimpleLeft: 0.03, mouthDimpleRight: 0.03,
            cheekSquintLeft: 0.04, cheekSquintRight: 0.04,
        },
        speech: { deltaRate: -0.05, deltaPitch: 0, deltaVolume: 0 },
        anims: null,  // filled from 'neutral' mood anims
    },
};

/**
 * Mood-to-base mapping: our therapeutic mood → which TalkingHead built-in
 * mood supplies the animation templates (breathing, pose, head, eyes, etc.)
 */
const MOOD_ANIM_SOURCE = {
    empathy: 'sad',
    concern: 'fear',
    encouragement: 'happy',
    acknowledgment: 'surprised',
    calm: 'neutral',
    listening: 'neutral',
};

/**
 * Paper finding #5 — 6 intensity levels (1.0× → 2.0×).
 * For therapy, we cap at 1.6× to avoid overwhelming the user.
 */
const INTENSITY_LEVELS = [1.0, 1.2, 1.3, 1.4, 1.6, 2.0];

const THERAPEUTIC_INTENSITIES = {
    neutral: 1.0,
    empathy: 1.3,  // warm presence, not dramatic
    concern: 1.4,  // clearly present but not alarming
    encouragement: 1.4,  // energizing but genuine
    acknowledgment: 1.2,  // subtle signal of attention
    calm: 1.0,  // never amplify calm
    listening: 1.0,  // always subtle
};

// Soft-knee compressor for intensity-scaled morph values. A hard
// Math.min(x, 1) clamp flattens every over-driven morph to the same 1.0,
// destroying the ratios between morphs that give a mood its shape
// (worst on Olaf, whose 1.5× styleMultiplier pushes several baselines
// past 1.0). Values ≤ knee pass through untouched; above the knee they
// compress asymptotically toward 1.0 without ever reaching it.
const softClip = (x, knee = 0.7) =>
    x <= knee ? x : knee + (1 - knee) * (1 - Math.exp(-(x - knee) / (1 - knee)));

// Lower-face morphs are owned by the viseme lipsync engine while the
// avatar is speaking. Stripping them out of mood baselines lets us keep
// upper-face emotion (brows, eyes, cheeks) on during speech without the
// mouth/jaw fighting the phoneme tracks.
const LOWER_FACE_PREFIXES = ['mouth', 'jaw', 'viseme_'];
function stripLowerFace(baseline) {
    const out = {};
    for (const [key, value] of Object.entries(baseline)) {
        const isLowerFace = LOWER_FACE_PREFIXES.some(p => key.startsWith(p));
        if (!isLowerFace) out[key] = value;
    }
    return out;
}


// ═══════════════════════════════════════════════════════════════════
//  2. EMOTION TIMELINE — Expression changes MID-RESPONSE
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a timeline of emotion keyframes from AI response metadata.
 * The AI backend should return structured cues like:
 *   [{ text: "I understand...", emotion: "empathy" },
 *    { text: "Let's try...", emotion: "encouragement" }]
 */
function buildEmotionTimeline(emotionCues, wpm = 130) {
    let currentTime = 0;
    const keyframes = [];

    for (const cue of emotionCues) {
        const words = cue.text.trim().split(/\s+/).length;
        const duration = (words / wpm) * 60;

        keyframes.push({
            startTime: currentTime,
            emotion: cue.emotion || 'neutral',
            intensity: cue.intensity ?? THERAPEUTIC_INTENSITIES[cue.emotion] ?? 1.0,
            transitionDuration: 0.4,  // 400ms blend — smooth but responsive
        });

        currentTime += duration;
    }

    return { keyframes, totalDuration: currentTime };
}

/**
 * Get active emotion at a given elapsed time.
 */
function getActiveEmotion(timeline, currentTime) {
    if (!timeline || !timeline.keyframes || timeline.keyframes.length === 0) {
        return { emotion: 'neutral', intensity: 1.0, progress: 1.0 };
    }

    const active = timeline.keyframes.filter(kf => kf.startTime <= currentTime);
    if (active.length === 0) {
        return { emotion: 'neutral', intensity: 1.0, progress: 1.0 };
    }

    const current = active[active.length - 1];
    const progress = Math.min(
        (currentTime - current.startTime) / current.transitionDuration,
        1.0
    );

    return {
        emotion: current.emotion,
        intensity: current.intensity,
        progress,
    };
}


// ═══════════════════════════════════════════════════════════════════
//  6. THERAPEUTIC GESTURES — Controlled head pose
// ═══════════════════════════════════════════════════════════════════

/**
 * Named gesture sequences applied via TalkingHead's custom morph targets
 * (headRotateX, headRotateY, headRotateZ, bodyRotateX, bodyRotateY, bodyRotateZ).
 */
const THERAPEUTIC_GESTURES = {

    // Keyframes follow basic animation principles: a tiny counter-movement
    // (anticipation) before the main action and a small overshoot before
    // settling, so gestures read as weighted instead of mechanical.
    // Anticipation/overshoot amplitudes stay ≤0.015 rad — calm, not bouncy.

    // Empathetic nod: lift-down-up-down-settle (1.5s)
    slow_nod: {
        duration: 1500,
        keyframes: [
            { t: 0, headRotateX: 0.00 },
            { t: 120, headRotateX: -0.015 },  // anticipation: tiny lift
            { t: 560, headRotateX: 0.10 },    // nod down
            { t: 1000, headRotateX: 0.00 },   // return
            { t: 1200, headRotateX: 0.05 },   // second gentle nod
            { t: 1380, headRotateX: -0.008 }, // settle overshoot
            { t: 1500, headRotateX: 0.00 },   // rest
        ],
        triggeredBy: ['empathy', 'acknowledgment', 'listening'],
    },

    // Concern lean: slow forward tilt, hold, return (3.5s).
    // No anticipation — a lean-in should feel deliberate, not springy.
    lean_forward: {
        duration: 3500,
        keyframes: [
            { t: 0, bodyRotateX: 0.00 },
            { t: 800, bodyRotateX: 0.07 },      // lean in
            { t: 2500, bodyRotateX: 0.07 },     // hold
            { t: 3250, bodyRotateX: -0.006 },   // settle overshoot on return
            { t: 3500, bodyRotateX: 0.00 },     // rest
        ],
        triggeredBy: ['empathy', 'concern'],
    },

    // Thoughtful head tilt (2.5s)
    thinking_tilt: {
        duration: 2500,
        keyframes: [
            { t: 0, bodyRotateZ: 0.00 },
            { t: 150, bodyRotateZ: 0.015 },    // anticipation: counter-tilt
            { t: 700, bodyRotateZ: -0.08 },    // tilt
            { t: 1800, bodyRotateZ: -0.08 },   // hold
            { t: 2300, bodyRotateZ: 0.01 },    // settle overshoot
            { t: 2500, bodyRotateZ: 0.00 },    // rest
        ],
        triggeredBy: ['neutral'],
    },

    // Gentle double-nod for agreement (1.8s) — second nod decays so the
    // repeat doesn't read as a loop.
    agreement_nod: {
        duration: 1800,
        keyframes: [
            { t: 0, headRotateX: 0.00 },
            { t: 100, headRotateX: -0.012 },  // anticipation: tiny lift
            { t: 340, headRotateX: 0.08 },
            { t: 620, headRotateX: 0.00 },
            { t: 900, headRotateX: 0.06 },    // second, smaller nod
            { t: 1200, headRotateX: 0.00 },
            { t: 1350, headRotateX: -0.006 }, // settle overshoot
            { t: 1800, headRotateX: 0.00 },
        ],
        triggeredBy: ['acknowledgment', 'encouragement'],
    },
};

const EMOTION_TO_GESTURE = {
    empathy: 'lean_forward',
    concern: 'lean_forward',
    acknowledgment: 'slow_nod',
    encouragement: 'agreement_nod',
    listening: 'slow_nod',
    neutral: 'thinking_tilt',
    calm: null, // no gesture for calm
};

// Parallel map of emotion → TalkingHead hand-gesture template name.
// These move arm/forearm/hand/fingers — independent of the head/body
// gestures in EMOTION_TO_GESTURE, so both can fire simultaneously.
const EMOTION_TO_HAND_GESTURE = {
    empathy: 'hand_to_chest',
    concern: 'hand_to_chest',
    acknowledgment: 'open_palm_welcome',
    encouragement: 'open_palm_welcome',
    listening: null,    // stay still while user talks
    calm: null,         // never gesture during grounding
    neutral: null,      // let the beat scheduler handle this
};

const GESTURE_COOLDOWN_MS = 4000;
// Cooldown is jittered ±(0.85×–1.35×) per gesture so consecutive gestures
// don't recur on a fixed clock.
const rollGestureCooldown = () => GESTURE_COOLDOWN_MS * (0.85 + Math.random() * 0.5);

// Interval between periodic "accent beat" gestures during long speech.
// Randomized per beat: a fixed 5.5s metronome read as mechanical across
// multi-sentence replies. The range keeps the rig visibly alive without
// becoming twitchy — paired with the bumped expression baselines above.
const BEAT_INTERVAL_RANGE_MS = [4500, 8000];
const rollBeatDelay = () =>
    BEAT_INTERVAL_RANGE_MS[0] +
    Math.random() * (BEAT_INTERVAL_RANGE_MS[1] - BEAT_INTERVAL_RANGE_MS[0]);
// Occasionally play the softer beat variant so long replies don't repeat
// one identical arm movement.
const BEAT_SOFT_PROBABILITY = 0.25;
const BEAT_DURATION_S = 1.5;


// ═══════════════════════════════════════════════════════════════════
//  3. MAIN BRIDGE — Disentangled 4-layer controller over TalkingHead
// ═══════════════════════════════════════════════════════════════════

/**
 * MindMitraBridge wraps a TalkingHead instance with the paper's architecture:
 *
 *   Layer 1 — Identity     (stable: set once via showAvatar)
 *   Layer 2 — Expression   (emotion changes via mood + baseline morphs)
 *   Layer 3 — Head Pose    (natural sway from TH + controlled gestures)
 *   Layer 4 — Lip Sync     (owned by TalkingHead's built-in visemes)
 *
 * The layers NEVER interfere with each other — expression uses upper-face
 * morph targets, lip sync owns the mouth, head pose uses bone rotations.
 */
class MindMitraBridge {

    /**
     * @param {TalkingHead} head  An already-constructed TalkingHead instance.
     * @param {Object} [opts]
     * @param {number} [opts.styleMultiplier=1.0]  Per-avatar amplitude scale
     *   for expression intensities. Stylised/cartoon rigs (e.g. Olaf) need
     *   ~1.5× to read as warmly as human avatars at the same baselines.
     * @param {boolean} [opts.reducedMotion=false]  Honour the user's
     *   prefers-reduced-motion: suppress beat/hand/head/body gestures.
     *   Mood expressions and breathing stay on.
     */
    constructor(head, opts = {}) {
        this.head = head;
        this.styleMultiplier = opts.styleMultiplier ?? 1.0;
        this.reducedMotion = opts.reducedMotion ?? false;
        this.amplitudeAnalyzer = new AmplitudeAnalyzer();

        // State
        this.state = 'idle';            // idle | listening | thinking | speaking
        this.currentEmotion = 'neutral';
        this.currentIntensity = 1.0;
        this.emotionTimeline = null;
        this.responseStartTime = 0;

        // Amplitude data for current utterance
        this.amplitudeFrames = [];
        // Disabled by default: TalkingHead already drives mouth/jaw from
        // visemes. A second amplitude-based jaw writer can over-open or
        // desynchronise RPM lips, especially with Azure word-boundary sync.
        this.enableAmplitudeJawBoost = false;

        // Gesture state
        this._gestureActive = false;
        this._gestureStart = 0;
        this._gesture = null;
        this._lastGestureEnd = 0;
        this._nextGestureCooldown = rollGestureCooldown();

        // Periodic hand-beat scheduler — fires an accent beat at a
        // randomized interval while the avatar is speaking (except in calm).
        this._lastBeatTime = 0;
        this._nextBeatDelay = rollBeatDelay();

        // Per-frame callback reference (so we can remove it)
        this._originalUpdate = null;
        this._boundUpdate = this._perFrameUpdate.bind(this);

        // Track which morph targets we "own" via setFixedValue
        this._ownedMorphs = new Set();
    }

    // ═══════════════════════════════════════════
    //  INITIALIZATION
    // ═══════════════════════════════════════════

    /**
     * Call AFTER `head.showAvatar()` resolves.
     * Injects therapeutic moods and hooks the per-frame update.
     */
    init() {
        this._injectTherapeuticMoods();
        this._hookPerFrameUpdate();
    }

    /**
     * Inject our custom therapeutic moods into TalkingHead's mood dictionary.
     * Each therapeutic mood borrows animation templates (breathing, pose, head,
     * eyes, blink, mouth, misc) from the closest built-in mood, but overrides
     * the baseline facial expression.
     */
    _injectTherapeuticMoods() {
        const builtInMoods = this.head.animMoods;

        for (const [name, mood] of Object.entries(THERAPEUTIC_MOODS)) {
            const sourceName = MOOD_ANIM_SOURCE[name];
            const source = builtInMoods[sourceName] || builtInMoods['neutral'];

            builtInMoods[name] = {
                baseline: { ...mood.baseline },
                speech: { ...mood.speech },
                anims: JSON.parse(JSON.stringify(source.anims)),  // deep clone
            };

            // Upper-face-only variant: used while the avatar is speaking so
            // visemes get a neutral mouth canvas while brows/eyes/cheeks
            // still carry the emotion.
            const speechBaseline = stripLowerFace(mood.baseline);
            if (name === 'encouragement') {
                // Smile-while-speaking should show some mouth interior.
                // Olaf has no separate teeth mesh — this jaw bias is the
                // closest honest "show some teeth" approximation. Small
                // enough that visemes still own moment-to-moment shape.
                speechBaseline.jawOpen = 0.08;
                speechBaseline.mouthOpen = 0.05;
            }
            builtInMoods[`${name}_speech`] = {
                baseline: speechBaseline,
                speech: { ...mood.speech },
                anims: JSON.parse(JSON.stringify(source.anims)),
            };
        }

        // Also provide a no-op `neutral_speech` so the React layer can
        // fall back to it without TalkingHead warning about an unknown mood.
        const neutralSource = builtInMoods['neutral'];
        if (neutralSource && !builtInMoods['neutral_speech']) {
            builtInMoods['neutral_speech'] = {
                baseline: stripLowerFace(neutralSource.baseline || {}),
                speech: { ...(neutralSource.speech || {}) },
                anims: JSON.parse(JSON.stringify(neutralSource.anims)),
            };
        }
    }

    /**
     * Hook into TalkingHead's per-frame callback (`opt.update`).
     * If the user already set one, we chain-call it.
     */
    _hookPerFrameUpdate() {
        this._originalUpdate = this.head.opt.update;
        this.head.opt.update = this._boundUpdate;
    }

    /**
     * Clean up — restore original update callback.
     */
    dispose() {
        this.head.opt.update = this._originalUpdate;
        this._releaseOwnedMorphs();
    }

    // ═══════════════════════════════════════════
    //  STATE TRANSITIONS — Therapeutic flow
    // ═══════════════════════════════════════════

    /**
     * User started speaking → avatar listens.
     */
    onUserStartedSpeaking() {
        this.state = 'listening';
        this.setEmotion('listening');
        // Increase eye contact while listening
        if (this.head.mtAvatar?.avatarIdleEyeContact) {
            this.head.opt.avatarIdleEyeContact = 0.7;
        }
    }

    /**
     * User finished speaking → avatar "thinks".
     */
    onUserFinishedSpeaking() {
        this.state = 'thinking';
        this.setEmotion('neutral');
        this._triggerGesture('thinking_tilt');
    }

    /**
     * AI response ready — begin speaking with emotion timeline.
     *
     * @param {Array<{text: string, emotion: string, intensity?: number}>} emotionCues
     *   The AI backend should segment its response with emotion cues.
     * @param {AudioBuffer} [audioBuffer]  Optional pre-decoded audio for amplitude analysis
     */
    onAvatarStartSpeaking(emotionCues, audioBuffer = null) {
        this.state = 'speaking';
        this.responseStartTime = performance.now();

        // Build emotion timeline
        this.emotionTimeline = buildEmotionTimeline(emotionCues);

        // Keep amplitude analysis opt-in. Normal speech leaves mouth/jaw fully
        // under TalkingHead's viseme control.
        if (this.enableAmplitudeJawBoost && audioBuffer) {
            this.amplitudeFrames = this.amplitudeAnalyzer.extractFromAudioBuffer(audioBuffer);
        } else {
            this.amplitudeFrames = [];
        }

        // Set initial emotion
        if (emotionCues.length > 0) {
            const first = emotionCues[0];
            this.setEmotion(first.emotion, first.intensity);

            // Opening gesture for emotional moments — skip for neutral: viseme lip-sync
            // and amplitude jaw run with a neutral mouth baseline; thinking_tilt every
            // reply fights the face and reads as jitter.
            const gesture = EMOTION_TO_GESTURE[first.emotion];
            if (gesture && first.emotion !== "neutral") this._triggerGesture(gesture);

            // Hand gesture (arm/forearm/hand) — runs in parallel with the
            // head/body gesture above. Skipped for null entries (listening,
            // calm, neutral) to keep grounding/listening still.
            const handGesture = EMOTION_TO_HAND_GESTURE[first.emotion];
            if (handGesture && !this.reducedMotion && typeof this.head.playGesture === 'function') {
                try { this.head.playGesture(handGesture, 3.5, false); } catch (e) { /* noop */ }
            }
        }

        // Reset beat schedule so each new reply starts fresh — first beat
        // fires after a freshly rolled delay from speech start.
        this._lastBeatTime = performance.now();
        this._nextBeatDelay = rollBeatDelay();
    }

    /**
     * Avatar finished speaking → return to idle.
     */
    onAvatarFinishedSpeaking() {
        this.state = 'idle';
        this.emotionTimeline = null;
        this.amplitudeFrames = [];
        this._releaseOwnedMorphs();
        this._lastBeatTime = 0;

        // Gentle return to neutral over 600ms
        this.setEmotion('neutral', 1.0);
    }

    // ═══════════════════════════════════════════
    //  EMOTION CONTROL (Paper #4 + #5)
    // ═══════════════════════════════════════════

    /**
     * Set the avatar's emotion (mood).
     * Applies intensity scaling by temporarily patching the mood's baseline
     * before calling setMood(), then restoring — so TalkingHead always sees
     * the correctly scaled values without relying on a non-standard API.
     *
     * @param {string} emotion   One of: neutral, empathy, concern, encouragement,
     *                           acknowledgment, calm, listening, happy, sad, fear, surprised
     * @param {number} [intensity]  1.0–2.0 (defaults to THERAPEUTIC_INTENSITIES)
     */
    setEmotion(emotion, intensity = null) {
        const moodName = emotion || 'neutral';

        // Validate mood exists
        if (!this.head.animMoods[moodName]) {
            console.warn(`[MindMitra] Unknown emotion "${moodName}", falling back to neutral`);
            this.head.setMood('neutral');
            this.currentEmotion = 'neutral';
            this.currentIntensity = 1.0;
            return;
        }

        this.currentEmotion = moodName;
        // Look up therapeutic intensity by the un-suffixed mood name so
        // both "empathy" and "empathy_speech" resolve to the same default.
        const baseMoodName = moodName.endsWith('_speech')
            ? moodName.slice(0, -'_speech'.length)
            : moodName;
        const resolvedIntensity = intensity ?? THERAPEUTIC_INTENSITIES[baseMoodName] ?? 1.0;
        this.currentIntensity = resolvedIntensity * this.styleMultiplier;

        const mood = this.head.animMoods[moodName];
        if (this.currentIntensity !== 1.0 && mood && mood.baseline) {
            // Temporarily scale baseline so setMood picks up the right values
            const origBaseline = { ...mood.baseline };
            for (const key of Object.keys(origBaseline)) {
                mood.baseline[key] = softClip(origBaseline[key] * this.currentIntensity);
            }
            this.head.setMood(moodName);
            // Restore canonical baseline so repeated calls work correctly
            mood.baseline = origBaseline;
        } else {
            this.head.setMood(moodName);
        }
    }

    // ═══════════════════════════════════════════
    //  GESTURE CONTROL (Paper #6)
    // ═══════════════════════════════════════════

    /**
     * Trigger a therapeutic gesture (controlled head pose).
     * Respects cooldown to avoid repetitive motion.
     */
    _triggerGesture(gestureName) {
        if (this.reducedMotion) return;
        const now = performance.now();
        if (now - this._lastGestureEnd < this._nextGestureCooldown) return;
        if (this._gestureActive) return;

        const gesture = THERAPEUTIC_GESTURES[gestureName];
        if (!gesture) return;

        this._gesture = gesture;
        this._gestureActive = true;
        this._gestureStart = now;
    }

    /**
     * Called manually to trigger a gesture by name.
     * @param {'slow_nod'|'lean_forward'|'thinking_tilt'|'agreement_nod'} name
     */
    triggerGesture(name) {
        this._triggerGesture(name);
    }

    /**
     * Process active gesture — interpolate keyframes and apply via setValue.
     */
    _updateGesture(now) {
        if (!this._gestureActive || !this._gesture) return;

        const elapsed = now - this._gestureStart;

        if (elapsed >= this._gesture.duration) {
            // End gesture — release morph targets
            for (const kf of this._gesture.keyframes) {
                for (const key of Object.keys(kf)) {
                    if (key !== 't') {
                        this.head.setValue(key, null, 300);
                    }
                }
            }
            this._gestureActive = false;
            this._lastGestureEnd = now;
            this._nextGestureCooldown = rollGestureCooldown();
            return;
        }

        // Find surrounding keyframes
        const keyframes = this._gesture.keyframes;
        let prev = keyframes[0];
        let next = keyframes[keyframes.length - 1];

        for (let i = 0; i < keyframes.length - 1; i++) {
            if (elapsed >= keyframes[i].t && elapsed < keyframes[i + 1].t) {
                prev = keyframes[i];
                next = keyframes[i + 1];
                break;
            }
        }

        // Interpolate
        const range = next.t - prev.t;
        const alpha = range > 0 ? (elapsed - prev.t) / range : 1;
        // Smooth step easing
        const t = alpha * alpha * (3 - 2 * alpha);

        // Apply interpolated values
        const allKeys = new Set([
            ...Object.keys(prev).filter(k => k !== 't'),
            ...Object.keys(next).filter(k => k !== 't'),
        ]);

        for (const key of allKeys) {
            const from = prev[key] ?? 0;
            const to = next[key] ?? 0;
            const value = from + (to - from) * t;
            this.head.setValue(key, value);
        }
    }

    // ═══════════════════════════════════════════
    //  PER-FRAME UPDATE — The heart of the bridge
    // ═══════════════════════════════════════════

    /**
     * Called every animation frame by TalkingHead's render loop.
     * Handles:
     *   - Emotion timeline progression (Paper #2)
     *   - Optional amplitude-based jaw scaling (disabled by default)
     *   - Gesture animation (Paper #6)
     */
    _perFrameUpdate(dt) {
        const now = performance.now();

        // ── Emotion Timeline (Paper #2) ──────────────────────
        if (this.emotionTimeline && this.state === 'speaking') {
            const elapsedSec = (now - this.responseStartTime) / 1000;
            const { emotion, intensity, progress } = getActiveEmotion(
                this.emotionTimeline, elapsedSec
            );

            // Switch emotion when timeline progresses to a new keyframe
            if (emotion !== this.currentEmotion && progress >= 0.1) {
                this.setEmotion(emotion, intensity);

                // Trigger contextual gesture on emotion change
                const gesture = EMOTION_TO_GESTURE[emotion];
                if (gesture) this._triggerGesture(gesture);
            }
        }

        // ── Optional Amplitude Jaw Scaling (Paper #1) ─────────
        // Disabled in normal speech so it does not fight TalkingHead's
        // viseme morphs. Enable only for a controlled experiment.
        if (this.enableAmplitudeJawBoost && this.amplitudeFrames.length > 0 && this.state === 'speaking') {
            const elapsedSec = (now - this.responseStartTime) / 1000;
            const amp = this.amplitudeAnalyzer.getAmplitudeAtTime(
                this.amplitudeFrames, elapsedSec
            );

            // Apply additional jaw boost via system-level setValue
            // This adds ON TOP of TH's own volume effect
            if (this.head.mtAvatar && this.head.mtAvatar['jawOpen']) {
                const currentJaw = this.head.mtAvatar['jawOpen'].value || 0;
                const boosted = this.amplitudeAnalyzer.scaleJawWithAmplitude(currentJaw, amp);
                if (boosted > currentJaw) {
                    this.head.setValue('jawOpen', boosted);
                }
            }
        }

        // ── Therapeutic Gestures (Paper #6) ──────────────────
        this._updateGesture(now);

        // ── Beat scheduler — periodic accent_beat during long speech ───
        // Keeps the avatar alive during multi-sentence replies without
        // looking twitchy. Skipped for calm (grounding) and when a head/
        // body gesture is currently animating.
        if (
            this.state === 'speaking' &&
            !this.reducedMotion &&
            this.currentEmotion !== 'calm' &&
            !this._gestureActive &&
            now - this._lastBeatTime > this._nextBeatDelay &&
            typeof this.head.playGesture === 'function'
        ) {
            const beat = Math.random() < BEAT_SOFT_PROBABILITY ? 'accent_beat_soft' : 'accent_beat';
            try { this.head.playGesture(beat, BEAT_DURATION_S, false); } catch (e) { /* noop */ }
            this._lastBeatTime = now;
            this._nextBeatDelay = rollBeatDelay();
        }

        // Chain to original update callback if present
        if (this._originalUpdate) {
            this._originalUpdate(dt);
        }
    }

    // ═══════════════════════════════════════════
    //  HELPER — Release fixed morph overrides
    // ═══════════════════════════════════════════

    _releaseOwnedMorphs() {
        for (const mt of this._ownedMorphs) {
            if (this.head.mtAvatar && this.head.mtAvatar[mt]) {
                // Clear fixed value — let TH resume normal control
                this.head.mtAvatar[mt].fixed = null;
                this.head.mtAvatar[mt].needsUpdate = true;
            }
        }
        this._ownedMorphs.clear();
    }

    // ═══════════════════════════════════════════
    //  CONVENIENCE — High-level API for chat UI
    // ═══════════════════════════════════════════

    /**
     * Speak text with emotion cues.
     * Wraps TalkingHead's speakText with therapeutic emotion timeline.
     *
     * @param {string} fullText           The complete response text
     * @param {Array<{text: string, emotion: string}>} emotionCues
     *   Segments of the response with emotion annotations.
     *   If not provided, the entire response uses a single emotion.
     * @param {Object} [opt]  Extra options passed to head.speakText()
     */
    speakWithEmotion(fullText, emotionCues, opt = {}) {
        if (!emotionCues || emotionCues.length === 0) {
            emotionCues = [{ text: fullText, emotion: 'neutral' }];
        }

        this.onAvatarStartSpeaking(emotionCues);

        // Queue speech. On completion, return to idle.
        this.head.speakText(fullText, opt);

        // Schedule finish (estimate from text length)
        const totalDur = this.emotionTimeline
            ? this.emotionTimeline.totalDuration * 1000
            : 3000;

        setTimeout(() => {
            // Only finish if we're still in speaking state
            if (this.state === 'speaking') {
                this.onAvatarFinishedSpeaking();
            }
        }, totalDur + 500);  // small buffer
    }

    /**
     * Speak pre-made audio with emotion cues and amplitude analysis.
     * Uses TalkingHead's speakAudio for audio playback.
     *
     * @param {Object} audioData  Audio data object for head.speakAudio()
     * @param {AudioBuffer} decodedAudio  Decoded AudioBuffer for amplitude analysis
     * @param {Array<{text: string, emotion: string}>} emotionCues
     * @param {Object} [opt]  Extra options
     */
    async speakAudioWithEmotion(audioData, decodedAudio, emotionCues, opt = {}) {
        if (decodedAudio) {
            this.amplitudeFrames = this.amplitudeAnalyzer.extractFromAudioBuffer(decodedAudio);
        }

        this.onAvatarStartSpeaking(emotionCues, decodedAudio);
        this.head.speakAudio(audioData, opt);
    }

    /**
     * Get available therapeutic emotions.
     */
    getTherapeuticEmotions() {
        return [
            'neutral', 'empathy', 'concern', 'encouragement',
            'acknowledgment', 'calm', 'listening',
        ];
    }

    /**
     * Get the current avatar state.
     */
    getState() {
        return this.state;
    }

    /**
     * Get current emotion name.
     */
    getCurrentEmotion() {
        return this.currentEmotion;
    }
}


// ═══════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════

export {
    MindMitraBridge,
    AmplitudeAnalyzer,
    buildEmotionTimeline,
    getActiveEmotion,
    softClip,
    THERAPEUTIC_MOODS,
    THERAPEUTIC_INTENSITIES,
    THERAPEUTIC_GESTURES,
    EMOTION_TO_GESTURE,
    INTENSITY_LEVELS,
    GESTURE_COOLDOWN_MS,
};
