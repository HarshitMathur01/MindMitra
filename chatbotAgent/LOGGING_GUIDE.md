# 🔍 Enhanced Logging Guide - Activities & Memories Tracking

## ✅ What's Been Added

Enhanced logging statements that show:
1. **Whether backend received user activities** ✅/❌
2. **20-word previews of each activity content**
3. **20-word previews of each memory content**
4. **Clear visual indicators** (✅/❌) for data presence

---

## 📊 What You'll See in Logs

### 🎮 **ACTIVITIES LOGGING** (When User Has Played Games)

```
================================================================================
🚀 [MAIN] NEW CHAT REQUEST RECEIVED
================================================================================
👤 [MAIN] User: user_123
🔗 [MAIN] Session: session_abc
💬 [MAIN] Message: 'I feel stressed about exams...'
🎮 [MAIN] User activities: 5 total
✅ [MAIN] ✅ ✅ BACKEND HAS RECEIVED USER ACTIVITIES! ✅ ✅
   Activity breakdown:
   - emotion_match: 2
   - balloon_game: 2
   - memory_challenge: 1

📋 [MAIN] Detailed Activities Content (20 words each):

   Activity #1:
   Type: emotion_match
   Score: 85
   Duration: 45.3
   Difficulty: medium
   Timestamp: 2025-11-02T18:00:00
   📄 Data (20 words): {'emotions_identified': ['happy', 'sad', 'anxious'], 'correct_matches': 8, 'total_questions': 10, 'accuracy': 0.8, 'time_per_question': 4.5, 'difficulty_progression': 'easy_to_medium'}...
   💡 Insights (20 words): User demonstrates strong emotional recognition skills. Particularly good at identifying basic emotions like happy and sad. Some confusion with complex emotions...

   Activity #2:
   Type: balloon_game
   Score: 92
   Duration: 60.0
   Difficulty: hard
   Timestamp: 2025-11-02T18:15:00
   📄 Data (20 words): {'positive_thoughts_collected': 15, 'negative_thoughts_avoided': 12, 'combo_streak': 8, 'power_ups_used': 3, 'game_completion': 100, 'stress_reduction_score': 85}...
   💡 Insights (20 words): Excellent stress management skills shown. User effectively focused on positive thinking and avoided negative patterns. High combo streak indicates sustained concentration...

================================================================================
```

### 🧠 **MEMORIES LOGGING** (After 20+ Messages in Session)

```
================================================================================
🔍 [WORKFLOW] DATA VERIFICATION - What LLM Will Receive
================================================================================
📊 [ACTIVITIES] Total activities received: 5
✅ [ACTIVITIES] ✅ ✅ WORKFLOW RECEIVED ACTIVITIES! ✅ ✅
   - emotion_match: 2 entries
   - balloon_game: 2 entries
   - memory_challenge: 1 entries

📝 [ACTIVITIES] First 3 activities (20 words each):

   Activity #1:
      Type: emotion_match
      Score: 85
      Duration: 45.3
      Difficulty: medium
      Timestamp: 2025-11-02T18:00:00
      📄 Data (20 words): {'emotions_identified': ['happy', 'sad', 'anxious'], 'correct_matches': 8, 'total_questions': 10, 'accuracy': 0.8, 'time_per_question': 4.5}...
      💡 Insights (20 words): User demonstrates strong emotional recognition skills particularly good at identifying basic emotions like happy and sad some confusion with complex emotions...

================================================================================

🧠 [MEMORIES] Fetching memories for session: session_abc
✅ [MEMORIES] ✅ ✅ RETRIEVED 8 MEMORIES! ✅ ✅
   - Procedural: 3
   - Semantic: 2
   - Episodic: 3

📚 [MEMORIES] Memory Content (20 words each):

   🔹 PROCEDURAL MEMORIES (3 total):
      Memory #1:
         📝 Content (20 words): User has developed a consistent pattern of playing emotional recognition games when feeling stressed. Successfully completes balloon game to manage anxiety. Uses...
         🎯 Confidence: 0.85
         📅 Created: 2025-11-02T17:30:00

      Memory #2:
         📝 Content (20 words): User tends to engage with QA tests in the evening after study sessions. Shows preference for challenging difficulty levels. Completes activities...
         🎯 Confidence: 0.78
         📅 Created: 2025-11-02T17:45:00

      Memory #3:
         📝 Content (20 words): Demonstrated ability to maintain focus during memory challenge games. Improves performance with practice. Shows resilience when facing difficult questions and...
         🎯 Confidence: 0.82
         📅 Created: 2025-11-02T18:00:00

   🔹 SEMANTIC MEMORIES (2 total):
      Memory #1:
         📝 Content (20 words): User understands that stress management requires regular practice and engagement with mental wellness activities. Recognizes the importance of emotional awareness for...
         🎯 Confidence: 0.90
         📅 Created: 2025-11-02T17:30:00

      Memory #2:
         📝 Content (20 words): User has knowledge about cognitive behavioral therapy techniques. Demonstrates understanding of the connection between thoughts emotions and behaviors. Applies this...
         🎯 Confidence: 0.87
         📅 Created: 2025-11-02T17:45:00

   🔹 EPISODIC MEMORIES (3 total):
      Memory #1:
         📝 Content (20 words): On November 2nd user expressed feeling overwhelmed about upcoming exams. Particularly worried about mathematics and physics. Mentioned family pressure to...
         🎯 Confidence: 0.88
         📅 Created: 2025-11-02T17:30:00

      Memory #2:
         📝 Content (20 words): User shared a positive experience after completing the balloon game. Reported feeling more relaxed and optimistic. Mentioned it helped distract from...
         🎯 Confidence: 0.85
         📅 Created: 2025-11-02T17:45:00

      Memory #3:
         📝 Content (20 words): During session user discussed conflicts with parents about career choices. Feels torn between personal interests and family expectations. Shows emotional distress...
         🎯 Confidence: 0.92
         📅 Created: 2025-11-02T18:00:00

================================================================================
```

