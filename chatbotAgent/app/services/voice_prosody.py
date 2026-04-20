"""
Voice Prosody Analysis Service — MindMitra
==========================================

OFFLINE / FUTURE-WORK ONLY — **NOT used by the chat path**.

This module exposes a synchronous Praat (parselmouth) analyser plus a few
helpers (decode_audio_data, format_prosody_for_prompt) that were once
threaded into the chat request hot path. They are no longer wired in
because:

  1. parselmouth's native shared library has hung indefinitely on macOS
     under Gatekeeper signature checks while holding the GIL, freezing
     the FastAPI lifespan and timing out browser requests.
  2. The MITRA pipeline never actually consumed the resulting prosodic
     features — `voice_analysis["prosody"]` was computed and then dropped
     before reaching `mitra_dispatch.run_mitra_turn`.

Keep the analyser here so future work (e.g. an offline subprocess job
that scores recorded audio) can still call it. Re-enabling on the chat
path requires the 3-step recipe documented in
`docs/MITRA.md` → "Future Work":

  (a) add a `prosody` field to `TurnInput`
  (b) add an assembler block that calls `format_prosody_for_prompt`
  (c) extract via `subprocess.run(["python", "-m", "app.tools.prosody_cli",
      ...], timeout=4)` so a Praat hang can never block FastAPI again.

Until that lands, do NOT call `analyze_prosody` from any async handler.
"""

from __future__ import annotations

import base64
import logging
import os
import tempfile
import time
from contextlib import contextmanager
from typing import Any, Dict, Optional

logger = logging.getLogger("mindmitra.voice_prosody")


# ──────────────────────────────────────────────────────────────────────────
# Helpers — safe to import from anywhere (no native code touched)
# ──────────────────────────────────────────────────────────────────────────
def decode_audio_data(audio_data_b64: str) -> Optional[bytes]:
    """Decode base64-encoded WAV audio data from frontend. Pure-Python; safe in async handlers."""
    try:
        wav_bytes = base64.b64decode(audio_data_b64)
        if len(wav_bytes) < 44:
            logger.warning("⚠️  [PROSODY] audio data too small to be valid WAV")
            return None
        if wav_bytes[:4] != b"RIFF" or wav_bytes[8:12] != b"WAVE":
            logger.warning("⚠️  [PROSODY] audio data is not valid WAV format")
            return None
        logger.debug(f"[PROSODY] decoded WAV: {len(wav_bytes)} bytes")
        return wav_bytes
    except Exception as exc:  # noqa: BLE001
        logger.error(f"❌ [PROSODY] base64 decode failed: {exc}")
        return None


def format_prosody_for_prompt(prosody: Dict[str, Any]) -> str:
    """Format prosodic features as a concise text block for LLM prompts."""
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


# ──────────────────────────────────────────────────────────────────────────
# Sync Praat analyser — OFFLINE ONLY
# ──────────────────────────────────────────────────────────────────────────
@contextmanager
def _temp_wav(wav_bytes: bytes):
    """Write WAV bytes to a NamedTemporaryFile and yield the path."""
    fp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        fp.write(wav_bytes)
        fp.close()
        yield fp.name
    finally:
        try:
            os.unlink(fp.name)
        except OSError:
            pass


