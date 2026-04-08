# MindGym (Therapeutic Practices Toolkit)

## Purpose
MindGym is a set of **offline, evidence-based therapeutic practices** (not casual games). It is designed for users who may be distressed, so the UX prioritizes low cognitive load, calm visuals, and supportive wording.

## Routes
- `GET /mindgym`: MindGym hub (catalog + recommended practice + XP/streak/badges)
- `GET /mindgym/:toolId`: Individual tool page (lazy-loaded)

## Tool Catalog
Source of truth:
- `src/lib/mindgym/catalog.ts` — `MINDGYM_TOOLS` (IDs, titles, tags, XP)
- `src/lib/mindgym/types.ts` — `ToolId` and `MindGymProgress` schema

Tool IDs (stable):
- `breath-sphere`
- `thought-trap`
- `emotion-compass`
- `worry-vault`
- `mood-weather`
- `five-senses`
- `inner-critic`
- `gratitude-garden`
- `focus-flow`

## Lazy Loading / Code Splitting
- `src/pages/mindgym/MindGymToolPage.tsx` dynamically imports each tool via `React.lazy`.

## Gamification (XP, streaks, badges)
Stored in localStorage:
- `mindmitra_mindgym_progress_v1`: `MindGymProgress`
- `mindmitra_mindgym_reco_v1`: daily recommendation selection (per day)

Key functions:
- `src/lib/mindgym/storage.ts`
  - `recordCompletion(toolId, xp, moodBefore?, moodAfter?)`
  - `loadProgress()` / `saveProgress()`
  - `getStreak(toolId)`
  - `isCompletedToday(toolId)`

### Date semantics (India-first)
MindGym uses **Asia/Kolkata** local date to compute “today” and streak boundaries to avoid breaking streaks around UTC midnight.

### Badge semantics
Badges are defined in `src/lib/mindgym/catalog.ts`.

Notes:
- `Garden Keeper` badge tracks **planted gratitude entries**, not just tool completions.
  - Counter: `mindmitra_mindgym_counters_v1` (`gratitude_entries`)

## Safety (Crisis)
Non-negotiables:
- Thought Trap and Inner Critic Court include crisis keyword screening.
- All MindGym screens show a persistent **“Need help?”** button which opens the crisis resources overlay.

Implementation:
- Crisis keywords: `src/lib/mindgym/types.ts` (`CRISIS_KEYWORDS`)
- Overlay UI: `src/components/mindgym/CrisisOverlay.tsx`

## MindGym Analytics (Anonymized)
Purpose: log safety escalations without collecting user-entered text.

Implementation:
- `src/lib/mindgym/analytics.ts`
  - `trackMindGymEvent("crisis_triggered", { toolId })`
  - localStorage ring buffer: `mindmitra_mindgym_analytics_v1`
  - optional best-effort Supabase insert to `mindgym_analytics` if configured (never blocks UX)

## Avatar integration contract
Every tool component supports:

```ts
onAvatarCue?: (text: string, emotion: string) => void
```

This is a **pure callback**: tools should never call TTS directly. The parent page can decide whether an avatar is visible/enabled and route cues to the avatar pipeline.

## LocalStorage keys by tool
- `mindmitra_thought_journal_v1` — Thought Trap entries
- `mindmitra_emotion_log_v1` — Emotion Compass entries
- `mindmitra_worry_vault_v1` — Worry Vault worries, schedule, stats
- `mindmitra_mood_weather_v1` — Mood Weather check-ins
- `mindmitra_compassion_cards_v1` — Inner Critic Court saved compassion cards
- `mindmitra_gratitude_garden_v1` — Gratitude Garden entries
- `mindmitra_focus_flow_v1` — Focus Flow sessions + settings

