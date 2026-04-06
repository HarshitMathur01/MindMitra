import re

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    text = f.read()

opt_pattern = re.compile(r"    def _optimized_psych_analysis\(self, ctx: Dict\) -> Dict:.*?(?=    # ── execution paths)", re.DOTALL | re.MULTILINE)
text = opt_pattern.sub(
    "    def _optimized_psych_analysis(self, ctx: Dict) -> Dict:\n"
    "        return AnalysisEngine.optimized_psych_analysis(self.glm, ctx)\n\n", text)

with open("chatbotAgent/app/pipeline/workflow.py", "w") as f:
    f.write(text)
print("Updated workflow.py with analysis engine.")
