"""Layer 5 — 7-block prompt construction with strict token-budget enforcement.

Blocks (in spec order):
  1. System identity (static; ~600 tokens)
  2. Tone template (~150 tokens, derived from tone_params)
  3. Memory injection (~200 tokens max, from MemoryResult)
  4. Cultural frame (~180 tokens, one of five static files)
  5. Mode instruction (~200 tokens, static per mode + optional dependency
     modifier)
  6. Anti-sycophancy frame (~80 tokens, static)
  7. Working memory (variable: full conversation history with middle-turn
     Python compression)

Trim order on budget overrun: Block 7 → Block 3 → Block 4.
NEVER trim Block 1 or Block 6.

The prompt is exposed as both ``full_prompt`` (system+user concatenated for
non-chat callers) and ``system_text`` / ``user_text`` for chat-completion
APIs (Azure / Groq / GLM all expect the chat layout).
"""
from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional  # noqa: F401

from ..core.prompts import load_block
from ..core.logging import get_logger, log_context
from ..core.session import SessionObject
from ..models.signals import (
    ActivitySuggestion,
    IngestedInput,
    MemoryResult,
    OrchestratorOutput,
    PromptBundle,
    Signals,
    ToneParams,
)

logger = get_logger(__name__)


# ── token counter (tiktoken with regex fallback) ──────────────────────────
_ENCODER = None


def _encoder():
    global _ENCODER
    if _ENCODER is not None:
        return _ENCODER
    try:
        import tiktoken

        _ENCODER = tiktoken.get_encoding("cl100k_base")
        return _ENCODER
    except Exception:  # noqa: BLE001
        return None


def count_tokens(text: str) -> int:
    enc = _encoder()
    if enc is not None:
        return len(enc.encode(text or ""))
    # rough fallback: 1 token ≈ 4 chars
    return max(1, len((text or "").strip()) // 4)


# ── partial pre-build (Blocks 1,2,4,5,6 only — concurrent with retrieval)
def build_partial_prompt(
    *,
    orchestrator: OrchestratorOutput,
    tone: ToneParams,
    urgency_score: int = 0,
    trace_id: str | None = None,
) -> Dict[str, str]:
    block1 = load_block("system_identity")
    block2 = _render_tone_block(
        tone,
        urgency_floor=urgency_score >= 1,
        response_language=orchestrator.response_language,
    )
    block4 = _render_cultural_frame(orchestrator.cultural_frame_id, orchestrator.frame_uncertainty)
    block5 = _render_mode_block(orchestrator.selected_mode, orchestrator.dependency_flag)
    block6 = load_block("anti_sycophancy")
    return {
        "block1_system_identity": block1,
        "block2_tone": block2,
        "block4_cultural_frame": block4,
        "block5_mode": block5,
        "block6_anti_sycophancy": block6,
    }


def build_full_prompt(
    *,
    partial: Dict[str, str],
    memory: MemoryResult,
    session: SessionObject,
    ingested: IngestedInput,
    orchestrator: OrchestratorOutput,
    signals: Signals,
    suggested_activity: Optional[ActivitySuggestion] = None,
    max_total_tokens: int = 8000,
    trace_id: str | None = None,
) -> PromptBundle:
    block3 = _render_memory_block(memory)
    if not block3:
        logger.info(
            "memory block empty — skipped",
            extra=log_context(session_id=session.session_id, user_id=session.user_id, trace_id=trace_id, reason="no_retrieved_memory_or_semantic_fact"),
        )
    block5_5 = _render_activity_invitation(suggested_activity)
    block7_full_turns = list(session.turns)
    block7 = _render_working_memory(block7_full_turns, compress_middle=False)

    blocks = {
        "block1_system_identity": partial["block1_system_identity"],
        "block2_tone": partial["block2_tone"],
        "block3_memory": block3,
        "block4_cultural_frame": partial["block4_cultural_frame"],
        "block5_mode": partial["block5_mode"],
        "block5_5_activity_invitation": block5_5,
        "block6_anti_sycophancy": partial["block6_anti_sycophancy"],
        "block7_working_memory": block7,
    }

    blocks, block_tokens = _enforce_token_budget(blocks, block7_full_turns, max_total_tokens)

    # The current user message is appended as a final user turn outside the
    # system blocks for chat-completion APIs.
    user_message = ingested.normalised_message

    system_text = _assemble_system(blocks)
    system_token_count = count_tokens(system_text)

    block_tokens["block7_working_memory"] = count_tokens(blocks["block7_working_memory"])

    full_prompt = system_text + "\n\nUSER:\n" + user_message
    total_tokens = system_token_count + count_tokens(user_message)

    bundle = PromptBundle(
        full_prompt=full_prompt,
        system_text=system_text,
        user_text=user_message,
        prompt_token_count=int(total_tokens),
        prompt_version_hash=_hash_block1(blocks["block1_system_identity"]),
        blocks_used={k: int(count_tokens(v)) for k, v in blocks.items()},
    )
    logger.info(
        "blocks",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            sys=bundle.blocks_used.get("block1_system_identity", 0),
            tone=bundle.blocks_used.get("block2_tone", 0),
            memory=bundle.blocks_used.get("block3_memory", 0),
            frame=bundle.blocks_used.get("block4_cultural_frame", 0),
            mode=bundle.blocks_used.get("block5_mode", 0),
            anti_syco=bundle.blocks_used.get("block6_anti_sycophancy", 0),
            history=bundle.blocks_used.get("block7_working_memory", 0),
            total=bundle.prompt_token_count,
        ),
    )
    logger.info(
        "built",
        extra=log_context(
            session_id=session.session_id,
            user_id=session.user_id,
            trace_id=trace_id,
            total=f"{bundle.prompt_token_count}/{max_total_tokens}",
            blocks=7,
            trim="see_budget_logs",
            hash=bundle.prompt_version_hash[:8],
        ),
    )
    return bundle


