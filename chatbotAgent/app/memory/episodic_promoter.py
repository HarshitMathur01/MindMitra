"""
EpisodicPromoter — promotes repeated episodic patterns to semantic memory.
BUG FIX: logger.success() → logger.info() (Python stdlib has no .success() method).
"""
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class EpisodicPromoter:
    """
    Tracks episodic patterns and promotes to semantic memory after 2+ occurrences.
    """

    def __init__(self, supabase_client, embedding_service, gemini_model):
        self.supabase = supabase_client
        self.embedding_service = embedding_service
        self.gemini_model = gemini_model
        logger.info("✅ [EpisodicPromoter] Initialized")

    # ── public API ─────────────────────────────────────────────────────────
    def compute_pattern_hash(self, episodic: Dict[str, Any]) -> str:
        content = episodic.get("content", "")
        words = content.lower().split()
        keywords = sorted([w for w in words if len(w) > 4 and w.isalpha()][:5])
        return hashlib.md5("_".join(keywords).encode()).hexdigest()[:16]

    def track_and_promote(
        self,
        episodic: Dict[str, Any],
        session_id: str,
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Track pattern; promote to semantic if it recurs ≥ 2 times."""
        try:
            pattern_hash = self.compute_pattern_hash(episodic)

            result = (
                self.supabase.from_("episodic_tracker")
                .select("*")
                .eq("user_id", user_id)
                .eq("pattern_hash", pattern_hash)
                .maybe_single()
                .execute()
            )
            existing = result.data if result.data else None

            if existing:
                occurrences: List[Dict] = existing.get("occurrences", [])
                occurrences.append(
                    {
                        "content": episodic.get("content"),
                        "session_id": session_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                new_count = existing["occurrence_count"] + 1

                self.supabase.from_("episodic_tracker").update(
                    {"occurrences": occurrences, "occurrence_count": new_count}
                ).eq("id", existing["id"]).execute()

                logger.info(
                    f"🔄 [EpisodicPromoter] Pattern '{pattern_hash}' occurred {new_count} times"
                )

                if new_count >= 2 and not existing.get("promoted_to_semantic_id"):
                    return self._promote_to_semantic(existing, episodic, user_id)
            else:
                self.supabase.from_("episodic_tracker").insert(
                    {
                        "user_id": user_id,
                        "pattern_hash": pattern_hash,
                        "occurrences": [
                            {
                                "content": episodic.get("content"),
                                "session_id": session_id,
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            }
                        ],
                        "occurrence_count": 1,
                    }
                ).execute()
                logger.debug(f"💾 [EpisodicPromoter] New pattern tracked: {pattern_hash}")

        except Exception as e:
            logger.error(f"❌ [EpisodicPromoter] Tracking failed: {e}")
        return None

    # ── internals ──────────────────────────────────────────────────────────
    def _promote_to_semantic(
        self,
        tracker_record: Dict[str, Any],
        new_occurrence: Dict[str, Any],
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Promote repeated episodic pattern to global semantic memory."""
        try:
            occurrences = tracker_record.get("occurrences", [])
            occ_text = "\n".join(
                f"Occurrence {i + 1}: {occ.get('content', '')}"
                for i, occ in enumerate(occurrences[-3:])
            )

            prompt = f"""User has repeated behavioral pattern:

{occ_text}

Generate semantic insight (1 concise sentence capturing the pattern) and outcome analysis.

Output ONLY valid JSON:
{{
  "insight": "General pattern insight",
  "outcome_trend": "Pattern outcome (success/mixed/failure)",
  "confidence": 0.7
}}

JSON:"""

            response = self.gemini_model.generate_content(prompt)
            content = response.text if response and hasattr(response, "text") else ""

            cleaned = content.strip().strip("`")
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            parsed = json.loads(cleaned)

            insight = parsed.get("insight", "Repeated pattern observed")
            confidence = float(parsed.get("confidence", 0.7))

            embedding = self.embedding_service.embed_text(insight)

            result = self.supabase.from_("global_memories").insert(
                {
                    "user_id": user_id,
                    "memory_type": "semantic",
                    "content": insight,
                    "embedding": embedding,
                    "confidence_score": confidence,
                    "worth_saving": True,
                    "source_session_ids": [occ.get("session_id") for occ in occurrences],
                    "occurrence_count": len(occurrences),
                }
            ).execute()

            semantic_id = result.data[0]["id"] if result.data else None

            self.supabase.from_("episodic_tracker").update(
                {"promoted_to_semantic_id": semantic_id}
            ).eq("id", tracker_record["id"]).execute()

            # FIX: was logger.success() — Python stdlib has no .success() method
            logger.info(f"✨ [EpisodicPromoter] Promoted to semantic: {insight}")

            return {"id": semantic_id, "content": insight, "confidence": confidence}

        except Exception as e:
            logger.error(f"❌ [EpisodicPromoter] Promotion failed: {e}")
            return None
