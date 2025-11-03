# 🔧 Environment Setup Guide - Memory Integration

## Required Environment Variables

### 1. Backend (FastAPI) - `.env` file in `chatbotAgent/` directory

Create a `.env` file in `/Users/harshitmathur/Desktop/MindMate/psyche-prompt-play/chatbotAgent/.env`:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key-here

# Google Gemini API
GOOGLE_API_KEY=your-google-api-key-here

# Optional: Server Configuration
PORT=8000
HOST=0.0.0.0
```

### 2. Supabase Edge Function - Environment Variables

In your Supabase Dashboard → Edge Functions → Settings, set:

```env
# Backend Workflow URL (use ngrok or your deployed URL)
WORKFLOW_URL=http://localhost:8000/chat

# If using ngrok for testing:
# WORKFLOW_URL=https://your-ngrok-url.ngrok.io/chat

# If deployed to a server:
# WORKFLOW_URL=https://your-backend-domain.com/chat
```

### 3. Frontend - Already configured via Supabase

The frontend gets configuration automatically from Supabase.

---

## 🚀 Setup Steps

### Step 1: Install Backend Dependencies

```bash
cd /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play/chatbotAgent

# Install required packages
pip install supabase google-generativeai

# Or install all dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables

```bash
# Create .env file
cat > .env << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
GOOGLE_API_KEY=your-google-api-key
EOF

# Make sure to replace with your actual values!
```

### Step 3: Verify Database Migration

The migration should already be applied (you ran `supabase db push`). Verify:

```sql
-- Check if memories table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'memories'
);

-- Check if processed_into_memory column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'chat_messages' 
AND column_name = 'processed_into_memory';
```

### Step 4: Start the Backend

```bash
cd /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play/chatbotAgent

# Start FastAPI server
python main.py

# Or with uvicorn (recommended for production)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
✅ [MAIN] Supabase client initialized
✅ [WORKFLOW] Supabase client initialized
✅ [WORKFLOW] Memory system initialized
```

### Step 5: Expose Backend (for Testing)

If testing locally with Supabase Edge Functions:

```bash
# Install ngrok if not already installed
# brew install ngrok (Mac)

# Start ngrok tunnel
ngrok http 8000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Update WORKFLOW_URL in Supabase Edge Function settings
```

### Step 6: Update Edge Function Environment

1. Go to Supabase Dashboard
2. Navigate to Edge Functions
3. Click on `enhanced-chat-context`
4. Go to Settings
5. Add/Update environment variable:
   ```
   WORKFLOW_URL = https://your-ngrok-url.ngrok.io/chat
   ```
6. Redeploy the edge function

### Step 7: Test the Complete Flow

```bash
# Test backend health
curl http://localhost:8000/health

# Expected response:
# {"status":"healthy","service":"mindmate-agent"}

# Test chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_message": "I feel anxious about exams",
    "user_id": "test-user",
    "session_id": "test-session",
    "recent_messages": [],
    "user_activities": [],
    "voice_analysis": {}
  }'
```

---

## 🔍 Verification Checklist

### Backend Checks:
- [ ] `.env` file created with all variables
- [ ] Dependencies installed (`supabase`, `google-generativeai`)
- [ ] Server starts without errors
- [ ] Logs show "✅ Supabase client initialized"
- [ ] Logs show "✅ Memory system initialized"
- [ ] `/health` endpoint returns 200 OK

### Database Checks:
- [ ] `memories` table exists
- [ ] `chat_messages` has `processed_into_memory` column
- [ ] Can query both tables without errors

### Edge Function Checks:
- [ ] `WORKFLOW_URL` environment variable set
- [ ] Edge function can reach backend (check logs)
- [ ] No CORS errors in browser console

### Frontend Checks:
- [ ] Chat messages are sent and received
- [ ] Messages saved to `chat_messages` table
- [ ] AI responses appear in chat
- [ ] Session IDs are maintained

### Memory Integration Checks:
- [ ] After 20 messages, logs show "🔔 Message count (20) is multiple of 20"
- [ ] Logs show "✅ [MEMORY] Extraction complete"
- [ ] `memories` table has new entries
- [ ] Messages marked as `processed_into_memory = true`

---

## 🐛 Troubleshooting

### Issue: "Supabase credentials not found"
**Solution**: Verify `.env` file exists and has correct variable names (`SUPABASE_URL`, `SUPABASE_KEY`)

### Issue: "Memory system initialization failed"
**Solution**: Check `GOOGLE_API_KEY` is set and valid

### Issue: "Edge function can't reach backend"
**Solution**: 
- Verify `WORKFLOW_URL` is set correctly
- If using ngrok, make sure tunnel is active
- Check firewall/network settings

### Issue: "Memory extraction not triggering"
**Solution**:
- Verify message count is being tracked
- Check `chat_messages` table has entries
- Look for errors in backend logs

### Issue: "Database table not found"
**Solution**: Run the migration:
```bash
cd /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play
supabase db push
```

---

## 📊 Architecture Flow

```
Frontend (React)
    ↓
Supabase Edge Function (enhanced-chat-context)
    ↓ [HTTP POST to WORKFLOW_URL]
FastAPI Backend (main.py)
    ↓
MindMateWorkflow (workflow.py)
    ├→ Fetch session memories from database
    ├→ Call LLM1 (Psychological Analyst)
    ├→ Call LLM2 (Therapeutic Responder)
    └→ Check if message_count % 20 == 0
        └→ Trigger memory extraction (background)
            ├→ Fetch last 15 unprocessed messages
            ├→ Extract 3 memory types (parallel)
            ├→ Save to memories table
            └→ Mark messages as processed
```

---

## 🎯 Success Indicators

You'll know everything is working when:

1. **Backend starts successfully** with all initialization logs
2. **Chat works** - messages sent and responses received
3. **After 20 messages** - see memory extraction logs
4. **Database has data** - `memories` table populated
5. **No errors** in browser console or backend logs

---

## 📝 Quick Commands Reference

```bash
# Start backend
cd chatbotAgent && python main.py

# Check backend health
curl http://localhost:8000/health

# View backend logs
tail -f logs/mindmate.log  # if logging to file

# Check database
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM memories;"

# Restart ngrok tunnel
ngrok http 8000

# Update edge function env
# (Do this in Supabase Dashboard → Edge Functions → Settings)
```

---

**Note**: Make sure all three components (Frontend, Edge Function, Backend) are properly connected and have access to the same Supabase project.