### ❌ **NO ACTIVITIES LOGGING** (When Database is Empty)

```
================================================================================
🚀 [MAIN] NEW CHAT REQUEST RECEIVED
================================================================================
👤 [MAIN] User: user_123
🔗 [MAIN] Session: session_abc
💬 [MAIN] Message: 'Hello, how are you?'
🎮 [MAIN] User activities: 0 total
⚠️ [MAIN] ❌ ❌ NO ACTIVITIES DATA RECEIVED! ❌ ❌
   Check if Edge Function is fetching activities from Supabase
================================================================================

================================================================================
🔍 [WORKFLOW] DATA VERIFICATION - What LLM Will Receive
================================================================================
📊 [ACTIVITIES] Total activities received: 0
⚠️ [ACTIVITIES] ❌ ❌ NO ACTIVITIES IN WORKFLOW! ❌ ❌
   Possible reasons:
   1. User hasn't played any games/QA sessions yet
   2. Data not being fetched from Supabase
   3. Data not being passed from main.py
================================================================================

🧠 [MEMORIES] Fetching memories for session: session_abc
⚠️ [MEMORIES] ❌ No memories found for this session yet
   Memories are created after 20 messages in a session
================================================================================
```

---

## 🎯 How to Test

### Step 1: Check Current Database Status
```bash
cd /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play/chatbotAgent
source ../venv/bin/activate
python test_activities_fetch.py
```

### Step 2: Restart Backend with Enhanced Logging
```bash
# Stop current server (CTRL+C)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Generate Activities
1. Open frontend: http://localhost:5173
2. Play these games:
   - Emotion Match (Games → Emotion Match)
   - Balloon Positivity Game
   - Memory Challenge
   - QA Tests

### Step 4: Test Chat & Watch Logs
1. Go to Chat interface
2. Send a message
3. Watch terminal for:
   - ✅ ✅ BACKEND HAS RECEIVED USER ACTIVITIES! ✅ ✅
   - 20-word previews of each activity
   - Activity breakdown by type

### Step 5: Test Memories (After 20 Messages)
1. Continue chatting (20+ messages)
2. Watch terminal for:
   - ✅ ✅ RETRIEVED X MEMORIES! ✅ ✅
   - 20-word previews of procedural/semantic/episodic memories
   - Memory confidence scores

---

## 🔍 Log Symbols Reference

| Symbol | Meaning |
|--------|---------|
| ✅ ✅ | Data successfully received |
| ❌ ❌ | Data missing or error |
| 🎮 | Activities data |
| 🧠 | Memory system data |
| 📄 | Activity content/data |
| 💡 | Activity insights |
| 📝 | Memory content |
| 🎯 | Confidence score |
| 📅 | Timestamp |
| 🔹 | Memory type section |

---

## 🚨 Troubleshooting

### If You See "NO ACTIVITIES DATA RECEIVED"
1. ✅ Check if games were actually played
2. ✅ Verify data saved to Supabase (run test_activities_fetch.py)
3. ✅ Check Edge Function is passing data to backend
4. ✅ Verify WORKFLOW_URL is set correctly in Edge Function

### If You See "No memories found"
1. ✅ Normal if session has < 20 messages
2. ✅ Check session_id is being passed correctly
3. ✅ Verify memories table exists in Supabase
4. ✅ Check if memory extraction is triggering (every 20 messages)

### If Activities Show 0 Content
1. ✅ Check game saves activity_data field
2. ✅ Verify database schema includes activity_data column
3. ✅ Check gameDataSaver is working in frontend

---

## 📋 Quick Reference

**See Activities?**
```
✅ [MAIN] ✅ ✅ BACKEND HAS RECEIVED USER ACTIVITIES! ✅ ✅
```

**See Memories?**
```
✅ [MEMORIES] ✅ ✅ RETRIEVED 8 MEMORIES! ✅ ✅
```

**No Activities?**
```
⚠️ [MAIN] ❌ ❌ NO ACTIVITIES DATA RECEIVED! ❌ ❌
```

**No Memories Yet?**
```
⚠️ [MEMORIES] ❌ No memories found for this session yet
```

---

## ✨ What This Tells You

With these enhanced logs, you can now:

1. **Instantly see** if backend received activities (✅/❌)
2. **Read 20 words** of each activity's actual content
3. **Read 20 words** of each memory's content
4. **Verify LLM receives** all the context it needs
5. **Debug issues** by seeing exactly what data is missing
6. **Track memory creation** as sessions progress

**Your system is now fully transparent! 🔍**
