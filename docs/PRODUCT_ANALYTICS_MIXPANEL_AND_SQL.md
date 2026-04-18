# Product analytics: Mixpanel, SQL, and safety

This document explains how MindMitra collects **explicit, low-sensitivity product events**, how to analyze them in **Mixpanel** and **Supabase SQL**, and how to avoid **clinical data leakage** on a mental-health product.

## Where the data lives

| Layer | What it stores | Where you analyze |
|--------|----------------|-------------------|
| **Mixpanel** (optional vendor) | Event names + small sanitized property bags; `distinct_id` = Supabase `user_id` (UUID) when logged in | Mixpanel **Insights**, **Funnels**, **Retention** |
| **Supabase `public.product_events`** | Same events for users with an active session (RLS: own rows only) | Supabase **SQL Editor**, **Metabase**, exports |
| **Supabase relational** | `chat_messages`, `onboarding_analytics`, `crisis_events`, etc. | SQL only — **never** ship raw message text to a third party |

First-party SQL templates: [`docs/sql/beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql).

Client implementation: [`src/lib/productAnalytics.ts`](../src/lib/productAnalytics.ts).

## Turning analytics on (production checklist)

1. **Apply the migration**  
   Run [`supabase/migrations/20260417120000_product_events.sql`](../supabase/migrations/20260417120000_product_events.sql) on your project (CLI `db push` or SQL Editor).

2. **Create a Mixpanel project** (US or EU data residency). Copy the **project token** (not the secret API key for exports on the server).

3. **Set frontend env** (see [`.env.production.example`](../.env.production.example)):

   - `VITE_ENABLE_PRODUCT_ANALYTICS=1`
   - `VITE_MIXPANEL_TOKEN=<token>`
   - Optional: `VITE_MIXPANEL_API_HOST=https://api-eu.mixpanel.com` for EU projects.

4. **Privacy policy**  
   Disclose that you use product analytics (category of events, vendor name, purpose). Offer opt-out if your jurisdiction requires it; wire `setProductAnalyticsOptOut(true)` from settings when you add a toggle.

5. **Mixpanel project settings**  
   Keep **Session Replay** off for this app unless you complete a separate DPIA and URL/path rules that **exclude** `/chat` and any assessment flows. This codebase does **not** start replay.

## Safety rules (non-negotiable)

- **Never** send chat content, voice transcripts, journal text, clinician notes, diagnoses, medications, addresses, phone numbers, or free-form user essays in event properties.
- **Never** put PHI into Mixpanel **People** profiles; we do not call `people.set` with email or name.
- Use **coarse labels** only, for example: `section: "resources"`, `route: "/profile"`, `personality_id: "mitra"` (enum-like), `success: true`.
- The client **strips** property keys that match sensitive substrings and caps string length (see `productAnalytics.ts`). This is a safety net, not a substitute for careful event design.
- **Respects `DNT`** when the browser sends Do Not Track; analytics stay off in that case.
- **Autocapture is disabled**; automatic pageview tracking is off so query strings with accidental tokens are not ingested by default.

## Instrumenting new events

Call from React only when it improves product understanding:

```ts
import { trackProductEvent } from '@/lib/productAnalytics';

trackProductEvent('settings_saved', { section: 'notifications' });
```

Event names must match `^[a-z][a-z0-9_]*$` (lowercase, reasonable length). If the name fails validation, the event is dropped.

## Mixpanel: how to visualize

1. **Insights** — Count of events over time; breakdown by a whitelisted property (e.g. `section`).
2. **Funnels** — Ordered steps such as `signup_completed` → `chat_thread_opened` → `first_message_sent` (define events you actually emit).
3. **Retention** — Return behavior using any recurring event you trust (e.g. `app_session` if you add a heartbeat — keep it sparse).

**VC-oriented views:** Save board-level charts: WAU/MAU proxy (unique `distinct_id` per week), core funnel conversion, and **supporting** retention on a non-clinical recurring event.

## SQL analytics: how to run and interpret

1. Open **Supabase → SQL Editor** as a project operator (postgres / dashboard), not the anon key.
2. Run queries from [`beta_product_analytics_queries.sql`](sql/beta_product_analytics_queries.sql).

**Interpretation:**

- **Query 1–2 (`product_events`)** — Funnel volume and DAU **only for clients with analytics enabled** and logged-in users (mirror writes require a session).
- **Query 3 (`chat_messages`)** — Authoritative **message counts** and active chatters; still **aggregate only**; do not export `content` to slides.
- **Query 4 (`onboarding_analytics`)** — Structural onboarding events from stored metadata.
- **Query 5 (`crisis_events`)** — Counts by day/level for operations; handle under clinical governance, not marketing decks.

For retention in SQL, define cohort keys (e.g. first `product_events` day per user) in a derived query; keep definitions stable week-to-week so metrics are comparable.

## Operational access control

- **Mixpanel:** project access limited to founders + designated ops; enable SSO if available; review **Lexicon** to hide unused properties.
- **Supabase:** RLS on `product_events` allows users to read their own rows; **operator dashboards** use the dashboard role, not the app anon key.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Mixpanel empty | `VITE_ENABLE_PRODUCT_ANALYTICS` not `1`, or token missing, or DNT enabled |
| Supabase `product_events` empty but Mixpanel works | User not logged in, migration not applied, or RLS policy failure (see browser console in dev) |
| TypeScript errors on `product_events` | Regenerate Supabase types after migration (`types.ts`) |

## Related docs

- [`docs/EVALUATION.md`](EVALUATION.md) — evaluation vs product metrics context  
- [`docs/api_contracts.md`](api_contracts.md) — API shapes (unchanged by analytics)
