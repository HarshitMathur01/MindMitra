"""
Analysis Engine — Isolated compute logic for LLM-based analysis in MindMitra.

This module houses the pure business logic and LLM interactions for psychological
and emotional analysis. It has been extracted from the main workflow to ensure
clean separation of concerns. The AnalysisEngine is a stateless utility class
that takes its required dependencies (like LLM clients) explicitly.
"""

import time
import logging
from typing import Dict, Any

from ..utils.json_utils import parse_json_from_llm_output

logger = logging.getLogger(__name__)

class AnalysisEngine:
    """
    Stateless engine for performing emotion, cultural, and psychological analysis.
    Takes dependencies (groq_nlp, glm) explicitly to avoid side-effects.
    """

    @staticmethod
    def activity_context_block(ctx: Dict, max_items: int = 5) -> str:
        """
        Build a compact activity summary string for injection into analysis prompts.
        Returns empty string if no recent activities.
        """
        activities = ctx.get("session_context", {}).get("user_activities", [])
        if not activities:
            return ""
        lines = []
        for act in activities[:max_items]:
            atype = act.get("activity_type", "?")
            score = act.get("score", "?")
            accuracy = act.get("accuracy_percentage")
            insights = act.get("insights_generated", {})
            perf = insights.get("performance_level", "") if isinstance(insights, dict) else ""
            patterns = insights.get("key_patterns", []) if isinstance(insights, dict) else []
            acc_str = f" acc={accuracy}%" if accuracy is not None else ""
            perf_str = f" perf={perf}" if perf else ""
            pat_str = f" signals={patterns}" if patterns else ""
            lines.append(f"  - {atype}: score={score}{acc_str}{perf_str}{pat_str}")
        return "Recent game/assessment activity (last 24h):\n" + "\n".join(lines)

    @staticmethod
    def build_voice_context_block(ctx: Dict) -> str:
        """
        Build a voice context block for LLM analysis prompts (Paths B, C).
        Raw metrics only — no emotional labels.
        """
        voice = ctx.get("voice_analysis", {})
        if not voice:
            return ""

        from app.services.voice_prosody import format_prosody_for_prompt

        lines = []

        # Azure speech metrics
        wpm = voice.get("speech_rate_wpm")
        if wpm is not None:
            lines.append(f"Speech rate: {wpm} WPM ({voice.get('speech_rate_category', '')})")
        pause = voice.get("pause_pattern")
        if pause:
            lines.append(f"Pause pattern: {pause} (long pauses: {voice.get('long_pause_count', 0)})")
        ratio = voice.get("speech_to_silence_ratio")
        if ratio is not None:
            lines.append(f"Speech-to-silence ratio: {ratio}")

        # Prosodic features (from parselmouth)
        prosody = voice.get("prosody", {})
        if prosody:
            prosody_text = format_prosody_for_prompt(prosody)
            if prosody_text:
                lines.append(prosody_text)

        if not lines:
            return ""

        return "Voice tone indicators (raw metrics, no interpretation):\n" + "\n".join(lines) + "\n"

    @classmethod
    def combined_emotion_cultural_analyse(cls, groq_nlp: Any, ctx: Dict) -> Dict:
        """
        Path B helper — ONE Groq call replaces old NLP + cultural calls.
        Returns: {primary_emotion, intensity, cultural_pressure, language_style,
                  user_needs, tone_match}
        """
        defaults = {
            "primary_emotion": "neutral",
            "intensity": 0.5,
            "cultural_pressure": "none",
            "language_style": "english",
            "user_needs": "validation",
            "tone_match": "warm",
        }
        if not (groq_nlp and groq_nlp.client):
            return defaults

        text = ctx.get("user_message", "")
        recent = ctx.get("session_context", {}).get("recent_messages", [])[-3:]
        history = " | ".join(
            f"{m.get('role', '?')}: {m.get('content', '')[:100]}" for m in recent
        )
        ctx_line = f"Context: {history[:400]}\n" if history else ""

        act_block = cls.activity_context_block(ctx)
        act_line = f"\n{act_block}\n" if act_block else ""

        # Memory context for emotional analysis (fixes memory blind spot in Path B)
        mem0_context = ctx.get("memory_context", "")
        mem_line = f"User history from memory: {mem0_context[:300]}\n" if mem0_context else ""

        # Voice prosody context (raw tone metrics)
        voice_block = cls.build_voice_context_block(ctx)
        voice_line = f"\n{voice_block}" if voice_block else ""

        prompt = (
            "Analyse this message for a mental-health chatbot. "
            "Return ONLY valid JSON:\n"
            "{\n"
            '  "primary_emotion": "<strongest emotion>",\n'
            '  "intensity": <float 0-1>,\n'
            '  "cultural_pressure": "<none|exam|family|social|identity|career|stigma>",\n'
            '  "language_style": "<english|hinglish|hindi>",\n'
            '  "user_needs": "<just_to_vent|validation|practical_help|information|company>",\n'
            '  "tone_match": "<playful|warm|gentle|calm|energetic>"\n'
            "}\n\n"
            f"{ctx_line}"
            f"{mem_line}"
            f"{act_line}"
            f"{voice_line}"
            f'Message: "{text[:600]}"\n\nJSON:'
        )
        try:
            _t_groq = time.monotonic()
            logger.debug(f"  📡 [COMBINED-ANALYSIS] Groq API call ({groq_nlp.model}) ...")
            resp = groq_nlp.client.chat.completions.create(
                model=groq_nlp.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=180,
            )
            _groq_ms = (time.monotonic() - _t_groq) * 1000
            raw = (resp.choices[0].message.content.strip()) if resp.choices else ""
            parsed = parse_json_from_llm_output(raw)
            if isinstance(parsed, dict):
                for k, v in defaults.items():
                    if k not in parsed:
                        parsed[k] = v
                logger.info(
                    f"✅ [COMBINED-ANALYSIS] Groq {_groq_ms:.0f}ms | "
                    f"emotion={parsed.get('primary_emotion')} "
                    f"intensity={parsed.get('intensity',0):.2f} "
                    f"lang={parsed.get('language_style')} "
                    f"needs={parsed.get('user_needs')}"
                )
                return parsed
        except Exception as e:
            logger.error(f"❌ [COMBINED-ANALYSIS] Groq call failed: {e}")
        return defaults

    @classmethod
    def optimized_psych_analysis(cls, llm_controller: Any, ctx: Dict) -> Dict:
        """
        Path C helper — lighter GLM prompt, ~40% fewer tokens than full analysis.
        Returns: {emotional_state, primary_stressor, risk_level, intervention,
                  insight, cultural_factor}
        """
        defaults = {
            "emotional_state": "distressed",
            "primary_stressor": "General",
            "risk_level": "moderate",
            "intervention": "validate",
            "insight": "User needs support and validation",
            "cultural_factor": None,
        }
        nlp = ctx.get("nlp_analysis", {})
        emotion = nlp.get("primary_emotion", "unknown")
        intensity = nlp.get("intensity", 0.0)

        session = ctx.get("session_context", {})
        recent = session.get("recent_messages", [])[-3:]

        # mem0 retrieved memories (injected before routing)
        mem0_context = ctx.get("memory_context", "")
        mem_block = mem0_context[:800] if mem0_context else "None"

        conv = "\n".join(
            f"{'U' if m.get('role') == 'user' else 'A'}: {m.get('content', '')[:80]}"
            for m in recent
        ) or "New conversation."

        act_block = cls.activity_context_block(ctx)
        act_line = f"\n{act_block}\n" if act_block else ""

        # Cross-session context for clinical continuity
        prev = ctx.get("previous_session_summary", {})
        prev_line = ""
        if prev and prev.get("summary"):
            prev_line = f"\nPrevious session: {prev['summary'][:400]}\n"

        # Voice prosody context (raw tone metrics)
        voice_block = cls.build_voice_context_block(ctx)
        voice_line = f"\n{voice_block}" if voice_block else ""

        prompt = (
            "You are a clinical psychologist. Return ONLY valid JSON:\n"
            "{\n"
            '  "emotional_state": "<2-3 word description>",\n'
            '  "primary_stressor": "<Academic|Family|Social|Identity|Career|Relationship|Health>",\n'
            '  "risk_level": "<low|moderate|high|crisis>",\n'
            '  "intervention": "<validate|reframe|ground|problem-solve|refer|psychoeducation>",\n'
            '  "insight": "<single most important clinical observation, one sentence>",\n'
            '  "cultural_factor": "<specific Indian pressure if relevant, else null>"\n'
            "}\n\n"
            f'Message: "{ctx["user_message"][:600]}"\n'
            f"Emotion: {emotion} (intensity {intensity:.1f})\n"
            f"User memories:\n{mem_block}\n"
            f"{act_line}"
            f"{prev_line}"
            f"{voice_line}"
            f"Recent:\n{conv}\n\nJSON:"
        )
        try:
            _t_glm = time.monotonic()
            logger.debug(f"  📡 [PSYCH-OPT] GLM API call ({getattr(llm_controller, 'model_name', '?')}) ...")
            resp = llm_controller.invoke([{"role": "user", "content": prompt}])
            _glm_ms = (time.monotonic() - _t_glm) * 1000
            if resp and resp.content:
                parsed = parse_json_from_llm_output(resp.content)
                if isinstance(parsed, dict):
                    for k, v in defaults.items():
                        if k not in parsed:
                            parsed[k] = v
                    logger.info(
                        f"✅ [PSYCH-OPT] GLM {_glm_ms:.0f}ms | "
                        f"stressor={parsed.get('primary_stressor')} "
                        f"interv={parsed.get('intervention')}"
                    )
                    return parsed
        except Exception as e:
            logger.error(f"❌ [PSYCH-OPT] GLM logic failed: {e}")

        return defaults
