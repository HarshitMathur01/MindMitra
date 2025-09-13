from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    user_message: str
    session_data: Dict[str, Any]
    conversation_history: List[Dict[str, Any]]
    mental_state_report: Dict[str, Any]
    selected_modality: str
    conversational_plan: Dict[str, Any]
    critic_verdict: str
    final_response: str
    retry_count: int
    max_retries: int