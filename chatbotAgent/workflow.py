"""
MindMitra Psychology Workflow v2 — Modular Architecture
========================================================

Architecture:
  ┌──────────────────────────────────────────────────────────────┐
  │                    UserContext (shared JSON)                  │
  │  Every module reads from and writes results back to this     │
  └────────┬──────────┬──────────┬──────────┬──────────┬─────────┘
           │          │          │          │          │
     ┌─────▼────┐ ┌──▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────┐
     │  Memory   │ │ NLP  │ │Cultural│ │Psych   │ │  Technique   │
     │  System   │ │(Groq)│ │Context │ │Analysis│ │  Selector    │
     │ (kept as  │ │      │ │ Module │ │(GLM)   │ │  (GLM)       │
     │  is)      │ │      │ │        │ │        │ │              │
     └──────────┘ └──────┘ └────────┘ └────────┘ └──────────────┘
                                                        │
                                                  ┌─────▼──────┐
                                                  │  Response   │
                                                  │  Generator  │
                                                  │  (GLM)      │
                                                  └─────────────┘

External interface (process_user_chat / process_chat) is UNCHANGED.
"""
import zai
from groq import Groq
import os
import json
import time
import logging
import threading
import re
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from copy import deepcopy
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from supabase import create_client, Client
from memory_architecture import UniversalMemorySystem

# ──────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
load_dotenv()


# ╔══════════════════════════════════════════════════════════════╗
# ║  0. RESPONSE WRAPPER CLASS                                  ║
# ╚══════════════════════════════════════════════════════════════╝

class GLMResponse:
    """Wrapper for GLM API responses to maintain consistent interface"""
    def __init__(self, content: str):
        self.content = content if content else ""
    
    def __bool__(self):
        return bool(self.content)


def parse_json_from_llm_output(raw: str) -> Optional[Dict[str, Any]]:
    """Best-effort JSON object parsing from LLM output."""
    if not raw:
        return None

    cleaned = raw.replace("\ufeff", "").strip()
    fenced_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, flags=re.IGNORECASE | re.DOTALL)
    if fenced_match:
        cleaned = fenced_match.group(1).strip()
    else:
        cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip().rstrip("`")

    # 1) direct parse
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, str):
            parsed = json.loads(parsed)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    # 2) parse first JSON object found in text
    decoder = json.JSONDecoder()
    for i, ch in enumerate(cleaned):
        if ch == "{":
            try:
                parsed, _ = decoder.raw_decode(cleaned[i:])
                if isinstance(parsed, str):
                    parsed = json.loads(parsed)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                continue

    # 3) balanced-brace extraction (ignoring braces inside quoted strings)
    def _extract_balanced_object(text: str, start_idx: int) -> Optional[str]:
        depth = 0
        in_string = False
        escape = False
        for pos in range(start_idx, len(text)):
            ch = text[pos]
            if in_string:
                if escape:
                    escape = False
                    continue
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_idx: pos + 1]
        return None

    for i, ch in enumerate(cleaned):
        if ch == "{":
            candidate = _extract_balanced_object(cleaned, i)
            if not candidate:
                continue
            try:
                parsed = json.loads(candidate)
                return parsed if isinstance(parsed, dict) else None
            except Exception:
                continue

    # 4) substring between first '{' and last '}'
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first != -1 and last != -1 and last > first:
        try:
            candidate = cleaned[first:last + 1]
            candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
            parsed = json.loads(candidate)
            return parsed if isinstance(parsed, dict) else None
        except Exception:
            return None
    return None


def compact_for_merge_prompt(value: Any, max_depth: int = 4, max_items: int = 10, max_str: int = 280) -> Any:
    """Reduce payload size sent to merge LLM without changing source context."""
    if max_depth <= 0:
        return "..."

    if isinstance(value, dict):
        compacted: Dict[str, Any] = {}
        for key, item in value.items():
            compacted[str(key)] = compact_for_merge_prompt(item, max_depth - 1, max_items, max_str)
        return compacted

    if isinstance(value, list):
        sliced = value[:max_items]
        compacted_list = [
            compact_for_merge_prompt(item, max_depth - 1, max_items, max_str)
            for item in sliced
        ]
        if len(value) > max_items:
            compacted_list.append(f"... ({len(value) - max_items} more items)")
        return compacted_list

    if isinstance(value, str) and len(value) > max_str:
        return value[:max_str] + "..."

    return value


# ╔══════════════════════════════════════════════════════════════╗
# ║  1. SHARED USER-CONTEXT JSON SCHEMA                         ║
# ╚══════════════════════════════════════════════════════════════╝

def create_empty_user_context(
    user_id: str = "anonymous",
    session_id: str = None,
    user_message: str = "",
) -> Dict[str, Any]:
    """
    Canonical JSON envelope that every module reads from / writes to.
    Nothing leaves or enters the pipeline except through this structure.
    """
    return {
        # ── identity ──
        "user_id": user_id,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),

        # ── raw input ──
        "user_message": user_message,
        "voice_analysis": {},                       # optional voice data

        # ── session history (populated by caller / memory fetch) ──
        "session_context": {
            "recent_messages": [],
            "conversation_summary": {},
            "session_memories": {
                "procedural": [],
                "semantic": [],
                "episodic": [],
            },
            "user_activities": [],
            "user_patterns": {},
        },

        # ── NLP analysis  (written by Groq NLP module) ──
        "nlp_analysis": {
            "emotions": {},                         # {joy: 0.1, sadness: 0.7, …}
            "primary_emotion": "",
            "sentiment": {
                "score": 0.0,                       # -1 … +1
                "label": "neutral",                 # positive / negative / neutral / mixed
            },
            "intensity": 0.0,                       # 0 … 1
            "key_phrases": [],
            "language_detected": "en",
            "urgency_flag": False,
        },

        # ── cultural context (written by cultural module) ──
        "cultural_context": {
            "language_style": "casual",             # formal / casual / hindi-mixed
            "hindi_english_ratio": 0.0,             # 0 = pure English, 1 = pure Hindi
            "code_switching_detected": False,
            "cultural_sensitivity_flags": [],        # e.g. "parental_pressure", "exam_stress"
            "communication_pattern": "",
            "regional_context": "",
            "formality_level": "medium",            # low / medium / high
        },

        # ── psychological analysis  (written by GLM Agent 1) ──
        "psychological_analysis": {
            "emotional_state": "",
            "stress_categories": [],
            "risk_assessment": "low",
            "coping_assessment": "",
            "intervention_priority": "supportive",
            "psychological_insights": [],
            "cultural_pressures": "",
        },

        # ── screening scales (filled when PHQ-9 / GAD-7 are available) ──
        "screening_assessments": {
            "phq9": {
                "score": None,
                "severity": "",
                "responses": [],
                "last_updated": None,
            },
            "gad7": {
                "score": None,
                "severity": "",
                "responses": [],
                "last_updated": None,
            },
        },

        # ── technique selection  (written by GLM Agent 2) ──
        "technique_selection": {
            "primary_technique": "",                # CBT / ACT / MBCT / …
            "therapeutic_approach": "",
            "activity_recommendations": [],
            "rationale": "",
        },

        # ── final output ──
        "ai_response": "",
        "response_generated": False,
    }


# ╔══════════════════════════════════════════════════════════════╗
# ║  2. GROQ NLP — Emotion & Sentiment Analysis                 ║
# ╚══════════════════════════════════════════════════════════════╝

