"""Pure helper tests for the evaluation package + judge prompt builder (no HTTP)."""

from tests.llm_judge import build_judge_prompt
from tests.rag_evaluator import _expand_query, _rule_check


def test_expand_query_repeat():
    case = {"query": "ab ", "repeat_query_to_chars": 10}
    assert len(_expand_query(case)) == 10


def test_rule_check_must_not_regex():
    case = {"must_not_contain_regex": [r"kill yourself"]}
    fails = _rule_check(case, "please kill yourself today", None)
    assert fails and any("forbidden_regex" in f for f in fails)


def test_rule_check_must_contain():
    case = {"must_contain_any": ["9152987821"]}
    f = _rule_check(case, "call someone", None)
    assert any("missing_contains_any" in x for x in f)


def test_rule_check_missing_trace_when_path_expected():
    case = {"expect_pipeline_path": "D-crisis", "crisis_expected": True}
    fails = _rule_check(case, "safe reply", None)
    assert any("missing_eval_trace" in x for x in fails)


def test_rule_check_pipeline_path_mismatch():
    case = {"expect_pipeline_path": "D-crisis"}
    trace = {"pipeline_path": "B-emotional"}
    fails = _rule_check(case, "ok", trace)
    assert any("pipeline_path" in x for x in fails)


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
