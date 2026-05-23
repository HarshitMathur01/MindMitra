# MindMitra — Feature Map

A single-page index of every shipped surface, the code that powers it, and
how features fan out across the frontend, the Python agent, and the data
plane. Generated 2026-05-22. Treat code as the source of truth — when a row
here disagrees with reality, update both.

---

## 1. Product surfaces (what the user actually sees)

### 1.1 Marketing / pre-auth
| Surface | Route | Entry file | Notes |
|---|---|---|---|
| Public marketing landing | `/` (unauthenticated) | [src/pages/PublicLanding.tsx](../src/pages/PublicLanding.tsx) | Renders via `Index.tsx` gateway when `useAuth().user` is null. |
| Auth (sign-in / sign-up) | `/auth` | [src/pages/Auth.tsx](../src/pages/Auth.tsx) | Supabase auth. |
| Privacy / Terms | `/privacy`, `/terms` | [Privacy.tsx](../src/pages/Privacy.tsx), [Terms.tsx](../src/pages/Terms.tsx) | DPDP-aligned. |

### 1.2 Authenticated home
| Surface | Route | Entry file | Notes |
|---|---|---|---|
| Sanctuary Home (scenic scroll) | `/` (authenticated) | [src/pages/SanctuaryHome.tsx](../src/pages/SanctuaryHome.tsx) | Post-login landing — scroll-driven scenes (hero, lake, forest, window, firefly). Replaces old Pulse/Continue/Library dashboard. |
| `/me` — Memory & wellbeing | `/me` | [src/pages/Me.tsx](../src/pages/Me.tsx) | Pulse identity widget, kept moments, recent sessions, safety plan & settings entry. |
| Settings | `/settings` | [src/pages/Settings.tsx](../src/pages/Settings.tsx) + [components/settings/](../src/components/settings/) | Account, accessibility, notifications, privacy, general. |
| Profile | `/profile` | [src/pages/Profile.tsx](../src/pages/Profile.tsx) + [components/profile/](../src/components/profile/) | Personality, emergency contact, mental health snapshot. |
| Help (stub) | (referenced in nav) | [src/pages/Help.tsx](../src/pages/Help.tsx) | Empty file — currently a placeholder; not wired into `App.tsx` routes. |
| 404 | `*` | [src/pages/NotFound.tsx](../src/pages/NotFound.tsx) | |

### 1.3 Conversational core
| Surface | Route | Entry file | Notes |
|---|---|---|---|
| Chat (text + voice + avatar) | `/chat` | [src/pages/Chat.tsx](../src/pages/Chat.tsx) → [components/chat/ChatGPTInterface.tsx](../src/components/chat/ChatGPTInterface.tsx) | Streaming chat over HTTP `POST /chat`. |
| Avatar (lipsync) | inside `/chat` | [TalkingHeadAvatar.tsx](../src/components/chat/TalkingHeadAvatar.tsx) | Iframe bridge; maps backend `expression` → 6 therapeutic moods (empathy, concern, encouragement, acknowledgment, calm, listening). |
| Voice mic | inside `/chat` | [MicFAB.tsx](../src/components/chat/MicFAB.tsx), [useVoiceRecording.tsx](../src/hooks/useVoiceRecording.tsx), [useAzureSpeech.tsx](../src/hooks/useAzureSpeech.tsx), [useAzureNarration.ts](../src/hooks/useAzureNarration.ts) | Groq Whisper STT fallback via `POST /transcribe`. |
| Safety overlays | inside `/chat` | [ChatSafetyRail.tsx](../src/components/chat/ChatSafetyRail.tsx), [PresenceSafetyOverlay.tsx](../src/components/chat/PresenceSafetyOverlay.tsx) | Crisis responses use fixed templates, never LLM-generated. |
| Command palette | global | [components/layout/CommandPalette.tsx](../src/components/layout/CommandPalette.tsx) | Keyboard-driven nav. |