_LANG_DIRECTIVES: Dict[str, str] = {
    "english":  " • Respond ONLY in English. Do not use any Hindi or code-mixing.",
    "hindi":    " • Respond ONLY in Hindi (Devanagari script). No English code-mix.",
    "japanese": " • Respond ONLY in Japanese (natural register).",
    "telugu":   " • Respond ONLY in Telugu (Telugu script).",
    "kannada":  " • Respond ONLY in Kannada (Kannada script).",
    "tamil":    " • Respond ONLY in Tamil (Tamil script).",
}
_LANG_OVERRIDE_NOTE = (
    " • This language directive overrides any earlier instruction "
    "to match the user's language or register."
)


# ── Block renderers ─────────────────────────────────────────────────────
def _render_tone_block(
    tone: ToneParams,
    *,
    urgency_floor: bool,
    response_language: Optional[str] = None,
) -> str:
    code_mix_pct = int(round(tone.code_mix * 100))
    length_label = "short" if tone.sentence_length < 0.4 else "medium" if tone.sentence_length < 0.7 else "long"
    warmth_label = "low" if tone.warmth < 0.5 else "medium" if tone.warmth < 0.75 else "high"
    # Non-Hinglish path: strong directive replaces the code-mix line and adds
    # an override note that beats the conflicting "match the user's language"
    # guidance in system_identity (block 1).
    if response_language and response_language in _LANG_DIRECTIVES:
        lines = [
            "STYLE GUIDE:",
            _LANG_DIRECTIVES[response_language],
            _LANG_OVERRIDE_NOTE,
            f" • Sentence length: {length_label}.",
            f" • Warmth: {warmth_label}.",
        ]
    else:
        # Hinglish / None / unknown → existing path (byte-identical to baseline).
        lines = [
            "STYLE GUIDE:",
            f" • Hindi-English code-mix: ~{code_mix_pct}% Hindi tokens.",
            f" • Sentence length: {length_label}.",
            f" • Warmth: {warmth_label}.",
        ]
    if urgency_floor:
        lines.append(" • Never offer solutions unless explicitly asked.")
    if tone.humour_tolerance >= 0.5:
        lines.append(" • Light humour is OK if the user initiates it.")
    if tone.directness <= 0.3:
        lines.append(" • Soften direct statements; reflect more than you assert.")
    if tone.emoji_use <= 0.15:
        lines.append(" • Avoid emojis unless the user uses them first.")
    return "\n".join(lines)


