# Product — UX surfaces, bridge, analytics, security

Complements [MITRA.md](MITRA.md) (backend narrative) and [platform.md](platform.md) (runbook).

---

## System shape (frontend ↔ API)

- **React/Vite SPA** (`src/`) talks to **FastAPI** (`chatbotAgent/`) over HTTPS.
- **Auth and relational data:** Supabase (JWT to API).
- **Avatar / TTS:** browser-side (Azure, Google fallbacks in `public/talkinghead.html`); backend returns **text** and motion hints, not audio bytes.

---

## MindGym

Offline therapeutic practices (not casual games). UX: low cognitive load, calm copy.

| Item | Location |
|------|----------|
| Routes | `GET /mindgym`, `GET /mindgym/:toolId` |
| Catalog | `src/lib/mindgym/catalog.ts` — `MINDGYM_TOOLS` |
| Types | `src/lib/mindgym/types.ts` |
| Tool pages | `src/pages/mindgym/MindGymToolPage.tsx` (lazy `React.lazy`) |
| Progress | `src/lib/mindgym/storage.ts` — keys `mindmitra_mindgym_progress_v1`, `mindmitra_mindgym_reco_v1` |

Stable tool IDs include: `breath-sphere`, `thought-trap`, `emotion-compass`, `worry-vault`, `mood-weather`, `five-senses`, `inner-critic`, `gratitude-garden`, `focus-flow`.

**Streaks:** “Today” uses **Asia/Kolkata** local date.

---

## Therapist bridge

**Consent-driven** path from in-app activity to a **structured clinician-facing brief**. Metrics must tie to **stored events**, not free-form model claims.

| Layer | Rule |
|-------|------|
| Sync | MindGym completions should reach Supabase `user_activities` (e.g. `ToolShell.tsx` → sync on complete; boot fallback in `App.tsx` when applicable) |
| Aggregate | `chatbotAgent/app/services/therapist_profile_builder.py` |
| PDF | `src/lib/utils/exportClinicalPDF.ts` — jsPDF; respects consent sections |

**Propagation:** new end-to-end metrics require updates in **backend extraction**, **frontend types**, and **PDF** together.

---

## Design language (“Quiet Companion”)

- **Tokens:** `src/index.css` (Sanctuary v4), behavior tokens `src/lib/redesign/tokens.ts`.
- **Principles:** calm editorial layout; sage accent (`--accent-500`); danger palette for crisis-only; restraint over decorative AI chrome.
- **Type:** DM Sans display, Inter body — see existing utility classes in CSS.

---

## Product analytics

| Layer | Storage | Analysis |
|-------|---------|----------|
| Mixpanel (optional) | Event names + coarse props; `distinct_id` = user UUID when logged in | Mixpanel dashboards |
| Supabase `product_events` | Same events (RLS: own rows) | SQL Editor, Metabase |

**Client:** `src/lib/productAnalytics.ts` — `trackProductEvent`.

**Enable:** migration `supabase/migrations/20260417120000_product_events.sql`; frontend `VITE_ENABLE_PRODUCT_ANALYTICS=1` and `VITE_MIXPANEL_TOKEN` (see `.env.production.example`).

**Rules:** never send chat text, transcripts, journal content, or PHI in event properties; no autocapture on chat surfaces; Session Replay off unless separately reviewed.

**SQL templates:** [`sql/beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql).

---

## Security headers

Configured in **`vercel.json`** (production):

- **Referrer-Policy** — limits leakage of URL-borne parameters to third parties.
- **Permissions-Policy** — restricts camera, geolocation, etc.; microphone allowed for same-origin (voice / Presence Mode).
- **CSP** — shipped Report-Only first; promote to enforced after a clean observation window. Allow-list covers Vite inline bootstrap, jsDelivr (TalkingHead / Azure Speech), Supabase, Mixpanel, TTS endpoints.

When adding a new outbound domain, update CSP `connect-src` (and related directives) in the same change.
