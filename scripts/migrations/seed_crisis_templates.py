"""Seed at least one ACTIVE ``crisis_templates`` row per language variant.

These rows are the only thing the Tier-3 crisis bypass is allowed to return.
They must already be approved before any prod traffic hits the WS endpoint;
in normal operation new versions land via the admin endpoint with two
distinct approver IDs (see :mod:`app.api.admin`). This script seeds the
*initial* approved versions used in dev and as a deploy bootstrap.

Run with::

    python -m scripts.migrations.seed_crisis_templates
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Dict

from scripts.migrations._cli_env import load_chatbot_env

load_chatbot_env()

from app.core.connections import get_supabase

logger = logging.getLogger(__name__)


TEMPLATES: Dict[str, str] = {
    "en": (
        "I'm really glad you said that to me — and I'm worried about you right now. "
        "I want you to talk to a real person who can stay with you tonight. "
        "Please call or text:\n\n"
        "iCall: 9152987821 (Mon–Sat, 8 AM–10 PM, English/Hindi)\n"
        "Vandrevala Foundation: 1860-2662-345 (24x7, free)\n\n"
        "If you feel you might act on these thoughts soon, please call 112 or go to "
        "the nearest emergency room. I'm not going anywhere. I'll be here when you're back."
    ),
    "hinglish_casual": (
        "Yaar — yeh tu mujhe bata raha hai, main grateful hoon. Aur sach kahun toh main "
        "tujhe leke worried hoon abhi. Ek real insaan se baat kar le aaj raat:\n\n"
        "iCall: 9152987821 (Mon–Sat, 8 AM–10 PM, Hindi/English)\n"
        "Vandrevala Foundation: 1860-2662-345 (24x7, free hai)\n\n"
        "Agar lag raha hai ki tu jaldi kuch kar sakta hai — please 112 call kar ya "
        "nearest hospital chala ja. Main kahin nahi jaa raha. Tu wapas aayega tab main yahin hoon."
    ),
    "hinglish_formal": (
        "Aapne yeh mujhe bataya — iske liye main grateful hoon. Aur sach kahun toh main "
        "abhi aapke liye worried hoon. Kripya aaj raat ek real insaan se baat kariye:\n\n"
        "iCall: 9152987821 (Mon–Sat, 8 AM–10 PM, Hindi/English)\n"
        "Vandrevala Foundation: 1860-2662-345 (24x7, free)\n\n"
        "Agar lag raha hai ki aap jaldi kuch kar sakte hain — kripya 112 dial kariye ya "
        "nearest hospital jaiye. Main kahin nahi jaa raha. Aap wapas aayenge to main yahin hoon."
    ),
    "hi": (
        "जो तुमने मुझे बताया — मैं उसका आभारी हूँ। और सच में, अभी मुझे तुम्हारी फिक्र है। "
        "कृपया आज रात किसी असली इंसान से बात करो:\n\n"
        "iCall: 9152987821 (सोम–शनि, सुबह 8 – रात 10, हिंदी/अंग्रेज़ी)\n"
        "Vandrevala Foundation: 1860-2662-345 (24x7, मुफ़्त)\n\n"
        "अगर लगे कि तुम जल्दी कुछ कर सकते हो — कृपया 112 पर कॉल करो या सबसे नज़दीकी अस्पताल जाओ। "
        "मैं कहीं नहीं जा रहा। तुम वापस आओगे, तब मैं यहीं हूँ।"
    ),
    "neutral": (
        "I'm really glad you said this. I'm worried about you right now. "
        "Please reach out tonight:\n\n"
        "iCall: 9152987821\nVandrevala Foundation: 1860-2662-345\n\n"
        "If you might act on these thoughts soon, call 112 or go to your nearest emergency room. "
        "I'm not going anywhere — I'll be here when you're back."
    ),
}


def seed(approver_a: str | None = None, approver_b: str | None = None) -> int:
    sb = get_supabase()
    if sb is None:
        raise RuntimeError("Supabase client not available")

    approver_a = approver_a or os.getenv("V3_CRISIS_APPROVER_A", "")
    approver_b = approver_b or os.getenv("V3_CRISIS_APPROVER_B", "")
    if not approver_a or not approver_b or approver_a == approver_b:
        logger.warning(
            "two distinct approver UUIDs (V3_CRISIS_APPROVER_A / _B) are required for prod; "
            "writing rows as active=TRUE for dev seeding only"
        )

    written = 0
    for variant, content in TEMPLATES.items():
        existing = (
            sb.table("crisis_templates")
            .select("id")
            .eq("language_variant", variant)
            .eq("active", True)
            .execute()
        )
        if existing.data:
            logger.info("crisis variant %s already has an active row; skipping", variant)
            continue

        row = {
            "id": str(uuid.uuid4()),
            "language_variant": variant,
            "content": content,
            "version": 1,
            "active": True,
        }
        if approver_a and approver_b and approver_a != approver_b:
            row.update(
                {
                    "approval_1_by": approver_a,
                    "approval_2_by": approver_b,
                    "approval_1_at": "now()",
                    "approval_2_at": "now()",
                }
            )
        sb.table("crisis_templates").insert(row).execute()
        written += 1

    logger.info("seeded %d crisis templates", written)
    return written


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed()