### 1.4 Therapist Bridge (referral product)
| Surface | Route | Entry file | Notes |
|---|---|---|---|
| Therapy landing | `/therapy` | [TherapyLanding.tsx](../src/pages/TherapyLanding.tsx) | Marketing for the bridge. |
| Therapist bridge | `/therapist-bridge` | [TherapistBridge.tsx](../src/pages/TherapistBridge.tsx) + [components/therapist-bridge/](../src/components/therapist-bridge/) | Profile preview, intake form, consent, directory, clinical actions. |
| Booking | `/booking/:id` | [Booking.tsx](../src/pages/Booking.tsx), [BookingModal.tsx](../src/components/therapist-bridge/BookingModal.tsx) | |

### 1.5 Mind Gym (14 tools across 5 sections)
Hub: `/mindgym` → [MindGymHub.tsx](../src/pages/mindgym/MindGymHub.tsx)  ·  Section: `/mindgym/section/:sectionId` → [MindGymSectionPage.tsx](../src/pages/mindgym/MindGymSectionPage.tsx)  ·  Tool: `/mindgym/:toolId` → [MindGymToolPage.tsx](../src/pages/mindgym/MindGymToolPage.tsx)

Catalog defined in [src/lib/mindgym/catalog.ts](../src/lib/mindgym/catalog.ts).

| Section | Tool | Tool file | Clinical basis (short) |
|---|---|---|---|
| Calm | Breath Sphere | [BreathSphere.tsx](../src/pages/mindgym/tools/BreathSphere.tsx) | Diaphragmatic breathing / HRV |
| Calm | 5-4-3-2-1 Anchor | [FiveSenses.tsx](../src/pages/mindgym/tools/FiveSenses.tsx) | DBT sensory grounding |
| Calm | Color Me Mindful | [ColorMeMindful.tsx](../src/pages/mindgym/tools/ColorMeMindful.tsx) + [color-me-mindful/](../src/pages/mindgym/tools/color-me-mindful/) | Creative grounding |
| Focus | Focus Flow Timer | [FocusFlow.tsx](../src/pages/mindgym/tools/FocusFlow.tsx) | Pomodoro / behavioral activation |
| Focus | Memory Challenge | [MemoryChallenge.tsx](../src/pages/mindgym/tools/MemoryChallenge.tsx) | Working memory |
| Reflect | Thought Trap | [ThoughtTrap.tsx](../src/pages/mindgym/tools/ThoughtTrap.tsx) | CBT cognitive restructuring (Beck) |
| Reflect | Emotion Compass | [EmotionCompass.tsx](../src/pages/mindgym/tools/EmotionCompass.tsx) | Emotional granularity (Barrett) |
| Reflect | Worry Vault | [WorryVault.tsx](../src/pages/mindgym/tools/WorryVault.tsx) | ACT defusion / scheduled worry |
| Reflect | Inner Critic Court | [InnerCritic.tsx](../src/pages/mindgym/tools/InnerCritic.tsx) | Self-compassion (Neff) |
| Reflect | Emotion Detective | [EmotionMatch.tsx](../src/pages/mindgym/tools/EmotionMatch.tsx) | Affect labeling (Lieberman) |
| Energize | Mood Weather | [MoodWeather.tsx](../src/pages/mindgym/tools/MoodWeather.tsx) | Mood tracking / behavioral activation |
| Energize | Gratitude Garden | [GratitudeGarden.tsx](../src/pages/mindgym/tools/GratitudeGarden.tsx) | Positive psychology (Emmons) |
| Fun | Campus Chess | [CampusChess.tsx](../src/pages/mindgym/tools/CampusChess.tsx) + [chess/](../src/pages/mindgym/tools/chess/) | Cognitive break |
| Fun | Campus Ludo · Hostel Hustle | [campus-ludo/](../src/pages/mindgym/tools/campus-ludo/) | Cognitive break |

Supporting infra: [TherapeuticGameShell.tsx](../src/components/mindgym/TherapeuticGameShell.tsx), [ToolShell.tsx](../src/components/mindgym/ToolShell.tsx), [CrisisOverlay.tsx](../src/components/mindgym/CrisisOverlay.tsx), [ForestBackdrop.tsx](../src/components/mindgym/ForestBackdrop.tsx).