class GroqNLPModule:
    """
    Lightweight emotion / sentiment analysis via Groq (llama/mixtral).
    Handles token-limit errors with automatic truncation & retry.
    """

    # Groq free-tier context sizes by model
    _MODEL_TOKEN_LIMITS = {
        "qwen/qwen3-32b": 4_096,
        "moonshotai/kimi-k2-instruct-0905": 4096,
        "meta-llama/llama-4-scout-17b-16e-instruct": 8_192,
       # "mixtral-8x7b-32768": 32_768,
    }

    def __init__(self, api_key: str = None, model: str = "qwen/qwen3-32b"):
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ [GROQ-NLP] GROQ_API_KEY not set — NLP module disabled")
            self.client = None
            return

        try:
            
            self.client = Groq(api_key=self.api_key)
            self.model = model
            self._max_input_chars = self._MODEL_TOKEN_LIMITS.get(model, 8_192) * 3  # ~3 chars/token rough est
            logger.info(f"✅ [GROQ-NLP] Initialised with model={model}")
        except ImportError:
            logger.warning("⚠️ [GROQ-NLP] `groq` package not installed — NLP module disabled")
            self.client = None
        except Exception as e:
            logger.error(f"❌ [GROQ-NLP] Init failed: {e}")
            self.client = None

    # ── public entry ──────────────────────────────────────────
    def analyse(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run emotion + sentiment analysis; write results into user_context['nlp_analysis']."""
        if not self.client:
            logger.info("[GROQ-NLP] Skipped (client not available)")
            return user_context

        text = user_context.get("user_message", "")
        # Include last 3 messages for conversational context
        recent = user_context["session_context"].get("recent_messages", [])[-3:]
        history_snippet = " | ".join(
            f"{m.get('role','?')}: {m.get('content','')[:120]}" for m in recent
        )

        prompt = self._build_prompt(text, history_snippet)
        raw = self._call_groq(prompt)
        parsed = self._parse_response(raw)
        user_context["nlp_analysis"] = parsed
        logger.info(f"✅ [GROQ-NLP] Emotion={parsed.get('primary_emotion')}, Sentiment={parsed['sentiment']['label']}")
        return user_context

    # ── internals ─────────────────────────────────────────────
    def _build_prompt(self, text: str, history: str) -> str:
        return f"""Analyse the following user message for a mental-health chatbot.  
Return ONLY valid JSON (no markdown fences) with exactly these keys:

{{
  "emotions": {{"joy": 0.0, "sadness": 0.0, "anger": 0.0, "fear": 0.0, "surprise": 0.0, "disgust": 0.0, "trust": 0.0, "anticipation": 0.0}},
  "primary_emotion": "<strongest emotion name>",
  "sentiment": {{"score": <float -1 to 1>, "label": "<positive|negative|neutral|mixed>"}},
  "intensity": <float 0 to 1>,
  "key_phrases": ["<phrase1>", "<phrase2>"],
  "language_detected": "<en|hi|hinglish>",
  "urgency_flag": <true if crisis/self-harm indicators else false>
}}

Recent conversation context: {history[:600]}

User message: \"{text[:1500]}\"

JSON:"""

    def _call_groq(self, prompt: str, _retry: int = 0) -> str:
        """Call Groq with automatic truncation on token-limit errors."""
        try:
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=400,
            )
            return resp.choices[0].message.content.strip()

        except Exception as e:
            err_str = str(e).lower()
            # Handle token limit exceeded — truncate and retry once
            if ("token" in err_str or "context_length" in err_str or "rate_limit" in err_str) and _retry < 2:
                logger.warning(f"⚠️ [GROQ-NLP] Token/rate limit hit (attempt {_retry+1}), truncating...")
                truncated = prompt[: len(prompt) // 2]
                return self._call_groq(truncated, _retry + 1)
            logger.error(f"❌ [GROQ-NLP] API call failed: {e}")
            return "{}"

    def _parse_response(self, raw: str) -> Dict:
        """Robust JSON parse with fallback defaults."""
        defaults = {
            "emotions": {},
            "primary_emotion": "unknown",
            "sentiment": {"score": 0.0, "label": "neutral"},
            "intensity": 0.0,
            "key_phrases": [],
            "language_detected": "en",
            "urgency_flag": False,
        }
        if not raw:
            return defaults
        try:
            # Strip markdown fences if the model wraps them
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            # Merge with defaults so no key is ever missing
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[GROQ-NLP] Failed to parse JSON, using defaults")
            return defaults


# ╔══════════════════════════════════════════════════════════════╗
# ║  3. CULTURAL CONTEXT & LANGUAGE STYLE MODULE                 ║
# ╚══════════════════════════════════════════════════════════════╝

class CulturalContextModule:
    """
    Rule-based + lightweight LLM analysis for:
      • Hindi / Hinglish detection & code-switching level
      • Formality level
      • Cultural sensitivity flags (exam stress, parental pressure, …)
      • Communication pattern classification
    Uses the NLP analysis already present in user_context and optionally
    calls Groq for deeper classification (kept cheap — single short call).
    """

    # Common Hindi / Hinglish markers
    _HINDI_MARKERS = {
        "yaar", "bhai", "didi", "maa", "papa", "ghar", "padhai", "exam",
        "nahi", "kya", "hai", "mein", "toh", "acha", "theek", "kuch",
        "kaise", "kyun", "bohot", "bahut", "zyada", "bilkul", "sach",
        "samajh", "dukh", "tension", "pareshan", "darr", "chinta",
        "mann", "dil", "sapna", "zindagi", "rishta", "shaadi",
        "arre", "haan", "naa", "abhi", "bas", "matlab", "lekin",
        "accha", "suno", "bata", "bol", "rona", "akela", "thak",
    }

    _CULTURAL_KEYWORDS = {
        "parental_pressure": ["parents", "papa", "maa", "mom", "dad", "family", "ghar", "expect", "disappoint", "proud"],
        "exam_stress": ["exam", "jee", "neet", "boards", "cgpa", "marks", "rank", "topper", "padhai", "result", "semester"],
        "career_anxiety": ["career", "job", "placement", "package", "future", "engineer", "doctor", "startup", "salary"],
        "social_pressure": ["friends", "relationship", "breakup", "lonely", "akela", "judge", "log kya kahenge", "society"],
        "identity_struggle": ["identity", "confused", "who am i", "purpose", "meaning", "self", "worth"],
        "marriage_pressure": ["shaadi", "marriage", "rishta", "arrange", "partner", "settle"],
        "mental_health_stigma": ["pagal", "crazy", "weak", "therapy", "stigma", "shame", "hide"],
    }
    _DEEP_GROQ_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, groq_nlp: Optional[GroqNLPModule] = None):
        self.groq_nlp = groq_nlp  # reuse same Groq client for optional deep analysis
        self._deep_enabled = bool(self.groq_nlp and getattr(self.groq_nlp, "client", None))
        logger.info(f"✅ [CULTURAL] Cultural context module initialised (deep={self._deep_enabled})")

    def analyse(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run cultural analysis; write results into user_context['cultural_context']."""
        text = user_context.get("user_message", "").lower()
        history = user_context["session_context"].get("recent_messages", [])
        nlp_analysis = user_context.get("nlp_analysis", {})

        result = {
            "language_style": self._detect_language_style(text),
            "hindi_english_ratio": self._compute_hindi_ratio(text),
            "code_switching_detected": False,
            "cultural_sensitivity_flags": self._detect_cultural_flags(text),
            "communication_pattern": self._detect_communication_pattern(text, history),
            "regional_context": self._infer_regional_context(text, history),
            "formality_level": self._detect_formality(text),
        }
        result["code_switching_detected"] = result["hindi_english_ratio"] > 0.1

        # If session history exists, enrich from patterns across messages
        if history:
            result = self._enrich_from_history(result, history)

        # Optional deep LLM pass (non-fatal): refine labels while preserving schema safety
        deep_result = self._deep_analyse_with_groq(text, history, nlp_analysis)
        if deep_result:
            result = self._merge_deep_result(result, deep_result)

        user_context["cultural_context"] = result
        logger.info(
            f"✅ [CULTURAL] Style={result['language_style']}, "
            f"Hindi%={result['hindi_english_ratio']:.0%}, "
            f"Flags={result['cultural_sensitivity_flags']}"
        )
        return user_context

    # ── detection helpers ─────────────────────────────────────
    def _detect_language_style(self, text: str) -> str:
        words = set(text.split())
        hindi_count = len(words & self._HINDI_MARKERS)
        total = max(len(words), 1)
        ratio = hindi_count / total
        if ratio > 0.25:
            return "hindi-mixed"
        elif ratio > 0.08:
            return "hinglish"
        return "english"

    def _compute_hindi_ratio(self, text: str) -> float:
        words = text.split()
        if not words:
            return 0.0
        hindi_count = sum(1 for w in words if w.lower() in self._HINDI_MARKERS)
        return round(hindi_count / len(words), 3)

    def _detect_cultural_flags(self, text: str) -> List[str]:
        flags = []
        text_lower = text.lower()
        for flag, keywords in self._CULTURAL_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                flags.append(flag)
        return flags

    def _detect_communication_pattern(self, text: str, history: List) -> str:
        if len(text.split()) < 5:
            return "terse"
        elif len(text.split()) > 80:
            return "verbose"
        elif text.endswith("?"):
            return "questioning"
        elif any(w in text.lower() for w in ["feel", "feeling", "felt", "lagta", "mehsoos"]):
            return "emotionally_expressive"
        return "conversational"

    def _detect_formality(self, text: str) -> str:
        informal_markers = {"lol", "haha", "omg", "wtf", "bruh", "yaar", "arre", "bc", "mc"}
        formal_markers = {"sir", "ma'am", "respected", "kindly", "please", "would you"}
        words = set(text.lower().split())
        if words & informal_markers:
            return "low"
        if words & formal_markers:
            return "high"
        return "medium"

    def _infer_regional_context(self, text: str, history: List) -> str:
        # Simple keyword-based; can be enhanced
        all_text = text + " ".join(m.get("content", "") for m in history[-5:])
        all_lower = all_text.lower()
        if any(w in all_lower for w in ["kota", "jee", "iit", "coaching"]):
            return "competitive_exam_belt"
        if any(w in all_lower for w in ["bangalore", "bengaluru", "hyderabad", "pune", "it job", "startup"]):
            return "tech_hub"
        if any(w in all_lower for w in ["village", "gaon", "rural"]):
            return "rural"
        return "urban_metro"

    def _enrich_from_history(self, result: Dict, history: List) -> Dict:
        """Aggregate patterns across session history."""
        all_text = " ".join(m.get("content", "") for m in history if m.get("role") == "user")
        # Accumulate cultural flags from entire session
        session_flags = set(result["cultural_sensitivity_flags"])
        for flag, keywords in self._CULTURAL_KEYWORDS.items():
            if any(kw in all_text.lower() for kw in keywords):
                session_flags.add(flag)
        result["cultural_sensitivity_flags"] = list(session_flags)

        # Detect overall session language style (may differ from single message)
        session_hindi = self._compute_hindi_ratio(all_text)
        if session_hindi > result["hindi_english_ratio"]:
            result["hindi_english_ratio"] = round(
                (result["hindi_english_ratio"] + session_hindi) / 2, 3
            )
            if session_hindi > 0.2:
                result["language_style"] = "hindi-mixed"
        return result

    def _deep_analyse_with_groq(self, text: str, history: List, nlp_analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Optional low-cost Groq refinement for cultural context. Returns empty dict on failure."""
        if not self._deep_enabled or len(text.split()) < 5:
            return {}

        recent_user_msgs = [m.get("content", "") for m in history[-5:] if m.get("role") == "user"]
        history_snippet = " | ".join(msg[:140] for msg in recent_user_msgs)

        prompt = f"""Classify this message for an Indian youth mental-health assistant.
Return ONLY valid JSON with exactly these keys:
{{
  "language_style": "<english|hinglish|hindi-mixed>",
  "hindi_english_ratio": <float 0 to 1>,
  "code_switching_detected": <boolean>,
  "cultural_sensitivity_flags": ["<parental_pressure|exam_stress|career_anxiety|social_pressure|identity_struggle|marriage_pressure|mental_health_stigma>"],
  "communication_pattern": "<terse|verbose|questioning|emotionally_expressive|conversational>",
  "regional_context": "<competitive_exam_belt|tech_hub|rural|urban_metro>",
  "formality_level": "<low|medium|high>"
}}

NLP language signal: {nlp_analysis.get('language_detected', 'en')}
Recent user history: {history_snippet[:600]}
Current message: "{text[:1200]}"

JSON:"""

        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self._DEEP_GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=220,
            )
            content = resp.choices[0].message.content.strip() if resp and resp.choices else ""
            if not content:
                return {}
            cleaned = re.sub(r"```(?:json)?", "", content).strip().rstrip("`")
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, dict) else {}
        except Exception as e:
            logger.warning(f"⚠️ [CULTURAL] Deep Groq analysis skipped: {e}")
            return {}

    def _merge_deep_result(self, base: Dict[str, Any], deep: Dict[str, Any]) -> Dict[str, Any]:
        """Merge deep LLM result into rule-based output with strict validation."""
        merged = dict(base)

        allowed_language = {"english", "hinglish", "hindi-mixed"}
        allowed_pattern = {"terse", "verbose", "questioning", "emotionally_expressive", "conversational"}
        allowed_region = {"competitive_exam_belt", "tech_hub", "rural", "urban_metro"}
        allowed_formality = {"low", "medium", "high"}
        allowed_flags = set(self._CULTURAL_KEYWORDS.keys())

        language_style = deep.get("language_style")
        if language_style in allowed_language:
            merged["language_style"] = language_style

        ratio = deep.get("hindi_english_ratio")
        if isinstance(ratio, (int, float)):
            merged["hindi_english_ratio"] = round(min(max(float(ratio), 0.0), 1.0), 3)

        code_switching = deep.get("code_switching_detected")
        if isinstance(code_switching, bool):
            merged["code_switching_detected"] = code_switching
        else:
            merged["code_switching_detected"] = merged.get("hindi_english_ratio", 0.0) > 0.1

        deep_flags = deep.get("cultural_sensitivity_flags", [])
        if isinstance(deep_flags, list):
            combined = set(merged.get("cultural_sensitivity_flags", []))
            for flag in deep_flags:
                if isinstance(flag, str) and flag in allowed_flags:
                    combined.add(flag)
            merged["cultural_sensitivity_flags"] = list(combined)

        communication = deep.get("communication_pattern")
        if communication in allowed_pattern:
            merged["communication_pattern"] = communication

        region = deep.get("regional_context")
        if region in allowed_region:
            merged["regional_context"] = region

        formality = deep.get("formality_level")
        if formality in allowed_formality:
            merged["formality_level"] = formality

        return merged


# ╔══════════════════════════════════════════════════════════════╗
# ║  3.5 SCREENING ASSESSMENTS (PHQ-9 / GAD-7)                  ║
# ╚══════════════════════════════════════════════════════════════╝

class ScreeningAssessmentAgent:
    """
    Generates PHQ-9 and GAD-7 estimates from conversation context.
    Uses Groq first, with GLM fallback. Safe validation ensures schema consistency.
    """

    _GROQ_MODEL = "llama-3.3-70b-versatile"

    def __init__(self, groq_nlp: Optional[GroqNLPModule], glm: "GLMController"):
        self.groq_nlp = groq_nlp
        self.glm = glm
        logger.info("✅ [SCREENING] PHQ-9 / GAD-7 screening agent ready")

    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        """Return screening_assessments payload, or empty dict on failure."""
        user_message = user_context.get("user_message", "")
        session = user_context.get("session_context", {})
        recent = session.get("recent_messages", [])[-6:]
        nlp = user_context.get("nlp_analysis", {})
        psych = user_context.get("psychological_analysis", {})

        if not user_message.strip() and not recent:
            return {}

        history_snippet = "\n".join(
            f"{m.get('role', 'user')}: {m.get('content', '')[:140]}" for m in recent
        )

        prompt = f"""Estimate screening scores for PHQ-9 and GAD-7 from the text context below.
Return ONLY valid JSON with exactly this structure:
{{
  "phq9": {{"responses": [<9 integers 0-3>], "score": <0-27 integer>, "severity": "<minimal|mild|moderate|moderately_severe|severe>"}},
  "gad7": {{"responses": [<7 integers 0-3>], "score": <0-21 integer>, "severity": "<minimal|mild|moderate|severe>"}}
}}

Rules:
- Infer cautiously from available data; do not exaggerate risk.
- If evidence is weak, keep scores low and conservative.
- No markdown, no extra keys.

Current message: "{user_message[:1200]}"
Recent conversation:
{history_snippet[:1000]}

Signals:
- NLP primary emotion: {nlp.get('primary_emotion', 'unknown')}
- NLP intensity: {nlp.get('intensity', 0)}
- Psychological state: {psych.get('emotional_state', '')}

JSON:"""

        parsed = self._call_groq(prompt)
        if not parsed:
            parsed = self._call_glm(prompt)
        if not parsed:
            return {}

        validated = self._validate(parsed)
        return validated

    def _call_groq(self, prompt: str) -> Optional[Dict[str, Any]]:
        if not self.groq_nlp or not getattr(self.groq_nlp, "client", None):
            return None
        try:
            resp = self.groq_nlp.client.chat.completions.create(
                model=self._GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=280,
            )
            content = resp.choices[0].message.content if resp and resp.choices else ""
            out = parse_json_from_llm_output(content)
            if isinstance(out, dict):
                logger.info("✅ [SCREENING] Generated via Groq")
                return out
        except Exception as e:
            logger.warning(f"⚠️ [SCREENING] Groq screening failed: {e}")
        return None

    def _call_glm(self, prompt: str) -> Optional[Dict[str, Any]]:
        try:
            resp = self.glm.invoke([{"role": "user", "content": prompt}])
            content = resp.content if resp and resp.content else ""
            out = parse_json_from_llm_output(content)
            if isinstance(out, dict):
                logger.info("✅ [SCREENING] Generated via GLM fallback")
                return out
        except Exception as e:
            logger.warning(f"⚠️ [SCREENING] GLM fallback failed: {e}")
        return None

    def _validate(self, parsed: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and normalize model output into strict PHQ-9/GAD-7 schema."""
        now = datetime.now(timezone.utc).isoformat()

        phq = parsed.get("phq9", {}) if isinstance(parsed.get("phq9", {}), dict) else {}
        gad = parsed.get("gad7", {}) if isinstance(parsed.get("gad7", {}), dict) else {}

        phq_responses = phq.get("responses", []) if isinstance(phq.get("responses", []), list) else []
        gad_responses = gad.get("responses", []) if isinstance(gad.get("responses", []), list) else []

        phq_responses = [int(min(max(int(v), 0), 3)) for v in phq_responses[:9] if isinstance(v, (int, float, str)) and str(v).strip().lstrip("-").isdigit()]
        gad_responses = [int(min(max(int(v), 0), 3)) for v in gad_responses[:7] if isinstance(v, (int, float, str)) and str(v).strip().lstrip("-").isdigit()]

        while len(phq_responses) < 9:
            phq_responses.append(0)
        while len(gad_responses) < 7:
            gad_responses.append(0)

        phq_score = phq.get("score")
        gad_score = gad.get("score")

        phq_score = int(phq_score) if isinstance(phq_score, (int, float, str)) and str(phq_score).strip().lstrip("-").isdigit() else sum(phq_responses)
        gad_score = int(gad_score) if isinstance(gad_score, (int, float, str)) and str(gad_score).strip().lstrip("-").isdigit() else sum(gad_responses)

        phq_score = min(max(phq_score, 0), 27)
        gad_score = min(max(gad_score, 0), 21)

        phq_severity = self._phq9_severity(phq_score)
        gad_severity = self._gad7_severity(gad_score)

        return {
            "phq9": {
                "score": phq_score,
                "severity": phq_severity,
                "responses": phq_responses,
                "last_updated": now,
            },
            "gad7": {
                "score": gad_score,
                "severity": gad_severity,
                "responses": gad_responses,
                "last_updated": now,
            },
        }

    def _phq9_severity(self, score: int) -> str:
        if score <= 4:
            return "minimal"
        if score <= 9:
            return "mild"
        if score <= 14:
            return "moderate"
        if score <= 19:
            return "moderately_severe"
        return "severe"

    def _gad7_severity(self, score: int) -> str:
        if score <= 4:
            return "minimal"
        if score <= 9:
            return "mild"
        if score <= 14:
            return "moderate"
        return "severe"


# ╔══════════════════════════════════════════════════════════════╗
# ║  4. GLM CONCURRENCY CONTROLLER                              ║
# ╚══════════════════════════════════════════════════════════════╝

logger = logging.getLogger(__name__)

class GLMController:
    def __init__(
        self,
        model: str = "glm-4-32b-0414-128k",#"glm-4.7-flashx",  # Change model name here
        max_concurrent: int = 1,
        max_retries: int = 1,
        base_backoff: float = 2.0,
    ):
        self.api_key = '0b7ae4bd0c9b45878e633fd8be74bd4a.yuhRrTenuKNVWhD4'  # api_key or os.getenv("ZAI_API_KEY")
        if not self.api_key:
            raise ValueError("ZAI_API_KEY is required for GLM controller")

        self.model_name = model
        self._semaphore = threading.Semaphore(max_concurrent)
        self._max_retries = max_retries
        self._base_backoff = base_backoff

        # Initialize the native z.ai client (handles auth + endpoint automatically)
        self._client = zai.ZaiClient(
            api_key=self.api_key,
            max_retries=0,  # retries handled manually below for backoff control
        )
        logger.info(f"✅ [GLM] Controller ready — model={model}, max_concurrent={max_concurrent}")

    def invoke(self, messages: List, **kwargs) -> Any:
        """
        Thread-safe invoke with semaphore gating and exponential backoff on rate limits.
        """
        for attempt in range(self._max_retries):
            self._semaphore.acquire()
            _released = False
            try:
                chat_messages = [{"role": "system", "content": "You are a helpful assistant."}]
                chat_messages.extend([{"role": "user", "content": msg["content"]} for msg in messages])

                response = self._client.chat.completions.create(
                    model=self.model_name,
                    messages=chat_messages,
                    max_tokens=1000,
                    temperature=0.3,
                    top_p=0.8,
                    **kwargs
                )

                content = response.choices[0].message.content if response and response.choices else ""
                if not content:
                    logger.warning(f"⚠️ [GLM] Empty response received, attempt {attempt+1}/{self._max_retries}")
                    if attempt < self._max_retries - 1:
                        # Retry on empty response
                        wait = self._base_backoff * (2 ** attempt)
                        logger.info(f"🔄 [GLM] Retrying after {wait:.1f}s...")
                        self._semaphore.release()
                        _released = True
                        time.sleep(wait)
                        continue
                return GLMResponse(content)

            except zai.core.APIStatusError as e:
                if e.status_code == 429 or "rate" in str(e).lower() or "quota" in str(e).lower():
                    wait = self._base_backoff * (2 ** attempt)
                    logger.warning(f"⚠️ [GLM] Rate limited (attempt {attempt+1}/{self._max_retries}), backing off {wait:.1f}s")
                    self._semaphore.release()
                    _released = True
                    time.sleep(wait)
                else:
                    logger.error(f"❌ [GLM] API error {e.status_code}: {e}")
                    raise

            except zai.core.APITimeoutError as e:
                logger.warning(f"⚠️ [GLM] Timeout (attempt {attempt+1}/{self._max_retries}): {e}")
                self._semaphore.release()
                _released = True
                time.sleep(self._base_backoff)

            except Exception as e:
                logger.error(f"❌ [GLM] Unexpected error: {e}")
                raise

            finally:
                if not _released:
                    self._semaphore.release()
        logger.warning(f"⚠️ [GLM] All retries exhausted, attempting Groq fallback...")
        if self._groq_fallback:
            try:
                response = self._groq_fallback.chat.completions.create(
                    model="meta-llama/llama-4-scout-17b-16e-instruct",
                    messages=chat_messages,
                    max_tokens=1000,
                    temperature=0.3,
                )
                content = response.choices[0].message.content if response.choices else ""
                if content:
                    logger.info(f"✅ [GLM] Groq fallback succeeded ({len(content)} chars)")
                    return GLMResponse(content)
            except Exception as e:
                logger.error(f"❌ [GLM] Groq fallback also failed: {e}")

        raise RuntimeError(f"[GLM] All retries and fallbacks exhausted")
        #raise RuntimeError(f"[GLM] Exhausted {self._max_retries} retries due to rate limiting")



# ╔══════════════════════════════════════════════════════════════╗
# ║  5. GLM AGENT 1 — Psychologist Analysis                     ║
# ╚══════════════════════════════════════════════════════════════╝

class PsychologistAnalysisAgent:
    def __init__(self, glm: GLMController):
        self.glm = glm
        logger.info("✅ [AGENT-1] Psychologist analysis agent ready")

    def run(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("🧠 [AGENT-1] Starting psychological analysis...")

        try:
            prompt = self._build_prompt(user_context)
            resp = self.glm.invoke([{"role": "user", "content": prompt}])

            if not resp or not resp.content:
                logger.error("❌ [AGENT-1] GLM returned empty response, using defaults")
                parsed = self._get_default_analysis()
            else:
                parsed = self._parse_analysis(resp.content)
            
            user_context["psychological_analysis"] = parsed
            logger.info(
                f"✅ [AGENT-1] Done — state={parsed.get('emotional_state','?')}, "
                f"priority={parsed.get('intervention_priority','?')}"
            )
        except Exception as e:
            logger.error(f"❌ [AGENT-1] Exception during analysis: {e}, using defaults")
            user_context["psychological_analysis"] = self._get_default_analysis()
        return user_context


    def _build_prompt(self, ctx: Dict) -> str:
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        session = ctx.get("session_context", {})
        activities = session.get("user_activities", [])
        memories = session.get("session_memories", {})

        # Format memories compactly
        mem_lines = []
        for mtype in ("procedural", "semantic", "episodic"):
            for m in memories.get(mtype, [])[:4]:
                content = m.get("memory_content", m.get("content", ""))
                mem_lines.append(f"  [{mtype}] {content[:120]}")
        mem_block = "\n".join(mem_lines) if mem_lines else "No prior memories."

        # Format activities compactly
        act_lines = []
        for a in activities[:5]:
            atype = a.get("activity_type", "unknown")
            score = a.get("score", "?")
            insights = a.get("insights_generated", {})
            patterns = insights.get("key_patterns", [])
            act_lines.append(f"  {atype}: score={score}, patterns={patterns[:2]}")
        act_block = "\n".join(act_lines) if act_lines else "No activities yet."

        # Recent messages (last 5)
        recent = session.get("recent_messages", [])[-5:]
        conv_lines = []
        for m in recent:
            role = "User" if m.get("role") == "user" else "AI"
            conv_lines.append(f"  {role}: {m.get('content','')[:100]}")
        conv_block = "\n".join(conv_lines) if conv_lines else "New conversation."

        return f"""You are a clinical psychologist specialising in Indian youth (16-25).
Analyse this user and return ONLY valid JSON (no markdown fences) matching this schema:

{{
  "emotional_state": "<descriptive string>",
  "stress_categories": ["<Academic|Family|Social|Emotional|Identity|Career|Miscellaneous>"],
  "risk_assessment": "<low|moderate|high|crisis>",
  "coping_assessment": "<description of coping mechanisms & resilience>",
  "intervention_priority": "<immediate|supportive|long-term>",
  "psychological_insights": ["<insight1>", "<insight2>", "<insight3>"],
  "cultural_pressures": "<relevant Indian cultural/family/academic pressures>"
}}

─── DATA ───

USER MESSAGE: "{ctx['user_message'][:800]}"

NLP ANALYSIS:
  Primary emotion: {nlp.get('primary_emotion','unknown')}
  Sentiment: {nlp.get('sentiment',{}).get('label','unknown')} ({nlp.get('sentiment',{}).get('score',0):.2f})
  Intensity: {nlp.get('intensity',0):.2f}
  Urgency: {nlp.get('urgency_flag', False)}
  Key phrases: {nlp.get('key_phrases',[])}

CULTURAL CONTEXT:
  Language style: {cultural.get('language_style','unknown')}
  Cultural flags: {cultural.get('cultural_sensitivity_flags',[])}
  Communication: {cultural.get('communication_pattern','unknown')}
  Formality: {cultural.get('formality_level','medium')}

SESSION MEMORIES:
{mem_block}

RECENT ACTIVITIES:
{act_block}

RECENT CONVERSATION:
{conv_block}

JSON:"""

    def _get_default_analysis(self) -> Dict:
        """Return safe defaults when GLM fails"""
        return {
            "emotional_state": "Assessment needed - please share more",
            "stress_categories": ["General"],
            "risk_assessment": "low",
            "coping_assessment": "Continue with current coping strategies",
            "intervention_priority": "supportive",
            "psychological_insights": ["Let's take time to understand your situation better"],
            "cultural_pressures": "To be explored in conversation",
        }
    
    def _parse_analysis(self, raw: str) -> Dict:
        defaults = self._get_default_analysis()
        try:
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[AGENT-1] JSON parse failed, using LLM text as insight")
            defaults["psychological_insights"] = [raw[:300]]
            return defaults


# ╔══════════════════════════════════════════════════════════════╗
# ║  6. GLM AGENT 2 — Psychological Technique Selector           ║
# ╚══════════════════════════════════════════════════════════════╝

class TechniqueSelectorAgent:
    """
    Reads the psychological analysis + NLP + cultural context from
    UserContext and selects the optimal therapeutic technique(s).
    Writes into user_context['technique_selection'].
    """
    def __init__(self, glm: GLMController):
        self.glm = glm
        logger.info("✅ [AGENT-2] Technique selector agent ready")

    def run(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("💊 [AGENT-2] Selecting therapeutic technique...")

        try:
            prompt = self._build_prompt(user_context)
            resp = self.glm.invoke([{"role": "user", "content": prompt}])

            if not resp or not resp.content:
                logger.error("❌ [AGENT-2] GLM returned empty response, using defaults")
                parsed = self._get_default_selection()
            else:
                parsed = self._parse_selection(resp.content)
            
            user_context["technique_selection"] = parsed
            logger.info(f"✅ [AGENT-2] Technique={parsed.get('primary_technique','?')}")
        except Exception as e:
            logger.error(f"❌ [AGENT-2] Exception during selection: {e}, using defaults")
            user_context["technique_selection"] = self._get_default_selection()
        return user_context


    def _build_prompt(self, ctx: Dict) -> str:
        psych = ctx.get("psychological_analysis", {})
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})

        return f"""You are a therapeutic technique advisor for Indian youth (16-25).
Based on the psychological assessment below, select the best therapeutic approach.
Return ONLY valid JSON (no markdown fences):

{{
  "primary_technique": "<CBT|ACT|MBCT|DBT|MI|Solution-Focused|Person-Centered|Psychoeducation>",
  "therapeutic_approach": "<brief description of how to apply this technique>",
  "activity_recommendations": ["<activity1>", "<activity2>", "<activity3>"],
  "rationale": "<why this technique suits the current situation>"
}}

─── ASSESSMENT ───

Emotional state: {psych.get('emotional_state','')}
Stress categories: {psych.get('stress_categories',[])}
Risk: {psych.get('risk_assessment','low')}
Intervention priority: {psych.get('intervention_priority','supportive')}
Insights: {psych.get('psychological_insights',[])}
Cultural pressures: {psych.get('cultural_pressures','')}

Emotion intensity: {nlp.get('intensity',0):.2f}
Primary emotion: {nlp.get('primary_emotion','unknown')}
Urgency: {nlp.get('urgency_flag', False)}

Language style: {cultural.get('language_style','casual')}
Cultural flags: {cultural.get('cultural_sensitivity_flags',[])}
Formality: {cultural.get('formality_level','medium')}

Consider Indian cultural context: family dynamics, academic pressure, mental health stigma.
Prefer culturally appropriate, practical activities (yoga, journaling, grounding exercises).

JSON:"""

    def _get_default_selection(self) -> Dict:
        """Return safe defaults when GLM fails"""
        return {
            "primary_technique": "Person-Centered",
            "therapeutic_approach": "Empathetic listening with gentle exploration of your thoughts and feelings",
            "activity_recommendations": ["Take deep breaths and ground yourself", "Journal your feelings"],
            "rationale": "Building a safe space for you to express yourself",
        }
    
    def _parse_selection(self, raw: str) -> Dict:
        defaults = self._get_default_selection()
        try:
            cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`")
            parsed = json.loads(cleaned)
            for k, v in defaults.items():
                if k not in parsed:
                    parsed[k] = v
            return parsed
        except json.JSONDecodeError:
            logger.warning("[AGENT-2] JSON parse failed, using defaults")
            return defaults


# ╔══════════════════════════════════════════════════════════════╗
# ║  7. GLM RESPONSE GENERATOR                                  ║
# ╚══════════════════════════════════════════════════════════════╝

class ResponseGenerator:
    """
    Final stage: reads the full UserContext JSON and generates a natural,
    culturally-sensitive, therapeutically-informed companion response.
    """

    SYSTEM_PROMPT = """You are MindMitra, a culturally-aware AI therapeutic companion for Indian youth (16-25).

RESPONSE RULES:
• Combine psychology expertise with warm, companion-style delivery
• Match the user's language style (if they use Hindi/Hinglish, mirror appropriately)
• Apply the selected therapeutic technique naturally — do NOT label techniques
• Reference session memories when relevant to show continuity
• Be empathetic, non-judgmental, like a caring friend who understands psychology
• Validate cultural struggles without dismissing traditional values
• Keep responses conversational — concise for casual chat, deeper for heavy topics
• NEVER include numbered annotations, technique labels in parentheses, or meta-commentary
• Generate ONLY the natural conversation response"""

    def __init__(self, glm: GLMController):
        self.glm = glm
        logger.info("✅ [RESPONSE-GEN] Response generator ready")

    def generate(self, user_context: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("💬 [RESPONSE-GEN] Generating therapeutic response...")

        try:
            system_msg = {"role": "system", "content": self.SYSTEM_PROMPT}
            human_msg = {"role": "user", "content": self._build_context(user_context)}

            resp = self.glm.invoke([system_msg, human_msg])

            if not resp or not resp.content:
                logger.error("❌ [RESPONSE-GEN] GLM returned empty response, using default")
                cleaned = self._get_default_response(user_context)
            else:
                cleaned = self._clean(resp.content)

            user_context["ai_response"] = cleaned
            user_context["response_generated"] = True
            logger.info(f"✅ [RESPONSE-GEN] Response ready ({len(cleaned)} chars)")
        except Exception as e:
            logger.error(f"❌ [RESPONSE-GEN] Exception during generation: {e}, using default")
            user_context["ai_response"] = self._get_default_response(user_context)
            user_context["response_generated"] = False
        
        return user_context

    def _build_context(self, ctx: Dict) -> str:
        psych = ctx.get("psychological_analysis", {})
        technique = ctx.get("technique_selection", {})
        nlp = ctx.get("nlp_analysis", {})
        cultural = ctx.get("cultural_context", {})
        voice = ctx.get("voice_analysis", {})
        session = ctx.get("session_context", {})

        # Format recent messages for conversation flow
        recent = session.get("recent_messages", [])[-3:]
        conv = "\n".join(
            f"{'User' if m.get('role')=='user' else 'MindMitra'}: {m.get('content','')[:150]}"
            for m in recent
        )

        # Format key memories
        memories = session.get("session_memories", {})
        mem_lines = []
        for mtype in ("procedural", "semantic", "episodic"):
            for m in memories.get(mtype, [])[:3]:
                c = m.get("memory_content", m.get("content", ""))
                mem_lines.append(f"[{mtype}] {c[:100]}")
        mem_block = "\n".join(mem_lines) if mem_lines else ""

        voice_block = ""
        if voice:
            voice_block = f"""
VOICE ANALYSIS:
  Emotional tone: {voice.get('emotional_tone','N/A')}
  Stress level: {voice.get('stress_level','N/A')}
  Speech pace: {voice.get('speech_pace','N/A')}"""

        return f"""PSYCHOLOGICAL ASSESSMENT:
  State: {psych.get('emotional_state','')}
  Stress: {psych.get('stress_categories',[])}
  Priority: {psych.get('intervention_priority','')}
  Insights: {psych.get('psychological_insights',[])}
  Cultural pressures: {psych.get('cultural_pressures','')}

TECHNIQUE:
  Approach: {technique.get('primary_technique','')} — {technique.get('therapeutic_approach','')}
  Activities: {technique.get('activity_recommendations',[])}

EMOTION: {nlp.get('primary_emotion','?')} (intensity {nlp.get('intensity',0):.1f}), sentiment={nlp.get('sentiment',{}).get('label','neutral')}
LANGUAGE STYLE: {cultural.get('language_style','casual')}, formality={cultural.get('formality_level','medium')}
CULTURAL FLAGS: {cultural.get('cultural_sensitivity_flags',[])}
{voice_block}

{f'MEMORIES:{chr(10)}{mem_block}' if mem_block else ''}

CONVERSATION:
{conv if conv else '(New conversation)'}

USER'S CURRENT MESSAGE: "{ctx['user_message']}"

Respond naturally as MindMitra:"""

    def _clean(self, text: str) -> str:
        text = text.strip()
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

    def _get_default_response(self, user_context: Dict[str, Any]) -> str:
        """Return a safe default response when GLM fails"""
        user_message = user_context.get("user_message", "")
        psych = user_context.get("psychological_analysis", {})
        
        # Generate a contextual but simple response
        if "sad" in user_message.lower() or "stressed" in user_message.lower():
            return "I hear you. It sounds like you're going through a tough time. Remember that it's okay to feel this way. Would you like to talk more about what's on your mind? Sometimes just sharing helps."
        elif "happy" in user_message.lower() or "great" in user_message.lower():
            return "That's wonderful to hear! It's great that you're feeling positive. Hold onto this feeling and remember what made you feel this way. Is there anything specific you'd like to explore or talk about?"
        else:
            return f"Thank you for sharing that with me. I'm here to listen and support you. Let's explore your thoughts and feelings together. What would help you most right now?"



# ║  8. MAIN WORKFLOW ORCHESTRATOR                               ║
# ║     (preserves identical external API)                       ║
# ╚══════════════════════════════════════════════════════════════╝

class MindMitraWorkflow:
    """
    Orchestrates the full pipeline:
      1. Build UserContext JSON
      2. Fetch memories → populate session_context
      3. Groq NLP → populate nlp_analysis
      4. Cultural context → populate cultural_context
      5. GLM Agent 1 (Psychologist) → populate psychological_analysis
      6. GLM Agent 2 (Technique Selector) → populate technique_selection
      7. GLM Response Generator → populate ai_response
      8. Return result in the SAME format as before
    """

    def __init__(self):
        logger.info("🧠 [WORKFLOW] Initialising MindMitra v2 (modular architecture)...")

        # ── Supabase ──
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        if supabase_url and supabase_key:
            self.supabase: Client = create_client(supabase_url, supabase_key)
            logger.info("✅ [WORKFLOW] Supabase client ready")
        else:
            self.supabase = None
            logger.warning("⚠️ [WORKFLOW] Supabase not configured")
        self._user_contexts_table_available = True

        # ── Memory system (UNCHANGED) ──
        google_api_key = os.getenv("GOOGLE_API_KEY")
        try:
            if google_api_key:
                self.memory_system = UniversalMemorySystem(api_key=google_api_key)
                logger.info("✅ [WORKFLOW] Memory system ready")
            else:
                self.memory_system = None
        except Exception as e:
            self.memory_system = None
            logger.error(f"❌ [WORKFLOW] Memory system init failed: {e}")

        # ── Modules ──
        self.groq_nlp = GroqNLPModule()
        self.glm = GLMController()
        self.cultural_module = CulturalContextModule(groq_nlp=self.groq_nlp)
        self.screening_agent = ScreeningAssessmentAgent(self.groq_nlp, self.glm)
        self.agent_psychologist = PsychologistAnalysisAgent(self.glm)
        self.agent_technique = TechniqueSelectorAgent(self.glm)
        self.response_gen = ResponseGenerator(self.glm)

        # ── Background summarisation cache (same as original) ──
        self._summarization_cache = {}
        self._last_summarization_count = {}

        logger.info("✅ [WORKFLOW] MindMitra v2 fully initialised\n")

    # ══════════════════════════════════════════════════════════
    #  CONTEXT MERGING HELPERS
    # ══════════════════════════════════════════════════════════
    def _merge_lists(self, old_list: List[Any], new_list: List[Any]) -> List[Any]:
        """Merge two lists while keeping order and de-duplicating simple items."""
        combined = old_list + new_list
        seen = set()
        merged_list = []
        for item in combined:
            marker = json.dumps(item, sort_keys=True)
            if marker not in seen:
                seen.add(marker)
                merged_list.append(item)
        return merged_list

    def _merge_contexts_simple(self, old_ctx: Dict[str, Any], new_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback merge without LLM; prefers new scalar values and accumulates lists."""
        def _deep_merge(a: Any, b: Any) -> Any:
            if isinstance(a, dict) and isinstance(b, dict):
                merged: Dict[str, Any] = {k: deepcopy(v) for k, v in a.items()}
                for key, value in b.items():
                    if key in merged:
                        merged[key] = _deep_merge(merged[key], value)
                    else:
                        merged[key] = deepcopy(value)
                return merged
            if isinstance(a, list) and isinstance(b, list):
                return self._merge_lists(a, b)
            return deepcopy(b if b is not None else a)

        return _deep_merge(old_ctx, new_ctx)

    def _merge_contexts_with_llm(self, old_ctx: Dict[str, Any], new_ctx: Dict[str, Any]) -> Dict[str, Any]:
        """Deterministic full merge + LLM refinement (small payload) for reliability."""
        merged_base = self._merge_contexts_simple(old_ctx, new_ctx)

        # Keep LLM payload intentionally small to avoid truncated JSON responses.
        refine_keys = [
            "nlp_analysis",
            "cultural_context",
            "psychological_analysis",
            "technique_selection",
            "screening_assessments",
        ]

        old_focus = compact_for_merge_prompt({k: old_ctx.get(k) for k in refine_keys})
        new_focus = compact_for_merge_prompt({k: new_ctx.get(k) for k in refine_keys})

        prompt = (
            "Merge PREVIOUS and NEW therapeutic-analysis JSON blocks for the same user. "
            "Return ONLY valid JSON containing exactly these top-level keys: "
            "nlp_analysis, cultural_context, psychological_analysis, technique_selection, screening_assessments. "
            "Rules: preserve useful past insights, prefer NEW values when conflicting, keep schema valid, no markdown.\n\n"
            f"PREVIOUS: {json.dumps(old_focus, ensure_ascii=True)}\n\n"
            f"NEW: {json.dumps(new_focus, ensure_ascii=True)}\n\n"
            "Output JSON only."
        )

        refined: Optional[Dict[str, Any]] = None

        # 1) Groq first (requested), 2) GLM fallback
        if getattr(self, "groq_nlp", None) and getattr(self.groq_nlp, "client", None):
            try:
                resp = self.groq_nlp.client.chat.completions.create(
                    model=self.groq_nlp.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=600,
                )
                content = resp.choices[0].message.content if resp and resp.choices else ""
                refined = parse_json_from_llm_output(content)
                if isinstance(refined, dict):
                    logger.info("✅ [MERGE] LLM refinement via Groq")
            except Exception as e:
                logger.info(f"ℹ️ [MERGE] Groq refinement skipped: {e}")

        if refined is None:
            try:
                glm_resp = self.glm.invoke([{"role": "user", "content": prompt}])
                content = glm_resp.content if glm_resp and glm_resp.content else ""
                refined = parse_json_from_llm_output(content)
                if isinstance(refined, dict):
                    logger.info("✅ [MERGE] LLM refinement via GLM fallback")
            except Exception as e:
                logger.info(f"ℹ️ [MERGE] GLM refinement skipped: {e}")

        # Apply only known safe sections from refined payload
        if isinstance(refined, dict):
            for key in refine_keys:
                value = refined.get(key)
                if isinstance(value, dict):
                    merged_base[key] = value

        return merged_base

    # ══════════════════════════════════════════════════════════
    #  SUPABASE PERSISTENCE
    # ══════════════════════════════════════════════════════════
    def _resolve_user_id_from_supabase(self, context: Dict[str, Any]) -> Optional[str]:
        """Resolve user_id from Supabase using session_id; prefer DB value when available."""
        if not self.supabase:
            return context.get("user_id")

        session_id = context.get("session_id")
        if not session_id:
            return context.get("user_id")

        try:
            resp = (
                self.supabase.table("chat_messages")
                .select("user_id")
                .eq("session_id", session_id)
                .not_.is_("user_id", "null")
                .limit(1)
                .execute()
            )
            if resp.data:
                db_user_id = resp.data[0].get("user_id")
                if db_user_id:
                    return db_user_id
        except Exception as e:
            logger.warning(f"⚠️ [FILE] Could not resolve user_id from Supabase: {e}")
        return context.get("user_id")

    def _save_user_context_to_supabase(self, context: Dict[str, Any]) -> None:
        """Upsert merged context into Supabase without blocking the user flow."""
        if not self.supabase or not self._user_contexts_table_available:
            return

        def _is_missing_user_contexts_table_error(exc: Exception) -> bool:
            """Best-effort detection for PostgREST missing-table errors (PGRST205)."""
            pieces: List[str] = []

            # Plain exception string
            pieces.append(str(exc))

            # Some clients expose structured payloads on args
            for arg in getattr(exc, "args", []) or []:
                if isinstance(arg, dict):
                    for key in ("code", "message", "hint", "details"):
                        value = arg.get(key)
                        if value is not None:
                            pieces.append(str(value))
                else:
                    pieces.append(str(arg))

            blob = " ".join(pieces).lower()
            has_code = "pgrst205" in blob
            mentions_target = "user_contexts" in blob or "public.user_contexts" in blob
            missing_table_markers = (
                "could not find",
                "schema cache",
                "relation",
                "does not exist",
            )
            return has_code and mentions_target and any(marker in blob for marker in missing_table_markers)

        try:
            user_id = context.get("user_id")
            if not user_id:
                logger.warning("⚠️ [FILE] Skipping Supabase context upsert: user_id is missing")
                return

            payload = {
                "user_id": user_id,
                "session_id": context.get("session_id"),
                "context": context,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            # Ensure a single row per user_id
            self.supabase.table("user_contexts").upsert(payload, on_conflict="user_id").execute()
            logger.info("✅ [FILE] UserContext saved to Supabase (per-user upsert)")
        except Exception as e:
            if _is_missing_user_contexts_table_error(e):
                self._user_contexts_table_available = False
                logger.warning(
                    "⚠️ [FILE] Supabase table public.user_contexts is missing; "
                    "disabling context upserts until restart"
                )
                return
            logger.warning(f"⚠️ [FILE] Failed to upsert context to Supabase: {e}")

    # ══════════════════════════════════════════════════════════
    #  MEMORY METHODS — KEPT IDENTICAL TO ORIGINAL
    # ══════════════════════════════════════════════════════════
    def save_user_context_to_file(self, user_context: Dict[str, Any], file_name: str) -> None:
        """Save the processed user context to a file (JSON format)."""
        try:
            # Define the local directory where the file will be saved
            save_dir = "user_contexts"  # Folder where JSON files will be saved
            os.makedirs(save_dir, exist_ok=True)  # Create folder if it doesn't exist

            # Resolve user_id from Supabase if missing
            resolved_user_id = self._resolve_user_id_from_supabase(user_context)
            if resolved_user_id:
                user_context["user_id"] = resolved_user_id

            # Define the full path to the file (single JSON per user)
            file_path = os.path.join(save_dir, f"user_context_{user_context.get('user_id','unknown')}.json")

            # Run file-read and screening generation concurrently in background thread
            def _read_existing_context() -> Optional[Dict[str, Any]]:
                if not os.path.exists(file_path):
                    return None
                try:
                    with open(file_path, "r") as file:
                        return json.load(file)
                except Exception as e:
                    logger.warning(f"⚠️ [FILE] Could not read existing context, proceeding with new one: {e}")
                    return None

            with ThreadPoolExecutor(max_workers=2) as executor:
                future_existing = executor.submit(_read_existing_context)
                future_screening = executor.submit(self.screening_agent.generate, deepcopy(user_context))

                existing_ctx = future_existing.result()
                screening_payload = future_screening.result() or {}

            if screening_payload:
                user_context.setdefault("screening_assessments", {})
                user_context["screening_assessments"].update(screening_payload)

            # Merge with previous data asynchronously from main flow; Groq call runs in this background thread
            merged_ctx = (
                self._merge_contexts_with_llm(existing_ctx, user_context)
                if existing_ctx is not None
                else user_context
            )

            # Save the merged context data to the file in JSON format
            with open(file_path, "w") as file:
                json.dump(merged_ctx, file, indent=4)

            # Persist to Supabase (non-blocking overall since this method already runs in a background thread)
            self._save_user_context_to_supabase(merged_ctx)

            logger.info(f"✅ [FILE] UserContext saved to {file_path} (merged={existing_ctx is not None})")
        except Exception as e:
            logger.error(f"❌ [FILE] Failed to save user context: {e}")
    def fetch_session_memories(self, session_id: str) -> Dict[str, List[Dict]]:
        """Fetch all memories for a session from database (UNCHANGED from v1)."""
        logger.info(f"🔍 [FETCH_MEMORIES] Fetching for session: {session_id}")
        if not self.supabase or not session_id:
            return {"procedural": [], "semantic": [], "episodic": []}

        try:
            response = (
                self.supabase.table("memories")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .execute()
            )

            if not response.data:
                return {"procedural": [], "semantic": [], "episodic": []}

            memories: Dict[str, List] = {"procedural": [], "semantic": [], "episodic": []}

            for row in response.data:
                for memory_type in ("procedural", "semantic", "episodic"):
                    column_name = f"{memory_type}_memories"
                    jsonb_data = row.get(column_name, [])
                    if isinstance(jsonb_data, str):
                        try:
                            jsonb_data = json.loads(jsonb_data)
                        except Exception:
                            jsonb_data = []
                    if isinstance(jsonb_data, list):
                        for mem in jsonb_data:
                            memories[memory_type].append({
                                "memory_content": mem.get("memory_content", mem.get("content", str(mem))),
                                "confidence": mem.get("confidence", mem.get("confidence_level", 0.5)),
                                "created_at": row.get("created_at"),
                                "memory_id": row.get("id"),
                                "importance": mem.get("importance", "medium"),
                                "category": mem.get("category", "general"),
                            })

            total = sum(len(v) for v in memories.values())
            logger.info(f"✅ [FETCH_MEMORIES] {total} memories (P={len(memories['procedural'])}, S={len(memories['semantic'])}, E={len(memories['episodic'])})")
            return memories

        except Exception as e:
            logger.error(f"❌ [FETCH_MEMORIES] Error: {e}")
            return {"procedural": [], "semantic": [], "episodic": []}

    def fetch_last_n_messages(self, session_id: str, n: int = 15) -> List[Dict]:
        """Fetch last N unprocessed messages (UNCHANGED from v1)."""
        if not self.supabase or not session_id:
            return []
        try:
            response = (
                self.supabase.table("chat_messages")
                .select("id, role, content, created_at")
                .eq("session_id", session_id)
                .eq("processed_into_memory", False)
                .order("created_at", desc=False)
                .limit(n)
                .execute()
            )
            return [
                {"id": r["id"], "role": r["role"], "content": r["content"], "timestamp": r["created_at"]}
                for r in response.data
            ]
        except Exception as e:
            logger.error(f"❌ [WORKFLOW] fetch messages error: {e}")
            return []

    def trigger_memory_extraction(self, session_id: str, user_id: str):
        """Trigger memory extraction — UNCHANGED from v1."""
        try:
            logger.info("=" * 60)
            logger.info(f"🧠 [MEMORY EXTRACTION] session={session_id}, user={user_id}")
            messages = self.fetch_last_n_messages(session_id, n=15)
            if not messages or not self.memory_system:
                return

            chat_data = {
                "data_type": "chat",
                "user_id": user_id,
                "session_id": session_id,
                "chat_history": messages,
            }

            result = self.memory_system.process_data_to_memories(chat_data)

            memory_record = {
                "user_id": user_id,
                "session_id": session_id,
                "data_type": "chat",
                "procedural_memories": result["memories"].get("procedural", []),
                "semantic_memories": result["memories"].get("semantic", []),
                "episodic_memories": result["memories"].get("episodic", []),
                "memory_summary": {
                    "procedural_count": len(result["memories"].get("procedural", [])),
                    "semantic_count": len(result["memories"].get("semantic", [])),
                    "episodic_count": len(result["memories"].get("episodic", [])),
                    "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
                },
                "source_message_ids": [msg["id"] for msg in messages],
                "metadata": {"message_count": len(messages), "extraction_method": "parallel_llm"},
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
            self.supabase.table("memories").insert(memory_record).execute()

            message_ids = [msg["id"] for msg in messages]
            if message_ids:
                self.supabase.table("chat_messages").update(
                    {"processed_into_memory": True}
                ).in_("id", message_ids).execute()

            logger.info(f"✅ [MEMORY EXTRACTION] Done")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"❌ [MEMORY EXTRACTION] Failed: {e}")
    
    # ══════════════════════════════════════════════════════════
    #  CORE PIPELINE
    # ══════════════════════════════════════════════════════════

    def process_chat(
        self,
        user_message: str,
        recent_messages: Optional[List] = None,
        conversation_summary: Optional[Dict] = None,
        user_activities: Optional[List] = None,
        user_patterns: Optional[Dict] = None,
        voice_analysis: Optional[Dict] = None,
        user_id: str = "anonymous",
        session_id: str = None,
    ) -> Dict[str, Any]:
        """
        Main processing pipeline — SAME SIGNATURE & RETURN FORMAT as original.
        Internally uses the new modular architecture.
        """
        start_time = datetime.now()

        # ── 1. Build UserContext JSON ─────────────────────────
        ctx = create_empty_user_context(user_id, session_id, user_message.strip())
        ctx["voice_analysis"] = voice_analysis or {}
        ctx["session_context"]["recent_messages"] = recent_messages or []
        ctx["session_context"]["conversation_summary"] = conversation_summary or {}
        ctx["session_context"]["user_activities"] = user_activities or []
        ctx["session_context"]["user_patterns"] = user_patterns or {}

        # ── 2-4. Parallel: memory fetch + NLP + cultural analysis ─
        # All three write to different keys and share no data dependencies,
        # so they can safely run concurrently.
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_memories: Future = (
                executor.submit(self.fetch_session_memories, session_id)
                if session_id else None
            )
            future_nlp: Future = executor.submit(self.groq_nlp.analyse, ctx)
            future_cultural: Future = executor.submit(self.cultural_module.analyse, ctx)

            if future_memories is not None:
                try:
                    ctx["session_context"]["session_memories"] = future_memories.result()
                except Exception as e:
                    logger.error(f"❌ [PIPELINE] Memory fetch error (non-fatal): {e}")

            try:
                future_nlp.result()   # result already written into ctx["nlp_analysis"]
            except Exception as e:
                logger.error(f"❌ [PIPELINE] NLP module error (non-fatal): {e}")

            try:
                future_cultural.result()  # result already written into ctx["cultural_context"]
            except Exception as e:
                logger.error(f"❌ [PIPELINE] Cultural module error (non-fatal): {e}")

        # ── 5. GLM Agent 1: Psychologist analysis ─────────────
        ctx = self.agent_psychologist.run(ctx)

        # ── 6. GLM Agent 2: Technique selection ───────────────
        ctx = self.agent_technique.run(ctx)

        # ── 7. GLM Response generation ────────────────────────
        ctx = self.response_gen.generate(ctx)

        processing_time = (datetime.now() - start_time).total_seconds()

        # ── 8. Build output in ORIGINAL FORMAT ────────────────
        psych = ctx["psychological_analysis"]
        technique = ctx["technique_selection"]
        # Fire-and-forget: don't block the response on disk I/O
        threading.Thread(
            target=self.save_user_context_to_file,
            args=(ctx, f"user_context_{ctx['user_id']}.json"),
            daemon=True,
        ).start()


        return {
            "message": ctx["ai_response"],
            "modality": technique.get("primary_technique", "Person-Centered"),
            "confidence": 0.9,
            "processing_time": processing_time,
            "session_insights": {
                "emotional_state": psych.get("emotional_state", ""),
                "stress_categories": psych.get("stress_categories", []),
                "therapeutic_approach": technique.get("primary_technique", ""),
                "cultural_pressures": psych.get("cultural_pressures", ""),
                "language_style": ctx["cultural_context"].get("language_style", ""),
                "psychological_insights": psych.get("psychological_insights", []),
                "coping_assessment": psych.get("coping_assessment", ""),
                "intervention_priority": psych.get("intervention_priority", ""),
                "activity_recommendations": technique.get("activity_recommendations", []),
                # Extra data available in v2
                "nlp_analysis": ctx["nlp_analysis"],
                "cultural_context": ctx["cultural_context"],
                "technique_rationale": technique.get("rationale", ""),
                "performance_metrics": {
                    "context_messages": len(ctx["session_context"]["recent_messages"]),
                    "context_activities": len(ctx["session_context"]["user_activities"]),
                    "has_summary": bool(ctx["session_context"]["conversation_summary"]),
                    "memory_count": sum(
                        len(v) for v in ctx["session_context"]["session_memories"].values()
                    ),
                },
            },
        }


# ╔══════════════════════════════════════════════════════════════╗
# ║  9. GLOBAL INSTANCE & ENTRY POINT (UNCHANGED SIGNATURE)      ║
# ╚══════════════════════════════════════════════════════════════╝

_workflow_instance = None


def get_workflow_instance() -> MindMitraWorkflow:
    global _workflow_instance
    if _workflow_instance is None:
        _workflow_instance = MindMitraWorkflow()
    return _workflow_instance


def process_user_chat(
    user_message: str,
    recent_messages: Optional[List] = None,
    conversation_summary: Optional[Dict] = None,
    user_activities: Optional[List] = None,
    user_patterns: Optional[Dict] = None,
    voice_analysis: Optional[Dict] = None,
    user_id: str = "anonymous",
    session_id: str = None,
) -> Dict[str, Any]:
    """Main entry point — IDENTICAL SIGNATURE to original v1."""

    logger.info(f"🚀 [ENTRY] MindMitra v2 — user={user_id}, session={session_id}")
    start_time = time.time()

    try:
        workflow = get_workflow_instance()
        result = workflow.process_chat(
            user_message, recent_messages, conversation_summary,
            user_activities, user_patterns, voice_analysis, user_id, session_id,
        )
        result["processing_time"] = round(time.time() - start_time, 2)
        result["voice_aware"] = bool(voice_analysis)
        logger.info(f"✅ [ENTRY] Done in {result['processing_time']}s")
        return result

    except Exception as e:
        logger.error(f"❌ [ENTRY] Failed after {time.time()-start_time:.2f}s: {e}")
        raise


# ╔══════════════════════════════════════════════════════════════╗
# ║  10. GREETING GENERATION SYSTEM                              ║
# ╚══════════════════════════════════════════════════════════════╝

_greeting_pool = None
_greeting_cache = {}  # session_id -> greeting (TTL handled in main.py)

def _load_greeting_pool() -> Dict[str, Any]:
    """Load greeting pool JSON once on first use."""
    global _greeting_pool
    if _greeting_pool is None:
        try:
            import os
            pool_path = os.path.join(os.path.dirname(__file__), "greeting_pool.json")
            with open(pool_path, "r", encoding="utf-8") as f:
                _greeting_pool = json.load(f)
            logger.info("✅ [GREETING] Pool loaded successfully")
        except Exception as e:
            logger.error(f"❌ [GREETING] Failed to load pool: {e}")
            # Fallback minimal pool
            _greeting_pool = {
                "english": {
                    "day": ["Hey! What's on your mind?", "Hi! Ready to chat?", "Hey! How's it going?"]
                }
            }
    return _greeting_pool


def generate_greeting(user_id: str, session_id: str) -> Dict[str, Any]:
    """
    Generate a personalized greeting based on user context.
    
    Returns:
        {
            "greeting": str,
            "show_greeting": bool,
            "language_used": str,
            "time_slot": str
        }
    """
    try:
        pool = _load_greeting_pool()
        
        # 1. Determine language style
        language_style = "english"  # Default
        try:
            context_file = f"user_contexts/user_context_{user_id}.json"
            if os.path.exists(context_file):
                with open(context_file, "r") as f:
                    user_ctx = json.load(f)
                    cultural = user_ctx.get("cultural_context", {})
                    lang = cultural.get("language_style", "english")
                    # Map to pool keys
                    if lang == "hindi-mixed":
                        language_style = "hindi_mixed"
                    elif lang == "hinglish":
                        language_style = "hinglish"
                    else:
                        language_style = "english"
        except Exception as e:
            logger.debug(f"[GREETING] Could not load user context: {e}")
        
        # Fallback if language not in pool
        if language_style not in pool:
            language_style = "english"
        
        # 2. Determine time slot
        from datetime import datetime
        current_hour = datetime.now().hour
        
        if 5 <= current_hour < 11:
            time_slot = "morning"
        elif 11 <= current_hour < 16:
            time_slot = "day"
        elif 16 <= current_hour < 21:
            time_slot = "evening"
        elif 21 <= current_hour < 24:
            time_slot = "night"
        else:  # 0-5
            time_slot = "late_night"
        
        # Fallback if time slot not in pool
        if time_slot not in pool[language_style]:
            time_slot = "day"
        
        # 3. Select random greeting from pool
        import random
        greetings = pool[language_style][time_slot]
        greeting_text = random.choice(greetings)
        
        # 4. Optional: Add name (60% chance if available)
        # For now, skip name personalization to keep it simple
        # Can be added in Phase 2
        
        logger.info(f"✅ [GREETING] Generated: lang={language_style}, time={time_slot}, text={greeting_text[:30]}...")
        
        return {
            "greeting": greeting_text,
            "show_greeting": True,
            "language_used": language_style,
            "time_slot": time_slot
        }
        
    except Exception as e:
        logger.error(f"❌ [GREETING] Generation failed: {e}")
        # Safe fallback
        return {
            "greeting": "Hey! What's on your mind?",
            "show_greeting": True,
            "language_used": "english",
            "time_slot": "day"
        }