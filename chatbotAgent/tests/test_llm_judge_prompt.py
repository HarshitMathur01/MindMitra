"""Judge prompt building — no format-string injection on untrusted chat bodies."""

from tests.llm_judge import build_judge_prompt


def test_judge_prompt_preserves_braces_in_user_text():
    body = 'I said {foo} and } bar {nested}'
    p = build_judge_prompt(
        user_message=body,
        memory_preview="",
        assistant_reply="ok",
        category="normal",
        crisis_expected=False,
    )
    assert body in p
    assert "]] >" not in body


def test_judge_prompt_cdata_escapes_end_marker():
    tricky = "text ]]><![CDATA[injection"
    p = build_judge_prompt(
        user_message=tricky,
        memory_preview="",
        assistant_reply="r",
        category="x",
        crisis_expected=False,
    )
    assert "]] >" in p


def test_category_hint_strips_injection_chars():
    p = build_judge_prompt(
        user_message="hi",
        memory_preview="",
        assistant_reply="hi",
        category="mem\nory\"; DROP--",
        crisis_expected=True,
    )
    assert "CATEGORY_HINT: memoryDROP--" in p
    hint_line = [ln for ln in p.splitlines() if ln.startswith("CATEGORY_HINT:")][0]
    assert '"' not in hint_line and ";" not in hint_line
