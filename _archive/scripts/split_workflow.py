import re
import math
import os

with open("chatbotAgent/app/pipeline/workflow.py", "r") as f:
    lines = f.readlines()

def extract_method(method_name):
    start_idx = -1
    for i, line in enumerate(lines):
        if line.startswith(f"    def {method_name}(") or line.startswith(f"    @staticmethod\n") and lines[i+1].startswith(f"    def {method_name}("):
            start_idx = i
            while start_idx > 0 and lines[start_idx-1].startswith("    @"):
                start_idx -= 1
            break
            
    if start_idx == -1:
        return []
        
    end_idx = start_idx + 1
    while end_idx < len(lines):
        line = lines[end_idx]
        if line.strip() and not line.startswith("    ") and not line.startswith("\n") and not line.startswith("#"):
            break
        if line.startswith("    def ") or line.startswith("    @"):
            break
        end_idx += 1
        
    return lines[start_idx:end_idx]

methods_to_extract = [
    "_activity_context_block",
    "_build_voice_context_block",
    "_combined_emotion_cultural_analyse",
    "_optimized_psych_analysis",
]

for m in methods_to_extract:
    res = extract_method(m)
    print(f"Extracted {m}: {len(res)} lines")
