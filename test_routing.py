import asyncio
import os
from unittest.mock import MagicMock
from chatbotAgent.app.pipeline.workflow import get_workflow_instance

def mock_process():
    print("Getting workflow instance...")
    workflow = get_workflow_instance()
    
    # Optional: Mock external dependencies to prevent actual API calls 
    # but still trace the code path
    if workflow.orchestrator.intent_router:
        workflow.orchestrator.intent_router.classify = MagicMock(return_value={"intent": "casual", "confidence": 0.99})
    if workflow.orchestrator.response_gen:
        def fake_gen(ctx):
            ctx["ai_response"] = "Hello from mock!"
        workflow.orchestrator.response_gen.generate = fake_gen
        
    print("Running process_chat...")
    try:
        res = workflow.process_chat(
            user_message="hello",
            user_id="test_user",
            session_id="test_session"
        )
        print("Success! Result:")
        print(res.keys())
        print(res["message"])
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv("chatbotAgent/.env")
    mock_process()
