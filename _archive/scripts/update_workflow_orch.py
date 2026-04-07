import re

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    text = f.read()

# 1. Add import
if "from .pipeline_orchestrator import PipelineOrchestrator" not in text:
    text = text.replace("from .crisis_manager import CrisisManager", "from .crisis_manager import CrisisManager\nfrom .pipeline_orchestrator import PipelineOrchestrator")

# 2. Update __init__
init_hook = "self.crisis_manager = CrisisManager(self.groq_nlp, self.supabase)"
if "self.orchestrator = PipelineOrchestrator" not in text:
    text = text.replace(
        init_hook,
        init_hook + "\n        self.orchestrator = PipelineOrchestrator(\n"
                    "            self.groq_nlp, self.glm, self.intent_router,\n"
                    "            self.response_gen, self.crisis_manager, self.supabase\n"
                    "        )"
    )

# 3. Strip out the massive chunk of extracted methods using a targeted regex:
# From: @staticmethod\n    def _build_voice_hint(voice: Dict) -> Optional[str]:
# To: the start of process_chat

strip_pattern = re.compile(
    r"    @staticmethod\n    def _build_voice_hint\(voice: Dict\).*?(?=    # ── core pipeline)",
    re.DOTALL | re.MULTILINE
)
text = strip_pattern.sub("", text)

# 4. Update route_and_execute call inside process_chat
text = text.replace("self._route_and_execute(ctx, session_id)", "self.orchestrator.route_and_execute(ctx, session_id)")

with open("chatbotAgent/app/pipeline/workflow.py", "w") as f:
    f.write(text)

print("Updated workflow.py with PipelineOrchestrator")
