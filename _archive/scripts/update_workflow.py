import re

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    text = f.read()

# 1. Add import
if "from .analysis_engine import AnalysisEngine" not in text:
    text = text.replace("import threading", "import threading\nfrom .analysis_engine import AnalysisEngine")

# 2. Replace _activity_context_block
activity_pattern = re.compile(r"    @staticmethod\n    def _activity_context_block\(ctx: Dict, max_items: int = 5\) -> str:.*?(?=    # ── combined emotion \+ cultural analysis)", re.DOTALL | re.MULTILINE)
text = activity_pattern.sub("    @staticmethod\n    def _activity_context_block(ctx: Dict, max_items: int = 5) -> str:\n        return AnalysisEngine.activity_context_block(ctx, max_items)\n\n", text)

# 3. Replace _combined_emotion_cultural_analyse
combo_pattern = re.compile(r"    def _combined_emotion_cultural_analyse\(self, ctx: Dict\) -> Dict:.*?(?=    # ── optimised psychological analysis)", re.DOTALL | re.MULTILINE)
text = combo_pattern.sub("    def _combined_emotion_cultural_analyse(self, ctx: Dict) -> Dict:\n        return AnalysisEngine.combined_emotion_cultural_analyse(self.groq_nlp, ctx)\n\n", text)

# 4. Replace _optimized_psych_analysis
opt_pattern = re.compile(r"    def _optimized_psych_analysis\(self, ctx: Dict\) -> Dict:.*?(?=    # ── Path A: Casual / Light)", re.DOTALL | re.MULTILINE)
text = opt_pattern.sub("    def _optimized_psych_analysis(self, ctx: Dict) -> Dict:\n        return AnalysisEngine.optimized_psych_analysis(self.glm, ctx)\n\n", text)

# 5. _build_voice_context_block
voice_pattern = re.compile(r"    def _build_voice_context_block\(self, ctx: Dict\) -> str:.*?(?=    def _build_crisis_response)", re.DOTALL | re.MULTILINE)
text = voice_pattern.sub("    def _build_voice_context_block(self, ctx: Dict) -> str:\n        return AnalysisEngine.build_voice_context_block(ctx)\n\n", text)

with open("chatbotAgent/app/pipeline/workflow.py", "w") as f:
    f.write(text)
print("Updated workflow.py")
