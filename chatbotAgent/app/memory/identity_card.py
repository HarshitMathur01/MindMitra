"""
Identity Card service — slowly-evolving structured user profile.

Always loaded into context (it's small). Updated by:
    - the onboarding flow (writes directly, no importance gate);
    - the post-turn extractor (writes via importance gate + provenance trail);
    - manual user edits via API.

Field definitions follow §4.2 of the architecture proposal.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .repositories import IdentityCardRepo, SupabaseLike

logger = logging.getLogger(__name__)


# Whitelisted fields and their JSON shapes — protects against accidental schema drift.
_TEXT_FIELDS = ("preferred_name", "pronouns", "age_band", "life_stage", "code_mix_register")
_LIST_FIELDS = ("languages",)
_JSON_FIELDS = ("cultural_context", "stated_identities", "values_facets",
                "clinical_flags", "boundaries", "field_provenance")


@dataclass
class IdentityCard:
    user_id: str
    preferred_name: Optional[str] = None
    pronouns: Optional[str] = None
    age_band: Optional[str] = None
    life_stage: Optional[str] = None
    languages: List[str] = field(default_factory=list)
    code_mix_register: Optional[str] = None
    cultural_context: Dict[str, Any] = field(default_factory=dict)
    stated_identities: List[Dict[str, Any]] = field(default_factory=list)
    values_facets: List[Dict[str, Any]] = field(default_factory=list)
    clinical_flags: List[Dict[str, Any]] = field(default_factory=list)
    boundaries: List[Dict[str, Any]] = field(default_factory=list)
    field_provenance: Dict[str, Any] = field(default_factory=dict)
    version: int = 1

    def is_empty(self) -> bool:
        return not (self.preferred_name or self.pronouns or self.stated_identities or self.values_facets)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "preferred_name": self.preferred_name,
            "pronouns": self.pronouns,
            "age_band": self.age_band,
            "life_stage": self.life_stage,
            "languages": list(self.languages),
            "code_mix_register": self.code_mix_register,
            "cultural_context": dict(self.cultural_context),
            "stated_identities": list(self.stated_identities),
            "values_facets": list(self.values_facets),
            "clinical_flags": list(self.clinical_flags),
            "boundaries": list(self.boundaries),
            "field_provenance": dict(self.field_provenance),
            "version": self.version,
        }

    def render_for_prompt(self) -> str:
        """Compact human-readable string injected into stance context."""
        if self.is_empty():
            return ""
        parts: List[str] = []
        if self.preferred_name:
            parts.append(f"User goes by: {self.preferred_name}")
        if self.pronouns:
            parts.append(f"Pronouns: {self.pronouns}")
        if self.age_band or self.life_stage:
            parts.append(f"Stage: {' / '.join(filter(None, [self.age_band, self.life_stage]))}")
        if self.languages:
            parts.append(f"Languages: {', '.join(self.languages)}")
        if self.stated_identities:
            ids = [i.get("text", "") for i in self.stated_identities if isinstance(i, dict)]
            if ids:
                parts.append("Self-described: " + "; ".join(filter(None, ids))[:200])
        if self.boundaries:
            bs = [b.get("text", "") for b in self.boundaries if isinstance(b, dict)]
            if bs:
                parts.append("Boundaries: " + "; ".join(filter(None, bs))[:160])
        return "\n".join(parts)


class IdentityCardService:
    def __init__(self, client: SupabaseLike):
        self.repo = IdentityCardRepo(client)

    def load(self, user_id: str) -> IdentityCard:
        row = self.repo.get(user_id)
        if not row:
            return IdentityCard(user_id=user_id)
        return _row_to_card(row)

    def is_empty(self, user_id: str) -> bool:
        return self.repo.is_empty(user_id)

    def upsert_partial(
        self,
        user_id: str,
        patch: Dict[str, Any],
        *,
        provenance: str = "extractor",
        provenance_session: Optional[str] = None,
    ) -> IdentityCard:
        """Merge `patch` into the existing card and write it back."""
        existing = self.load(user_id)
        merged = existing.to_dict()
        prov_log: Dict[str, Any] = dict(merged.get("field_provenance") or {})
        ts = datetime.now(timezone.utc).isoformat()

        for k, v in (patch or {}).items():
            if k not in (*_TEXT_FIELDS, *_LIST_FIELDS, *_JSON_FIELDS):
                logger.warning("identity_card: ignoring unknown field %s", k)
                continue
            # List fields: union; JSON list fields: append; scalars: overwrite if non-empty.
            if k in _LIST_FIELDS:
                cur = list(merged.get(k) or [])
                for item in v or []:
                    if item not in cur:
                        cur.append(item)
                merged[k] = cur
            elif k in _JSON_FIELDS and isinstance(v, list):
                cur = list(merged.get(k) or [])
                cur.extend(x for x in v if x not in cur)
                merged[k] = cur
            elif k in _JSON_FIELDS and isinstance(v, dict):
                cur = dict(merged.get(k) or {})
                cur.update(v)
                merged[k] = cur
            else:
                if v in (None, ""):
                    continue
                merged[k] = v

            prov_log[k] = {"by": provenance, "session": provenance_session, "at": ts}

        merged["field_provenance"] = prov_log
        merged["version"] = int(merged.get("version") or 1) + 1
        self.repo.upsert(merged)
        return _row_to_card(merged)


def _row_to_card(row: Dict[str, Any]) -> IdentityCard:
    return IdentityCard(
        user_id=row["user_id"],
        preferred_name=row.get("preferred_name"),
        pronouns=row.get("pronouns"),
        age_band=row.get("age_band"),
        life_stage=row.get("life_stage"),
        languages=list(row.get("languages") or []),
        code_mix_register=row.get("code_mix_register"),
        cultural_context=dict(row.get("cultural_context") or {}),
        stated_identities=list(row.get("stated_identities") or []),
        values_facets=list(row.get("values_facets") or []),
        clinical_flags=list(row.get("clinical_flags") or []),
        boundaries=list(row.get("boundaries") or []),
        field_provenance=dict(row.get("field_provenance") or {}),
        version=int(row.get("version") or 1),
    )
