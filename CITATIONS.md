# MindMitra — Research Citations

This file tracks the academic and industry research grounding the design and engineering decisions of the **Presence Mode** (3D voice avatar) feature, plus other research-backed product choices. Sourced primarily during the Presence Mode planning + implementation work.

> Convention: each entry includes (1) the source, (2) what it claims, and (3) where in the codebase the insight was applied.

---

## I. Embodied Conversational Agents (ECAs) for Mental Health

### 1. JMIR (2025) — Animated agent vs. text agent in a college mental-health app
**Source:** *Impact of Conversational and Animation Features of a Mental Health App Virtual Agent on Depressive Symptoms and User Experience Among College Students: Randomized Controlled Trial.* PubMed Central, PMC12007843. https://pmc.ncbi.nlm.nih.gov/articles/PMC12007843/

**What it claims:**
- Animation features (mouth, body, gesture) significantly improve user satisfaction, trust, and perceived usefulness vs. non-animated agents.
- Users prefer agents that mirror their own demographics (gender, age) — disclosure rates ↑.
- Poor lip-sync fidelity actively *harms* perceived empathy — the bar for animation in a mental-health context is higher than entertainment.

**Applied in MindMitra:**
- Justifies investing in real lip-sync (Azure viseme stream + TalkingHead.js) instead of a simpler "talking blob" animation. (`public/talkinghead.html`, `src/components/chat/TalkingHeadAvatar.tsx`)
- Roadmap item: surface avatar selection (skin tone, gender presentation) as a clinical feature in `ChatHeaderBar` companion menu (already partially supported via `AVATAR_OPTIONS`).

---

### 2. JMIR Scoping Review (2017) — Embodied Conversational Agents in clinical psychology
**Source:** Provoost, S., Lau, H. M., Ruwaard, J., & Riper, H. *Embodied Conversational Agents in Clinical Psychology: A Scoping Review.* JMIR 2017; 19(5):e151. https://www.jmir.org/2017/5/e151/

**What it claims:**
- ECAs simulate face-to-face interaction using verbal and non-verbal cues, fostering trust and perceived social presence.
- Agent persona (e.g. extraverted vs. introverted) and role (coach vs. authoritative) measurably influence affective engagement — not a cosmetic choice.
- Design flaws (lack of inflection, misaligned non-verbal behaviors) negatively impact UX. The bar is high.

**Applied in MindMitra:**
- Six therapeutic emotion presets in `EXPRESSION_TO_EMOTION` (`empathy, concern, encouragement, acknowledgment, calm, listening`) — deliberately conservative, no rage/shock — match what skilled therapists actually display. (`src/components/chat/TalkingHeadAvatar.tsx`)
- Avatar customization persists per user (`settings.avatar_model` in Supabase) so persona is stable.

---

### 3. AVATAR therapy for psychosis (King's College London)
**Source:** *AVATAR therapy: a promising new approach for persistent distressing voices.* PubMed Central, PMC6313224. https://pmc.ncbi.nlm.nih.gov/articles/PMC6313224/

**What it claims:**
- Three RCTs show face-to-face engagement with a digital avatar reduces severity and frequency of distressing auditory hallucinations vs. treatment-as-usual.
- Mechanism is the *face-to-face quality* of the interaction — not the content. Visual presence activates social-cognition circuits text cannot.

**Applied in MindMitra:**
- Justification for treating "Presence Mode" as a distinct therapeutic surface (not just a UI mode).
- Frames the feature for VC pitches: "research-backed therapeutic mechanism" not "premium gimmick".

---

### 4. ECAs in eHealth — text vs. facial expression of emotion
**Source:** *Embodied Conversational Agents in eHealth: How Facial and Textual Expressions of Positive and Neutral Emotions Influence Perceptions of Mutual Understanding.* ResearchGate, publication 353352383. https://www.researchgate.net/publication/353352383

**What it claims:**
- Users rate rapport higher when the agent expresses emotion via face vs. text-only.
- Emotion must be *aligned* with content — mismatched emotion (e.g. smile during sad content) destroys trust.

**Applied in MindMitra:**
- Backend already returns `facial_expression` per response. Plan: in Phase 5, replace rule-based `detectSentiment()` (`src/hooks/useChat.tsx`) with the LLM-annotated expression to guarantee alignment.

---

## II. Voice-First UX & Conversational Latency

### 5. Voice-First AI Mental Health Companion — Design Study
**Source:** Reddy et al. *Voice-First AI Mental Health Companion: Design, Implementation and Evaluation.* IJERT, Vol. 15 Issue 4, 2024. https://www.ijert.org/voice-first-ai-mental-health-companion-design-implementation-and-evaluation-ijertv15is040245

**What it claims:**
- Voice-first interaction is more intuitive for users in emotional distress (reduces interface friction).
- Continuous VAD enables natural dialogue flow, but requires good turn-detection to avoid premature cutoffs.
- Hybrid VAD + push-to-talk gives users agency over privacy.

**Applied in MindMitra:**
- Phase 2 — `usePresenceVAD` hook combines VAD (default) with hold-to-talk override.
- 1.5-second silence threshold derived from this paper's pause analysis (mental-health context tolerates longer thinking pauses than transactional voice UI).

---

### 6. Real-time voice AI latency thresholds
**Source:** Inworld Engineering Blog. *Best Realtime APIs for Voice AI* (2024). https://inworld.ai/resources/best-realtime-apis-for-voice-ai

