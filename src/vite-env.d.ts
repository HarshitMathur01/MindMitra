/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_AZURE_TTS_KEY?: string;
    readonly VITE_AZURE_TTS_REGION?: string;
    readonly VITE_GOOGLE_TTS_KEY?: string;
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