def _render_cultural_frame(frame_id: str, uncertainty: bool) -> str:
    block = load_block(f"cultural_frame_{frame_id}") or load_block("cultural_frame_metro_social")
    if uncertainty:
        return (
            block
            + "\n\nNOTE: The user's current language register has drifted noticeably "
            + "from their baseline. Apply the cultural cues above more loosely; if a "
            + "specific cultural assumption doesn't fit, drop it."
        )
    return block


def _render_mode_block(mode: str, dependency_flag: bool) -> str:
    block = load_block(f"mode_{mode}") or load_block("mode_companion")
    if dependency_flag and mode == "companion":
        block = block + (
            "\n\nQUIET NUDGE: If it fits naturally, show genuine interest in their "
            "relationships with others. Celebrate any mention of connecting with a "
            "friend or family member. Gently reference that having people around "
            "matters — not as advice, as curiosity. Do this at most once in this "
            "response."
        )
    return block


def _render_activity_invitation(suggested: Optional[ActivitySuggestion]) -> str:
    """Render block 5.5 only when a suggestion is present.

    The template intentionally exposes only the *one* selected activity's
    title to the LLM so it cannot hallucinate other tools. Anti-sycophancy
    (block 6) still follows so the LLM can't pivot into salesmanship.
    """
    if suggested is None:
        return ""
    template = load_block("mode_activity_invitation")
    if not template:
        return ""
    return template.format(title=suggested.title, voice_hint=suggested.voice_hint)


def _render_memory_block(memory: MemoryResult) -> str:
    if not memory.episodic_memories and not memory.semantic_facts_injection:
        return ""

    lines: List[str] = ["WHAT YOU REMEMBER:"]
    if memory.semantic_facts_injection:
        lines.append(memory.semantic_facts_injection)
    for ep in memory.episodic_memories:
        lines.append(f" • {ep.relative_date.capitalize()}: {ep.summary_text}")
    return "\n".join(lines)


def _render_working_memory(
    turns: List[Dict[str, Any]],
    *,
    compress_middle: bool,
    char_cap: int = 1200,
) -> str:
    if not turns:
        return ""

    if not compress_middle or len(turns) <= 10:
        body = "\n".join(_format_turn(t, i, char_cap=char_cap) for i, t in enumerate(turns))
        return "CONVERSATION SO FAR:\n" + body

    first2 = turns[:2]
    last8 = turns[-8:]
    middle = turns[2:-8]
    compressed = "\n".join(_compress_turn(t, idx + 2) for idx, t in enumerate(middle))
    body = (
        "\n".join(_format_turn(t, i, char_cap=char_cap) for i, t in enumerate(first2))
        + "\n[middle turns compressed]\n"
        + compressed
        + "\n"
        + "\n".join(_format_turn(t, len(turns) - len(last8) + i, char_cap=char_cap) for i, t in enumerate(last8))
    )
    return "CONVERSATION SO FAR:\n" + body


_PER_TURN_CHAR_CAP = 1200  # ~300 tokens — keeps Block 7 sane even with mega-paste


def _format_turn(turn: Dict[str, Any], idx: int, *, char_cap: int = _PER_TURN_CHAR_CAP) -> str:
    role = "User" if turn.get("role") == "user" else "Agent"
    content = (turn.get("content") or "").strip()
    if len(content) > char_cap:
        content = content[:char_cap].rstrip() + "…"
    return f"[Turn {idx}] {role}: {content}"


def _compress_turn(turn: Dict[str, Any], idx: int) -> str:
    role = "User" if turn.get("role") == "user" else "Agent"
    raw = (turn.get("content") or "").strip()
    words = raw.split()
    if not words:
        return f"[Turn {idx}] {role} said: …"
    # Hard cap at ~6 words or 60 chars (defends against pathological inputs)
    snippet = " ".join(words[:6])
    if len(snippet) > 60:
        snippet = snippet[:60].rstrip()
    return f"[Turn {idx}] {role} said: {snippet}…"


