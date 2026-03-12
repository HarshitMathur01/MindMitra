"""
Voice Prosody Analysis Service — MindMitra
==========================================

Extracts clinically-validated prosodic features from speech audio using
Praat (via parselmouth). These objective acoustic measurements are sent
to the AI response pipeline WITHOUT interpretation — the LLM contextualises
them alongside conversation history.

Features extracted:
  - Pitch (F0): mean, std, min, max, range — voice frequency
  - Intensity: mean, std, range — volume / energy
  - Jitter: local % — pitch perturbation (voice shakiness)
  - Shimmer: local dB — amplitude perturbation (voice tremor)
  - HNR: harmonics-to-noise ratio — voice clarity
  - Voiced fraction: % of audio that is voiced speech

Why Praat over ML:
  - Gold standard in clinical voice research (used in DSM-5 studies)
  - ~30 MB installed, ~50 MB in memory — fits Railway free tier
  - 200-500 ms per utterance on CPU-only
  - Extracts the SAME features that ML-SER models are trained to detect
  - No external API cost
"""

import io
import base64
import logging
import time
from typing import Dict, Optional, Any

logger = logging.getLogger("mindmitra.voice_prosody")

# Lazy import: parselmouth is only loaded when actually called
_parselmouth = None


def _get_parselmouth():
    """Lazy-load parselmouth to avoid startup cost if never used."""
    global _parselmouth
    if _parselmouth is None:
        try:
            import parselmouth
            _parselmouth = parselmouth
            logger.info("✅ [PROSODY] parselmouth loaded successfully")
        except ImportError:
            logger.warning(
                "⚠️ [PROSODY] parselmouth not installed — pip install parselmouth"
            )
            _parselmouth = False  # sentinel: tried and failed
    return _parselmouth if _parselmouth is not False else None