XP / streaks / badges defined in `catalog.ts` (`BADGES`). Persistence: [src/lib/mindgym/storage.ts](../src/lib/mindgym/storage.ts) (local) + [supabaseSync.ts](../src/lib/mindgym/supabaseSync.ts) + boot-time fallback sync at [App.tsx:70-75](../src/App.tsx#L70-L75) via [syncMindGymClinicalData.ts](../src/lib/api/syncMindGymClinicalData.ts).

Legacy game leaves still reachable: `/emoji-match`, `/mood-mountain`, `/thought-detective`, `/balloon-pop` (see [App.tsx:124-129](../src/App.tsx#L124-L129)).

### 1.6 Content / library
| Surface | Route | Entry file |
|---|---|---|
| Psychological content hub | `/psychological-content` | [PsychologicalContent.tsx](../src/pages/PsychologicalContent.tsx) + [data/psychologicalContent.ts](../src/data/psychologicalContent.ts) |
| Grounding rituals article | `/articles/grounding-rituals-busy-mornings` | [GroundingRitualsArticle.tsx](../src/pages/GroundingRitualsArticle.tsx) |
| Nervous system reset | `/articles/reset-your-nervous-system` | [NervousSystemResetArticle.tsx](../src/pages/NervousSystemResetArticle.tsx) |
| Calming bedtime routine | `/articles/calming-bedtime-routine` | [BedtimeRoutineArticle.tsx](../src/pages/BedtimeRoutineArticle.tsx) |
| Mountain reset guide | `/articles/mountain-reset-calmer-mind` | [MountainResetGuideArticle.tsx](../src/pages/MountainResetGuideArticle.tsx) |
| Nature focus / visual grounding | `/articles/nature-focus-visual-grounding` | [NatureFocusVisualGroundingArticle.tsx](../src/pages/NatureFocusVisualGroundingArticle.tsx) |
| Journal | `/journal` | [Journal.tsx](../src/pages/Journal.tsx) |
| Peer support | `/peer-support` | [PeerSupport.tsx](../src/pages/PeerSupport.tsx) |
| Safety plan | `/safety-plan` | [SafetyPlan.tsx](../src/pages/SafetyPlan.tsx) |

### 1.7 Tooling / QA
| Surface | Route | Entry file |
|---|---|---|
| QA test harness | `/qa-tests` | [QATests.tsx](../src/pages/QATests.tsx) |

### 1.8 Legacy redirects
Old IA preserved as redirects to protect SEO and bookmarks. Defined inline in [App.tsx:114-129](../src/App.tsx#L114-L129):
- `/wellness-checkin`, `/healthy-habits` → `/me`
- `/games`, `/meditate`, `/stress-control` → `/mindgym`
- `/breathe` → `/mindgym/breath-sphere`
- `/gratitude` → `/mindgym/gratitude-garden`
- `/memory-challenge`, `/emotion-match` → `/mindgym/*`
- `/nutrition` → `/`

---

## 2. Backend surface (`chatbotAgent/`)

FastAPI app: [chatbotAgent/app/main.py](../chatbotAgent/app/main.py). Live request-path map is in the file's top docstring.

### 2.1 HTTP routers
| Router | File | Endpoints |
|---|---|---|
| Health | [api/health.py](../chatbotAgent/app/api/health.py) | `GET /health` (Railway probe) |
| Chat | [api/chat_ws.py](../chatbotAgent/app/api/chat_ws.py) | `POST /chat` (HTTP request/response; SSE/WebSocket intentionally not registered) |
| Onboarding | [api/onboarding.py](../chatbotAgent/app/api/onboarding.py) | `POST /onboarding` (3 prescripted turns; Groq classifier on turns 2-3) |
| Audio | [api/audio.py](../chatbotAgent/app/api/audio.py) | `POST /transcribe` (Groq Whisper-large-v3-turbo) |
| Admin | [api/admin.py](../chatbotAgent/app/api/admin.py) | `POST /admin/crisis-templates`, `POST /admin/crisis-templates/{id}/approve` (2-distinct-approver governance) |
| Therapist Bridge | [api/therapist_bridge.py](../chatbotAgent/app/api/therapist_bridge.py) | profile preview, referral, clinician magic-link read |

### 2.2 Chat pipeline (8 layers)
All in [chatbotAgent/app/pipeline/](../chatbotAgent/app/pipeline/):

| Layer | Module | Purpose |
|---|---|---|
| L1 | [ingestion.py](../chatbotAgent/app/pipeline/ingestion.py) | Unicode normalisation + PII redaction |
| L1.5 | [crisis_bypass.py](../chatbotAgent/app/pipeline/crisis_bypass.py) | Lexical + Groq-LLM confirmer (bypass-resistant; tests `tests/v3/test_crisis_bypass.py`) |
| L2 | [signal_extraction.py](../chatbotAgent/app/pipeline/signal_extraction.py) | Groq structured signals, parallel with embedding |
| L3 | [orchestrator.py](../chatbotAgent/app/pipeline/orchestrator.py) | Pure-Python: mode select, memory gate, tone, frame, max-tokens, dependency flag |
| L4 | [memory_retrieval.py](../chatbotAgent/app/pipeline/memory_retrieval.py) | Qdrant dual-channel retrieval |
| L5 | [prompt_builder.py](../chatbotAgent/app/pipeline/prompt_builder.py) | 7-block prompt, tiktoken trim |
| L6 | [llm_core.py](../chatbotAgent/app/pipeline/llm_core.py) | Azure GPT-4o primary → Groq → GLM-4 fallback chain |
| L7 | [safety_gate.py](../chatbotAgent/app/pipeline/safety_gate.py) | 5 checks → retry/replace/static fallback |

Conversation modes (orchestrator output): `companion`, `active_listener`, `recovery_check`, `referral_bridge`. (Spec also lists `psychoeducation` & `skill_coach` — gated by env flags `psychoeducation_enabled`, `skill_coach_enabled`.)

### 2.3 Memory writers (post-response, async)
All in [chatbotAgent/app/memory/](../chatbotAgent/app/memory/):
- [embedding.py](../chatbotAgent/app/memory/embedding.py) — sentence-transformer embedding (prewarmed at boot, [main.py:324-337](../chatbotAgent/app/main.py#L324-L337))
- [episodic_write.py](../chatbotAgent/app/memory/episodic_write.py) — session-end episodic memory
- [semantic_write.py](../chatbotAgent/app/memory/semantic_write.py) — semantic profile merge
- [procedural_update.py](../chatbotAgent/app/memory/procedural_update.py) — EMA style-vector update (tone convergence)
- [longitudinal_update.py](../chatbotAgent/app/memory/longitudinal_update.py) — valence/arousal trajectory

Memory is scoped by `user_id` (service-role queries must filter explicitly — system invariant from `CLAUDE.md`).

### 2.4 Services
- [session_service.py](../chatbotAgent/app/services/session_service.py) — Redis session lifecycle, keyspace listener / polling sweep
- [profile_service.py](../chatbotAgent/app/services/profile_service.py) — Supabase profile loads, audit log writes
- [supabase_service.py](../chatbotAgent/app/services/supabase_service.py)
- [therapist_profile_builder.py](../chatbotAgent/app/services/therapist_profile_builder.py), [therapist_profile_synthesis.py](../chatbotAgent/app/services/therapist_profile_synthesis.py) — clinician-facing profile bundle

### 2.5 Jobs
- [jobs/session_end_worker.py](../chatbotAgent/app/jobs/session_end_worker.py) — fans out the four memory writers on idle/timeout/explicit close

### 2.6 Core
- [core/auth.py](../chatbotAgent/app/core/auth.py) — Supabase JWT decode (refuses unsafe `SKIP_AUTH` in prod)
- [core/connections.py](../chatbotAgent/app/core/connections.py) — Redis, Qdrant, Azure, Groq, Gemini, GLM, Supabase
- [core/env.py](../chatbotAgent/app/core/env.py) — `V3Env`, `validate_required_env()`
- [core/session.py](../chatbotAgent/app/core/session.py) — `SessionObject`
- [core/fallback.py](../chatbotAgent/app/core/fallback.py) — static template selection
- [core/monitoring.py](../chatbotAgent/app/core/monitoring.py) — Sentry + PostHog
- [core/prompts/](../chatbotAgent/app/core/prompts/) — prompt blocks
- [core/logging.py](../chatbotAgent/app/core/logging.py) — request-id / trace-id context vars

---

## 3. Frontend state, hooks, libs

### 3.1 Hooks ([src/hooks/](../src/hooks/))
| Hook | Purpose |
|---|---|
| [useAuth](../src/hooks/useAuth.tsx) | Supabase auth context |
| [useChat](../src/hooks/useChat.tsx) | HTTP `/chat` driver, streaming reducer |
| [useProfile](../src/hooks/useProfile.tsx) | Profile fetch / mutation |
| [useSettings](../src/hooks/useSettings.tsx) | Settings state, persistence |
| [usePersonality](../src/hooks/usePersonality.ts) | Personality preset selection |
| [useVoiceRecording](../src/hooks/useVoiceRecording.tsx) | Mic capture |
| [useAzureSpeech](../src/hooks/useAzureSpeech.tsx) | Azure TTS bridge |
| [useAzureNarration](../src/hooks/useAzureNarration.ts) | Avatar narration sync |
| [useReadingProgress](../src/hooks/useReadingProgress.ts) | Article reader bar |
| [useDebouncedValue](../src/hooks/useDebouncedValue.ts), [usePersistedSet](../src/hooks/usePersistedSet.ts), [use-mobile](../src/hooks/use-mobile.tsx), [use-toast](../src/hooks/use-toast.ts) | Generic utilities |

### 3.2 Lib ([src/lib/](../src/lib/))
- [lib/api/syncMindGymClinicalData.ts](../src/lib/api/syncMindGymClinicalData.ts) — boot-time silent push of stranded local MindGym data to Supabase
- [lib/mindgym/](../src/lib/mindgym/) — catalog, types, theme, storage, supabaseSync, analytics
- [lib/sessionManager.ts](../src/lib/sessionManager.ts), [lib/sessionCleanup.ts](../src/lib/sessionCleanup.ts) — chat-session helpers
- [lib/azureSpeechLoader.ts](../src/lib/azureSpeechLoader.ts), [lib/avatarOptions.ts](../src/lib/avatarOptions.ts) — voice + avatar config
- [lib/helplines.ts](../src/lib/helplines.ts) — `ROUND_THE_CLOCK_HELPLINE` and crisis numbers
- [lib/productAnalytics.ts](../src/lib/productAnalytics.ts) — PostHog wrapper
- [lib/redesign/](../src/lib/redesign/) — design tokens (`DURATION`, `EASE`, etc.)

### 3.3 UI primitives
[src/components/ui/](../src/components/ui/) — shadcn/ui set (button, card, dialog, command, etc.).
App-level shells: [components/app/](../src/components/app/) (`AppShell`, `PageContainer`, `PageHeader`, `Section`).
Layout chrome: [components/layout/](../src/components/layout/) (`Header`, `Footer`, `HillsFooter`, `PageShell`, `CommandPalette`, watercolor scenes).

---

## 4. Data plane

### 4.1 Supabase (Postgres)
Migrations in [supabase/migrations/](../supabase/migrations/). Notable:
- `20260303120000_phase0_foundation.sql` — base schema
- `20260303125000_create_profile_settings_tables.sql`
- `20260303130000_personality_system.sql`
- `20260407120000_therapist_bridge.sql`
- `20260417120000_product_events.sql` — PostHog mirror
- `20260420120000_mitra_memory_v2.sql`, `20260420130000_mitra_preferences.sql`, `20260420140000_mitra_stage_engine.sql`, `20260420150000_mitra_memory_mirror.sql`
- `20260601000000_production_cleanup.sql`
- `20260602000000_memory_scoring_upgrade.sql`

Client: [src/integrations/supabase/](../src/integrations/supabase/).

### 4.2 Redis
Sessions, keyspace expiry → session-end worker. Mode controlled by `REDIS_KEYSPACE_MODE` (`auto` | `listener` | `sweep`); see [main.py:352-388](../chatbotAgent/app/main.py#L352-L388).

### 4.3 Qdrant
Dual-channel memory retrieval (episodic + semantic). Init: `scripts/migrations/init_qdrant.py`.

### 4.4 External AI providers
- Azure OpenAI (GPT-4o) — primary chat LLM
- Groq — signal extraction, crisis confirmer, Whisper STT, fallback chat
- Gemini — episodic/semantic writers
- GLM-4 — secondary fallback
- Sentence-transformers — embeddings (prewarmed at boot)

---

## 5. Cross-cutting features

| Feature | Where |
|---|---|
| Crisis path (lexical + LLM confirmer + fixed templates) | [pipeline/crisis_bypass.py](../chatbotAgent/app/pipeline/crisis_bypass.py), [ChatSafetyRail.tsx](../src/components/chat/ChatSafetyRail.tsx), [components/mindgym/CrisisOverlay.tsx](../src/components/mindgym/CrisisOverlay.tsx), [SafetyPlan.tsx](../src/pages/SafetyPlan.tsx), [lib/helplines.ts](../src/lib/helplines.ts) |
| Auth (Supabase JWT) | [hooks/useAuth.tsx](../src/hooks/useAuth.tsx), [core/auth.py](../chatbotAgent/app/core/auth.py) |
| PII redaction | [pipeline/ingestion.py](../chatbotAgent/app/pipeline/ingestion.py) |
| Audit log | `profile_service.write_audit_log` (fire-and-forget after each turn) |
| Product analytics | [ProductAnalyticsProvider.tsx](../src/components/analytics/ProductAnalyticsProvider.tsx), [lib/productAnalytics.ts](../src/lib/productAnalytics.ts), `core/monitoring.posthog_event` |
| Error boundary | [components/system/ErrorBoundary.tsx](../src/components/system/ErrorBoundary.tsx) (outermost wrapper in [App.tsx](../src/App.tsx)) |
| SEO | [components/system/SEO.tsx](../src/components/system/SEO.tsx) + `HelmetProvider` |
| Theme | [context/ThemeContext.tsx](../src/context/ThemeContext.tsx), [ThemeToggle.tsx](../src/components/ThemeToggle.tsx) |
| Skip-to-main / a11y | [components/system/SkipToMain.tsx](../src/components/system/SkipToMain.tsx), [components/settings/AccessibilitySettings.tsx](../src/components/settings/AccessibilitySettings.tsx) |
| Code-splitting | All routes `lazy()` in [App.tsx:22-52](../src/App.tsx#L22-L52); shared fallback `DashboardSkeleton` |
| Feature flags | `MHA_V3_ENABLED`, `SKIP_AUTH`, `psychoeducation_enabled`, `skill_coach_enabled`, `counsellor_dashboard_enabled` (see [core/env.py](../chatbotAgent/app/core/env.py)) |

---

## 6. Tests & evaluation
- Frontend: route-level smoke via [src/pages/QATests.tsx](../src/pages/QATests.tsx)
- Backend: [chatbotAgent/tests/v3/](../chatbotAgent/tests/), incl. `test_crisis_bypass.py`, `tests/health/`
- Evaluations: [chatbotAgent/evaluations/](../chatbotAgent/evaluations/), [chatbotAgent/run_full_evaluation.py](../chatbotAgent/run_full_evaluation.py), [chatbotAgent/rag_evaluation_report.json](../chatbotAgent/rag_evaluation_report.json)

---

## 7. Known stubs / dangling
- [src/pages/Help.tsx](../src/pages/Help.tsx) — empty file, not wired into [App.tsx](../src/App.tsx). Either implement, or delete + remove any nav references.
- [src/components/handcrafted_image/](../src/components/handcrafted_image/) — image assets only (no `.tsx`); consider moving under `src/assets/` for clarity.
- `agents/` directory in [chatbotAgent/app/](../chatbotAgent/app/) contains only `__pycache__` — no source. Likely deletable.
- `controllers/` in [chatbotAgent/app/](../chatbotAgent/app/) is also empty (only `__pycache__`). Likely deletable.

---

## 8. Source-of-truth pointers
- Architecture spec: [html-to-markdown.md](../html-to-markdown.md)
- Local dev runbook: [LOCAL_DEV.md](../LOCAL_DEV.md)
- Backend quickstart + route table: [chatbotAgent/README.md](../chatbotAgent/README.md)
- Project memory invariants: [CLAUDE.md](../CLAUDE.md)

If this doc disagrees with the code, the code wins — fix the doc in the same PR.
