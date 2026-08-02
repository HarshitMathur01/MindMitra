/**
 * RouteFallback — the <Suspense> placeholder for lazy route chunks.
 *
 * Why this replaced the single `DashboardSkeleton`: that skeleton drew the
 * retired dashboard (mood row + 4-up quick-action grid). Nothing in the app
 * has looked like that since `/` became the SanctuaryHome scroll, so every
 * route was preceded by a skeleton of a page that no longer exists — which
 * reads worse than a plain hold, because the layout visibly jumps when the
 * real page arrives.
 *
 * Three shapes, chosen by pathname, matching the three real layouts:
 *   home  → full-bleed scene with a centred hero panel (SanctuaryHome, PublicLanding)
 *   chat  → conversation column with a pinned composer (ChatGPTInterface)
 *   page  → fixed header + max-w-page content rhythm (PageShell surfaces)
 *
 * Constraints this file lives under:
 *   - It ships in the eager bundle, so: plain divs, theme tokens, no imports.
 *   - `motion-safe:` gates the pulse so `prefers-reduced-motion` users get a
 *     still placeholder instead of a throbbing one.
 */

type Shape = "home" | "chat" | "page";

function routeFallbackShape(pathname: string): Shape {
  if (pathname === "/") return "home";
  if (pathname === "/chat") return "chat";
  return "page";
}

const bar = "rounded bg-muted motion-safe:animate-pulse";
const block = "rounded-2xl bg-muted motion-safe:animate-pulse";

function HeaderBar() {
  return (
    <div className="flex h-[var(--header-height,56px)] items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-muted motion-safe:animate-pulse" />
        <div className={`h-4 w-28 ${bar}`} />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-muted motion-safe:animate-pulse" />
        <div className="hidden h-9 w-24 rounded-full bg-muted motion-safe:animate-pulse lg:block" />
      </div>
    </div>
  );
}

function HomeFallback() {
  return (
    <div className="min-h-screen w-full bg-background">
      {/* Both `/` branches use a floating pill nav, not the app HeaderBar. */}
      <div className="flex justify-center px-4 py-5">
        <div className="h-14 w-full max-w-3xl rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
      {/*
        Arrival: full-bleed backdrop, centred column, then a row of round mood
        dots. The dot row is the shape-defining element of SanctuaryHome's hero
        — without it the skeleton visibly re-lays-out when the real page lands.
        PublicLanding shares this shape closely enough (backdrop + centred
        headline + CTA) that one fallback still serves both.
      */}
      <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <div className="absolute inset-0 bg-muted/40 motion-safe:animate-pulse" />
        <div className="relative flex w-full max-w-xl flex-col items-center gap-5 p-8 sm:p-10">
          <div className={`h-3 w-24 ${bar}`} />
          <div className={`h-12 w-full max-w-md ${bar}`} />
          <div className={`h-12 w-3/4 max-w-sm ${bar}`} />
          <div className={`mt-2 h-4 w-64 ${bar}`} />
          <div className="mt-6 flex items-center justify-center gap-5 sm:gap-7">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="size-12 rounded-full bg-muted motion-safe:animate-pulse" />
            ))}
          </div>
          <div className="mt-6 h-12 w-52 rounded-full bg-muted motion-safe:animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function ChatFallback() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <HeaderBar />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-8 sm:px-6">
        <div className={`h-16 w-3/4 self-start ${block}`} />
        <div className={`h-10 w-1/2 self-end ${block}`} />
        <div className={`h-24 w-4/5 self-start ${block}`} />
        <div className={`h-10 w-2/5 self-end ${block}`} />
      </div>
      {/* Composer — the one element users look for first on /chat. */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 sm:px-6">
        <div className="h-14 w-full rounded-full bg-muted motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="min-h-screen w-full bg-background">
      <HeaderBar />
      <div className="mx-auto w-full max-w-page px-4 pt-8 sm:px-6 lg:px-8">
        <div className={`h-3 w-28 ${bar}`} />
        <div className={`mt-4 h-8 w-3/4 max-w-xl ${bar}`} />
        <div className={`mt-3 h-4 w-1/2 max-w-md ${bar}`} />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className={`h-40 ${block}`} />
          <div className={`h-40 ${block}`} />
          <div className={`h-40 ${block}`} />
          <div className={`h-40 ${block}`} />
        </div>
      </div>
    </div>
  );
}

export function RouteFallback({ pathname }: { pathname: string }) {
  const shape = routeFallbackShape(pathname);
  // `data-route-fallback` is a debugging affordance: it makes "is the user
  // looking at OUR skeleton, or at the destination page's own loading state?"
  // answerable from devtools or a perf script, which is otherwise guesswork
  // once several pulsing placeholders are on screen.
  return (
    <div data-route-fallback={shape}>
      {shape === "home" ? <HomeFallback /> : shape === "chat" ? <ChatFallback /> : <PageFallback />}
    </div>
  );
}

export default RouteFallback;