def analyze_prosody(wav_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Analyse a WAV audio buffer and return raw prosodic features.

    Args:
        wav_bytes: Raw WAV file bytes (16-bit PCM, any sample rate)

    Returns:
        Dict of prosodic features or None if analysis fails.
        All values are raw numerics — no emotional labels.
    """
    pm = _get_parselmouth()
    if pm is None:
        logger.warning("⚠️ [PROSODY] parselmouth unavailable, skipping analysis")
        return None

    t0 = time.monotonic()

    try:
        # Load audio from bytes
        sound = pm.Sound(io.BytesIO(wav_bytes))
        duration = sound.duration

        if duration < 0.5:
            logger.info(f"⚠️ [PROSODY] Audio too short ({duration:.1f}s), skipping")
            return None

        # ── Pitch (F0) extraction ──
        # Praat's default autocorrelation method, optimised for speech
        pitch = sound.to_pitch_ac(
            time_step=0.01,       # 10ms frames
            pitch_floor=75.0,     # Hz — covers deep male voices
            pitch_ceiling=500.0,  # Hz — covers high female voices
        )

        pitch_values = pitch.selected_array["frequency"]
        voiced_frames = pitch_values[pitch_values > 0]

        if len(voiced_frames) > 0:
            pitch_mean = float(voiced_frames.mean())
            pitch_std = float(voiced_frames.std())
            pitch_min = float(voiced_frames.min())
            pitch_max = float(voiced_frames.max())
            pitch_range = pitch_max - pitch_min
            voiced_fraction = len(voiced_frames) / len(pitch_values)
        else:
            pitch_mean = pitch_std = pitch_min = pitch_max = pitch_range = 0.0
            voiced_fraction = 0.0

        # ── Intensity (energy / loudness) ──
        intensity = sound.to_intensity(
            minimum_pitch=75.0,
            time_step=0.01,
        )
        intensity_values = intensity.values[0]
        # Filter out -inf / silence frames
        import numpy as np
        valid_intensity = intensity_values[np.isfinite(intensity_values)]

        if len(valid_intensity) > 0:
            intensity_mean = float(valid_intensity.mean())
            intensity_std = float(valid_intensity.std())
            intensity_min = float(valid_intensity.min())
            intensity_max = float(valid_intensity.max())
            intensity_range = intensity_max - intensity_min
        else:
            intensity_mean = intensity_std = intensity_range = 0.0
            intensity_min = intensity_max = 0.0

        # ── Pause detection from intensity curve ──────────────────────────────
        # Frames at or below (mean_intensity − 8 dB) that persist for ≥ 200 ms
        # (≥ 20 consecutive 10 ms frames) are classified as pauses.
        # The ‑8 dB threshold is relative to the signal's own mean, so results
        # are mic-gain agnostic.
        pause_count_praat: int = 0
        mean_pause_duration_ms_praat: Optional[float] = None
        speech_to_silence_praat: Optional[float] = None
        longest_pause_ms_praat: Optional[float] = None

        try:
            PRAAT_FRAME_MS = 10.0           # matches time_step=0.01 in to_intensity()
            SILENCE_DB_BELOW_MEAN = 8.0     # frames < (mean − 8 dB) are silence
            MIN_PAUSE_FRAMES = 20           # 200 ms minimum to count as a pause

            silence_thresh = intensity_mean - SILENCE_DB_BELOW_MEAN if intensity_mean > 0 else -float("inf")

            # Silence mask: -inf frames (complete silence) OR below relative threshold
            silence_mask = ~np.isfinite(intensity_values) | (intensity_values < silence_thresh)

            # Detect contiguous silent regions
            pause_durations_ms_list: list = []
            in_pause = False
            pause_len = 0

            for frame_silent in silence_mask:
                if frame_silent:
                    in_pause = True
                    pause_len += 1
                else:
                    if in_pause and pause_len >= MIN_PAUSE_FRAMES:
                        pause_durations_ms_list.append(pause_len * PRAAT_FRAME_MS)
                    in_pause = False
                    pause_len = 0
            # Trailing silence
            if in_pause and pause_len >= MIN_PAUSE_FRAMES:
                pause_durations_ms_list.append(pause_len * PRAAT_FRAME_MS)

            pause_count_praat = len(pause_durations_ms_list)
            total_frames = len(intensity_values)
            silent_frames = int(silence_mask.sum())

            if pause_count_praat > 0:
                mean_pause_duration_ms_praat = round(float(np.mean(pause_durations_ms_list)), 1)
                longest_pause_ms_praat = round(float(np.max(pause_durations_ms_list)), 1)

            if total_frames > 0:
                speech_to_silence_praat = round(1.0 - (silent_frames / total_frames), 3)

            logger.info(
                f"🔇 [PROSODY] Pauses: count={pause_count_praat} "
                f"mean={mean_pause_duration_ms_praat}ms "
                f"longest={longest_pause_ms_praat}ms "
                f"speech_ratio={speech_to_silence_praat}"
            )

        except Exception as pause_exc:
            logger.warning(f"⚠️ [PROSODY] Pause detection failed: {pause_exc}")

        # ── Voice quality: Jitter, Shimmer, HNR ──
        # Use Praat's PointProcess for jitter/shimmer (most accurate method)
        point_process = pm.praat.call(
            sound, "To PointProcess (periodic, cc)", 75.0, 500.0
        )

        # Jitter (local) — pitch perturbation, higher = shakier voice
        try:
            jitter_local = pm.praat.call(
                point_process, "Get jitter (local)", 0.0, 0.0, 0.0001, 0.02, 1.3
            )
            jitter_local = float(jitter_local) * 100  # Convert to percentage
        except Exception:
            jitter_local = None

        # Shimmer (local) — amplitude perturbation, higher = more tremor
        try:
            shimmer_local = pm.praat.call(
                [sound, point_process], "Get shimmer (local)", 0.0, 0.0, 0.0001, 0.02, 1.3, 1.6
            )
            shimmer_local = float(shimmer_local) * 100  # Convert to percentage
        except Exception:
            shimmer_local = None

        # HNR — harmonics-to-noise ratio, higher = clearer voice
        try:
            harmonicity = pm.praat.call(
                sound, "To Harmonicity (cc)", 0.01, 75.0, 0.1, 1.0
            )
            hnr = pm.praat.call(harmonicity, "Get mean", 0.0, 0.0)
            hnr = float(hnr) if hnr == hnr else None  # NaN check
        except Exception:
            hnr = None

        elapsed_ms = (time.monotonic() - t0) * 1000

        result = {
            # Pitch (F0) — voice frequency
            "pitch_mean_hz": round(pitch_mean, 1),
            "pitch_std_hz": round(pitch_std, 1),
            "pitch_min_hz": round(pitch_min, 1),
            "pitch_max_hz": round(pitch_max, 1),
            "pitch_range_hz": round(pitch_range, 1),

            # Intensity — volume / energy
            "intensity_mean_db": round(intensity_mean, 1),
            "intensity_std_db": round(intensity_std, 1),
            "intensity_range_db": round(intensity_range, 1),

            # Voice quality
            "jitter_local_percent": round(jitter_local, 3) if jitter_local is not None else None,
            "shimmer_local_percent": round(shimmer_local, 3) if shimmer_local is not None else None,
            "hnr_db": round(hnr, 1) if hnr is not None else None,

            # Speech vs silence
            "voiced_fraction": round(voiced_fraction, 3),

            # Pause detection (Praat intensity-based)
            "pause_count_praat": pause_count_praat,
            "mean_pause_duration_ms_praat": mean_pause_duration_ms_praat,
            "longest_pause_ms_praat": longest_pause_ms_praat,
            "speech_to_silence_praat": speech_to_silence_praat,

            # Metadata
            "audio_duration_sec": round(duration, 1),
            "analysis_time_ms": round(elapsed_ms),
        }

        logger.info(
            f"✅ [PROSODY] Analysed {duration:.1f}s audio in {elapsed_ms:.0f}ms | "
            f"F0={pitch_mean:.0f}Hz±{pitch_std:.0f} | "
            f"jitter={jitter_local:.2f}% | HNR={hnr:.1f}dB | "
            f"voiced={voiced_fraction:.0%}"
        )

        return result

    except Exception as exc:
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.error(f"❌ [PROSODY] Analysis failed ({elapsed_ms:.0f}ms): {exc}")
        return None


def decode_audio_data(audio_data_b64: str) -> Optional[bytes]:
    """
    Decode base64-encoded WAV audio data from frontend.

    Args:
        audio_data_b64: Base64-encoded WAV file string

    Returns:
        Raw WAV bytes, or None if decoding fails.
    """
    try:
        wav_bytes = base64.b64decode(audio_data_b64)
        # Basic WAV validation: check RIFF header
        if len(wav_bytes) < 44:
            logger.warning("⚠️ [PROSODY] Audio data too small to be valid WAV")
            return None
        if wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
            logger.warning("⚠️ [PROSODY] Audio data is not valid WAV format")
            return None
        logger.info(f"✅ [PROSODY] Decoded WAV: {len(wav_bytes)} bytes")
        return wav_bytes
    except Exception as exc:
        logger.error(f"❌ [PROSODY] Base64 decode failed: {exc}")
        return None


def format_prosody_for_prompt(prosody: Dict[str, Any]) -> str:
    """
    Format prosodic features as a concise text block for LLM prompts.
    Raw numbers only — no emotional interpretation.
    """
    lines = []

    pitch_mean = prosody.get("pitch_mean_hz", 0)
    pitch_std = prosody.get("pitch_std_hz", 0)
    if pitch_mean > 0:
        lines.append(
            f"  Pitch: {pitch_mean}Hz mean ± {pitch_std}Hz std "
            f"(range {prosody.get('pitch_min_hz', 0)}-{prosody.get('pitch_max_hz', 0)}Hz)"
        )

    intensity_mean = prosody.get("intensity_mean_db", 0)
    intensity_std = prosody.get("intensity_std_db", 0)
    if intensity_mean > 0:
        lines.append(
            f"  Intensity: {intensity_mean}dB mean ± {intensity_std}dB std "
            f"(range {prosody.get('intensity_range_db', 0)}dB)"
        )

    jitter = prosody.get("jitter_local_percent")
    if jitter is not None:
        lines.append(f"  Jitter: {jitter}% (pitch perturbation — voice steadiness)")

    shimmer = prosody.get("shimmer_local_percent")
    if shimmer is not None:
        lines.append(f"  Shimmer: {shimmer}% (amplitude perturbation — voice tremor)")

    hnr = prosody.get("hnr_db")
    if hnr is not None:
        lines.append(f"  HNR: {hnr}dB (harmonics-to-noise — voice clarity)")

    voiced = prosody.get("voiced_fraction", 0)
    lines.append(f"  Voiced fraction: {voiced:.0%} of audio is speech")

    # Praat pause detection
    pause_count = prosody.get("pause_count_praat")
    if pause_count is not None:
        longest = prosody.get("longest_pause_ms_praat")
        mean_p = prosody.get("mean_pause_duration_ms_praat")
        sil_ratio = prosody.get("speech_to_silence_praat")
        lines.append(
            f"  Praat pauses: {pause_count} pause(s) ≥200ms | "
            f"longest={longest}ms | mean={mean_p}ms | "
            f"speech_ratio={sil_ratio:.0%}" if sil_ratio is not None else
            f"  Praat pauses: {pause_count} pause(s) ≥200ms | "
            f"longest={longest}ms | mean={mean_p}ms"
        )

    return "\n".join(lines) if lines else ""
