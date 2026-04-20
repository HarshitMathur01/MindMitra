"""
Retriever Orchestrator.

Calls memory services in parallel under a strict deadline. Anything that
misses the deadline is dropped (graceful degradation > brittle fail).

All services are dependency-injected — pass `None` to skip a channel.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class RetrievedContext:
    identity_card: Optional[Any] = None       # IdentityCard or None
    episodes: List[Any] = field(default_factory=list)
    affect_pattern: Optional[Any] = None
    related_entities: List[Any] = field(default_factory=list)
    procedural_recommendation: Optional[Any] = None
    preferences: Optional[Any] = None
    timings_ms: Dict[str, float] = field(default_factory=dict)
    errors: Dict[str, str] = field(default_factory=dict)


class RetrieverOrchestrator:
    """Composes the parallel-fanout reads. Honour the per-channel deadline."""

    def __init__(
        self,
        *,
        identity_service=None,
        episodic_service=None,
        affective_service=None,
        relational_service=None,
        procedural_service=None,
        preferences_service=None,
        deadline_ms: int = 250,
    ):
        self.identity = identity_service
        self.episodic = episodic_service
        self.affective = affective_service
        self.relational = relational_service
        self.procedural = procedural_service
        self.preferences = preferences_service
        self.deadline_s = deadline_ms / 1000.0

    async def fetch(
        self,
        *,
        user_id: str,
        query: str,
        intent: str,
        needs_memory: bool,
        needs_self_disclosure: bool,
        top_k_episodes: int = 6,
        salience_weights=None,
        current_vad: Optional[Dict[str, float]] = None,
    ) -> RetrievedContext:
        ctx = RetrievedContext()
        if not user_id:
            return ctx

        async def _identity():
            if not self.identity:
                return None
            return await asyncio.to_thread(self.identity.load, user_id)

        async def _episodes():
            if not self.episodic or not needs_memory:
                return []
            return await self.episodic.retrieve(
                user_id=user_id, query=query, top_k=top_k_episodes,
                weights=salience_weights, current_vad=current_vad,
            )

        async def _affect():
            if not self.affective:
                return None
            return await asyncio.to_thread(self.affective.recent_pattern, user_id)

        async def _entities():
            if not self.relational or not needs_memory:
                return []
            return await asyncio.to_thread(self.relational.by_user, user_id)

        async def _procedure():
            if not self.procedural or intent != "seek_advice":
                return None
            return await asyncio.to_thread(self.procedural.best_for, user_id, "stress")

        async def _preferences():
            if not self.preferences:
                return None
            return await asyncio.to_thread(self.preferences.load, user_id)

        tasks = {
            "identity": asyncio.create_task(_identity()),
            "episodes": asyncio.create_task(_episodes()),
            "affect":   asyncio.create_task(_affect()),
            "entities": asyncio.create_task(_entities()),
            "procedure": asyncio.create_task(_procedure()),
            "preferences": asyncio.create_task(_preferences()),
        }

        # Race against the deadline: gather what completes, cancel the rest.
        done, pending = await asyncio.wait(tasks.values(), timeout=self.deadline_s)
        for t in pending:
            t.cancel()

        for name, task in tasks.items():
            if task in done and not task.cancelled() and task.exception() is None:
                val = task.result()
                if name == "identity":
                    ctx.identity_card = val
                elif name == "episodes":
                    ctx.episodes = list(val or [])
                elif name == "affect":
                    ctx.affect_pattern = val
                elif name == "entities":
                    ctx.related_entities = list(val or [])
                elif name == "procedure":
                    ctx.procedural_recommendation = val
                elif name == "preferences":
                    ctx.preferences = val
            elif task in pending:
                ctx.errors[name] = "deadline"
            elif task.exception() is not None:
                ctx.errors[name] = str(task.exception())

        return ctx
