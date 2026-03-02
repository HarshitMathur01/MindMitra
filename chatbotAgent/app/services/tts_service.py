"""
TTS Service — ElevenLabs → Google Cloud TTS → gTTS fallback chain.
"""
import base64
import io
import logging
import os
from typing import Optional

import httpx
from gtts import gTTS
from google.cloud import texttospeech

logger = logging.getLogger(__name__)

# ── config ─────────────────────────────────────────────────────────────────
ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID: str = os.getenv("ELEVENLABS_VOICE_ID", "vT0wMbLG5dssaBsksrb6")
ELEVENLABS_MODEL_ID: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_v3")

ENABLE_ELEVENLABS_TTS: bool = bool(ELEVENLABS_API_KEY)
ENABLE_GOOGLE_TTS: bool = True

if ENABLE_ELEVENLABS_TTS:
    logger.info(
        f"✅ [TTS] ElevenLabs enabled "
        f"(voice_id={ELEVENLABS_VOICE_ID}, model_id={ELEVENLABS_MODEL_ID})"
    )
else:
    logger.warning("⚠️ [TTS] ElevenLabs disabled: ELEVENLABS_API_KEY missing")

# ── constants ──────────────────────────────────────────────────────────────
_EMOTION_VOICE_SETTINGS = {
    "happy":     {"stability": 0.0, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True},
    "sad":       {"stability": 1.0, "similarity_boost": 0.85, "style": 0.1,  "use_speaker_boost": True},
    "angry":     {"stability": 0.5, "similarity_boost": 0.75, "style": 0.45, "use_speaker_boost": True},
    "surprised": {"stability": 0.0, "similarity_boost": 0.8,  "style": 0.4,  "use_speaker_boost": True},
    "neutral":   {"stability": 0.5, "similarity_boost": 0.8,  "style": 0.2,  "use_speaker_boost": True},
}

_EMOTION_SPEECH_CONFIGS = {
    "happy":     {"speaking_rate": 1.1, "pitch": 2.0},
    "sad":       {"speaking_rate": 0.9, "pitch": -2.0},
    "angry":     {"speaking_rate": 1.05, "pitch": -1.0},
    "surprised": {"speaking_rate": 1.15, "pitch": 3.0},
    "neutral":   {"speaking_rate": 1.0, "pitch": 0.0},
}


# ── helpers ────────────────────────────────────────────────────────────────
def _is_elevenlabs_credit_exhausted(status_code: int, response_text: str) -> bool:
    indicators = ["insufficient", "credit", "quota", "limit", "payment", "free tier", "character_limit"]
    return status_code in (401, 402, 403, 429) and any(ind in (response_text or "").lower() for ind in indicators)


# ── individual providers ────────────────────────────────────────────────────
def generate_elevenlabs_tts(text: str, emotion: str = "neutral", language_style: str = "english") -> Optional[str]:
    """Generate TTS via ElevenLabs. Returns base64 MP3 or None."""
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        return None

    settings = _EMOTION_VOICE_SETTINGS.get(emotion, _EMOTION_VOICE_SETTINGS["neutral"])
    try:
        logger.info(f"🔊 [ElevenLabs] Generating audio ({len(text)} chars)…")
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"
        headers = {"xi-api-key": ELEVENLABS_API_KEY, "Accept": "audio/mpeg", "Content-Type": "application/json"}
        payload = {"text": text, "model_id": ELEVENLABS_MODEL_ID, "output_format": "mp3_44100_128", "voice_settings": settings}

        with httpx.Client(timeout=35.0) as client:
            response = client.post(url, headers=headers, json=payload)

        if response.status_code == 200 and response.content:
            audio_b64 = base64.b64encode(response.content).decode("utf-8")
            logger.info(f"✅ [ElevenLabs] {len(audio_b64) / 1024:.1f} KB base64 MP3")
            return audio_b64

        response_text = response.text[:600]
        logger.error(f"❌ [ElevenLabs] {response.status_code}: {response_text}")
        if _is_elevenlabs_credit_exhausted(response.status_code, response_text):
            logger.warning("⚠️ [ElevenLabs] Credits/quota exhausted")
        return None
    except Exception as e:
        logger.error(f"❌ [ElevenLabs] Exception: {e}")
        return None


def generate_google_cloud_tts(text: str, emotion: str = "neutral", language_style: str = "english") -> Optional[str]:
    """Generate TTS via Google Cloud Text-to-Speech. Returns base64 WAV or None."""
    try:
        logger.info(f"🔊 [Google TTS] Generating audio ({len(text)} chars)…")
        client = texttospeech.TextToSpeechClient()

        cfg = _EMOTION_SPEECH_CONFIGS.get(emotion, _EMOTION_SPEECH_CONFIGS["neutral"])
        synthesis_input = texttospeech.SynthesisInput(text=text)

        if language_style in ("hindi-mixed", "hinglish"):
            lang_code, voice_name = "hi-IN", "hi-IN-Neural2-A"
        else:
            lang_code, voice_name = "en-US", "en-US-Wavenet-F"

        voice = texttospeech.VoiceSelectionParams(
            language_code=lang_code,
            name=voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
            sample_rate_hertz=16000,
            speaking_rate=cfg["speaking_rate"],
            pitch=cfg["pitch"],
        )
        response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
        audio_b64 = base64.b64encode(response.audio_content).decode("utf-8")
        logger.info(f"✅ [Google TTS] {len(audio_b64) / 1024:.1f} KB base64 WAV")
        return audio_b64
    except Exception as e:
        logger.error(f"❌ [Google TTS] {e}")
        return None


def generate_gtts_audio(text: str, lang: str = "en") -> Optional[str]:
    """Generate TTS via gTTS (fallback). Returns base64 MP3 or None."""
    try:
        logger.info(f"🔊 [gTTS] Generating audio ({len(text)} chars)…")
        tts = gTTS(text=text, lang=lang, slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        audio_b64 = base64.b64encode(buf.read()).decode("utf-8")
        logger.info(f"✅ [gTTS] {len(audio_b64) / 1024:.1f} KB base64 MP3")
        return audio_b64
    except Exception as e:
        logger.error(f"❌ [gTTS] {e}")
        return None


# ── main entry ─────────────────────────────────────────────────────────────
def generate_tts_audio_v2(text: str, emotion: str = "neutral", language_style: str = "english") -> Optional[str]:
    """
    Fallback chain: ElevenLabs → Google Cloud TTS → gTTS.
    Returns base64-encoded audio (WAV or MP3) or None on complete failure.
    """
    if ENABLE_ELEVENLABS_TTS:
        audio = generate_elevenlabs_tts(text, emotion, language_style)
        if audio:
            return audio
        logger.warning("⚠️ [TTS] ElevenLabs failed, trying Google Cloud TTS…")

    if ENABLE_GOOGLE_TTS:
        audio = generate_google_cloud_tts(text, emotion, language_style)
        if audio:
            return audio
        logger.warning("⚠️ [TTS] Google Cloud TTS failed, trying gTTS…")

    return generate_gtts_audio(text)
