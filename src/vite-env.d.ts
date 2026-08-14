/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_AZURE_TTS_KEY?: string;
    readonly VITE_AZURE_TTS_REGION?: string;
    readonly VITE_GOOGLE_TTS_KEY?: string;
    /**
     * Historical avatar-renderer switch. TalkingHead has been deleted, so the
     * chat surface mounts AnamAvatar unconditionally and nothing reads this.
     * See src/lib/avatarProvider.ts.
     */
    readonly VITE_AVATAR_PROVIDER?: string;
    /**
     * `true` / `1` → Anam turnkey mode: Anam's own STT + LLM + TTS drive the
     * conversation and the crisis interceptor in useAnamAvatar.ts is what keeps
     * crisis replies on clinician-reviewed templates. Anything else keeps the
     * MindMitra /chat pipeline in charge with Anam doing lipsync only.
     * See docs/anam-avatar.md.
     */
    readonly VITE_ANAM_PIPELINE_MODE?: string;
    /** Sanctuary: `"true"` → read mood logs from Supabase; `"false"` → localStorage only. */
    readonly VITE_SANCTUARY_MOOD_LOGS_REMOTE?: string;
    /** Sanctuary: `"true"` → fetch /me/snapshot from Railway backend. */
    readonly VITE_SANCTUARY_SNAPSHOT_REMOTE?: string;
    /** Set to `1` to enable Mixpanel + `product_events` (see docs/product.md). */
    readonly VITE_ENABLE_PRODUCT_ANALYTICS?: string;
    readonly VITE_MIXPANEL_TOKEN?: string;
    /** Optional. Default US: `https://api.mixpanel.com`. EU project: `https://api-eu.mixpanel.com`. */
    readonly VITE_MIXPANEL_API_HOST?: string;
    // add more env vars here as needed
    [key: string]: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module "virtual:avatar-backdrop-videos" {
    const videos: Array<{
        src: string;
        poster?: string;
    }>;
    export default videos;
}
