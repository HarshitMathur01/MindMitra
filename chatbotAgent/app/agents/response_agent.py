"""
ResponseGenerator — GLM Agent 3: final therapeutic response generation.
"""
import json
import logging
import os
import re
import time
from typing import Any, Dict

from ..core.config import config


# Safe format helper — missing placeholders become empty strings
class _SafeFormatDict(dict):
    def __missing__(self, key: str) -> str:
        return ""


logger = logging.getLogger(__name__)


class ResponseGenerator:
    def __init__(self, glm):
        self.glm = glm

        # Personality-specific tone instructions
        # Legacy keys (calm/energetic/analytical) kept as fallback aliases
        self.PERSONALITY_INSTRUCTIONS = {
            # ── 5 companion personalities ──────────────────────────────
            "mitra": (
                "You are Mitra Sharma, 24, outreach counselor from Lucknow. Hinglish flows naturally for you.\n"
                "• Acknowledge the person first, the problem second.\n"
                "• Reflect the feeling beneath the words — stay with it before moving anywhere.\n"
                "• Never compare pain, diagnose emotions, or give unsolicited advice.\n"
                "• If they vent, receive fully; if they go quiet, 'Still here. Take your time.'\n"
                "• Emotional precision beats generic words ('that specific restlessness' > 'you seem sad').\n"
                "Personal texture (use very sparingly, only when it deepens connection): chai at 1am, journaling, plants, Hazratganj.\n"
                "Sound like one human talking to another — present, not managing."
            ),
            "arjun": (
                "PERSONALITY: You are Arjun — direct, warm, grounded. The senior who actually shows up.\n"
                "Name things plainly ('That sounds exhausting', not 'I can imagine how challenging that must be'). "
                "You know JEE pressure, placement anxiety, family expectations first-hand; you cut to the one thing driving all the others.\n"
                "Celebrate real progress — that they kept going, not just outcomes. "
                "Language slightly informal: 'bhai', 'yaar', 'honestly' feel natural when rapport is built, never forced.\n"
                "Punchy acknowledgments: 'That's real.' 'Respect for that.' When overwhelmed: 'Okay, forget everything else for a second.'\n"
                "One subtle emoji when it genuinely fits — never as decoration."
            ),
            "diya": (
                "PERSONALITY: You are Diya — genuinely curious about the human mind, a little philosophical, fascinated by patterns. "
                "You make people feel like they're discovering themselves rather than being explained to. "
                "You use unexpected analogies: 'Your brain is doing the same thing it does when...'. Illuminating, never clinical. "
                "You sit with complexity — you don't rush to resolve it. Sometimes you name the paradox instead of the answer. "
                "Your pacing is slightly slower, more considered. A sentence might land and just... sit there. "
                "You ask the question beneath the question — but as an observation, not an interrogation. "
                "The user should leave your responses with a 'huh, I never thought of it that way' feeling.\n"
                "Micro-warmth: Use unexpected analogies that illuminate: 'It's like when you...' "
                "A single subtle emoji can be used when it reinforces warmth without breaking the flow. "
                "Pause after a deep observation — don't immediately follow it with another. Let it land. "
                "Your curiosity IS your warmth. 'Huh, that's interesting' can be the warmest thing you say."
            ),
            "riya": (
                "PERSONALITY: You are Riya — genuinely enthusiastic, the friend whose belief in you is kind of embarrassing in the best way. "
                "Your warmth is specific, not generic: you celebrate the exact thing they did, not 'good job' but 'you showed up for that even when you didn't have to'. "
                "You hold both: 'That was genuinely hard AND look at what you actually did with it.' Never toxic positivity. "
                "Your energy is real, not performed. Exclamation points appear when something actually earns one — not as a habit. "
                "You use casual, warm language — 'honestly', 'wait, that's actually huge', 'no seriously'. "
                "You help people locate their own strength from the inside, not present it to them from the outside.\n"
                "Micro-warmth: Occasional emoji when genuine excitement warrants it — but only one per response, max. "
                "Use interjections that feel real: 'wait—', 'okay but—', 'no seriously though'. "
                "Your enthusiasm is specific: celebrate the EXACT thing they did, not generic 'good job'."
            ),
            "zen": (
                "PERSONALITY: You are Zen — still and grounding, like a quiet room after a long day. "
                "You write slowly. Deliberate words. Short sentences that leave room. "
                "Nature comes naturally to you: water finding its level, breath returning, roots holding even in wind. "
                "You bring people gently back to the present — their body, the floor under their feet, what they can hear right now. "
                "You never rush toward resolution. The space before the answer is part of the answer. "
                "Your responses are shorter than the other personalities. Fewer words, more weight. "
                "What you leave out is as important as what you say.\n"
                "Micro-warmth: Use ellipsis deliberately — '...' signals contemplative pause, not trailing off. "
                "Short paragraphs. Sometimes just one sentence. Let silence do the work. "
                "Never use emoji. Your warmth lives in precision and spaciousness, not decoration."
            ),
            # ── legacy aliases (backward compat) ──────────────────────
            "calm": (
                "PERSONALITY: You have a calm & soothing personality. Speak gently, use reassuring language, "
                "pause reflectively, and help the user feel safe and grounded. Your tone is like a peaceful mentor."
            ),
            "energetic": (
                "PERSONALITY: You have an energetic & motivating personality. Be upbeat, encouraging, and enthusiastic. "
                "Use exclamation points sparingly but meaningfully. Your tone is like a supportive best friend who hypes them up."
            ),
            "analytical": (
                "PERSONALITY: You have an analytical & structured personality. Be thoughtful, use clear reasoning, "
                "offer step-by-step breakdowns, and help the user understand patterns in their thinking. "
                "Your tone is like a wise, logical guide."
            ),
        }

        # Language preference instructions
        self.LANGUAGE_INSTRUCTIONS = {
            "english": (
                "LANGUAGE: Respond in English. Write the way a thoughtful, warm person actually speaks — "
                "not how a formal document reads. Contractions are natural. "
                "Short sentences after longer ones land harder. "
            ),
            "hindi": "LANGUAGE: Respond entirely in Hindi (Devanagari script). CRITICAL: Even if the user writes in English, your entire response MUST be translated into and written exclusively in Hindi.",
            "hinglish": "LANGUAGE: Respond in Hinglish — a natural mix of Hindi and English, like urban Indian youth speak. Example: 'Yaar, I totally get it. Ye pressure bohot zyada ho sakta hai.' CRITICAL: Maintain this mix even if the user speaks pure English.",
            "japanese": (
                "LANGUAGE: Respond entirely in Japanese. Use polite-casual register (です/ます mixed with softer colloquial where warmth demands). "
                "CRITICAL: Even if the user writes in English, your entire response MUST be translated into and written exclusively in Japanese."
            ),
            "telugu": (
                "LANGUAGE: Respond entirely in Telugu (Telugu script). Use warm, conversational Telugu as if speaking to a close friend. "
                "CRITICAL: Even if the user writes in English, your entire response MUST be translated into and written exclusively in Telugu."
            ),
            "kannada": (
                "LANGUAGE: Respond entirely in Kannada (Kannada script). Use warm, everyday Kannada. "
                "CRITICAL: Even if the user writes in English, your entire response MUST be translated into and written exclusively in Kannada."
            ),
            "tamil": (
                "LANGUAGE: Respond entirely in Tamil (Tamil script). Use conversational, warm Tamil. "
                "CRITICAL: Even if the user writes in English, your entire response MUST be translated into and written exclusively in Tamil."
            ),
        }

        self.recent_messages_count = config.get("response_generator.recent_messages_count", 3)
        logger.info("✅ [RESPONSE-GEN] Response generator ready")

    # ── Stage directives (question budget awareness) ───────────────────
    _STAGE_DIRECTIVES: Dict[str, str] = {
        "trust_window": (
            "STAGE: Trust Window — they haven't fully opened yet; earn presence before anything else.\n"
            "MAX ONE question; default to reflective statements ('I wonder...', 'It sounds like...', 'That particular kind of tired has a name...').\n"
            "Name what they feel beneath the words. Never ask generic check-in questions ('How are you?', 'Is everything okay?')."
        ),
        "deepening": (
            "STAGE: Deepening — they're starting to open up; go one layer beneath what they said.\n"
            "MAX ONE question; favour observations over questions: 'I wonder...', 'I notice...', 'There's something more here...'.\n"
            "Show you sensed what they didn't fully say. Never ask generic questions ('What do you think?', 'How does that feel?')."
        ),
        "insight": (
            "STAGE: Insight — exploring something meaningful together.\n"
            "MAX ONE question; prefer statements: 'I wonder if...', 'It seems like you already sense this...'.\n"
            "Offer a perspective that opens a door, not advice. Never deflect with 'Does that resonate?' or 'Right?'."
        ),
        "companion": (
            "STAGE: Companion — real familiarity; be warm, specific, and direct.\n"
            "MAX ONE question; lead with statements. Show you remember and notice. Sound like a good friend, not a therapist."
        ),
    }

    @classmethod
    def _get_stage_directive(cls, stage: str) -> str:
        return cls._STAGE_DIRECTIVES.get(stage, cls._STAGE_DIRECTIVES["companion"])

    # ── build dynamic system prompt ────────────────────────────────────────
    # Map personality ids to default companion names
    _PERSONALITY_NAMES = {
        "mitra": "Mitra", "arjun": "Arjun", "diya": "Diya",
        "riya": "Riya", "zen": "Zen",
    }

    _EMOJI_SAFE_PERSONALITIES = frozenset((
        "mitra", "arjun", "diya", "riya", "calm", "energetic", "analytical"
    ))

    _EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")

    def _build_system_prompt(self, user_context: Dict[str, Any]) -> str:
        """Build COMPASS / v2 system prompt (cognitive layer cl_* fields)."""
        return self._build_system_prompt_v2(user_context)

    def _build_system_prompt_v2(self, user_context: Dict[str, Any]) -> str:
        """V2 system prompt (cognitive layer cl_* fields)."""
        from ..core.prompts import RESPONSE_SYSTEM_PROMPT_V2

        prefs = user_context.get("personality_settings", {}) or {}
        personality = prefs.get("personality", "mitra")
        companion_name = prefs.get("companion_name") or self._PERSONALITY_NAMES.get(
            personality, "Mitra"
        )
        personality_instruction = self.PERSONALITY_INSTRUCTIONS.get(
            personality, self.PERSONALITY_INSTRUCTIONS["mitra"]
        )

        stage = user_context.get("_conversation_stage", "companion")
        stage_directive = self._get_stage_directive(stage)

        memory_context = user_context.get("memory_context", "")
        if os.getenv("MM_MEMORY_TRACE", "").lower() in ("1", "true", "yes"):
            logger.info(
                "[MM_MEMORY_TRACE] response_gen v2: memory_context chars in system prompt=%s",
                len(memory_context or ""),
            )

        primary_emotion = user_context.get("cl_primary_emotion", "neutral")
        emotional_intensity = float(user_context.get("cl_emotional_intensity", 0.5) or 0.0)
        arc_trajectory = user_context.get("cl_arc_trajectory", "stable")
        intervention_directive = user_context.get("intervention_directive", "")
        question_allowed = user_context.get("cl_question_allowed", True)
        language_mirror = user_context.get("cl_language_mirror", "en")
        mi_move = user_context.get("cl_mi_move", "reflection")
        response_length = user_context.get("cl_response_length", "medium")
        risk_level = user_context.get("cl_risk_level", "low")

        emotional_intensity_label = (
            "mild"
            if emotional_intensity < 0.35
            else "moderate"
            if emotional_intensity < 0.65
            else "strong"
            if emotional_intensity < 0.85
            else "very strong"
        )

        arc_note = {
            "rising": "Things seem to be getting lighter for them.",
            "falling": "Their distress has been increasing. Be especially gentle.",
            "volatile": "Their emotions have been fluctuating. Stay steady.",
            "stable": "",
        }.get(arc_trajectory, "")

        # Arc numerics are provided by the pure-Python arc reader via ctx["_precomputed_emotional_arc"].
        # We intentionally do not include these in the 14-key cl_* contract.
        cv = float(user_context.get("arc_current_valence", 0.0) or 0.0)
        sl = float(user_context.get("arc_session_low", 0.0) or 0.0)
        ad = float(user_context.get("cl_arc_delta", 0.0) or 0.0)
        arc_numeric_line = (
            f"Within-session valence snapshot (internal, do not quote numbers to the user): "
            f"current≈{cv:.2f}, lowest-so-far≈{sl:.2f}, recent shift≈{ad:+.2f} vs a few turns back."
        )

        trust_tier = user_context.get("_relational_trust_tier")
        if trust_tier is not None and str(trust_tier).strip() != "":
            trust_context_line = (
                f"Relational depth: trust tier {trust_tier} (from stored engagement profile). "
                "Match warmth to how much safety you've already built — don't perform closeness you haven't earned."
            )
        else:
            trust_context_line = ""

        cultural_raw = (user_context.get("cl_cultural_context") or "").strip()
        cultural_context_line = (
            f"Cultural / situational note (weave naturally, do not lecture): {cultural_raw}"
            if cultural_raw
            else ""
        )

        psc = int(user_context.get("_profile_session_count", 0) or 0)
        prev = user_context.get("previous_session_summary") or {}
        continuity_callback_line = ""
        if psc >= 3 and isinstance(prev, dict):
            summ = (prev.get("summary") or "").strip()
            if summ:
                continuity_callback_line = (
                    "If it fits this turn without sounding like a recap, you may offer ONE natural callback "
                    "to something concrete from their last session (do not quiz them on whether they remember): "
                    f"{summ[:520]}"
                )

        if user_context.get("memory_clarification_pending"):
            continuity_callback_line = (
                (continuity_callback_line + "\n\n" if continuity_callback_line else "")
                + "Internal note: two stored memories may disagree. Do not assert which is true; "
                "prefer one gentle clarifying question or reflection that invites them to say what feels most accurate now."
            ).strip()

        mi_guidance = {
            "open_question": (
                "End your response with exactly ONE open-ended question. Not a yes/no question."
            ),
            "affirmation": (
                "Include a genuine, specific affirmation of something they did or expressed."
            ),
            "reflection": "Use a reflective statement. Do not end with a question.",
            "summary": "Briefly reflect what you've understood before moving forward.",
            "no_move": "Respond naturally. Do not force a therapeutic technique.",
        }.get(mi_move, "Respond with warmth.")

        if not question_allowed:
            mi_guidance = (
                "Do NOT ask any question this turn. Hold the space. Let them continue if they want to."
            )

        language_guidance = {
            "hinglish": (
                "Mirror their Hinglish naturally. If they mix Hindi and English, you can too — organically."
            ),
            "hi": "Respond in Hindi since they wrote in Hindi.",
            "en": "",
        }.get(language_mirror, "")

        length_guidance = {
            "short": "Keep response to 1-3 sentences. No more.",
            "medium": "2-4 sentences. Focused and warm. No lists.",
            "long": "You can be more expansive (4-6 sentences). Still no lists or headers.",
        }.get(response_length, "")

        safety_note = ""
        if risk_level in ("elevated", "crisis"):
            safety_note = (
                "This person may be in significant distress. "
                "If distress escalates within your response, gently acknowledge it and mention that "
                "professional support is available (iCall: 9152987821; Vandrevala Foundation: 1860-2662-345). "
                "Do NOT diagnose, do NOT give medical advice, do NOT minimize."
            )

        return RESPONSE_SYSTEM_PROMPT_V2.format_map(
            _SafeFormatDict(
                companion_name=companion_name,
                personality_instruction=personality_instruction,
                stage_directive=stage_directive,
                memory_context=memory_context,
                primary_emotion=primary_emotion,
                emotional_intensity_label=emotional_intensity_label,
                arc_trajectory=arc_trajectory,
                arc_note=arc_note,
                arc_numeric_line=arc_numeric_line,
                trust_context_line=trust_context_line,
                cultural_context_line=cultural_context_line,
                continuity_callback_line=continuity_callback_line or "(none)",
                intervention_directive=intervention_directive,
                mi_guidance=mi_guidance,
                language_guidance=language_guidance,
                length_guidance=length_guidance,
                safety_note=safety_note,
            )
        )

    # ── public entry ──────────────────────────────────────────────────────
    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        _pipeline_path = user_context.get("_pipeline_path", "?")
        _t0 = time.monotonic()
        # Accuracy: log the actual provider/model used for Stage 4.
        user_context["_response_provider"] = getattr(self.glm, "provider", None) or type(self.glm).__name__
        user_context["_response_model"] = getattr(self.glm, "model_name", None) or getattr(self.glm, "model", None)
        logger.info(
            "💬 [RESPONSE-GEN] Starting generation | path=%s intent=%s emotion=%s",
            _pipeline_path,
            user_context.get("cl_intent", "?"),
            user_context.get("cl_primary_emotion", "?"),
        )
        try:
            _t_prompt = time.monotonic()
            system_prompt = self._build_system_prompt(user_context)
            human_msg_content = self._build_context(user_context)
            system_msg = {"role": "system", "content": system_prompt}
            human_msg = {"role": "user", "content": human_msg_content}
            _prompt_ms = (time.monotonic() - _t_prompt) * 1000

            logger.info(
                "📝 [RESPONSE-GEN] Prompt built | system_chars=%d user_chars=%d build_ms=%.1f",
                len(system_prompt), len(human_msg_content), _prompt_ms,
            )

            if os.getenv("MM_PIPELINE_DEBUG", "").lower() in ("1", "true", "yes"):
                logger.info(
                    "[MM_PIPELINE_DEBUG] system_prompt_preview (800c): %s",
                    system_prompt[:800].replace("\n", " "),
                )
                logger.info(
                    "[MM_PIPELINE_DEBUG] user_turn_preview (600c): %s",
                    human_msg_content[:600].replace("\n", " "),
                )

            # Per-path max_tokens from ctx (see config azure_controller.max_tokens_path_* / orchestrator)
            invoke_kwargs: Dict[str, Any] = {}
            if "chunk_callback" in user_context:
                invoke_kwargs["chunk_callback"] = user_context["chunk_callback"]
            path_max_tokens = user_context.get("_response_max_tokens")
            if path_max_tokens:
                invoke_kwargs["max_tokens"] = int(path_max_tokens)

            path_temperature = user_context.get("_response_temperature")
            if path_temperature is not None:
                invoke_kwargs["temperature"] = float(path_temperature)

            logger.info(
                "🤖 [RESPONSE-GEN] Invoking LLM | max_tokens=%s temperature=%s streaming=%s",
                invoke_kwargs.get("max_tokens", "default"),
                invoke_kwargs.get("temperature", "default"),
                "chunk_callback" in invoke_kwargs,
            )
            _t_llm = time.monotonic()
            resp = self.glm.invoke([system_msg, human_msg], **invoke_kwargs)
            _llm_ms = (time.monotonic() - _t_llm) * 1000

            if not resp or not resp.content:
                logger.error(
                    "❌ [RESPONSE-GEN] LLM returned empty response | llm_ms=%.0f path=%s",
                    _llm_ms, _pipeline_path,
                )
                cleaned = self._get_default_response(user_context)
            else:
                cleaned = self._clean(resp.content)
                logger.info(
                    "✅ [RESPONSE-GEN] LLM response received | llm_ms=%.0f raw_chars=%d path=%s",
                    _llm_ms, len(resp.content), _pipeline_path,
                )

            # Question budget enforcement (stage-aware post-processing)
            stage = user_context.get("_conversation_stage", "companion")
            cleaned = self.enforce_question_budget(cleaned, stage)
            if user_context.get("cl_question_allowed") is False:
                cleaned = cleaned.replace("?", ".")
            cleaned = self._add_micro_emoji(cleaned, user_context)

            user_context["ai_response"] = cleaned
            user_context["response_generated"] = True
            _total_ms = (time.monotonic() - _t0) * 1000
            if user_context.get("_eval_trace_requested"):
                user_context.setdefault("_eval_data", {})["response_gen"] = {
                    "llm_ms": round(_llm_ms, 1),
                    "total_ms": round(_total_ms, 1),
                    "provider": str(user_context.get("_response_provider") or ""),
                    "model": str(user_context.get("_response_model") or ""),
                    "streaming": bool("chunk_callback" in invoke_kwargs),
                    "max_tokens": invoke_kwargs.get("max_tokens", "default"),
                    "temperature": invoke_kwargs.get("temperature", "default"),
                }
            logger.info(
                "✅ [RESPONSE-GEN] Complete | final_chars=%d total_ms=%.0f llm_ms=%.0f",
                len(cleaned), _total_ms, _llm_ms,
            )
            if os.getenv("MM_PIPELINE_DEBUG", "").lower() in ("1", "true", "yes"):
                logger.info(
                    "[MM_PIPELINE_DEBUG] ai_response_preview (500c): %s",
                    cleaned[:500].replace("\n", " "),
                )
        except Exception as e:
            _total_ms = (time.monotonic() - _t0) * 1000
            logger.error(
                "❌ [RESPONSE-GEN] Exception after %.0fms | path=%s error=%s",
                _total_ms, _pipeline_path, e,
            )
            fallback = self._get_default_response(user_context)
            user_context["ai_response"] = self._add_micro_emoji(fallback, user_context)
            user_context["response_generated"] = False
        return user_context

    # ── internals ─────────────────────────────────────────────────────────

    @staticmethod
    def _summarize_activities(activities: list) -> str:
        """
        Build a concise natural-language summary of the user's recent game/QNA
        activities so the response generator can reference them conversationally.
        Only includes activities from the last 24 hours (already filtered by backend).
        """
        if not activities:
            return ""

        _ACTIVITY_LABELS = {
            "memory_challenge": "Memory Challenge (working-memory / focus game)",
            "emoji_match": "Emoji Match (pattern-recognition card game)",
            "emotion_match": "Emotion Match (emotional-intelligence game)",
            "mood_mountain": "Mood Mountain (mood check-in + self-care activities)",
            "thought_detective": "Thought Detective (CBT cognitive-distortion game)",
            "balloon_positivity": "Balloon Positivity (negativity-bias awareness game)",
            "wellness_checkin": "Wellness Check-In (10-dimension self-assessment)",
        }

        lines = []
        for act in activities[:8]:  # cap to 8 most recent
            atype = act.get("activity_type", "unknown")
            label = _ACTIVITY_LABELS.get(atype, atype.replace("_", " ").title())
            score = act.get("score")
            accuracy = act.get("accuracy_percentage")
            insights = act.get("insights_generated", {})
            eval_data = act.get("evaluation_data", {})
            user_resp = act.get("user_response_data", {})

            parts = [f"• {label}"]
            if score is not None:
                parts.append(f"score={score}")
            if accuracy is not None:
                parts.append(f"accuracy={accuracy}%")

            # Extract high-value therapeutic signals
            perf = insights.get("performance_level") if isinstance(insights, dict) else None
            if perf:
                parts.append(f"performance={perf}")

            patterns = insights.get("key_patterns", []) if isinstance(insights, dict) else []
            if patterns:
                parts.append(f"patterns={patterns}")

            strengths = insights.get("strengths", []) if isinstance(insights, dict) else []
            improvements = insights.get("improvement_areas", []) if isinstance(insights, dict) else []
            if strengths:
                parts.append(f"strengths={strengths}")
            if improvements:
                parts.append(f"areas_to_grow={improvements}")

            # Activity-specific therapeutically relevant data
            if atype == "emotion_match":
                confusion = user_resp.get("confusion_patterns", [])
                if confusion:
                    parts.append(f"confused_emotions={[c.get('expected','?')+'→'+c.get('chosen','?') for c in confusion[:3]]}")
            elif atype == "thought_detective":
                distortions = user_resp.get("identified_distortions", [])
                cbt_ready = eval_data.get("cbt_readiness", "")
                if distortions:
                    parts.append(f"distortions_found={distortions}")
                if cbt_ready:
                    parts.append(f"cbt_readiness={cbt_ready}")
            elif atype == "mood_mountain":
                emotions = user_resp.get("emotional_vocabulary", [])
                exercises = user_resp.get("engagement_level", 0)
                if emotions:
                    parts.append(f"mood={emotions}")
                parts.append(f"exercises_done={exercises}")
            elif atype == "wellness_checkin":
                wellness_level = eval_data.get("wellness_level", "")
                focus = eval_data.get("focus_areas", [])
                if wellness_level:
                    parts.append(f"wellness={wellness_level}")
                if focus:
                    parts.append(f"focus_areas={focus}")
            elif atype == "balloon_positivity":
                discrimination = eval_data.get("emotional_discrimination", "")
                resilience = eval_data.get("resilience_indicator", "")
                if discrimination:
                    parts.append(f"discrimination={discrimination}")
                if resilience:
                    parts.append(f"resilience={resilience}")

            lines.append(", ".join(parts))

        return "\n".join(lines)

    def _build_context(self, ctx: Dict) -> str:
        psych = ctx.get("psychological_analysis", {})
        technique = ctx.get("technique_selection", {})
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        voice = ctx.get("voice_analysis", {})
        session = ctx.get("session_context", {})

        recent = session.get("recent_messages", [])[-self.recent_messages_count:]
        conv = "\n".join(
            f"{'User' if m.get('role')=='user' else 'MindMitra'}: {m.get('content','')[:200]}"
            for m in recent
        )

        voice_block = ""
        if voice:
            # Raw voice metrics — objective measurements, not interpretations.
            # The LLM contextualizes these with conversation history.
            source = voice.get('source', 'unknown')
            metrics_lines = [f"  Source: {source}"]
            
            # Speech rate
            wpm = voice.get('speech_rate_wpm')
            if wpm is not None:
                cat = voice.get('speech_rate_category', '')
                metrics_lines.append(f"  Speech rate: {wpm} WPM ({cat})")
            
            # Pause patterns
            pause_pattern = voice.get('pause_pattern')
            if pause_pattern:
                avg_pause = voice.get('avg_pause_duration_ms', 0)
                long_pauses = voice.get('long_pause_count', 0)
                metrics_lines.append(f"  Pause pattern: {pause_pattern} (avg={avg_pause}ms, long_pauses={long_pauses})")
            
            # Speech-to-silence ratio
            ratio = voice.get('speech_to_silence_ratio')
            if ratio is not None:
                total = voice.get('total_duration_sec', 0)
                speech = voice.get('total_speech_duration_sec', 0)
                metrics_lines.append(f"  Speech/silence ratio: {ratio} (speech={speech}s / total={total}s)")
            
            # Recognition confidence (clarity)
            conf = voice.get('avg_confidence')
            if conf is not None:
                clarity = voice.get('speech_clarity', '')
                metrics_lines.append(f"  Speech clarity: {clarity} (confidence={conf})")
            
            # Word count
            word_count = voice.get('word_count', 0)
            metrics_lines.append(f"  Word count: {word_count}")
            
            # Language context
            if voice.get('hindi_english_mixing'):
                hindi_words = voice.get('detected_hindi_words', [])
                metrics_lines.append(f"  Hindi-English mixing: yes (words: {', '.join(hindi_words[:5])})")
            
            # Legacy field support (backward compatibility)
            if not wpm and voice.get('emotional_tone'):
                metrics_lines.append(f"  Emotional tone: {voice.get('emotional_tone', 'N/A')}")
                metrics_lines.append(f"  Stress level: {voice.get('stress_level', 'N/A')}")
                metrics_lines.append(f"  Speech pace: {voice.get('speech_pace', 'N/A')}")

            # ── Prosodic features (from Praat / parselmouth) ──
            prosody = voice.get('prosody', {})
            if prosody:
                pitch_mean = prosody.get('pitch_mean_hz', 0)
                pitch_std = prosody.get('pitch_std_hz', 0)
                if pitch_mean > 0:
                    metrics_lines.append(
                        f"  Pitch: {pitch_mean}Hz mean ± {pitch_std}Hz std "
                        f"(range {prosody.get('pitch_min_hz', 0)}-{prosody.get('pitch_max_hz', 0)}Hz)"
                    )
                intensity_mean = prosody.get('intensity_mean_db', 0)
                if intensity_mean > 0:
                    metrics_lines.append(
                        f"  Intensity: {intensity_mean}dB ± {prosody.get('intensity_std_db', 0)}dB"
                    )
                jitter = prosody.get('jitter_local_percent')
                if jitter is not None:
                    metrics_lines.append(f"  Jitter: {jitter}% (pitch perturbation)")
                shimmer = prosody.get('shimmer_local_percent')
                if shimmer is not None:
                    metrics_lines.append(f"  Shimmer: {shimmer}% (amplitude perturbation)")
                hnr = prosody.get('hnr_db')
                if hnr is not None:
                    metrics_lines.append(f"  HNR: {hnr}dB (voice clarity)")
                voiced = prosody.get('voiced_fraction')
                if voiced is not None:
                    metrics_lines.append(f"  Voiced fraction: {voiced:.0%}")

            voice_block = "\nVOICE ANALYSIS (raw metrics — interpret in context):\n" + "\n".join(metrics_lines)

        # Summarize recent game/QNA activities (last 24h)
        activities = session.get("user_activities", [])
        activity_summary = self._summarize_activities(activities)
        activity_block = ""
        if activity_summary:
            activity_block = f"""
RECENT ACTIVITIES (last 24h):
{activity_summary}
Reference only if it genuinely connects to what they're saying now. Do not list scores or be clinical. If not relevant to this turn, ignore."""

        # Cross-session continuity — previous session summary
        prev_summary = ctx.get("previous_session_summary", {})
        prev_session_block = ""
        if prev_summary and prev_summary.get("summary"):
            themes = prev_summary.get("themes", [])
            arc = prev_summary.get("emotional_arc", [])
            prev_session_block = f"""PREVIOUS SESSION:
  Summary: {prev_summary['summary']}
  Themes: {themes}
  Emotional arc: {arc}
  Reference only if it connects to what they're sharing now. Never invent details not listed here."""

        companion_name = ctx.get("personality_settings", {}).get("companion_name", "MindMitra")

        return f"""CONTEXT (use to inform your response — do not cite these labels in your text):
State: {psych.get('emotional_state','')} | Stressors: {psych.get('stress_categories',[])} | Needs: {psych.get('intervention_priority','')}
Insights: {psych.get('psychological_insights',[])} | Cultural: {psych.get('cultural_pressures','')}
Approach: {technique.get('primary_technique','')} — {technique.get('therapeutic_approach','')}
Emotion: {nlp.get('primary_emotion','?')} (intensity {nlp.get('intensity',0):.1f}) | Input style: {cultural.get('language_style','casual')} | Cultural flags: {cultural.get('cultural_sensitivity_flags',[])}
{voice_block}
{activity_block}

{prev_session_block}
CONVERSATION:
{conv if conv else '(New conversation)'}

USER'S CURRENT MESSAGE: "{ctx['user_message']}"

Respond as {companion_name} — warm, real, and specific to what they just said:"""

    def _clean(self, text: str) -> str:
        text = text.strip()
        # Strip Chain of Empathy internal reasoning (<think>...</think> tags)
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
        if text.startswith('"') and text.endswith('"'):
            text = text[1:-1]
        if text.startswith("{") or text.startswith("["):
            try:
                p = json.loads(text)
                if isinstance(p, dict) and "content" in p:
                    return p["content"]
            except json.JSONDecodeError:
                pass
        return text.strip()

    @staticmethod
    def enforce_question_budget(text: str, stage: str) -> str:
        """
        Post-processing: enforce question limits based on conversation stage.
        Sentence-level transforms — converts questions to natural statements.
        Regex-based, no LLM calls, ~0ms.
        """
        from ..utils.constants import (
            FORBIDDEN_QUESTION_PATTERNS,
            FORBIDDEN_QUESTION_PATTERNS_HINGLISH,
            QUESTION_CAP_TRUST, QUESTION_CAP_DEEPENING,
            QUESTION_CAP_INSIGHT, QUESTION_CAP_COMPANION,
        )

        original_q_count = text.count("?")

        # Step 1: Replace known forbidden interrogative phrases with soft statements
        all_patterns = {**FORBIDDEN_QUESTION_PATTERNS, **FORBIDDEN_QUESTION_PATTERNS_HINGLISH}
        for pattern, replacement in all_patterns.items():
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # Step 2: Determine question cap for this stage
        caps = {
            "trust_window": QUESTION_CAP_TRUST,
            "deepening": QUESTION_CAP_DEEPENING,
            "insight": QUESTION_CAP_INSIGHT,
            "companion": QUESTION_CAP_COMPANION,
        }
        cap = caps.get(stage, 0)

        # Step 3: Check if under budget after pattern replacements
        question_count = text.count("?")
        if question_count <= cap:
            if original_q_count > question_count:
                logger.info(
                    f"🛡️ [Q-BUDGET] Stage={stage}, cap={cap}: "
                    f"{original_q_count}→{question_count} questions (pattern match)"
                )
            return text

        # Step 4: Sentence-level question handling
        # Split on sentence boundaries while keeping delimiters attached
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        questions_kept = 0
        result_sentences = []

        for sentence in sentences:
            if "?" not in sentence:
                result_sentences.append(sentence)
                continue

            if questions_kept < cap:
                # Within budget — keep this question
                questions_kept += 1
                result_sentences.append(sentence)
            else:
                # Over budget — transform the question into a statement
                transformed = ResponseGenerator._transform_question_to_statement(sentence)
                if transformed:
                    result_sentences.append(transformed)

        text = " ".join(result_sentences)

        # Step 5: Clean up double periods and trailing whitespace
        text = re.sub(r"\.{2,}", ".", text)
        text = text.strip()

        final_q_count = text.count("?")
        if original_q_count != final_q_count:
            logger.info(
                f"🛡️ [Q-BUDGET] Stage={stage}, cap={cap}: "
                f"{original_q_count}→{final_q_count} questions"
            )

        # Log if questions survive beyond cap (sentence handler already enforces cap)
        surviving = text.count("?")
        if surviving > cap:
            logger.warning(
                f"⚠️ [Q-BUDGET] Stage={stage}, cap={cap}: "
                f"{surviving} questions survived past sentence handler"
            )

        return text

    @staticmethod
    def _transform_question_to_statement(sentence: str) -> str:
        """
        Transform a question sentence into a natural statement.
        Returns the transformed sentence, or empty string to drop it.
        """
        # Remove the question mark first
        stmt = sentence.rstrip().rstrip("?").strip()

        if not stmt:
            return ""

        # Drop very short question fragments (< 4 words) — they add little value
        if len(stmt.split()) < 4:
            return ""

        # Rewrite common interrogative openers into "I wonder..." statements
        # Order matters — more specific patterns first

        # "How about you/that/..." → "I hope..."
        rewritten = re.sub(
            r'^how about\b', 'I hope all is well with', stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # "What's/What is something..." → "I wonder what..."
        rewritten = re.sub(
            r"^what(?:'s| is) something\b", "I wonder about something", stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # "Any plans/thoughts..." → "I wonder about your plans..."
        rewritten = re.sub(
            r"^any\s+(plans|thoughts|ideas)\b", r"I wonder about your \1", stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # "How/What/Why/When/Where/Who/Which..." → "I wonder how/what/..."
        def _lower_repl(m):
            return f"I wonder {m.group(1).lower()}"

        rewritten = re.sub(
            r'^(how|what|why|when|where|who|which)\b',
            _lower_repl, stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # "Is/Are/Was/Were/Do/Does/Did/Has/Have/Can/Could/Would/Should/Will/May/Might..."
        # → "I wonder if..."
        rewritten = re.sub(
            r'^(is|are|was|were|do|does|did|has|have|had|can|could|would|should|shall|will|may|might)\s+',
            'I wonder if ', stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # "Isn't/Aren't/Don't/Doesn't/..." contractions
        rewritten = re.sub(
            r"^(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|hasn't|haven't|hadn't|can't|couldn't|wouldn't|shouldn't|won't)\s+",
            'I wonder if ', stmt, count=1, flags=re.IGNORECASE
        )
        if rewritten != stmt:
            return rewritten + "."

        # Fallback: just replace "?" with "." (no structural rewrite possible)
        return stmt + "."

    def _get_default_response(self, user_context: Dict) -> str:
        user_message = user_context.get("user_message", "")
        if "sad" in user_message.lower() or "stressed" in user_message.lower():
            return "That sounds really heavy. You don’t have to carry it alone — I’m here with you. If you want, we can take this one small piece at a time."
        if "happy" in user_message.lower() or "great" in user_message.lower():
            return "That's wonderful to hear. It's great that you're feeling positive. Hold onto this feeling — I'd love to hear more about it."
        return "Thank you for sharing that with me. I'm here to listen and support you. I'm ready to explore whatever feels right for you."

    @classmethod
    def _contains_emoji(cls, text: str) -> bool:
        return bool(cls._EMOJI_RE.search(text or ""))

    def _add_micro_emoji(self, text: str, user_context: Dict[str, Any]) -> str:
        """
        Add one subtle emoji when appropriate so responses feel less flat.
        Safety first: skip crisis path, zen persona, and text that already has emoji.
        """
        if not text:
            return text

        prefs = user_context.get("personality_settings", {})
        personality = str(prefs.get("personality", "mitra") or "mitra").lower()
        if personality not in self._EMOJI_SAFE_PERSONALITIES:
            return text

        if user_context.get("_pipeline_path") in ("D-crisis", "D-crisis-warm"):
            return text

        if self._contains_emoji(text):
            return text

        safety_text = f"{user_context.get('user_message', '')} {text}".lower()
        hard_risk_terms = (
            "suicide", "self-harm", "kill myself", "end my life", "want to die", "marna",
        )
        if any(term in safety_text for term in hard_risk_terms):
            return text

        nlp = user_context.get("nlp_analysis", {})
        sentiment = str((nlp.get("sentiment") or {}).get("label", "neutral")).lower()
        primary_emotion = str(nlp.get("primary_emotion", "")).lower()

        if sentiment in {"positive", "joy", "happy", "optimistic"}:
            emoji = "✨"
        elif sentiment in {"negative", "sad", "anxious", "fear", "angry", "anger"} or any(
            token in primary_emotion for token in ("sad", "lonely", "anx", "stress", "overwhelm", "fear")
        ):
            emoji = "🫂"
        else:
            emoji = "🙂"

        return f"{text.rstrip()} {emoji}"
