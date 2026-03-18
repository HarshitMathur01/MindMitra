import re

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    text = f.read()

# 1. Add import
if "from .crisis_manager import CrisisManager" not in text:
    text = text.replace("from .analysis_engine import AnalysisEngine", "from .analysis_engine import AnalysisEngine\nfrom .crisis_manager import CrisisManager")

# 2. Add instantiation in __init__
init_hook = "self._last_summarization_count: Dict = {}"
if "self.crisis_manager = CrisisManager(" not in text:
    text = text.replace(init_hook, f"{init_hook}\n        self.crisis_manager = CrisisManager(self.groq_nlp, self.supabase)")

# 3. Remove class level constants
text = re.sub(r"    # Crisis keywords that trigger immediate.*?_CRISIS_AMBIGUOUS_KEYWORDS = \((.*?)\)\n", "", text, flags=re.DOTALL | re.MULTILINE)
text = re.sub(r"    # Hardcoded crisis resources.*?_CRISIS_RESPONSE_TEMPLATES: Dict\[str, str\] = \{(.*?)\s{4}\}\n", "", text, flags=re.DOTALL | re.MULTILINE)
# Also clean up any lingering _CRISIS_HARD_KEYWORDS text block
text = re.sub(r"    _CRISIS_HARD_KEYWORDS = \((.*?)\)\n", "", text, flags=re.DOTALL | re.MULTILINE)

# 4. Replace _build_crisis_response
build_crisis_pattern = re.compile(r"    def _build_crisis_response\(self, ctx: Dict\) -> str:.*?(?=    def _check_crisis_keywords)", re.DOTALL | re.MULTILINE)
text = build_crisis_pattern.sub(
    "    def _build_crisis_response(self, ctx: Dict) -> str:\n"
    "        return self.crisis_manager.build_crisis_response(ctx)\n\n", text)

# 5. Replace _check_crisis_keywords
check_crisis_pattern = re.compile(r"    def _check_crisis_keywords\(self, text: str\) -> str:.*?(?=    def _crisis_llm_check)", re.DOTALL | re.MULTILINE)
text = check_crisis_pattern.sub(
    "    def _check_crisis_keywords(self, text: str) -> str:\n"
    "        return self.crisis_manager.check_crisis_keywords(text)\n\n", text)

# 6. Replace _crisis_llm_check
crisis_llm_pattern = re.compile(r"    def _crisis_llm_check\(self, text: str\) -> bool:.*?(?=    def _crisis_fast_path)", re.DOTALL | re.MULTILINE)
text = crisis_llm_pattern.sub(
    "    def _crisis_llm_check(self, text: str) -> bool:\n"
    "        return self.crisis_manager.crisis_llm_check(text)\n\n", text)

# 7. Replace _crisis_fast_path
fast_path_pattern = re.compile(r"    def _crisis_fast_path\(self, ctx: Dict\) -> None:.*?(?=    # ── technique directive lookup)", re.DOTALL | re.MULTILINE)
text = fast_path_pattern.sub(
    "    def _crisis_fast_path(self, ctx: Dict) -> None:\n"
    "        self.crisis_manager.crisis_fast_path(ctx)\n\n", text)

with open("chatbotAgent/app/pipeline/workflow.py", "w") as f:
    f.write(text)
print("Updated workflow.py with CrisisManager")
