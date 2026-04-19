# Security Headers — Production Configuration

These headers ship with `vercel.json` for every deploy. They protect users in three ways:

1. **Stop secrets leaking via the URL bar.** `Referrer-Policy: strict-origin-when-cross-origin` ensures
   that any URL-borne credential (e.g. legacy `?googleKey=` query parameters on the avatar iframe — see
   CODE_AUDIT.md item #1) is not sent in the `Referer` header to third-party CDNs.
2. **Lock down browser capabilities.** `Permissions-Policy` denies camera, geolocation, payment, and
   FLoC. Microphone is allowed for the self-origin only because it powers the voice/Presence Mode
   feature. If you remove voice, also remove `microphone=(self)`.
3. **Prepare for a strict CSP.** We currently ship CSP in **Report-Only** mode so any violation
   surfaces in browser DevTools / a future report endpoint without breaking the site. Once we have
   confidence that the allow-list below covers all real traffic, switch the header name from
   `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

---

## CSP allow-list rationale

| Directive       | Allowed                                                                                     | Why                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `script-src`    | `'self'`, `'unsafe-inline'`, `https://cdn.jsdelivr.net`                                     | Vite injects inline bootstrap; Three.js + Azure Speech SDK loaded from jsDelivr inside `/talkinghead.html`.               |
| `style-src`     | `'self'`, `'unsafe-inline'`                                                                 | Tailwind, Framer Motion, Sonner all emit inline styles. Required to keep the UI from breaking.                            |
| `connect-src`   | `'self'`, Supabase, Mixpanel, Google TTS, Azure TTS, jsDelivr                               | All outbound XHR/SSE/WebSocket destinations the app actually talks to. Add new domains here when you add a new provider. |
| `frame-src`     | `'self'`                                                                                    | The TalkingHead avatar lives at `/talkinghead.html` (same-origin). No third-party frames are allowed.                     |
| `worker-src`    | `'self'`, `blob:`                                                                           | Some libs spin up workers from blobs (e.g. Three.js).                                                                     |
| `object-src`    | `'none'`                                                                                    | We never embed plugins; this kills a class of legacy XSS vectors.                                                         |
| `base-uri`      | `'self'`                                                                                    | Prevents an injected `<base>` tag from re-routing relative URLs.                                                          |
| `form-action`   | `'self'`                                                                                    | All forms POST to our origin (Supabase RPC over fetch goes through `connect-src`, not form submit).                       |

`upgrade-insecure-requests` ensures any accidental `http://` URL gets rewritten to `https://` in
production.

---

## Promoting CSP from Report-Only to enforced

1. Watch the browser console (or attach a `report-uri`/`report-to` endpoint) for `[Report Only]`
   warnings during a 1–2 week observation window across web, Android Chrome, iOS Safari.
2. For each violation, decide: **add the origin to the allow-list** (legitimate), or **fix the
   code** (incidental — usually inline scripts that should be moved into modules).
3. When violations stop appearing in normal use, change the header key in `vercel.json` from
   `Content-Security-Policy-Report-Only` → `Content-Security-Policy`. Re-deploy.

## Notes for backend (chatbotAgent/) endpoints

The frontend talks to `VITE_BACKEND_URL` (Railway). Until that domain is added explicitly, requests
will be flagged by CSP. Recommended:

```
connect-src ... https://your-railway-app.up.railway.app ...
```

…or use a stable custom subdomain (e.g. `api.mindmitra.in`) so the CSP doesn't need to change every
deploy.
