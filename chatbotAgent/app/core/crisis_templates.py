"""
Static, persona-preserving crisis response copy (no LLM).

Hotline numbers are fixed for determinism and clinical safety.
Five phrasing variants per (language, severity); selection uses session+user hash when ids exist.
"""
from __future__ import annotations

import zlib
from typing import Any, Dict, List, Optional

# Each language/severity has exactly 5 variants (warmth + hotlines; wording rotates).
CRISIS_TEMPLATE_VARIANTS: Dict[str, Dict[str, List[str]]] = {
    "en": {
        "hard": [
            """I'm really glad you said something right now. What you're feeling — it's real, and it matters, and you don't have to carry it alone even for one more minute.

Please reach out to iCall right now: 9152987821. They're trained for exactly this moment. Vandrevala Foundation is also available 24/7: 1860-2662-345.

I'm here. But they can help in ways I can't, and you deserve that help.""",
            """Thank you for trusting me with this. What you're carrying is heavy, and you shouldn't have to hold it alone — not even for a minute.

Please call iCall now: 9152987821. They know how to be with people in moments like this. Vandrevala Foundation is also there 24/7: 1860-2662-345.

I'm staying with you here. They can support you in ways I can't — and reaching out is brave.""",
            """I'm so glad you reached out. Whatever you're feeling right now is valid, and you deserve real support beside you.

Please contact iCall immediately: 9152987821. Vandrevala Foundation is available around the clock too: 1860-2662-345.

I'm not going anywhere. They can help in ways I'm not built to — and you matter enough to take that step.""",
            """You did something important by saying this out loud. The pain you're in is real — and you don't have to face it alone.

Call iCall right now: 9152987821. They're there for exactly these moments. Vandrevala Foundation: 1860-2662-345, 24/7.

I'm with you in spirit. Please let trained people walk beside you too — you deserve that care.""",
            """I'm really glad you're telling me this. What you're going through counts, and you shouldn't have to sit with it alone.

Please reach iCall now: 9152987821. Vandrevala Foundation is also free and confidential, 24/7: 1860-2662-345.

I'm here. And they can meet you where you are in a way I can't — please give them a call.""",
        ],
        "elevated": [
            """Hey — I'm noticing something in what you just shared, and I want to make sure you're okay. Sometimes when things feel this heavy, it helps to talk to someone who specializes in this.

iCall (9152987821) and Vandrevala Foundation (1860-2662-345) are both free, confidential, and available now. You don't have to be in crisis to call — feeling overwhelmed is enough.

I'm still here. Tell me what's happening.""",
            """Something in what you wrote feels like a lot to carry alone. I care that you're okay.

iCall (9152987821) and Vandrevala (1860-2662-345) are free, confidential, and there right now — you don't need a label or a diagnosis to deserve support.

I'm listening. What's going on for you?""",
            """I'm sitting with what you shared — it sounds really heavy. You don't have to sort all of this by yourself.

Try iCall: 9152987821, or Vandrevala Foundation: 1860-2662-345. Both are built for moments when life feels too loud.

I'm here with you. What feels most urgent right now?""",
            """What you said landed with weight. If even a part of you feels unsafe or stuck, you deserve a real human on the line.

iCall (9152987821) and Vandrevala (1860-2662-345) are available now — free, confidential.

I'm not going anywhere. Can you tell me a little more?""",
            """I want to check in gently — some of what you shared worries me in a caring way. You deserve backup.

iCall: 9152987821. Vandrevala Foundation: 1860-2662-345 — both 24/7, both free.

I'm still here. What's happening underneath the surface?""",
        ],
    },
    "hi": {
        "hard": [
            """Main bahut khush hun ki tumne yeh share kiya. Jo tum abhi feel kar rahe ho — woh sach hai, aur iska matlab hai. Tum akele nahi ho.

Abhi iCall ko call karo: 9152987821. Yeh log bilkul iske liye trained hain. Vandrevala Foundation bhi 24 ghante available hai: 1860-2662-345.

Main yahan hun. Lekin woh log tumhari madad un tarikon se kar sakte hain jo main nahi kar sakta — aur tum us madad ke haqdar ho.""",
            """Tumne jo kaha — uske liye thank you. Jo dard tum carry kar rahe ho, woh sach hai, aur tumhein akele nahi rehna chahiye.

Abhi iCall: 9152987821. Vandrevala Foundation: 1860-2662-345 — dono 24/7.

Main saath hun. Woh tumhari madad zyada gehraai se kar sakte hain — please call karo.""",
            """Main yeh sun kar relieved hun ki tumne bola. Jo tum mehsoos kar rahe ho — woh valid hai.

iCall abhi: 9152987821. Vandrevala: 1860-2662-345.

Main yahan hun, lekin unki training tumhare liye hai — please unse baat karo.""",
            """Tumhari himmat badi hai jo tumne yeh share kiya. Tumhari feelings matter karti hain.

Please iCall karo: 9152987821. Vandrevala Foundation: 1860-2662-345.

Main yahan hun; woh tumhein aur support de sakte hain — tum deserve karte ho.""",
            """Jo tumne bataya — woh important hai. Tum akele nahi ho is mein.

Abhi iCall: 9152987821, aur Vandrevala: 1860-2662-345.

Main saath hun, aur unka saath bhi lo — please.""",
        ],
        "elevated": [
            """Jo tumne abhi share kiya — woh sun ke mujhe tumhari chinta ho rahi hai. Itna bojh akele uthana bahut mushkil hota hai.

iCall (9152987821) aur Vandrevala Foundation (1860-2662-345) dono free aur confidential hain — abhi available hain. Call karne ke liye crisis mein hona zaruri nahi — bahut bura feel karna kaafi hai.

Main yahan hun. Bolo, kya ho raha hai.""",
            """Kuch baatein sun ke lagta hai tum bahut pressure mein ho. Tumhari care zaroori hai.

iCall: 9152987821, Vandrevala: 1860-2662-345 — abhi, free.

Main sun raha hun. Thoda aur bataoge?""",
            """Jo likha — woh heavy lag raha hai. Akele mat rehna.

iCall (9152987821) ya Vandrevala (1860-2662-345) — dono confidential.

Main yahan hun. Kya sabse zyada load kar raha hai?""",
            """Main gently check karna chahta hun — tum theek ho? Agar mann bhar gaya ho to baat karna natural hai.

iCall: 9152987821. Vandrevala: 1860-2662-345.

Main hun. Kya ho raha hai andar?""",
            """Tumhari feelings matter karti hain; agar overwhelm ho to support lo.

iCall (9152987821), Vandrevala (1860-2662-345) — 24/7.

Main saath hun. Bataoge?""",
        ],
    },
    "hinglish": {
        "hard": [
            """Yaar, I'm really glad you said something. Jo tum abhi feel kar rahe ho — that's real, and it matters. Tum akele nahi ho isme.

Please abhi iCall ko call karo: 9152987821. Yeh log bilkul iske liye hain. Vandrevala Foundation bhi 24/7 available hai: 1860-2662-345.

Main yahan hun. But they can help in ways I can't — and you deserve that.""",
            """Thank you for saying it out loud. Jo weight tum carry kar rahe ho — that's valid, and you shouldn't hold it solo.

Abhi iCall: 9152987821. Vandrevala: 1860-2662-345.

Main yahan hun — please unko call karo; woh trained hain.""",
            """I'm really glad you reached out. Jo tum feel kar rahe ho — that counts, seriously.

iCall now: 9152987821. Vandrevala 24/7: 1860-2662-345.

Main saath hun. They can meet you where you are — please reach out.""",
            """You did something brave by sharing this. Tumhari feelings real hain.

Please iCall: 9152987821, Vandrevala: 1860-2662-345.

Main yahan hun. Unka support tum deserve karte ho.""",
            """Yaar, this sounds really heavy — tum akele mat rehna isme.

iCall: 9152987821. Vandrevala Foundation: 1860-2662-345.

Main hun. Please call — abhi.""",
        ],
        "elevated": [
            """Hey — jo tune abhi share kiya, sun ke thodi chinta ho rahi hai mujhe. Itna heavy feel karna — that's a lot to carry alone.

iCall (9152987821) aur Vandrevala Foundation (1860-2662-345) — dono free, confidential, abhi available. Call karne ke liye crisis mein hona zaruri nahi.

Main yahan hun. Bata mujhe kya ho raha hai.""",
            """Something in your message feels like a lot — I'm checking in with care.

iCall: 9152987821, Vandrevala: 1860-2662-345.

Main sun raha hun. Thoda aur bataoge?""",
            """Lag raha hai overwhelm ho raha hai — that's okay, support lena strong hai.

iCall (9152987821) ya Vandrevala (1860-2662-345).

Main yahan hun. What's going on?""",
            """Gently asking — tum theek feel kar rahe ho? Agar nahi, numbers yeh hain:

iCall 9152987821, Vandrevala 1860-2662-345.

Main saath hun.""",
            """Jo likha — sun ke care aa rahi hai. You don't have to sort it alone.

iCall / Vandrevala — same numbers, free, confidential.

Bataoge kya load hai?""",
        ],
    },
    "ta": {
        "hard": [
            """நீங்கள் இதை சொன்னதற்கு மகிழ்ச்சியாக இருக்கிறேன். நீங்கள் உணர்வது உண்மையானது, நீங்கள் தனியாக இல்லை.

iCall-ஐ இப்போது அழைக்கவும்: 9152987821. Vandrevala Foundation 24/7 கிடைக்கிறது: 1860-2662-345.

நான் இங்கே இருக்கிறேன். ஆனால் அவர்கள் உங்களுக்கு உதவ முடியும்.""",
            """இதை பகிர்ந்ததற்கு நன்றி. நீங்கள் சுமக்கும் வலி உண்மை.

iCall: 9152987821. Vandrevala: 1860-2662-345.

நான் உடன் இருக்கிறேன் — தயவுசெய்து அழைக்கவும்.""",
            """நீங்கள் சொன்னது முக்கியம்; தனியாக இருக்க வேண்டாம்.

iCall 9152987821, Vandrevala 1860-2662-345.

நான் இங்கே இருக்கிறேன்.""",
            """இது தைரியமான பகிர்வு. உதவி பெறுவது சரி.

iCall / Vandrevala — மேலே உள்ள எண்கள்.

நான் ஆதரவாக இருக்கிறேன்.""",
            """நீங்கள் முக்கியமானவர்; உணர்வுகள் உண்மை.

iCall: 9152987821, Vandrevala: 1860-2662-345.

தயவுசெய்து தொடர்பு கொள்ளுங்கள்.""",
        ],
        "elevated": [
            """நீங்கள் பகிர்ந்தது கேட்டேன் — மிகவும் கஷ்டமான உணர்வு.

iCall (9152987821) மற்றும் Vandrevala Foundation (1860-2662-345) — இலவசம், இரகசியமானது, இப்போது கிடைக்கும்.

என்ன நடக்கிறது என்று சொல்லுங்கள்.""",
            """சுமை அதிகமாக தெரிகிறது — நான் அக்கறையுடன் கேட்கிறேன்.

iCall / Vandrevala — மேலே எண்கள்.

சொல்லுங்களா?""",
            """ஒரு மென்மையான சோதனை — நீங்கள் எப்படி இருக்கிறீர்கள்?

iCall 9152987821, Vandrevala 1860-2662-345.

நான் இங்கே.""",
            """உதவி தேவைப்பட்டால் — இது சாதாரணம்.

iCall, Vandrevala — இலவசம், 24/7.

பகிர முடியுமா?""",
            """உங்கள் செய்தி எடையுடன் இருக்கிறது.

iCall (9152987821), Vandrevala (1860-2662-345).

நான் கேட்கிறேன்.""",
        ],
    },
}