def analyze_prosody(wav_bytes: bytes) -> Optional[Dict[str, Any]]:
    """
    Analyse a WAV audio buffer and return raw prosodic features.

    OFFLINE ONLY. This call:
      * imports parselmouth lazily (may hang under macOS Gatekeeper),
      * blocks the calling thread while Praat runs,
      * is NOT wrapped in a timeout.

    Do not call this from any FastAPI handler or async coroutine. For
    future on-line use, run it via `subprocess.run([...], timeout=4)`
    so a hang can be killed without taking down the server.

    Returns ``None`` if parselmouth is unavailable or the analysis fails.
    """
    try:
        import parselmouth as pm  # type: ignore
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"⚠️  [PROSODY] parselmouth unavailable: {exc}")
        return None

    t0 = time.monotonic()

    try:
        with _temp_wav(wav_bytes) as wav_path:
            sound = pm.Sound(wav_path)
            duration = sound.duration

            if duration < 0.5:
                logger.info(f"⚠️  [PROSODY] audio too short ({duration:.1f}s), skipping")
                return None

            # ── Pitch (F0) extraction ──
            pitch = sound.to_pitch_ac(
                time_step=0.01,
                pitch_floor=75.0,
                pitch_ceiling=500.0,
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
            intensity = sound.to_intensity(minimum_pitch=75.0, time_step=0.01)
            intensity_values = intensity.values[0]
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

            # ── Pause detection from intensity curve ──
            pause_count_praat: int = 0
            mean_pause_duration_ms_praat: Optional[float] = None
            speech_to_silence_praat: Optional[float] = None
            longest_pause_ms_praat: Optional[float] = None

            try:
                PRAAT_FRAME_MS = 10.0
                SILENCE_DB_BELOW_MEAN = 8.0
                MIN_PAUSE_FRAMES = 20

                silence_thresh = (
                    intensity_mean - SILENCE_DB_BELOW_MEAN
                    if intensity_mean > 0 else -float("inf")
                )
                silence_mask = ~np.isfinite(intensity_values) | (intensity_values < silence_thresh)

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
                    f"🔇 [PROSODY] pauses={pause_count_praat} "
                    f"mean={mean_pause_duration_ms_praat}ms "
                    f"longest={longest_pause_ms_praat}ms "
                    f"speech_ratio={speech_to_silence_praat}"
                )
            except Exception as pause_exc:  # noqa: BLE001
                logger.warning(f"⚠️  [PROSODY] pause detection failed: {pause_exc}")

            # ── Voice quality: jitter, shimmer, HNR ──
            point_process = pm.praat.call(
                sound, "To PointProcess (periodic, cc)", 75.0, 500.0
            )
            try:
                jitter_local = pm.praat.call(
                    point_process, "Get jitter (local)",
                    0.0, 0.0, 0.0001, 0.02, 1.3,
                )
                jitter_local = float(jitter_local) * 100
            except Exception:  # noqa: BLE001
                jitter_local = None
            try:
                shimmer_local = pm.praat.call(
                    [sound, point_process], "Get shimmer (local)",
                    0.0, 0.0, 0.0001, 0.02, 1.3, 1.6,
                )
                shimmer_local = float(shimmer_local) * 100
            except Exception:  # noqa: BLE001
                shimmer_local = None
            try:
                harmonicity = pm.praat.call(
                    sound, "To Harmonicity (cc)", 0.01, 75.0, 0.1, 1.0
                )
                hnr = pm.praat.call(harmonicity, "Get mean", 0.0, 0.0)
                hnr = float(hnr) if hnr == hnr else None  # NaN-check
            except Exception:  # noqa: BLE001
                hnr = None

            elapsed_ms = (time.monotonic() - t0) * 1000

            result = {
                "pitch_mean_hz": round(pitch_mean, 1),
                "pitch_std_hz": round(pitch_std, 1),
                "pitch_min_hz": round(pitch_min, 1),
                "pitch_max_hz": round(pitch_max, 1),
                "pitch_range_hz": round(pitch_range, 1),
                "intensity_mean_db": round(intensity_mean, 1),
                "intensity_std_db": round(intensity_std, 1),
                "intensity_range_db": round(intensity_range, 1),
                "jitter_local_percent": round(jitter_local, 3) if jitter_local is not None else None,
                "shimmer_local_percent": round(shimmer_local, 3) if shimmer_local is not None else None,
                "hnr_db": round(hnr, 1) if hnr is not None else None,
                "voiced_fraction": round(voiced_fraction, 3),
                "pause_count_praat": pause_count_praat,
                "mean_pause_duration_ms_praat": mean_pause_duration_ms_praat,
                "longest_pause_ms_praat": longest_pause_ms_praat,
                "speech_to_silence_praat": speech_to_silence_praat,
                "audio_duration_sec": round(duration, 1),
                "analysis_time_ms": round(elapsed_ms),
            }

            logger.info(
                f"✅ [PROSODY] analysed {duration:.1f}s in {elapsed_ms:.0f}ms | "
                f"F0={pitch_mean:.0f}Hz±{pitch_std:.0f} | "
                f"jitter={jitter_local if jitter_local is not None else 'n/a'} | "
                f"HNR={hnr if hnr is not None else 'n/a'} | "
                f"voiced={voiced_fraction:.0%}"
            )

            return result

    except Exception as exc:  # noqa: BLE001
        elapsed_ms = (time.monotonic() - t0) * 1000
        logger.error(f"❌ [PROSODY] analysis failed ({elapsed_ms:.0f}ms): {exc}")
        return None