**What it claims:**
- **Time-to-first-audio (TTFA) < 250 ms** = production-grade conversational; < 500 ms = acceptable.
- **End-to-end < 1.5 s** preserves "natural conversation"; > 2.5 s breaks social-mode and re-enters "talking to a machine" mode (perceptual cliff).
- Streaming pipelines (sentence-level TTS while LLM continues generating) are the only way to hit < 1.5 s.

**Applied in MindMitra:**
- `splitIntoSentences()` and `appendAvatarMessage()` already lay groundwork for sentence-level streaming. (`src/components/chat/TalkingHeadAvatar.tsx`, `src/hooks/useChat.tsx`)
- Phase 3 wires this all the way through — first sentence speaks while LLM emits sentences 2…N.

---

### 7. ricky0123/vad — Browser Silero VAD
**Source:** ricky0123. *Voice Activity Detector (VAD) for the Browser.* GitHub. https://github.com/ricky0123/vad

**What it claims:**
- Silero VAD (deep-learning-based) is ~3-4× more accurate than threshold-based VAD on noisy / accented audio.
- WebAssembly inference runs in a Web Worker; ~170 KB; negligible CPU overhead on modern phones.

**Applied in MindMitra:**
- Selected as the VAD library for Phase 2 (`usePresenceVAD.ts`). Critical for accent-tolerant Hindi/English code-switching detection in our Indian user base.

---

## III. Indian User Behavior

### 8. Nielsen India Digital Report 2023 — voice notes preference
**Source:** Nielsen India / Meta. Cited in *WhatsApp Voice Notes vs Text Messages: Understanding Indian User Preferences* by NextLeap. https://assets.nextleap.app/submissions/WhatsApp-Voice-Notes-vs-Text-Messages-Understanding-Indian-User-Preferences-ade8d441-258e-4b83-aff3-9a4257dae66e.pdf

**What it claims:**
- Voice notes account for **22% of all WhatsApp communications in India** vs. 14% globally.
- Indian users prefer voice over text for regional-language communication and emotionally rich content.
- "Voice note fatigue" is real — users want transcription for navigation/skim.

**Applied in MindMitra:**
- **Strategic justification** for prioritizing Presence Mode (voice + face) over text-only for the Indian youth segment.
- `VoiceAnalysis.hindi_english_mixing` and `detected_hindi_words` in `useVoiceRecording.tsx` capture code-switching as clinical signal — leveraging the same code-switching that voice notes already enable.
- Subtitles in Presence Mode (Phase 3) address voice-fatigue/skim need by always showing what was said.

---

## IV. Lip-Sync Tech Stack

### 9. TalkingHead.js — Real-time browser lip-sync
**Source:** met4citizen. *TalkingHead (3D): A JavaScript class for real-time lip-sync using Ready Player Me full-body 3D avatars.* GitHub. https://github.com/met4citizen/TalkingHead

**What it claims:**
- Phoneme-to-viseme mapping with morph-target blending in Three.js.
- Supports Google Cloud TTS, Azure TTS (with `visemeReceived` events), ElevenLabs, Web Speech.
- Sub-50 ms audio-to-viseme sync when audio + visemes arrive in same stream (Azure SDK pattern).

**Applied in MindMitra:**
- Already integrated via `public/talkinghead.html` + `src/components/chat/TalkingHeadAvatar.tsx`.
- Azure SDK path used as primary (visemes co-arrive with audio); Google Cloud TTS as fallback.

---

### 10. Mascot Bot SDK — OpenAI Realtime + Avatar Pattern
**Source:** Mascot Bot. *OpenAI Realtime API Avatar — Interactive Lip Sync SDK.* https://docs.mascot.bot/libraries/openai-realtime-api-avatar

**What it claims:**
- For low-latency face-to-face: bundle audio + viseme metadata in same stream → < 50 ms sync.
- Use `response.output_text.delta` for partial text UI updates but gate avatar speech on `response.output_text.done` (sentence boundary) to avoid stuttering.
- WebRTC > WebSocket for ultra-low-latency bidirectional audio.

**Applied in MindMitra:**
- Subtitles use partial token deltas (TypewriterText), avatar speech uses sentence boundaries (already implemented in `splitIntoSentences()` / `appendAvatarMessage`).

---

## V. Crisis Safety in Voice UI

### 11. Stanley-Brown Safety Planning Intervention (SPI)
**Source:** Stanley, B. & Brown, G. K. (2012). *Safety Planning Intervention: A Brief Intervention to Mitigate Suicide Risk.* Cognitive and Behavioral Practice, 19(2), 256–264.

**What it claims:**
- 6-step safety plan reduces suicide attempts in randomized trials.
- The plan must be authored by the user (not prescribed) and accessible in moments of crisis without friction.

**Applied in MindMitra:**
- `/safety-plan` page implements the full 6-step Stanley-Brown plan (`src/pages/SafetyPlan.tsx`).
- Phase 4 — `PresenceSafetyOverlay` keeps the safety plan one tap away in Presence Mode without breaking the conversation surface.

---

## How to add new entries

When new research is consulted (papers, blog posts from credible engineering teams, RCTs, SDK docs), append an entry here with:
1. Full citation.
2. Two-sentence summary of the relevant claim.
3. Concrete location in the codebase where the insight was applied.

Keep this file alive — it is the bridge between *why* a decision was made and *what* the code looks like.
