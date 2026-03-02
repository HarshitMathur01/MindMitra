"""
Lipsync Service — Rhubarb Lip-Sync CLI + text-phoneme fallback.
"""
import base64
import json
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Rhubarb binary lives two directories above this file:
# chatbotAgent/app/services/lipsync_service.py  →  chatbotAgent/bin/rhubarb
_RHUBARB_PATH = Path(__file__).parent.parent.parent / "bin" / "rhubarb"

# Phoneme map (matches Avatar.jsx viseme targets)
_PHONEME_MAP: Dict[str, str] = {
    "a": "D", "e": "E", "i": "C", "o": "E", "u": "F",
    "p": "A", "b": "A", "m": "A",
    "f": "G", "v": "G",
    "t": "B", "d": "B", "k": "B", "g": "B",
    "s": "X", "z": "X", "r": "X", "l": "X", "n": "X", "h": "X",
    "w": "F", "y": "C",
}


def generate_lipsync_from_audio(audio_base64: str, text_fallback: str) -> Dict[str, Any]:
    """
    Generate lip-sync data from audio using Rhubarb Lip-Sync CLI.
    Falls back to text-based generation on any error.
    Handles both WAV (Google Cloud TTS) and MP3 (ElevenLabs/gTTS) formats.
    """
    temp_file = None
    try:
        start_time = time.time()
        logger.info("🎤 [RHUBARB] Starting audio-based lip-sync analysis…")

        audio_bytes = base64.b64decode(audio_base64)

        # Detect format: WAV starts with "RIFF", otherwise assume MP3
        is_wav = audio_bytes[:4] == b"RIFF"
        file_extension = ".wav" if is_wav else ".mp3"
        logger.info(f"🎵 [RHUBARB] Detected audio format: {file_extension.upper()}")

        temp_file = tempfile.NamedTemporaryFile(suffix=file_extension, delete=False)
        temp_file.write(audio_bytes)
        temp_file.close()

        rhubarb_path = str(_RHUBARB_PATH)
        if not os.path.exists(rhubarb_path):
            raise FileNotFoundError(f"Rhubarb binary not found at {rhubarb_path}")

        logger.info(f"🎙️ [RHUBARB] Executing: {rhubarb_path} -f json {temp_file.name}")
        result = subprocess.run(
            [rhubarb_path, "-f", "json", temp_file.name],
            capture_output=True,
            text=True,
            timeout=10,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Rhubarb exit {result.returncode}: {result.stderr}")

        rhubarb_output = json.loads(result.stdout)

        # Rhubarb outputs A-H, X — no remapping needed; pass through as-is
        mouth_cues = []
        for cue in rhubarb_output.get("mouthCues", []):
            mouth_cues.append({"start": cue["start"], "end": cue["end"], "value": cue["value"]})

        if mouth_cues:
            unique_shapes = sorted({c["value"] for c in mouth_cues})
            logger.info(f"📊 [RHUBARB] Unique shapes: {unique_shapes}")

        elapsed = time.time() - start_time
        logger.info(f"✅ [RHUBARB] Generated {len(mouth_cues)} cues in {elapsed:.2f}s")
        return {"mouthCues": mouth_cues}

    except subprocess.TimeoutExpired:
        logger.error("❌ [RHUBARB] Timeout after 10 s — falling back to text-based")
        return generate_lipsync_from_text(text_fallback)
    except FileNotFoundError as exc:
        logger.error(f"❌ [RHUBARB] Binary not found: {exc} — falling back to text-based")
        return generate_lipsync_from_text(text_fallback)
    except Exception as exc:
        logger.error(f"❌ [RHUBARB] {type(exc).__name__}: {exc} — falling back to text-based")
        return generate_lipsync_from_text(text_fallback)
    finally:
        if temp_file and os.path.exists(temp_file.name):
            try:
                os.unlink(temp_file.name)
            except Exception as exc:
                logger.warning(f"⚠️ [RHUBARB] Could not delete temp file: {exc}")


def generate_lipsync_from_text(text: str, audio_duration: Optional[float] = None) -> Dict[str, Any]:
    """
    Generate lip-sync data from text using phoneme mapping (fallback method).
    """
    try:
        logger.info(f"👄 [LIPSYNC-TEXT] Generating text-based lip-sync ({len(text)} chars)…")

        mouth_cues = []
        current_time = 0.0
        phoneme_dur = 0.15   # 150 ms / phoneme
        word_pause = 0.10    # 100 ms between words

        words = text.split(" ")
        for word_idx, word in enumerate(words):
            word_lower = word.lower()
            char_idx = 0

            while char_idx < len(word_lower):
                ch = word_lower[char_idx]

                # Digraph: "th"
                if char_idx < len(word_lower) - 1 and ch + word_lower[char_idx + 1] == "th":
                    mouth_cues.append({"start": current_time, "end": current_time + phoneme_dur, "value": "H"})
                    current_time += phoneme_dur
                    char_idx += 2
                    continue

                if ch in _PHONEME_MAP:
                    mouth_cues.append({"start": current_time, "end": current_time + phoneme_dur, "value": _PHONEME_MAP[ch]})
                    current_time += phoneme_dur
                elif ch.isalpha():
                    mouth_cues.append({"start": current_time, "end": current_time + phoneme_dur * 0.5, "value": "X"})
                    current_time += phoneme_dur * 0.5

                char_idx += 1

            if word_idx < len(words) - 1:
                mouth_cues.append({"start": current_time, "end": current_time + word_pause, "value": "X"})
                current_time += word_pause

        logger.info(f"✅ [LIPSYNC] Generated {len(mouth_cues)} cues, duration: {current_time:.2f}s")

        # Calibrate to actual audio duration if provided
        if audio_duration and audio_duration > 0 and current_time > 0:
            scale = audio_duration / current_time
            logger.info(f"🎯 [LIPSYNC] Calibrating with scale factor: {scale:.3f}")
            for cue in mouth_cues:
                cue["start"] *= scale
                cue["end"] *= scale

        return {"mouthCues": mouth_cues}

    except Exception as exc:
        logger.error(f"❌ [LIPSYNC] Text-based generation failed: {exc}")
        return {"mouthCues": []}