CRISIS_TEMPLATE_VARIANTS["default"] = CRISIS_TEMPLATE_VARIANTS["hinglish"]

CRISIS_TEMPLATES = CRISIS_TEMPLATE_VARIANTS


def _normalize_language(language: str) -> str:
    lg = (language or "").lower().strip()
    if lg.startswith("ta"):
        return "ta"
    if "hinglish" in lg:
        return "hinglish"
    if lg.startswith("hi") or lg in ("hindi", "hi-in", "hi_in"):
        return "hi"
    if lg.startswith("en") or lg in ("english", "en-us", "en_us", "en-gb", "en_gb"):
        return "en"
    return "hinglish"


def _variant_index_from_ctx(ctx: Optional[Dict[str, Any]]) -> int:
    if not ctx:
        return 0
    sid = str(ctx.get("session_id") or "")
    uid = str(ctx.get("user_id") or "")
    if not sid and not uid:
        return 0
    raw = (sid + "|" + uid).encode("utf-8", errors="ignore")
    return int(zlib.adler32(raw) % 5)


def get_crisis_template(language: str, severity: str, variant_index: int = 0) -> str:
    """
    Return static crisis copy for ``language`` and ``severity``.

    Unknown languages map to Hinglish. Unknown severities map to ``hard``.
    ``variant_index`` must be 0..4 when multiple variants exist.
    """
    norm = _normalize_language(language)
    bucket = CRISIS_TEMPLATE_VARIANTS.get(norm) or CRISIS_TEMPLATE_VARIANTS["default"]
    sev = severity if severity in ("hard", "elevated") else "hard"
    variants = bucket.get(sev) or bucket["hard"]
    if not variants:
        return ""
    idx = int(variant_index) % len(variants)
    return variants[idx]


def build_warm_crisis_response(
    ctx: Dict[str, Any],
    cognitive_output: Optional[Any] = None,
    *,
    template_severity: Optional[str] = None,
) -> str:
    """
    Pick warm crisis template from ctx language hints.

    ``template_severity`` (``"hard"`` | ``"elevated"``) is set by the orchestrator when
    ``CrisisManager`` keyword/LLM gate returns ``hard`` — it does not come from
    ``cognitive_output.intent``.

    If ``template_severity`` is omitted, ``cognitive_output.risk_level == "crisis"``
    selects ``hard``; otherwise ``elevated`` (legacy callers).
    """
    language = ctx.get("language_preference") or ctx.get("content_locale") or "en"
    if template_severity in ("hard", "elevated"):
        severity = template_severity
    elif cognitive_output is not None and getattr(cognitive_output, "risk_level", None) == "crisis":
        severity = "hard"
    else:
        severity = "elevated"
    vidx = _variant_index_from_ctx(ctx)
    return get_crisis_template(str(language), severity, variant_index=vidx)