# ── Token budget enforcement ─────────────────────────────────────────────
TRIM_ORDER = ("block7_working_memory", "block3_memory", "block4_cultural_frame")


def _enforce_token_budget(
    blocks: Dict[str, str],
    full_turns: List[Dict[str, Any]],
    max_total_tokens: int,
) -> tuple[Dict[str, str], Dict[str, int]]:
    block_tokens = {k: count_tokens(v) for k, v in blocks.items()}
    total = sum(block_tokens.values())

    # Pass 1: compress Block 7 middle turns once if oversize
    if total > max_total_tokens:
        logger.info(
            "token budget enforcement triggered",
            extra=log_context(total=total, ceiling=max_total_tokens, trim="block7_middle_compression"),
        )
        blocks["block7_working_memory"] = _render_working_memory(full_turns, compress_middle=True)
        block_tokens["block7_working_memory"] = count_tokens(blocks["block7_working_memory"])
        total = sum(block_tokens.values())

    # Pass 2: trim Block 7 by dropping the oldest *post-warmup* turns one by one
    if total > max_total_tokens:
        logger.info(
            "token budget trimming block7",
            extra=log_context(total=total, ceiling=max_total_tokens, trim="drop_middle_then_shrink_turns"),
        )
        trimmed_turns = list(full_turns)
        # First: drop middles aggressively (preserve first 2 + last 8)
        while total > max_total_tokens and len(trimmed_turns) > 10:
            trimmed_turns.pop(2)
            blocks["block7_working_memory"] = _render_working_memory(trimmed_turns, compress_middle=True)
            block_tokens["block7_working_memory"] = count_tokens(blocks["block7_working_memory"])
            total = sum(block_tokens.values())
        # If still over, preserve first 2 + last 8 but shrink per-turn content.
        # The spec requires these anchor turns to remain present.
        char_cap = 600
        while total > max_total_tokens and char_cap >= 120:
            blocks["block7_working_memory"] = _render_working_memory(
                trimmed_turns,
                compress_middle=True,
                char_cap=char_cap,
            )
            block_tokens["block7_working_memory"] = count_tokens(blocks["block7_working_memory"])
            total = sum(block_tokens.values())
            char_cap -= 120

    # Pass 3: trim Block 3 to a single line if still over
    if total > max_total_tokens and blocks.get("block3_memory"):
        logger.info(
            "token budget trimming block3",
            extra=log_context(total=total, ceiling=max_total_tokens, trim="memory_to_one_summary"),
        )
        first_line = blocks["block3_memory"].split("\n", 2)[:2]
        blocks["block3_memory"] = "\n".join(first_line)
        block_tokens["block3_memory"] = count_tokens(blocks["block3_memory"])
        total = sum(block_tokens.values())

    # Pass 4: trim Block 4 to first ~100 tokens
    if total > max_total_tokens and blocks.get("block4_cultural_frame"):
        logger.info(
            "token budget trimming block4",
            extra=log_context(total=total, ceiling=max_total_tokens, trim="cultural_frame_100_tokens"),
        )
        text = blocks["block4_cultural_frame"]
        words = text.split()
        if len(words) > 60:
            blocks["block4_cultural_frame"] = " ".join(words[:60]) + "…"
            block_tokens["block4_cultural_frame"] = count_tokens(blocks["block4_cultural_frame"])

    return blocks, block_tokens


def _assemble_system(blocks: Dict[str, str]) -> str:
    parts: List[str] = []
    for key in (
        "block1_system_identity",
        "block2_tone",
        "block4_cultural_frame",
        "block5_mode",
        "block3_memory",
        "block5_5_activity_invitation",
        "block6_anti_sycophancy",
        "block7_working_memory",
    ):
        content = blocks.get(key) or ""
        if content.strip():
            parts.append(content.strip())
    return "\n\n".join(parts)


def _hash_block1(block1: str) -> str:
    return hashlib.md5(block1.encode("utf-8")).hexdigest()[:12]
