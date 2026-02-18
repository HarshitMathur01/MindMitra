# MindMitra Configuration System

## 🎯 Overview

MindMitra now uses a **centralized configuration system** via `config.yaml`. You can modify **all system parameters** without touching the source code—just edit the YAML file.

---

## 📁 Files

- **`config.yaml`** - Main configuration file (edit this!)
- **`config_loader.py`** - Configuration loader (don't edit)
- **`workflow.py`** - Uses config instead of hardcoded values

---

## 🚀 Quick Start

### 1. Edit Configuration

```bash
cd /Users/harshitmathur/Desktop/MindMitra/chatbotAgent
nano config.yaml  # or use any text editor
```

### 2. Change Any Parameter

```yaml
# Example: Change NLP model
nlp_module:
  model: "meta-llama/llama-4-scout-17b-16e-instruct"  # Changed!
  temperature: 0.2  # Changed!

# Example: Adjust RAG retrieval
rag_memory:
  retrieval:
    top_k: 10  # Retrieve more memories
    vector_weight: 0.8  # More emphasis on vector similarity
```

### 3. Restart Server

```bash
uvicorn main:app --reload
```

**No code changes needed!** Configuration is loaded automatically.

---

## 📋 Configuration Sections

### 1. API Keys

```yaml
api_keys:
  groq_api_key: ${GROQ_API_KEY}  # Reads from environment
  zai_api_key: ${ZAI_API_KEY}
  google_api_key: ${GOOGLE_API_KEY}
```

**Note:** `${VAR_NAME}` syntax reads from environment variables. You can also hardcode keys directly (not recommended for production).

---

### 2. NLP Module (Groq)

```yaml
nlp_module:
  enabled: true
  model: "qwen/qwen3-32b"
  temperature: 0.1
  max_tokens: 400
```

**Available Models:**
- `qwen/qwen3-32b` (default, 4K context)
- `meta-llama/llama-4-scout-17b-16e-instruct` (8K context)
- `moonshotai/kimi-k2-instruct-0905` (4K context)

---

### 3. Cultural Context

```yaml
cultural_module:
  enabled: true
  deep_analysis_enabled: true
  deep_analysis_model: "llama-3.3-70b-versatile"
  
  # Which cultural issues to detect
  detect_cultural_flags:
    - parental_pressure
    - exam_stress
    - career_anxiety
    - social_pressure
```

**Disable deep analysis** to save API calls:
```yaml
deep_analysis_enabled: false
```

---

### 4. GLM Controller (ZhipuAI)

```yaml
glm_controller:
  model: "glm-4-32b-0414-128k"
  max_concurrent: 1  # Number of parallel GLM calls
  max_retries: 2
  base_backoff: 2.0  # Exponential backoff (seconds)
  temperature: 0.3
  top_p: 0.8
```

**For faster responses** (less quality):
```yaml
model: "glm-4-flash"
temperature: 0.5
```

---

### 5. RAG Memory System

#### 5.1 Query Decision

```yaml
rag_memory:
  query_decision:
    # Trigger conditions
    triggers:
      emotional_intensity_threshold: 0.5  # Lower = trigger more
      reference_keywords:
        - "again"
        - "like before"
        - "remember"
```

**To trigger memory retrieval more often:**
```yaml
emotional_intensity_threshold: 0.3  # Trigger at lower intensity
```

#### 5.2 Retrieval Settings

```yaml
rag_memory:
  retrieval:
    # Hybrid search weights
    vector_weight: 0.7  # 70% semantic similarity
    keyword_weight: 0.3  # 30% keyword matching
    
    # How many memories to retrieve
    top_k: 5
    max_semantic: 3
    max_procedural: 3
    max_episodic: 2
```

**For more context-aware responses:**
```yaml
top_k: 10  # Retrieve more memories
vector_weight: 0.8  # Rely more on semantic search
```

#### 5.3 Memory Extraction

```yaml
rag_memory:
  memory_extraction:
    enabled: true
    interval: 12  # Extract every N messages
```

**To extract more frequently:**
```yaml
interval: 6  # Extract every 6 messages
```

---

### 6. Agent Configuration

#### Psychologist Agent

```yaml
psychologist_agent:
  max_memories_per_type: 4  # Memories in prompt
  max_activities: 5
  recent_messages_count: 5
```

**For richer context:**
```yaml
max_memories_per_type: 8
recent_messages_count: 10
```

#### Technique Selector

```yaml
technique_selector_agent:
  available_techniques:
    - CBT
    - ACT
    - MBCT
    - DBT
  include_voice_analysis: true
```

**To prioritize specific techniques:**
```yaml
available_techniques:
  - CBT  # Listed first = higher priority
  - ACT
```

#### Response Generator

```yaml
response_generator:
  recent_messages_count: 3
  max_memories_per_type: 3
  
  # Customize system prompt
  system_prompt: |
    You are MindMitra...
```

---

### 7. Feature Flags

**Enable/disable entire features:**

```yaml
features:
  nlp_analysis: true
  cultural_context: true
  rag_memory_retrieval: true
  screening_assessments: true
  background_memory_extraction: true
  voice_analysis_support: true
  save_to_supabase: true
```

**Example: Disable RAG for testing:**
```yaml
features:
  rag_memory_retrieval: false  # Skip all RAG processing
```

---

### 8. Performance Tuning

```yaml
performance:
  max_user_message_length: 2000
  groq_timeout: 30
  glm_timeout: 60
  requests_per_minute: 60
```

**For high-traffic:**
```yaml
glm_controller:
  max_concurrent: 3  # More parallel calls
performance:
  requests_per_minute: 120
```

---

## 🔧 Common Use Cases

### Use Case 1: Reduce API Costs

```yaml
# Use cheaper models
nlp_module:
  model: "qwen/qwen3-32b"  # Instead of Llama 70B

glm_controller:
  model: "glm-4-flash"  # Cheaper than glm-4-32b

# Disable optional features
cultural_module:
  deep_analysis_enabled: false

features:
  screening_assessments: false
```

### Use Case 2: Maximize Context Awareness

```yaml
# Retrieve more memories
rag_memory:
  retrieval:
    top_k: 10
    max_semantic: 5
    max_procedural: 5

# Include more history
psychologist_agent:
  max_memories_per_type: 8
  recent_messages_count: 10

response_generator:
  recent_messages_count: 5
```

### Use Case 3: Development/Testing Mode

```yaml
# Disable expensive features
features:
  rag_memory_retrieval: false
  screening_assessments: false
  background_memory_extraction: false

# Enable debugging
debug:
  print_prompts: true
  save_prompts: true
  log_timing: true

logging:
  level: "DEBUG"
```

### Use Case 4: Production Optimization

```yaml
# Parallel processing
glm_controller:
  max_concurrent: 2

workflow:
  max_workers: 5
  parallel_processing: true

# Caching
features:
  context_caching: true

workflow:
  summarization:
    cache_enabled: true
```

---

## 🧪 Testing Configuration Changes

### 1. Test Config Loader

```bash
python3 config_loader.py
```

**Output:**
```
NLP Model: qwen/qwen3-32b
GLM Model: glm-4-32b-0414-128k
RAG Enabled: True
Configuration loaded successfully!
```

### 2. Test Workflow Import

```bash
python3 -c "from workflow import MindMitraWorkflow; print('✅ Success')"
```

### 3. Check Specific Config Value

```python
from config_loader import config

# Check any config value
print(config.get("nlp_module.model"))
print(config.get("rag_memory.retrieval.top_k"))
print(config.is_enabled("features.rag_memory_retrieval"))
```

---

## 📊 Configuration Reference

### Quick Access Methods

```python
from config_loader import config

# Get model names
config.get_model("nlp")        # NLP module model
config.get_model("glm")        # GLM controller model
config.get_model("embedding")  # Embedding model

# Get API keys
config.get_api_key("groq")
config.get_api_key("zai")

# Get temperatures
config.get_temperature("nlp")
config.get_temperature("glm")

# Check features
config.is_enabled("features.rag_memory_retrieval")
config.is_enabled("features.screening_assessments")

# Get sections
rag_config = config.get_section("rag_memory")
workflow_config = config.get_section("workflow")
```

---

## 🔄 Configuration Reload

To reload configuration without restarting:

```python
from config_loader import config

# Reload from file
config.reload()
```

**Note:** Most components cache config values at initialization, so you'll still need to restart the server for changes to take full effect.

---

## ⚠️ Important Notes

### 1. Environment Variables

The config uses `${VAR_NAME}` syntax to read environment variables:

```yaml
api_keys:
  groq_api_key: ${GROQ_API_KEY}
```

This reads from `.env` file or system environment. If not set, it will be empty string.

### 2. Model Availability

Not all models are available on all API tiers. Check your Groq/ZhipuAI account limits.

### 3. Performance Impact

- Higher `max_memories_per_type` = longer prompts = slower/more expensive
- Lower `emotional_intensity_threshold` = more frequent RAG queries = more DB load
- Higher `max_concurrent` = faster but more API quota usage

### 4. Feature Dependencies

Some features depend on others:
- RAG requires `embeddings_service` initialized
- Screening requires Groq client
- Memory extraction requires Google API key

Disabling a dependency will cascade to dependent features.

---

## 🐛 Troubleshooting

### Config not loading

```bash
# Check file exists
ls -la config.yaml

# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('config.yaml'))"
```

### API keys not working

```bash
# Check environment variables
echo $GROQ_API_KEY
echo $ZAI_API_KEY

# Check .env file
cat .env | grep API_KEY
```

### Feature not disabled

Some features check config at **initialization time**. Restart the server after config changes.

---

## 📝 Example Configurations

### Minimal Config (Low Cost)

```yaml
nlp_module:
  enabled: true
  model: "qwen/qwen3-32b"

glm_controller:
  model: "glm-4-flash"

features:
  rag_memory_retrieval: false
  screening_assessments: false
  background_memory_extraction: false

cultural_module:
  deep_analysis_enabled: false
```

### Full Featured Config (Production)

```yaml
nlp_module:
  enabled: true
  model: "meta-llama/llama-4-scout-17b-16e-instruct"

glm_controller:
  model: "glm-4-32b-0414-128k"
  max_concurrent: 2

features:
  rag_memory_retrieval: true
  screening_assessments: true
  background_memory_extraction: true

rag_memory:
  retrieval:
    top_k: 10
```

---

## 🎓 Best Practices

1. **Version Control** - Commit `config.yaml` with default values
2. **Environment-specific** - Use `.env` for API keys (not in config.yaml)
3. **Document Changes** - Add comments in YAML explaining custom settings
4. **Test After Changes** - Run workflow import test after modifications
5. **Monitor Performance** - Check logs for timing after tuning parameters

---

## 📚 Additional Resources

- **Config Loader API**: See `config_loader.py` docstrings
- **Workflow Integration**: See workflow.py initialization
- **Agent Configuration**: See individual agent `__init__` methods

---

**Last Updated:** February 18, 2026
**Config Version:** 1.0
**MindMitra Version:** 2.0 (Modular Architecture)
