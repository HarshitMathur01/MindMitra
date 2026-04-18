from app.core.retrieval_spec import RetrievalSpec


def _map(i: str) -> str:
    return {"emotional": "venting"}.get(i, "venting")


def test_retrieval_spec_build():
    s = RetrievalSpec.build(
        query="hello world",
        user_id="u1",
        router_intent="emotional",
        session_count=5,
        current_affect={"valence": -0.2, "intensity": 0.6},
        cl_arc_trajectory="falling",
        session_message_count=3,
        intent_mapper=_map,
    )
    d = s.to_debug_dict()
    assert d["memoir_intent"] == "venting"
    assert d["session_count"] == 5
    assert d["session_message_count"] == 3
    assert d["arc"] == "falling"
    assert d["q_len"] == 11
