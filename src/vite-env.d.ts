/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_AZURE_TTS_KEY?: string;
    readonly VITE_AZURE_TTS_REGION?: string;
    readonly VITE_GOOGLE_TTS_KEY?: string;
    // add more env vars here as needed
    [key: string]: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
