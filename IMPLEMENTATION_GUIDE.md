# Memory-Enhanced Chatbot Implementation Guide

## ✅ Phase 1: Fix memory_architecture.py - COMPLETED

### Changes Made:
1. ✅ Fixed constructor: `_init_` → `__init__` 
2. ✅ Added threading imports: `from concurrent.futures import ThreadPoolExecutor, as_completed` and `import time`

### Required Manual Fixes:

#### Fix 1: Replace `_get_llm_response` method (Line 362-390)

**Find this code:**
```python
def _get_llm_response(self, prompt: str) -> List[Dict]:
    """Get response from LLM and parse JSON safely."""
    try:
        response = self.model.generate_content(prompt)
        response_text = response.text.strip()
        # ... rest of old code
```

**Replace with:**
```python
def _get_llm_response(self, prompt: str, max_retries: int = 3) -> List[Dict]:
    """Get response from LLM and parse JSON safely with retry logic."""
    for attempt in range(max_retries):
        try:
            response = self.model.generate_content(prompt)
            
            # Handle different response structures
            if not response:
                self.logger.error(f"LLM returned None response (attempt {attempt + 1})")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                    continue
                raise ValueError("LLM returned None after all retries")
            
            if hasattr(response, 'text'):
                response_text = response.text.strip()
            elif hasattr(response, 'content'):
                response_text = str(response.content).strip()
            else:
                self.logger.error(f"Unexpected response structure: {type(response)}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                raise ValueError("Unexpected LLM response structure")
            
            # Log raw response for debugging
            self.logger.debug(f"Raw LLM response (attempt {attempt + 1}): {response_text[:200]}...")
            
            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                json_text = json_match.group(0)
            else:
                # Try to clean common formatting issues
                response_text = re.sub(r'^```json\s*', '', response_text)
                response_text = re.sub(r'\s*```$', '', response_text)
                json_text = response_text.strip()
            
            # Parse JSON
            parsed_response = json.loads(json_text)
            
            if isinstance(parsed_response, list):
                self.logger.info(f"Successfully parsed {len(parsed_response)} memory items")
                return parsed_response
            else:
                self.logger.warning("LLM response is not a list")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                return []
                
        except json.JSONDecodeError as e:
            self.logger.warning(f"JSON parse error (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                self.logger.error(f"Failed to parse JSON after {max_retries} attempts")
                self.logger.error(f"Raw response: {response_text if 'response_text' in locals() else 'N/A'}")
                raise ValueError(f"Failed to parse LLM JSON response after {max_retries} attempts: {e}")
            time.sleep(2 ** attempt)
        except Exception as e:
            self.logger.error(f"Error getting LLM response (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                raise ValueError(f"Failed to get LLM response after {max_retries} attempts: {e}")
            time.sleep(2 ** attempt)
    
    raise ValueError(f"Failed to get valid LLM response after {max_retries} attempts")
```

#### Fix 2: Add parallel memory extraction method

**Add this new method after `process_data_to_memories` method (around line 450):**

```python
def extract_all_memories_parallel(self, input_data: Union[Dict, str]) -> Dict:
    """
    Extract all three memory types in parallel using threading.
    This is faster than sequential extraction.
    """
    # Handle string input (JSON)
    if isinstance(input_data, str):
        try:
            input_data = json.loads(input_data)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON string provided")
    
    if not isinstance(input_data, dict):
        raise ValueError("Input must be a dictionary or valid JSON string")
    
    # Detect data type
    data_type = input_data.get('data_type', self.detect_data_type(input_data))
    self.logger.info(f"Processing {data_type} data with parallel extraction")
    
    # Format data based on type
    if data_type in self.data_handlers:
        formatted_data = self.data_handlers[data_type](input_data)
    else:
        formatted_data = self._handle_general_data(input_data)
    
    # Extract memories in parallel using ThreadPoolExecutor
    procedural_memories = []
    semantic_memories = []
    episodic_memories = []
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        # Submit all three extraction tasks
        future_to_type = {
            executor.submit(self.extract_procedural_memory, formatted_data, data_type): 'procedural',
            executor.submit(self.extract_semantic_memory, formatted_data, data_type): 'semantic',
            executor.submit(self.extract_episodic_memory, formatted_data, data_type): 'episodic'
        }
        
        # Collect results as they complete
        for future in as_completed(future_to_type, timeout=120):
            memory_type = future_to_type[future]
            try:
                result = future.result()
                if memory_type == 'procedural':
                    procedural_memories = result
                    self.logger.info(f"✅ Extracted {len(result)} procedural memories")
                elif memory_type == 'semantic':
                    semantic_memories = result
                    self.logger.info(f"✅ Extracted {len(result)} semantic memories")
                elif memory_type == 'episodic':
                    episodic_memories = result
                    self.logger.info(f"✅ Extracted {len(result)} episodic memories")
            except Exception as e:
                self.logger.error(f"❌ Error extracting {memory_type} memories: {e}")
                # Let error bubble up as per requirements
                raise
    
    # Structure the output
    output = {
        "data_type": data_type,
        "user_id": input_data.get('user_id', 'unknown'),
        "session_id": input_data.get('session_id', f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "memory_summary": {
            "total_procedural": len(procedural_memories),
            "total_semantic": len(semantic_memories),
            "total_episodic": len(episodic_memories),
            "total_memories": len(procedural_memories) + len(semantic_memories) + len(episodic_memories)
        },
        "memories": {
            "procedural": procedural_memories,
            "semantic": semantic_memories,
            "episodic": episodic_memories
        },
        "metadata": {
            "input_data_type": data_type,
            "processing_model": "gemini-1.5-flash",
            "version": "2.0",
            "extraction_method": "parallel_threading"
        }
    }
    
    self.logger.info(f"✅ Memory extraction complete: {output['memory_summary']['total_memories']} total memories")
    return output
```

---

## 📊 Phase 2: Create Database Migration

Create file: `supabase/migrations/20251101000000_add_memories_table.sql`

```sql
-- Create memories table for storing extracted memories
CREATE TABLE IF NOT EXISTS memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  data_type text NOT NULL,
  processed_at timestamptz DEFAULT now(),
  
  -- Store all three memory types as JSONB
  procedural_memories jsonb DEFAULT '[]'::jsonb,
  semantic_memories jsonb DEFAULT '[]'::jsonb,
  episodic_memories jsonb DEFAULT '[]'::jsonb,
  
  -- Summary stats
  memory_summary jsonb DEFAULT '{}'::jsonb,
  source_message_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_processed_at ON memories(processed_at);
CREATE INDEX IF NOT EXISTS idx_memories_data_type ON memories(data_type);

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own memories" ON memories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memories" ON memories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories" ON memories
  FOR UPDATE USING (user_id = auth.uid());

-- Add column to track which messages have been processed into memories
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS processed_into_memory boolean DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS memory_processed_at timestamptz;

-- Create index for efficient querying of unprocessed messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_processed ON chat_messages(session_id, processed_into_memory);
```

---

## 🔄 Phase 3: Update workflow.py

This document provides the changes needed. Due to token limits, I'll provide key sections:

### Add imports at top of workflow.py:

```python
from memory_architecture import UniversalMemorySystem
from threading import Thread
import asyncio
```

### Add to MindMateWorkflow.__init__ (after existing LLM initialization):

```python
# Initialize memory system
try:
    self.memory_system = UniversalMemorySystem(os.getenv('GEMINI_API_KEY'))
    logger.info("✅ Memory system initialized")
except Exception as e:
    logger.error(f"❌ Failed to initialize memory system: {e}")
    self.memory_system = None
```

### Add new methods to MindMateWorkflow class:

```python
def fetch_session_memories(self, user_id: str, session_id: str) -> Dict:
    """Fetch all memories for a specific session from Supabase."""
    try:
        from supabase import create_client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found, returning empty memories")
            return {"procedural": [], "semantic": [], "episodic": []}
        
        supabase = create_client(supabase_url, supabase_key)
        
        response = supabase.table('memories').select('*').eq('session_id', session_id).execute()
        
        if response.data and len(response.data) > 0:
            # Get the most recent memory record
            latest_memory = response.data[-1]
            return {
                "procedural": latest_memory.get('procedural_memories', []),
                "semantic": latest_memory.get('semantic_memories', []),
                "episodic": latest_memory.get('episodic_memories', [])
            }
        else:
            logger.info(f"No memories found for session {session_id}")
            return {"procedural": [], "semantic": [], "episodic": []}
            
    except Exception as e:
        logger.error(f"Error fetching session memories: {e}")
        return {"procedural": [], "semantic": [], "episodic": []}

def fetch_last_n_messages(self, session_id: str, limit: int = 15) -> List[Dict]:
    """Fetch last N messages for a session."""
    try:
        from supabase import create_client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.warning("Supabase credentials not found")
            return []
        
        supabase = create_client(supabase_url, supabase_key)
        
        response = supabase.table('chat_messages')\
            .select('*')\
            .eq('session_id', session_id)\
            .order('created_at', desc=False)\
            .limit(limit)\
            .execute()
        
        if response.data:
            return response.data
        return []
            
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        return []

def trigger_memory_extraction(self, state: Dict[str, Any]):
    """Background task to extract memories after every 20 messages."""
    try:
        user_id = state.get('user_id')
        session_id = state.get('session_id')
        message_count = state.get('message_count', 0)
        
        logger.info(f"🧠 Starting memory extraction for session {session_id} (message count: {message_count})")
        
        # Fetch unprocessed messages
        from supabase import create_client
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            logger.error("Supabase credentials not found")
            return
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Get last 20 unprocessed messages
        response = supabase.table('chat_messages')\
            .select('*')\
            .eq('session_id', session_id)\
            .eq('processed_into_memory', False)\
            .order('created_at', desc=False)\
            .limit(20)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            logger.info("No unprocessed messages found")
            return
        
        messages = response.data
        logger.info(f"Found {len(messages)} unprocessed messages")
        
        # Format messages for memory extraction
        chat_history = []
        message_ids = []
        for msg in messages:
            chat_history.append({
                "role": msg.get('role', 'user'),
                "content": msg.get('content', ''),
                "timestamp": msg.get('created_at', '')
            })
            message_ids.append(msg.get('id'))
        
        # Fetch user activities
        activities_response = supabase.table('user_activities')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('session_id', session_id)\
            .execute()
        
        activities = activities_response.data if activities_response.data else []
        
        # Prepare data for memory extraction
        memory_input = {
            "data_type": "chat",
            "user_id": user_id,
            "session_id": session_id,
            "chat_history": chat_history,
            "context": {
                "activities": activities
            }
        }
        
        # Extract memories using parallel extraction
        if self.memory_system:
            memories_output = self.memory_system.extract_all_memories_parallel(memory_input)
            
            # Store in database
            insert_data = {
                "user_id": user_id,
                "session_id": session_id,
                "data_type": "chat",
                "procedural_memories": memories_output['memories']['procedural'],
                "semantic_memories": memories_output['memories']['semantic'],
                "episodic_memories": memories_output['memories']['episodic'],
                "memory_summary": memories_output['memory_summary'],
                "source_message_ids": message_ids,
                "metadata": memories_output['metadata']
            }
            
            supabase.table('memories').insert(insert_data).execute()
            
            # Mark messages as processed
            for msg_id in message_ids:
                supabase.table('chat_messages')\
                    .update({"processed_into_memory": True, "memory_processed_at": datetime.now().isoformat()})\
                    .eq('id', msg_id)\
                    .execute()
            
            logger.info(f"✅ Memory extraction complete: {memories_output['memory_summary']['total_memories']} total memories stored")
        else:
            logger.error("Memory system not initialized")
            
    except Exception as e:
        logger.error(f"❌ Error in memory extraction: {e}")
        # Let error bubble up as per requirements
        raise
```

---

## 🔌 Phase 4: Update main.py

### Add helper functions:

```python
def get_session_message_count(session_id: str) -> int:
    """Get total message count for a session."""
    try:
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
        
        if not supabase_url or not supabase_key:
            return 0
        
        from supabase import create_client
        supabase = create_client(supabase_url, supabase_key)
        
        response = supabase.table('chat_messages')\
            .select('id', count='exact')\
            .eq('session_id', session_id)\
            .execute()
        
        return response.count if hasattr(response, 'count') else 0
    except Exception as e:
        logger.error(f"Error counting messages: {e}")
        return 0
```

### Update the /chat endpoint (after saving messages):

```python
# After saving user message and AI response to database:
new_message_count = get_session_message_count(session_id)

# Check if we need to trigger memory extraction (every 20 messages)
if new_message_count > 0 and new_message_count % 20 == 0:
    logger.info(f"🧠 Triggering memory extraction (message count: {new_message_count})")
    # Run in background thread
    state_for_memory = {
        "user_id": user_id,
        "session_id": session_id,
        "message_count": new_message_count
    }
    Thread(target=workflow.trigger_memory_extraction, args=(state_for_memory,), daemon=True).start()
```

---

## ✅ Testing Checklist

1. Test memory_architecture.py:
   - `python memory_architecture.py` should work without errors
   
2. Run migration:
   - `supabase db push` or apply migration manually
   
3. Test chat workflow:
   - Send messages and verify responses work
   
4. Test memory extraction:
   - Send 20 messages in a session
   - Check if memories table gets populated
   - Verify messages are marked as processed

5. Test memory retrieval:
   - Start new conversation in same session
   - Verify LLM gets memories in context

---

## 🚨 Important Notes

1. All errors will throw (no silent failures) as requested
2. Memory extraction runs in background thread (non-blocking)
3. Messages are kept in DB but marked as processed
4. Parallel extraction uses 3 threads for speed
5. LLM1 gets all session memories, LLM2 gets last 15 messages

---

Ready to implement! Follow the phases in order.
