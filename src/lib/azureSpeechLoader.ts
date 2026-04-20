/**
 * Loads the Azure Cognitive Services Speech SDK from the official browser bundle.
 * Do not import the npm `microsoft-cognitiveservices-speech-sdk` in app code — Vite/Rollup
 * production bundles hit circular CJS graphs and throw "Class extends value undefined".
 *
 * `index.html` includes a matching `defer` script (id below) for early parallel load;
 * this helper waits for `window.SpeechSDK` or ensures the script is present once.
 */
export const AZURE_SPEECH_SDK_SCRIPT_ID = 'azure-speech-sdk-bundle';

const AZURE_SPEECH_SDK_CDN =
  'https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.48.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle.js';

/** Namespace attached by Microsoft's browser bundle to `window`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AzureSpeechSDKGlobal = any;

declare global {
  interface Window {
    SpeechSDK?: AzureSpeechSDKGlobal;
  }
}

let sdkPromise: Promise<AzureSpeechSDKGlobal> | null = null;

export function loadAzureSpeechSDK(): Promise<AzureSpeechSDKGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Azure Speech SDK: window is not available'));
  }

  if (window.SpeechSDK) {
    return Promise.resolve(window.SpeechSDK);
  }

  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const tryResolve = (): boolean => {
        if (window.SpeechSDK) {
          resolve(window.SpeechSDK);
          return true;
        }
        return false;
      };

      if (tryResolve()) return;

      let el = document.getElementById(AZURE_SPEECH_SDK_SCRIPT_ID) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.id = AZURE_SPEECH_SDK_SCRIPT_ID;
        el.src = AZURE_SPEECH_SDK_CDN;
        el.async = true;
        document.head.appendChild(el);
      }

      // Cache the script handle so the cleanup helpers can reference the
      // same node even if the loader is re-entered.
      const scriptEl = el;
      const onLoad = () => {
        cleanup();
        if (!tryResolve()) {
          reject(new Error('Azure Speech SDK global not found after script load'));
        }
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to load Azure Speech SDK from CDN'));
      };
      // Both listeners are removed once we resolve/reject so the <script>
      // tag doesn't accumulate handlers across HMR cycles or repeated
      // loader entries.
      const cleanup = () => {
        scriptEl.removeEventListener('load', onLoad);
        scriptEl.removeEventListener('error', onError);
      };

      scriptEl.addEventListener('load', onLoad);
      scriptEl.addEventListener('error', onError);

      // Defer script may have finished before listeners were attached
      queueMicrotask(() => {
        if (tryResolve()) cleanup();
      });
    });
  }

  return sdkPromise;
}
