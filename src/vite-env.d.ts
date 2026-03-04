/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_AZURE_TTS_KEY?: string;
    // add more env vars here as needed
    [key: string]: string | undefined;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
