# verify — MindMitra frontend

How to drive the app for runtime verification.

## Launch

- `npm run dev` → Vite on **http://localhost:8080** (strict port, `vite.config.ts`).
- No test suite exists. Static gates: `npx tsc --noEmit`, `npm run lint`,
  `npm run lint:copy` (main carries 4 pre-existing banned-word hits in
  MoodMountain/ThoughtDetective — gate is zero NEW hits), `npm run build`.

## Reaching the authenticated surface (`/` → SanctuaryHome)

`/` renders PublicLanding unless a Supabase session exists (`src/pages/Index.tsx`).
There is no frontend auth bypass. For client-side-only verification, inject a
fake session before reload — supabase-js trusts localStorage until a server
call rejects it; data queries then 401 and every hook falls back to its
cold-start state (which is also the flags-off default worth testing):

```js
// key: sb-<project-ref>-auth-token, ref from VITE_SUPABASE_URL in .env
localStorage.setItem("sb-mwdgrottngfmcelqydsg-auth-token", JSON.stringify({
  access_token: fakeJwtWithFutureExp, token_type: "bearer",
  expires_at: farFutureEpochSeconds, expires_in: 999999, refresh_token: "fake",
  user: { id: "<uuid>", aud: "authenticated", role: "authenticated",
          email: "x@example.com", app_metadata: {},
          user_metadata: { full_name: "Asha Kumar" },
          created_at: "...", updated_at: "..." },
}));
```

The fake JWT just needs three base64url segments and a future `exp`.

## Browser harness

No Playwright/puppeteer in the repo. Use `puppeteer-core` (install in a
scratch dir, `--no-save`) with the system browser:
`C:/Program Files/Google/Chrome/Application/chrome.exe`. Launch args that
matter: `--mute-audio --autoplay-policy=no-user-gesture-required`.

## Flows worth driving on SanctuaryHome

- Five scene landmarks `#arrival #checkin #doors #practice #reflect`; header
  anchors + `/me` + `/settings` links.
- Mood tap (buttons `[aria-label^="Mood:"]`) → with
  `VITE_SANCTUARY_MOOD_LOGS_REMOTE` off it writes
  `mindmitra-sanctuary-mood-local:<userId>` and must light the
  ConstellationMap in the same render (shared React Query key).
- Soundscape pills → network fetch of `/sounds/ambient/<track>.mp3`,
  `aria-pressed`, `[role="status"]` aria-live line. Revisit must show the
  stored track as an outlined suggestion, never autoplay.
- Guided video play → `<video src="/videos/meditating_calming.mp4">` mounts
  and the soundscape status flips to off.
- Parallax: `getComputedStyle(document.querySelector('#checkin .scene-bg')).transform`
  at two `window.scrollTo` positions — drifts on desktop ≥768px, static under
  `prefers-reduced-motion` emulation and at mobile widths.
- Overflow: `scrollWidth - clientWidth === 0` at 1440px and 375px.

## Gotchas

- Framer-motion scroll values clamp once a scene is fully past — measure at
  absolute scroll positions near the scene, not after `scrollIntoView` of a
  distant section.
- Day-keying of mood logs is local-timezone (`localDayKey` in
  `src/hooks/useMoodLog.ts`) — don't reintroduce `toISOString().slice(0,10)`.
