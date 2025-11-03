# MindMate Chatbot Agent - Memory-Enhanced Psychology Workflow

A FastAPI-based psychology chatbot with intelligent memory integration for Indian youth mental wellness.

## 🧠 Architecture

- **2-Agent Psychology Workflow**: Analyst (Gemini 1.5 Pro) → Responder (Gemini 1.5 Flash)
- **Memory System**: Automatic extraction of procedural, semantic, and episodic memories every 20 messages
- **Parallel Processing**: 3 LLM calls simultaneously for memory extraction
- **Context-Aware**: Uses past memories to inform therapeutic responses

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
GOOGLE_API_KEY=your-google-api-key
```

### 3. Start Server

```bash
python main.py
```

Server starts on `http://localhost:8000`

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "mindmate-agent"
}
```

### Chat
```bash
POST /chat
Content-Type: application/json

{
  "user_message": "I feel anxious about exams",
  "user_id": "user-123",
  "session_id": "session-456",
  "recent_messages": [],
  "user_activities": [],
  "voice_analysis": {}
}
```

Response:
```json
{
  "message": "I understand exam anxiety can be overwhelming...",
  "modality": "CBT",
  "confidence": 0.9,
  "processing_time": 2.5,
  "session_insights": {
    "emotional_state": "anxious",
    "stress_categories": ["academic"],
    "therapeutic_approach": "CBT"
  }
}
```

## 🧩 Components

### main.py
- FastAPI entry point
- Handles `/chat` and `/health` endpoints
- Triggers memory extraction every 20 messages
- Manages Supabase connection

### workflow.py
- 2-agent psychology workflow
- Fetches session memories from database
- Calls LLM1 (Psychological Analyst) and LLM2 (Therapeutic Responder)
- Background memory extraction

### memory_architecture.py
- Universal memory extraction system
- Supports multiple data types (chat, game, activity, learning)
- Parallel memory extraction with ThreadPoolExecutor
- Retry logic with exponential backoff

## 🔄 Memory Extraction Flow

1. **Trigger**: After every 20 messages in a session
2. **Fetch**: Last 15 unprocessed messages from database
3. **Extract**: 3 memory types in parallel:
   - **Procedural**: Skills, techniques, coping strategies
   - **Semantic**: Facts, preferences, goals
   - **Episodic**: Past experiences, significant events
4. **Save**: Store in `memories` table
5. **Mark**: Set `processed_into_memory = TRUE` on messages

## 📊 Memory Types

### Procedural Memory
```json
{
  "type": "procedural",
  "category": "technique",
  "content": "4-7-8 breathing technique",
  "steps": ["Inhale for 4", "Hold for 7", "Exhale for 8"],
  "triggers": ["anxiety", "stress"],
  "effectiveness": "high"
}
```

### Semantic Memory
```json
{
  "type": "semantic",
  "category": "preference",
  "content": "Prefers morning study sessions",
  "confidence": 0.9,
  "importance": "medium",
  "related_concepts": ["academic", "productivity"]
}
```

### Episodic Memory
```json
{
  "type": "episodic",
  "event_description": "Overcame presentation anxiety",
  "context": {
    "temporal": "Last week",
    "emotional_state": "anxious then confident"
  },
  "outcome": "Successful presentation",
  "significance": "high"
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon key |
| `GOOGLE_API_KEY` | Yes | Google Gemini API key |
| `PORT` | No | Server port (default: 8000) |

### Workflow Settings

Located in `workflow.py`:

```python
# LLM configuration
model="gemini-2.5-flash-lite"
max_tokens=300
temperature=0.3

# Memory extraction threshold
MEMORY_EXTRACTION_INTERVAL = 20  # messages
MESSAGES_TO_PROCESS = 15  # last N messages
```

## 📝 Logging

All logs include prefixes for easy filtering:

- `[MAIN]` - FastAPI endpoints
- `[WORKFLOW]` - Workflow execution
- `[MEMORY]` - Memory extraction
- `[EDGE]` - Edge function calls (if integrated)

Example:
```
✅ [MAIN] Supabase client initialized
🧠 [WORKFLOW] Memory system initialized
🔔 [MAIN] Message count (20) is multiple of 20
🧠 [MEMORY] Triggering memory extraction
✅ [MEMORY] Extraction complete: 12 memories saved
```

## 🐛 Troubleshooting

### "Supabase credentials not found"
- Verify `.env` file exists
- Check variable names are exact (case-sensitive)
- Restart server after adding credentials

### "Memory system initialization failed"
- Verify `GOOGLE_API_KEY` is valid
- Check API quota not exceeded
- Ensure google-generativeai package installed

### Memory extraction not triggering
- Check message count: `SELECT COUNT(*) FROM chat_messages WHERE session_id = 'xxx'`
- Verify `processed_into_memory` column exists
- Look for errors in logs

## 📚 Dependencies

Main packages:
- `fastapi` - Web framework
- `supabase` - Database client
- `google-generativeai` - Gemini LLM
- `langchain` - LLM orchestration
- `langgraph` - Agent workflow
- `pydantic` - Data validation

See `requirements.txt` for full list.

## 🧪 Testing

### Manual Test
```bash
# Health check
curl http://localhost:8000/health

# Send message
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "I feel anxious",
    "user_id": "test",
    "session_id": "test-session"
  }'
```

### Verify Memory Extraction
1. Send 20 messages to same session
2. Check logs for "🔔 Message count (20)"
3. Query database: `SELECT * FROM memories LIMIT 5;`

## 📦 File Structure

```
chatbotAgent/
├── main.py                  # FastAPI entry point
├── workflow.py              # 2-agent psychology workflow
├── memory_architecture.py   # Memory extraction system
├── requirements.txt         # Python dependencies
├── .env                     # Environment variables (create this)
└── models/                  # Pydantic models
    ├── __init__.py
    ├── schemas.py          # Request/response schemas
    └── state.py            # Workflow state models
```

## 🔐 Security

- Never commit `.env` file
- Use environment variables for all secrets
- Rotate API keys regularly
- Use HTTPS in production
- Validate all user inputs
- Sanitize database queries

## 🚀 Production Deployment

1. **Server Setup**: Deploy on AWS/GCP/Azure
2. **Environment**: Set all required env variables
3. **Database**: Ensure migrations applied
4. **Monitoring**: Set up logging/alerting
5. **HTTPS**: Enable SSL/TLS
6. **Scaling**: Use gunicorn/uvicorn workers

Example production start:
```bash
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## 📖 Documentation

- [FINAL_STATUS.md](../FINAL_STATUS.md) - Complete architecture overview
- [ENV_SETUP_GUIDE.md](../ENV_SETUP_GUIDE.md) - Environment setup
- [IMPLEMENTATION_COMPLETE.md](../IMPLEMENTATION_COMPLETE.md) - Implementation details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

See LICENSE file in root directory.

## 👥 Authors

- **MindMate Team** - Mental wellness platform for Indian youth
- **Implementation**: GitHub Copilot (October 2025)

## 🔗 Links

- Frontend: `../src/`
- Edge Functions: `../supabase/functions/`
- Database Migrations: `../supabase/migrations/`

---

**Last Updated**: October 31, 2025  
**Version**: 2.0.0 (Memory Integration)  
**Status**: 🟢 Production Ready
