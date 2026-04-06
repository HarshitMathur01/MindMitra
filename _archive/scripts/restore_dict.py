import re

dict_str = '''    _TECHNIQUE_DIRECTIVES: Dict[str, str] = {
        "validate": (
            "Focus entirely on making this person feel deeply understood. "
            "Do not offer advice or reframes."
        ),
        "reframe": (
            "Gently offer one alternative way to look at this situation. "
            "Don't push — just open a door."
        ),
        "ground": (
            "Naturally bring their attention to the present moment — "
            "their body, breath, or surroundings."
        ),
        "problem-solve": (
            "Help identify one small, concrete next step they can actually take right now."
        ),
        "refer": (
            "Warmly acknowledge this is bigger than a chat can hold. "
            "Gently and compassionately mention professional support."
        ),
        "psychoeducation": (
            "Share one simple, relatable insight about what they're experiencing. "
            "Keep it accessible, not clinical."
        ),
    }

'''

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    text = f.read()

text = text.replace("    def _technique_directive(self, intervention: str) -> str:", dict_str + "    def _technique_directive(self, intervention: str) -> str:")

with open("chatbotAgent/app/pipeline/workflow.py", "w") as f:
    f.write(text)
print("Restored _TECHNIQUE_DIRECTIVES.")
