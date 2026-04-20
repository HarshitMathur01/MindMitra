"""
Affective memory — three-channel time-series.

Channels:
    - 'lexical'      : per-turn detected affect (always recorded when present)
    - 'acoustic'     : per-voice-turn Praat features (optional)
    - 'self_report'  : PHQ-9 / GAD-7 / PHQ-2 / GAD-2 scores (occasional)

Patterns are surfaced to the assembler only when ≥2 channels agree (raises
confidence, lowers spurious surfacing). This is the single most clinically-
defensible piece of the system.
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from .repositories import AffectRepo, SupabaseLike

logger = logging.getLogger(__name__)


@dataclass
class AffectPattern:
    label: str                              # e.g. "low_mood_trend", "sunday_dip", "anxiety_spike"
    confidence: float
    supporting_channels: List[str]
    detail: str
    sample_size: int


class AffectiveService:
    def __init__(self, client: SupabaseLike):
        self.repo = AffectRepo(client)

    # ── Internal: composite-key lookup ──────────────────────────────────────

    def _fetch_bucket(
        self, user_id: str, bucket: date, bucket_kind: str, channel: str,
    ) -> Optional[Dict[str, Any]]:
        rows = self.repo.recent_buckets(user_id, channel=channel, days=2)
        target = bucket.isoformat()
        for r in rows:
            if (r.get("bucket_date") == target
                    and r.get("bucket_kind") == bucket_kind
                    and r.get("channel") == channel):
                return r
        return None

    # ── Writers (one per channel) ───────────────────────────────────────────

    def record_lexical(
        self, *, user_id: str, vad: Dict[str, float], label: Optional[str] = None,
        bucket: Optional[date] = None,
    ) -> None:
        bucket = bucket or date.today()
        existing = self._fetch_bucket(user_id, bucket, "daily", "lexical")
        if existing:
            new_count = (existing.get("message_count") or 0) + 1
            cur_mean = existing.get("vad_mean") or {}
            mean = _running_mean(cur_mean, vad, existing.get("message_count") or 0)
            cur_min = existing.get("vad_min") or vad
            mn = {k: min(float(cur_min.get(k, 0.0)), float(vad.get(k, 0.0))) for k in ("v", "a", "d")}
            row = {**existing, "vad_mean": mean, "vad_min": mn, "message_count": new_count,
                   "affect_label_top": label or existing.get("affect_label_top")}
        else:
            row = {
                "user_id": user_id,
                "bucket_date": bucket.isoformat(),
                "bucket_kind": "daily",
                "channel": "lexical",
                "vad_mean": dict(vad),
                "vad_min": dict(vad),
                "affect_label_top": label,
                "message_count": 1,
            }
        self.repo.upsert_bucket(row)

    def record_acoustic(
        self, *, user_id: str, prosody_features: Dict[str, float],
        bucket: Optional[date] = None,
    ) -> None:
        bucket = bucket or date.today()
        row = {
            "user_id": user_id,
            "bucket_date": bucket.isoformat(),
            "bucket_kind": "daily",
            "channel": "acoustic",
            "acoustic_features": dict(prosody_features),
            "message_count": 1,
        }
        self.repo.upsert_bucket(row)

    def record_self_report(
        self, *, user_id: str, scores: Dict[str, int],
        bucket: Optional[date] = None,
    ) -> None:
        """`scores` may include any subset of phq9/gad7/phq2/gad2."""
        bucket = bucket or date.today()
        row = {
            "user_id": user_id,
            "bucket_date": bucket.isoformat(),
            "bucket_kind": "daily",
            "channel": "self_report",
            "self_report_scores": dict(scores),
            "message_count": 1,
        }
        self.repo.upsert_bucket(row)

    # ── Readers ─────────────────────────────────────────────────────────────

    def recent_pattern(self, user_id: str, *, days: int = 14) -> Optional[AffectPattern]:
        """Detect a pattern only when ≥2 channels agree."""
        lex = self.repo.recent_buckets(user_id, channel="lexical", days=days)
        ac = self.repo.recent_buckets(user_id, channel="acoustic", days=days)
        sr = self.repo.recent_buckets(user_id, channel="self_report", days=days)

        votes: Dict[str, List[str]] = {}

        if (sig := _lexical_low_mood(lex)):
            votes.setdefault(sig, []).append("lexical")
        if (sig := _acoustic_low_mood(ac)):
            votes.setdefault(sig, []).append("acoustic")
        if (sig := _self_report_low_mood(sr)):
            votes.setdefault(sig, []).append("self_report")

        for label, channels in votes.items():
            if len(channels) >= 2:
                # Sample size = sum of all bucket message counts across channels.
                n = sum((b.get("message_count") or 0) for b in (lex + ac + sr))
                conf = min(1.0, 0.5 + 0.2 * len(channels))
                return AffectPattern(
                    label=label, confidence=conf, supporting_channels=channels,
                    detail=_human_explanation(label, channels), sample_size=n,
                )
        return None

    def cross_channel_confidence(self, pattern: AffectPattern) -> float:
        """Returns 0..1 — how much the assembler should trust surfacing this."""
        return pattern.confidence


# ── Helpers ──────────────────────────────────────────────────────────────────

def _running_mean(prev: Dict[str, float], new: Dict[str, float], prev_n: int) -> Dict[str, float]:
    out = {}
    for k in ("v", "a", "d"):
        old = float(prev.get(k, 0.0))
        nv = float(new.get(k, 0.0))
        out[k] = ((old * prev_n) + nv) / max(1, prev_n + 1)
    return out


def _lexical_low_mood(buckets: List[Dict[str, Any]]) -> Optional[str]:
    if len(buckets) < 5:
        return None
    valences = [(b.get("vad_mean") or {}).get("v") for b in buckets]
    valences = [float(v) for v in valences if v is not None]
    if len(valences) < 5:
        return None
    avg = statistics.mean(valences)
    return "low_mood_trend" if avg < -0.15 else None


def _acoustic_low_mood(buckets: List[Dict[str, Any]]) -> Optional[str]:
    if len(buckets) < 5:
        return None
    f0_means = [(b.get("acoustic_features") or {}).get("f0_mean") for b in buckets]
    speaking_rates = [(b.get("acoustic_features") or {}).get("speaking_rate") for b in buckets]
    f0_means = [float(x) for x in f0_means if x is not None]
    speaking_rates = [float(x) for x in speaking_rates if x is not None]
    if not f0_means or not speaking_rates:
        return None
    # Heuristic: depressed prosody → reduced F0 variability + slower rate.
    if statistics.mean(speaking_rates) < 3.5 and (max(f0_means) - min(f0_means)) < 20:
        return "low_mood_trend"
    return None


def _self_report_low_mood(buckets: List[Dict[str, Any]]) -> Optional[str]:
    if not buckets:
        return None
    last = sorted(buckets, key=lambda b: b.get("bucket_date") or "")[-1]
    s = last.get("self_report_scores") or {}
    phq = int(s.get("phq9") or 0)
    if phq >= 10:        # PHQ-9 ≥10 = moderate depression (clinical convention)
        return "low_mood_trend"
    return None


def _human_explanation(label: str, channels: List[str]) -> str:
    if label == "low_mood_trend":
        return (
            f"Low-mood trend detected across {', '.join(channels)} channels "
            "over the recent window."
        )
    return label
