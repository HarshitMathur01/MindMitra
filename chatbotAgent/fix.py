import re

for file in ["memory_store.py", "memory_retriever.py", "memory_reflection.py"]:
    filepath = f"chatbotAgent/app/agents/{file}"
    with open(filepath, "r") as f:
        content = f.read()
    
    # Add logger if missing
    if "logger = logging.getLogger(__name__)" not in content:
        content = content.replace("class Memory", "logger = logging.getLogger(__name__)\n\nclass Memory")

    # Fix intent limits
    if file == "memory_retriever.py":
        bad_intent = "    _INTENT_LIMITS = {\n        'casual': MEMORY_LIMIT_CASUAL,\n        'emotional': MEMORY_LIMIT_EMOTIONAL,\n        'therapeutic': MEMORY_LIMIT_THERAPEUTIC,\n        'crisis': MEMORY_LIMIT_CRISIS,\n    }\n"
        if bad_intent in content:
            content = content.replace(bad_intent, "")
            # insert into class
            content = content.replace("class MemoryRetriever:\n", "class MemoryRetriever:\n" + bad_intent)

    with open(filepath, "w") as f:
        f.write(content)
