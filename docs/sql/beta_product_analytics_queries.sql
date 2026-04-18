-- MindMitra beta / product analytics — run in Supabase SQL Editor (postgres role).
-- Source rows: public.product_events (client), public.onboarding_analytics, public.chat_messages, public.crisis_events.

-- ── 1) Daily event counts (funnel building blocks) ─────────────────────────
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_ist,
       event_name,
       count(*) AS events
FROM public.product_events
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;

-- ── 2) Unique users per day (WAU building block) ───────────────────────────
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_ist,
       count(DISTINCT user_id) AS unique_users
FROM public.product_events
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- ── 3) Chat engagement from DB (authoritative message volume) ──────────────
-- Adjust timezone as needed.
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_ist,
       count(*) FILTER (WHERE role = 'user') AS user_messages,
       count(*) FILTER (WHERE role = 'assistant') AS assistant_messages,
       count(DISTINCT user_id) AS users_with_messages
FROM public.chat_messages
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;

-- ── 4) Onboarding funnel (structural events in metadata.event_type) ────────
SELECT coalesce(metadata ->> 'event_type', '(none)') AS event_type,
       count(*) AS n
FROM public.onboarding_analytics
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 2 DESC;

-- ── 5) Crisis signals (counts only — review process separately) ──────────
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS day_ist,
       level,
       count(*) AS n
FROM public.crisis_events
WHERE created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- ── 6) DAU from product_events (instrumented clients only) ─────────────────
SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day_utc,
       count(DISTINCT user_id) AS dau
FROM public.product_events
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;
