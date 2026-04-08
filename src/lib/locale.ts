/**
 * Locale helpers shared across chat UI, avatar, and STT.
 */

export type SupportedLanguage =
  | "english"
  | "hindi"
  | "hinglish"
  | "japanese"
  | "telugu"
  | "kannada"
  | "tamil";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  english: "English",
  hindi: "हिन्दी",
  hinglish: "Hinglish",
  japanese: "日本語",
  telugu: "తెలుగు",
  kannada: "ಕನ್ನಡ",
  tamil: "தமிழ்",
};

const BCP47_MAP: Record<SupportedLanguage, string> = {
  english: "en-IN",
  hindi: "hi-IN",
  hinglish: "hi-IN",
  japanese: "ja-JP",
  telugu: "te-IN",
  kannada: "kn-IN",
  tamil: "ta-IN",
};

interface VoiceSpec {
  azure: string;
  google: string;
  bcp47: string;
}

const VOICE_TABLE: Record<SupportedLanguage, VoiceSpec> = {
  english: { azure: "en-IN-NeerjaNeural", google: "en-IN-Neural2-A", bcp47: "en-IN" },
  hindi: { azure: "hi-IN-SwaraNeural", google: "hi-IN-Neural2-A", bcp47: "hi-IN" },
  hinglish: { azure: "hi-IN-SwaraNeural", google: "hi-IN-Neural2-A", bcp47: "hi-IN" },
  japanese: { azure: "ja-JP-NanamiNeural", google: "ja-JP-Neural2-B", bcp47: "ja-JP" },
  telugu: { azure: "te-IN-ShrutiNeural", google: "te-IN-Standard-A", bcp47: "te-IN" },
  kannada: { azure: "kn-IN-SapnaNeural", google: "kn-IN-Standard-A", bcp47: "kn-IN" },
  tamil: { azure: "ta-IN-PallaviNeural", google: "ta-IN-Standard-A", bcp47: "ta-IN" },
};

export function languageToBcp47(lang?: string): string {
  return BCP47_MAP[(lang as SupportedLanguage) ?? "english"] ?? "en-IN";
}

export function voiceForLocale(lang?: string): { ttsVoice: string; ttsLang: string } {
  const spec = VOICE_TABLE[(lang as SupportedLanguage) ?? "english"] ?? VOICE_TABLE.english;
  return { ttsVoice: spec.azure, ttsLang: spec.bcp47 };
}

export function sttLocale(lang?: string): string {
  return BCP47_MAP[(lang as SupportedLanguage) ?? "english"] ?? "en-IN";
}
