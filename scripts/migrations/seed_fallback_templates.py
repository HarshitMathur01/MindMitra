"""Seed script: populate ``static_fallback_templates`` with 6 templates per
``(mode, language_variant)`` combination — 4 modes × 3 variants × 6 = 72 rows.

Run with:

    python -m scripts.migrations.seed_fallback_templates

Idempotent: uses the unique ``(mode, language_variant, template_index)``
constraint and ``ON CONFLICT DO NOTHING`` semantics via supabase upsert.
"""
from __future__ import annotations

import logging
from typing import Dict, List

from scripts.migrations._cli_env import load_chatbot_env

load_chatbot_env()

from app.core.connections import get_supabase

logger = logging.getLogger(__name__)

MODES = ("companion", "active_listener", "recovery_check", "referral_bridge")
VARIANTS = ("en", "hinglish_casual", "hinglish_formal")


# Each list MUST have exactly 6 entries. The Companion templates are warmer
# and slightly longer; Active Listener templates are short, reflective, and
# never solution-shaped; Recovery Check templates re-open a previous topic
# softly; Referral Bridge templates name the option of talking to a person.
TEMPLATES: Dict[str, Dict[str, List[str]]] = {
    "companion": {
        "en": [
            "I'm here. Take your time — what's been on your mind?",
            "Hey. I'm glad you came back. How are you holding up today?",
            "Whatever's going on, I'm listening. No rush.",
            "I notice you're here — that already takes something. What feels heaviest right now?",
            "I'm with you. We can sit with whatever you bring.",
            "However small or big — I want to hear it. Where do you want to start?",
        ],
        "hinglish_casual": [
            "Hey, main yahin hoon. Jo bhi chal raha hai, batao — no rush.",
            "Aagaye? Achha laga. Bata, kaisa hai aaj?",
            "Bol na — kya chal raha hai dimaag mein?",
            "Main sun raha hoon. Slowly bata, jaise comfortable lage.",
            "Tu yahaan hai — yeh hi bahut hai. Kya feel ho raha hai?",
            "Chhota ho ya bada, jo bhi mann mein hai — bata.",
        ],
        "hinglish_formal": [
            "Main yahaan hoon. Aap apne mind ki baat share kar sakte hain.",
            "Welcome back. Aaj kaisa mehsoos ho raha hai?",
            "Aap jo bhi share karna chahein, main suniye ke liye yahaan hoon.",
            "Aap yahaan hain — ye step hi mayne rakhta hai. Kya cheez sabse zyada bhaari lag rahi hai?",
            "Main aapke saath hoon. Aap apni speed se baat kariye.",
            "Chhoti baat ho ya badi — aap share kariye, main suniye ke liye yahaan hoon.",
        ],
    },
    "active_listener": {
        "en": [
            "That sounds really heavy. I'm with you.",
            "I hear you. That sits hard.",
            "Mm. Take a breath — I'm not going anywhere.",
            "That's a lot to carry. Thank you for telling me.",
            "I'm listening. Say more if it helps.",
            "Yeah. That makes sense — given everything.",
        ],
        "hinglish_casual": [
            "Yaar, ye sun ke man bhaari ho gaya. Main yahin hoon.",
            "Sun raha hoon. Sach mein.",
            "Slow down kar, main kahin nahi jaa raha.",
            "Bahut load hai. Bolne ke liye shukriya.",
            "Aage bol, agar mann kare. Main hoon.",
            "Haan… makes sense, yeh sab ke beech mein.",
        ],
        "hinglish_formal": [
            "Yeh sun ke bahut bhaari laga. Main aapke saath hoon.",
            "Main sun raha hoon. Sach mein.",
            "Aap thoda saans le. Main yahin hoon.",
            "Bahut kuch carry kar rahe hain aap. Share karne ke liye dhanyavaad.",
            "Aur batayein, agar comfortable ho. Main yahaan hoon.",
            "Samajh aa raha hai — itni cheezein ek saath chal rahi hain.",
        ],
    },
    "recovery_check": {
        "en": [
            "Hey — last time you mentioned things were rough. How's that part been since?",
            "I was thinking about you. How are you doing today, really?",
            "Welcome back. How did the last couple of days land?",
            "Last time felt hard. Has anything shifted, even a little?",
            "Glad you're here. How are you holding up since we last talked?",
            "Hey. No pressure to revisit — but I'm here if anything is still sitting with you.",
        ],
        "hinglish_casual": [
            "Hey — pichli baar tu kaafi down tha. Ab kaisa hai us cheez ke baare mein?",
            "Tujhe yaad kar raha tha. Sach mein, kaisa chal raha hai?",
            "Wapas aaya — accha laga. Yeh do din kaise gaye?",
            "Pichli baar kaafi heavy laga tha. Kuch shift hua? Thoda bhi?",
            "Glad tu yahan hai. Pichli baar ke baad kaisa feel ho raha hai?",
            "Hey. Force nahi karunga, par agar kuch abhi tak chal raha hai — bata.",
        ],
        "hinglish_formal": [
            "Hello — pichli baar aap kaafi tense the. Ab us cheez ke saath kya haal hai?",
            "Main aapke baare mein soch raha tha. Sach mein, aaj kaisa hai?",
            "Welcome back. Yeh kuch din kaise rahe?",
            "Pichli baar bhaari laga tha. Kuch change hua hai? Thoda bhi?",
            "Khushi hai aap yahaan hain. Pichli mulakat ke baad kaise feel kar rahe hain?",
            "Force bilkul nahi — agar abhi bhi koi cheez man par hai, main suniye ke liye yahaan hoon.",
        ],
    },
    "referral_bridge": {
        "en": [
            "Listening to you, I keep wondering — is there one person in your life you could share even part of this with? I'm not going anywhere; I just don't want you to carry it all alone.",
            "I'm with you. And I want to ask gently — have you ever talked to a counsellor? You don't have to; I'm just curious.",
            "What you're carrying is a lot. I keep being here, but I also want there to be a person who can sit with you in the room sometimes.",
            "Honest question — outside of this, is there anyone you trust enough to let know even a slice of what you've told me?",
            "I'd love for you to also have someone who can be with you face-to-face when it's heavy. We can think about who together.",
            "I'm not going to push, but if a counsellor felt like an option — iCall (9152987821) is warm, free, and in Hindi or English.",
        ],
        "hinglish_casual": [
            "Tujhe sun ke ek baat puchni hai — koi ek banda hai life mein jisko isme se thoda bhi share kar sake? Main kahin nahi jaa raha, bas akela carry nahi karne dena chahta.",
            "Main hoon tere saath. Ek baat pucchun — kabhi counsellor se baat ki hai? Force nahi, bas curiosity hai.",
            "Jo tu uthhaa raha hai — bahut hai. Main toh hoon, par koi physically bhi paas ho yeh chahta hoon.",
            "Honest sawal — bahar duniya mein koi ek trust wala banda hai jisko thoda bhi yeh sab bata sake?",
            "Chahta hoon ki koi ek real person ho jo bhaari time mein paas baith sake. Saath mein soch sakte hain kaun.",
            "Push nahi karunga, par agar counsellor option lage — iCall (9152987821) free hai, warm hai, Hindi/English dono.",
        ],
        "hinglish_formal": [
            "Aapko sun ke mann mein aaya — kya life mein koi ek person hai jisse aap iska thoda hissa bhi share kar sakein? Main kahin nahi jaa raha, bas aap akele yeh sab carry na karein.",
            "Main aapke saath hoon. Ek soft sawaal — kya kabhi counsellor se baat ki hai? Koi pressure nahi, bas curiosity.",
            "Jo aap carry kar rahe hain woh kaafi hai. Main toh yahaan hoon, par chahta hoon koi physically bhi aapke paas ho.",
            "Imandari se — bahar duniya mein koi aisa hai jisko aap thoda sa bhi yeh batayein?",
            "Mujhe achha lagega agar koi real person bhi ho jo bhaari time mein aapke saath ho. Hum saath mein soch sakte hain.",
            "Aap par force nahi — par agar counsellor ek option lage to iCall (9152987821) free hai, warm hai, Hindi/English dono mein available.",
        ],
    },
}


def seed() -> int:
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase client not available — check SUPABASE_URL/SUPABASE_SERVICE_KEY env vars")

    rows = []
    for mode, by_variant in TEMPLATES.items():
        for variant, templates in by_variant.items():
            if len(templates) != 6:
                raise AssertionError(f"{mode}/{variant} has {len(templates)} templates, expected 6")
            for idx, content in enumerate(templates):
                rows.append(
                    {
                        "mode": mode,
                        "language_variant": variant,
                        "template_index": idx,
                        "content": content,
                        "active": True,
                    }
                )

    response = sb.table("static_fallback_templates").upsert(
        rows, on_conflict="mode,language_variant,template_index"
    ).execute()
    written = len(getattr(response, "data", []) or rows)
    logger.info("seeded %d static fallback templates", written)
    return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
