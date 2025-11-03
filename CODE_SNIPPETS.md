# 🔧 Copy-Paste Ready Code Snippets

## File 1: memory_architecture.py

### Snippet 1: Replace _get_llm_response method (Find line ~362)

**FIND THIS:**
```python
    def _get_llm_response(self, prompt: str) -> List[Dict]:
```

**REPLACE ENTIRE METHOD WITH:**
```python
    def _get_llm_response(self, prompt: str, max_retries: int = 3) -> List[Dict]:
        """Get response from LLM and parse JSON safely with retry logic."""
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)
                
                if not response:
                    self.logger.error(f"LLM returned None response (attempt {attempt + 1})")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)
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
                
                self.logger.debug(f"Raw LLM response (attempt {attempt + 1}): {response_text[:200]}...")
                
                json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if json_match:
                    json_text = json_match.group(0)
                else:
                    response_text = re.sub(r'^```json\s*', '', response_text)
                    response_text = re.sub(r'\s*```$', '', response_text)
                    json_text = response_text.strip()
                
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

---

### Snippet 2: Add new method after process_data_to_memories (around line 450)

**ADD THIS NEW METHOD:**
```python
    def extract_all_memories_parallel(self, input_data: Union[Dict, str]) -> Dict:
        """Extract all three memory types in parallel using threading."""
        if isinstance(input_data, str):
            try:
                input_data = json.loads(input_data)
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON string provided")
        
        if not isinstance(input_data, dict):
            raise ValueError("Input must be a dictionary or valid JSON string")
        
        data_type = input_data.get('data_type', self.detect_data_type(input_data))
        self.logger.info(f"Processing {data_type} data with parallel extraction")
        
        if data_type in self.data_handlers:
            formatted_data = self.data_handlers[data_type](input_data)
        else:
            formatted_data = self._handle_general_data(input_data)
        
        procedural_memories = []
        semantic_memories = []
        episodic_memories = []
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_type = {
                executor.submit(self.extract_procedural_memory, formatted_data, data_type): 'procedural',
                executor.submit(self.extract_semantic_memory, formatted_data, data_type): 'semantic',
                executor.submit(self.extract_episodic_memory, formatted_data, data_type): 'episodic'
            }
            
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
                    raise
        
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

## File 2: workflow.py

### Snippet 1: Add imports at the TOP of the file

**ADD THESE IMPORTS:**
```python
from memory_architecture import UniversalMemorySystem
from threading import Thread
from datetime import datetime
```

### Snippet 2: In __init__ method, after LLM initialization

**ADD THIS:**
```python
        # Initialize memory system
        try:
            self.memory_system = UniversalMemorySystem(os.getenv('GEMINI_API_KEY'))
            logger.info("✅ Memory system initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize memory system: {e}")
            self.memory_system = None
```

### Snippet 3: Add these new methods to the MindMateWorkflow class

**ADD THESE METHODS (copy all three):**

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
            
            from supabase import create_client
            supabase_url = os.getenv('SUPABASE_URL')
            supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not found")
                return
            
            supabase = create_client(supabase_url, supabase_key)
            
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
            
            chat_history = []
            message_ids = []
            for msg in messages:
                chat_history.append({
                    "role": msg.get('role', 'user'),
                    "content": msg.get('content', ''),
                    "timestamp": msg.get('created_at', '')
                })
                message_ids.append(msg.get('id'))
            
            activities_response = supabase.table('user_activities')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('session_id', session_id)\
                .execute()
            
            activities = activities_response.data if activities_response.data else []
            
            memory_input = {
                "data_type": "chat",
                "user_id": user_id,
                "session_id": session_id,
                "chat_history": chat_history,
                "context": {"activities": activities}
            }
            
            if self.memory_system:
                memories_output = self.memory_system.extract_all_memories_parallel(memory_input)
                
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
            raise
```

---

## File 3: main.py

### Snippet 1: Add helper function (add after imports, before @app.post("/chat"))

**ADD THIS FUNCTION:**
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

### Snippet 2: In /chat endpoint, AFTER saving messages to database

**ADD THIS CODE (after you save user message and AI response):**
```python
        # Check if we need to trigger memory extraction (every 20 messages)
        new_message_count = get_session_message_count(request.session_id)
        
        if new_message_count > 0 and new_message_count % 20 == 0:
            logger.info(f"🧠 Triggering memory extraction (message count: {new_message_count})")
            state_for_memory = {
                "user_id": request.user_id,
                "session_id": request.session_id,
                "message_count": new_message_count
            }
            from threading import Thread
            workflow_instance = get_workflow_instance()
            Thread(target=workflow_instance.trigger_memory_extraction, args=(state_for_memory,), daemon=True).start()
```

---

## Quick Start Commands:

```bash
# 1. Apply database migration
cd /Users/harshitmathur/Desktop/MindMate/psyche-prompt-play
supabase db push

# 2. Test memory system
cd chatbotAgent
python memory_architecture.py

# 3. Start backend
python main.py

# 4. Send 20 test messages to trigger memory extraction
```

---

## ✅ Checklist:

- [ ] Replace `_get_llm_response` in memory_architecture.py
- [ ] Add `extract_all_memories_parallel` method in memory_architecture.py
- [ ] Add imports in workflow.py
- [ ] Initialize memory_system in workflow.py __init__
- [ ] Add 3 new methods in workflow.py
- [ ] Add helper function in main.py
- [ ] Add memory trigger code in main.py /chat endpoint
- [ ] Run database migration
- [ ] Test end-to-end

---

ALL CODE IS READY - JUST COPY & PASTE! 🚀
