import type { ComponentType } from "react";

/**
 * routeChunks — one source of truth for "which JS chunk backs which URL".
 *
 * Consumed twice:
 *   1. `App.tsx` turns each loader into a `React.lazy()` component.
 *   2. `prefetchRoute()` calls the *same* loader on hover / focus / pointer-down,
 *      so the chunk is already in the module registry when the click lands.
 *
 * Calling a loader more than once is free: the browser's ES module map dedupes,
 * so the second call resolves from memory instead of re-fetching. That's what
 * makes prefetch-on-intent safe to fire liberally.
 *
 * Keep `ROUTE_CHUNKS` in step with the <Route> table in App.tsx. A missing
 * entry is not a bug — it just means that path doesn't get prefetched.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RouteModule = { default: ComponentType<any> };
export type RouteLoader = () => Promise<RouteModule>;

/**
 * Named loaders. App.tsx imports this object so the identity of each function
 * is shared with the prefetcher — that identity is what the `started` set below
 * dedupes on.
 */
export const loadRoute = {
  index: () => import("@/pages/Index"),
  sanctuaryHome: () => import("@/pages/SanctuaryHome"),
  publicLanding: () => import("@/pages/PublicLanding"),
  auth: () => import("@/pages/Auth"),
  chat: () => import("@/pages/Chat"),
  qaTests: () => import("@/pages/QATests"),
  emojiMatch: () => import("@/pages/EmojiMatch"),
  moodMountain: () => import("@/pages/MoodMountain"),
  thoughtDetective: () => import("@/pages/ThoughtDetective"),
  balloonPositivityGame: () => import("@/pages/BalloonPositivityGame"),
  therapyLanding: () => import("@/pages/TherapyLanding"),
  therapistBridge: () => import("@/pages/TherapistBridge"),
  booking: () => import("@/pages/Booking"),
  settings: () => import("@/pages/Settings"),
  profile: () => import("@/pages/Profile"),
  peerSupport: () => import("@/pages/PeerSupport"),
  psychologicalContent: () => import("@/pages/PsychologicalContent"),
  groundingRitualsArticle: () => import("@/pages/GroundingRitualsArticle"),
  nervousSystemResetArticle: () => import("@/pages/NervousSystemResetArticle"),
  bedtimeRoutineArticle: () => import("@/pages/BedtimeRoutineArticle"),
  mountainResetGuideArticle: () => import("@/pages/MountainResetGuideArticle"),
  natureFocusVisualGroundingArticle: () =>
    import("@/pages/NatureFocusVisualGroundingArticle"),
  journal: () => import("@/pages/Journal"),
  mindGymHub: () => import("@/pages/mindgym/MindGymHub"),
  mindGymSectionPage: () => import("@/pages/mindgym/MindGymSectionPage"),
  mindGymToolPage: () => import("@/pages/mindgym/MindGymToolPage"),
  me: () => import("@/pages/Me"),
  safetyPlan: () => import("@/pages/SafetyPlan"),
  privacy: () => import("@/pages/Privacy"),
  terms: () => import("@/pages/Terms"),
  notFound: () => import("@/pages/NotFound"),
} satisfies Record<string, RouteLoader>;

/**
 * Path pattern → loader. `:param` matches exactly one non-empty segment.
 * Ordered most-specific first so `/mindgym/section/:id` wins over
 * `/mindgym/:toolId`, mirroring the <Route> order in App.tsx.
 *
 * The legacy SEO redirect paths (`/breathe`, `/games`, …) are intentionally
 * absent: they render a <Navigate>, not a chunk, and are entered from search
 * results rather than hovered in-app.
 */
const ROUTE_CHUNKS: ReadonlyArray<readonly [string, RouteLoader]> = [
  ["/", loadRoute.index],
  ["/auth", loadRoute.auth],
  ["/chat", loadRoute.chat],
  ["/therapy", loadRoute.therapyLanding],
  ["/therapist-bridge", loadRoute.therapistBridge],
  ["/booking/:id", loadRoute.booking],
  ["/qa-tests", loadRoute.qaTests],
  ["/me", loadRoute.me],
  ["/safety-plan", loadRoute.safetyPlan],
  ["/privacy", loadRoute.privacy],
  ["/terms", loadRoute.terms],
  ["/emoji-match", loadRoute.emojiMatch],
  ["/mood-mountain", loadRoute.moodMountain],
  ["/thought-detective", loadRoute.thoughtDetective],
  ["/balloon-pop", loadRoute.balloonPositivityGame],
  ["/profile", loadRoute.profile],
  ["/settings", loadRoute.settings],
  ["/peer-support", loadRoute.peerSupport],
  ["/psychological-content", loadRoute.psychologicalContent],
  ["/articles/grounding-rituals-busy-mornings", loadRoute.groundingRitualsArticle],
  ["/articles/reset-your-nervous-system", loadRoute.nervousSystemResetArticle],
  ["/articles/calming-bedtime-routine", loadRoute.bedtimeRoutineArticle],
  ["/articles/mountain-reset-calmer-mind", loadRoute.mountainResetGuideArticle],
  ["/articles/nature-focus-visual-grounding", loadRoute.natureFocusVisualGroundingArticle],
  ["/journal", loadRoute.journal],
  ["/mindgym", loadRoute.mindGymHub],
  ["/mindgym/section/:sectionId", loadRoute.mindGymSectionPage],
  ["/mindgym/:toolId", loadRoute.mindGymToolPage],
];

function segments(path: string): string[] {
  return path.split("?")[0].split("#")[0].split("/").filter(Boolean);
}

function matchLoader(pathname: string): RouteLoader | null {
  const parts = segments(pathname);
  for (const [pattern, loader] of ROUTE_CHUNKS) {
    const want = segments(pattern);
    if (want.length !== parts.length) continue;
    if (want.every((w, i) => (w.startsWith(":") ? parts[i].length > 0 : w === parts[i]))) {
      return loader;
    }
  }
  return null;
}

/**
 * Data-saver guard. MindMitra's core audience is on Indian mobile data; a
 * speculative download the user never navigates to is a real cost to them.
 * Skip prefetching entirely when the browser says the connection is poor or
 * the user asked for reduced data. Actual navigations are unaffected.
 */
function prefetchAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  return conn.effectiveType !== "slow-2g" && conn.effectiveType !== "2g";
}

const started = new Set<RouteLoader>();

/**
 * Warm the chunk behind `pathname`. Idempotent and non-throwing: a prefetch
 * that fails must never surface to the user, because the real navigation will
 * retry the same import through <Suspense> anyway.
 */
export function prefetchRoute(pathname: string): void {
  if (!prefetchAllowed()) return;
  const loader = matchLoader(pathname);
  if (!loader || started.has(loader)) return;
  started.add(loader);
  loader().catch(() => {
    // Let a transient network failure be retried on the next hover.
    started.delete(loader);
  });
}

/** Prefetch by loader rather than by URL — for chunks nested below a route. */
export function prefetchChunk(loader: RouteLoader): void {
  if (!prefetchAllowed() || started.has(loader)) return;
  started.add(loader);
  loader().catch(() => started.delete(loader));
}
