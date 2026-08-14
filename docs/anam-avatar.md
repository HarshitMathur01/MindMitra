# Anam avatar — what is customisable, and what we set

The chat avatar is [Anam.ai](https://anam.ai/docs) over WebRTC. It runs in
**turnkey mode**: Anam supplies the STT, the LLM and the TTS, so almost
everything about how the conversation *feels* is decided by the session config
rather than by `app/pipeline/`.

This document is the field reference for that config, why each MindMitra default
was chosen, and — most importantly — how the crisis invariant survives a path
where MindMitra's own LLM is not writing the words.

## Where the pieces live

| Concern | File |
|---|---|
| Config surface (the knobs) | [`chatbotAgent/config.yaml`](../chatbotAgent/config.yaml) → `avatar:` |
| Persona builder (YAML → Anam JSON) | [`chatbotAgent/app/api/avatar.py`](../chatbotAgent/app/api/avatar.py) → `build_persona_config()` |
| Live token broker | [`chatbotAgent/app/api/anam.py`](../chatbotAgent/app/api/anam.py) → `GET /anam/session-token` |
| Crisis interceptor (server) | `anam.py` → `POST /anam/crisis-check` |
| Crisis interceptor (client) | [`src/hooks/useAnamAvatar.ts`](../src/hooks/useAnamAvatar.ts) → `screenForCrisis` |
| Turn recorder | `anam.py` → `POST /anam/conversation` |
| Daily video quota | [`chatbotAgent/app/services/anam_quota.py`](../chatbotAgent/app/services/anam_quota.py), `anam.py` → `POST /anam/heartbeat` |

The browser never sends `personaConfig`. It sends at most an `avatar_id` and a
`language`, both resolved against server-side tables. A browser-supplied system
prompt on a mental-health surface is a prompt-injection hole, and the tests in
`tests/v3/test_anam_session_token.py` pin that.

## The two pipeline modes

`VITE_ANAM_PIPELINE_MODE` decides who writes the words.

| | `true` — turnkey (current) | `false` — MindMitra pipeline |
|---|---|---|
| STT | Anam WebRTC | Azure |
| Brain | **Anam's LLM** | `POST /chat` (full v3 pipeline) |
| TTS | Anam | Azure → `AgentAudioInputStream` lipsync |
| `crisis_bypass` | via `/anam/crisis-check` (below) | inline, on every turn |
| `safety_gate` | **not run** | inline, on every turn |

Turnkey buys natural turn-taking, barge-in, and sub-second latency. It costs the
safety gate. That trade is deliberate; the crisis half is bought back below, but
`safety_gate`'s other four checks genuinely do not run on this path.

## Crisis handling in turnkey mode

Invariant #1 in [`CLAUDE.md`](../CLAUDE.md): *crisis responses are fixed,
clinician-reviewed templates — never LLM-generated.* Turnkey mode takes
`crisis_bypass` off the turn, so it is put back out-of-band:

1. `MESSAGE_HISTORY_UPDATED` fires when the **user** stops speaking — before the
   persona has answered.
2. The client POSTs that utterance to `/anam/crisis-check`, in parallel with
   Anam composing its own reply. The normal path therefore costs nothing.
3. The server runs the real thing: `ingestion.ingest_input` →
   `signal_extraction.extract_signals` → `crisis_bypass.crisis_bypass_check`.
   Same session, same urgency history, same Supabase `crisis_templates` as
   `POST /chat`.
4. On tier 3 the client calls `interruptPersona()` and then `talk(template)` —
   cutting Anam off mid-sentence and speaking the template verbatim.

Two properties worth not breaking:

- **Fail open, not closed.** A Groq timeout returns `crisis=false`. Firing the
  helpline script at a student who is fine erodes trust in the one response that
  has to be believed.
- **Tier 3 is sticky.** The result is written to `session.urgency_history`, so
  the next utterance short-circuits without a second Groq round-trip — the same
  pre-check `chat_ws._process_turn` does.

`skip_turn` is deliberately **not** enabled as a system tool: a model that can
silence itself is a model that can decline to respond to a crisis.

## Daily video quota

10 minutes of Anam avatar video per account per day, resetting at IST
(`Asia/Kolkata`) midnight. Anam bills per session-minute, and turnkey mode has
no other cost control on it, so this exists purely to bound vendor spend — it
has nothing to do with the crisis path above and is not exempt from it (a
crisis mid-session still ends when the cap is hit; see the open question at
the end of this section).

Two things enforce it, on purpose:

1. **`maxSessionLengthSeconds` clamp, per mint.** `GET /anam/session-token`
   asks `anam_quota.get_remaining_seconds()` and sets the persona's
   `maxSessionLengthSeconds` to whichever is smaller: the configured session
   cap (`avatar.session.max_session_length_seconds`, 600s) or what's left of
   the day's quota. **Anam itself** then closes the WebRTC connection when
   that elapses — `CONNECTION_CLOSED` fires with
   `ConnectionClosedCode.SERVER_CLOSED_CONNECTION`, handled in
   `useAnamAvatar.ts`. This is the backstop: it holds even if the client never
   sends a heartbeat.
2. **Heartbeat debits, while video is playing.** The frontend POSTs
   `/anam/heartbeat` every ~15s once `VIDEO_PLAY_STARTED` fires. The request
   carries no duration — the server computes elapsed time itself from a
   timestamp anchored at mint (`mark_session_start`), clamped to 2x the
   heartbeat interval per call. A client cannot inflate its balance by
   reporting a fabricated duration or by polling off-cadence.

Redis holds the hot per-user, per-day counter (`anam:sec:<uid>:<IST date>`).
Every debit mirrors the running total into Supabase `anam_usage_daily`
(fire-and-forget, off the request hot path), and a Redis miss — a fresh day
or an eviction — rehydrates from that table before incrementing rather than
silently treating a spent user as having a full quota again.

**Open question, not yet resolved:** the cap applies uniformly, including
mid-crisis. A student in tier-3 crisis whose 10 minutes run out gets the
connection closed like anyone else. Exempting an active crisis session from
the cap (checking `session.urgency_history[-1] == 3` before enforcing) would
be cheap to add and sits closer to the spirit of invariant #1 in
[`CLAUDE.md`](../CLAUDE.md) — flagged here rather than decided unilaterally,
since it changes what the cap actually guarantees.

---

# Field reference

Every field below may be left blank or absent, in which case it is omitted from
the request and Anam's own default applies. `0` and `false` are meaningful and
are always sent.

## Identity and rendering

| Field | Notes |
|---|---|
| `name` | Internal label; shows up in Anam's session logs. |
| `avatarId` | UUID from the avatar gallery, or a custom avatar. |
| `avatarModel` | `cara-3` \| `cara-4` \| `cara-4-latest`. Director notes need cara-4. |
| `voiceId` | UUID. **Also determines the spoken language.** |
| `llmId` | See below. |
| `systemPrompt` | Keep under ~8k tokens — length directly drives response latency. |

Catalogue IDs are per-account. Re-list them with:

```bash
curl -H "Authorization: Bearer $ANAM_API_KEY" "https://api.anam.ai/v1/avatars?perPage=100"
curl -H "Authorization: Bearer $ANAM_API_KEY" "https://api.anam.ai/v1/voices?perPage=100"
curl -H "Authorization: Bearer $ANAM_API_KEY" "https://api.anam.ai/v1/llms"
```

**Both are paginated** (`?page=`/`?perPage=`, `meta.lastPage` in the response) —
the default page of 10 is a small slice of ~120 avatars and ~1000 voices.

### LLM choices

| `llmId` | Model | Notes |
|---|---|---|
| `a7cf662c-2ace-4de1-a21e-ef0fbf144bb7` | GPT OSS 120B (Groq) | **Our default.** Anam's recommendation; strong tool calling, fast. |
| `89649f1a-feb2-4fea-be43-56baec997a93` | GPT 5 Chat | Higher quality, higher latency. |
| `b4f89001-9638-4879-a9c3-02cc9f9f2004` | GPT 4.1 | Slow all-rounder. |
| `ANAM_LLAMA_v3_3_70B_V1` | Llama 3.3 70B | Fast, but weak tool calling — avoid, the system tools matter here. |
| `CUSTOMER_CLIENT_V1` | *Disable LLM* | Turns off Anam's brain so the client drives text via `createTalkMessageStream()`. |

`CUSTOMER_CLIENT_V1` is the interesting one for a future revisit: it would let
Anam keep STT + turn-taking + TTS + lipsync while MindMitra's pipeline writes
every word, which restores `safety_gate` inline. Not wired up today.

### System prompt

Built by `avatar.py::_persona_system_prompt()` from `system_identity.txt` — the
same identity block prompt-block 1 uses, so the avatar and text chat are one
character. Two substitutions:

- The paragraph *"Crisis is handled before you see the message"* is replaced with
  Tele-MANAS guidance. That sentence is true for `POST /chat` and false here, and
  shipping it would actively suppress the model's own crisis handling.
- Spoken-delivery guidance is appended: no markdown, no emoji, numbers as words
  (TTS reads "14416" badly), shorter turns, and when to use the tools.

## Conversation flow

| Field | Default (Anam) | Ours | Why |
|---|---|---|---|
| `skipGreeting` | `false` | `false` | The avatar opens; a silent face is worse than a hello. |
| `uninterruptibleGreeting` | `false` | `false` | The student can always talk over it. |
| `initialMessage` | — | *"Hey, I'm here…"* | Low-pressure opener. |
| `maxSessionLengthSeconds` | plan cap | `600` (further clamped per-request — see [Daily video quota](#daily-video-quota)) | Matches the daily quota; a single session no longer needs its own long allowance now that the quota is the real limit. |

Plan caps: Free 3 min, Starter 5 min, Explorer 10 min, Growth+ unlimited. A
configured value above your plan cap does not raise it.

## Turn-taking — `voiceDetectionOptions`

Anam's defaults are tuned for sales and support agents that jump in fast. Every
value here deliberately makes the avatar more patient.

| Field | Range | Anam | Ours | Effect |
|---|---|---|---|---|
| `endOfSpeechSensitivity` | 0–1 | 0.5 | **0.35** | Lower waits for more confidence the student finished. |
| `silenceBeforeAutoEndTurnSeconds` | 0.5–10 | 5 | **4.0** | Pause tolerated mid-thought. |
| `silenceBeforeSkipTurnSeconds` | 0–900 | 15 | **45** | How long before gently prompting a quiet student. `0` disables. |
| `silenceBeforeSessionEndSeconds` | 0–7200 | 60 | **0** | **Never enable.** The default hangs up on someone who went quiet because they are crying. |
| `speechEnhancementLevel` | 0–1 | 0.8 | 0.8 | Noise reduction on input. |

## Voice — `voiceGenerationOptions`

Provider-dependent, and **reset whenever `voiceId` changes**.

- **Cartesia (sonic-3.x):** `speed` 0.6–1.5, `volume` 0.5–2.0, `emotion` ∈
  `neutral|calm|angry|content|sad|scared`
- **ElevenLabs:** `stability` 0–1, `similarityBoost` 0–1, `speed` 0.7–1.2,
  `style` 0–1 (v2), `useSpeakerBoost` (v2)

Our personas use Cartesia Indian voices at `speed: 0.95`, `emotion: calm`.

## Performance — `directorNotes`

Controls *how* lines are delivered, not what is said. **cara-4 only**; older
models ignore it and the session still starts.

```yaml
director_notes:
  preset_style: "supportive"   # happy|warm|playful|supportive|sad|angry|distressed
  expressivity: 0.45           # 0-1
```

Two rules the API enforces and YAML cannot, so `_sanitise_director_notes()` does:

- `presetStyle` and `customStylePrompt` are **mutually exclusive**.
- Cue-only tags (`curious`, `concerned`, `laughter`, `surprised`) work *inline in
  speech* — `"[warm] I hear you. [curious] What happened?"` — but are rejected as
  session-start presets.

Director notes are broad direction, explicitly not per-word gesture control.

## Tools

> **The docs are wrong about this one.** Anam's published OpenAPI spec says
> `personaConfig.tools[].type` accepts `"system"`. The live session-token
> endpoint does not — it only accepts `client` and `server`, and returns
> `Invalid literal value, expected "client" | "server"`. System tools must be
> **created once** via `POST /v1/tools` with `type: "SYSTEM"` and then
> referenced by id through `toolIds`.

| Kind | Setup | Ours |
|---|---|---|
| **System** | `POST /v1/tools`, then `toolIds` | `change_language`, `pause_conversation`, `end_call` — *pending, see below* |
| **Client** | inline, browser event handler | not used |
| **Webhook** | inline or `/v1/tools` | not used |
| **Knowledge (RAG)** | uploaded documents | not used |

To enable them:

```bash
cd chatbotAgent && python scripts/anam_system_tools.py --create
# paste the printed ids into config.yaml → avatar.tool_ids
```

`config.yaml` ships with `tool_ids: []`, so **the avatar currently has no
tools**. That is a real capability gap, not a cosmetic one:
`change_language` is what carries Hindi/Hinglish code-switching mid-call, and
`end_call` / `pause_conversation` are how a distressed student stops the
conversation by voice alone. Until the ids are filled in, the persona can only
switch language in what it *says*, not in what it *hears*.

`skip_turn` is excluded on purpose — a model that can silence itself is a model
that can decline to respond to a crisis.

## Language

`languageCode` sets what the system expects to **hear**; `voiceId` sets what it
**speaks**. It is fixed for the life of a session and cannot be patched live —
`GET /anam/session-token?language=hi-IN` re-mints the token, and the hook treats
`language` as a dependency that reconnects the stream.

Mid-conversation switching is the `change_language` system tool's job — which
needs `avatar.tool_ids` populated first (see Tools). Note its limit: it moves
**transcription only**. A multilingual voice and a Hindi-capable LLM are still
required for the persona to answer in Hindi.

Codes are allow-listed server-side (`en`, `hi`, `ta`, `te`, `kn`, `ja`);
anything else falls back to the configured default rather than erroring.

## Session options

These sit alongside `personaConfig`, not inside it.

| Field | Default | Ours |
|---|---|---|
| `sessionReplay.enableSessionReplay` | **`true`** | **`false`** — DPDP. Anam records sessions unless told not to. |
| `videoQuality` | `auto` | `auto` |
| `videoWidth` / `videoHeight` | — | unset |
| `showAIAvatarDisclosure` | — | unset |

## Mid-session updates

Only three things can change on a live session, via `sendDataMessage()`:
`languageCode`, `voiceGenerationOptions`, `voiceDetectionOptions`. **System
prompt, LLM and persona cannot.** Rejections arrive as a `SERVER_WARNING` event
rather than dropping the session.

```js
anamClient.sendDataMessage(JSON.stringify({
  message_type: "persona_config",
  data: { voiceGenerationOptions: { speed: 1.1 } },
}));
```

## SDK surface we use

`createClient`, `streamToVideoElement`, `muteInputAudio`, `interruptPersona`,
`talk`, `createAgentAudioInputStream` (+ `sendAudioChunk` / `endSequence`).

Available but unused: `createTalkMessageStream()` (lower-latency streaming for a
client-side LLM), `sendUserMessage()`, `addContext()` (inject context silently,
no reply — a good fit for MindMitra memory).

Events: `MESSAGE_HISTORY_UPDATED`, `CONNECTION_CLOSED` (drives the error/ended
UI — see `ConnectionClosedCode` branches in `useAnamAvatar.ts`),
`VIDEO_PLAY_STARTED` (starts the quota heartbeat loop above),
`MESSAGE_STREAM_EVENT_RECEIVED` (live partial transcripts),
`TALK_STREAM_INTERRUPTED`, `SERVER_WARNING`, `TOOL_CALL_*`.

## Gotchas

- **`avatarOnly: true` strips the persona's LLM and TTS.** The old broker sent it
  *and* the frontend ran with `VITE_ANAM_PIPELINE_MODE=true`, so both paths were
  muted. Do not reintroduce it while turnkey mode is on.
- **`personaConfig` is `oneOf`.** Either `{personaId}` or the full inline config —
  you cannot send a `personaId` plus overrides. That is why the persona is built
  inline rather than referencing a Lab-stored persona. The discriminator is
  `type`: `ephemeral` | `stateful` | `avatar` | `audio_passthrough` | `legacy`.
  We send `ephemeral`. (`avatar` is the modern spelling of the old
  `avatarOnly: true`.)
- **The published spec lags the live API.** `swagger.json` omits the `type`
  discriminator entirely and claims system tools work inline. When they
  disagree, believe the 400 body — its zod errors name the accepted literals.
- **Never echo Anam's error body.** On validation failures it mirrors the request
  back, and the request carries the system prompt.
- **A stale catalogue ID 404s the whole session.** The previously hardcoded
  `d56808e1-…` existed as neither a persona nor an avatar in this account.
