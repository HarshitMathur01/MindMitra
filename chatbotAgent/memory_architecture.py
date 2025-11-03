"""

procedural, semantic, and episodic memories

"""

import json
import google.generativeai as genai
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional, Union
import logging
import os
import re
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class MemoryItem:
    """Base class for memory items"""
    type: str
    content: str
    confidence: float
    timestamp: str
    source_type: str

@dataclass
class ProceduralMemory(MemoryItem):
    """Procedural memory for skills, strategies, and processes"""
    category: str
    steps: List[str]
    triggers: List[str]
    effectiveness: str
    last_used: Optional[str]
    
@dataclass
class SemanticMemory(MemoryItem):
    """Semantic memory for facts, concepts, and knowledge"""
    category: str
    related_concepts: List[str]
    importance: str
    source: str
    
@dataclass
class EpisodicMemory(MemoryItem):
    """Episodic memory for events and experiences"""
    event_description: str
    context: Dict[str, Any]
    emotional_intensity: int
    significance: str
    outcome: str

class UniversalMemorySystem:
    """
    Universal memory system that can process various types of input data
    into procedural, semantic, and episodic memories using Gemini LLM.
    """
    
    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash"):
        """Initialize the memory system with Gemini API."""
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("Please provide a valid Gemini API key")
            
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Data type handlers
        self.data_handlers = {
            'chat': self._handle_chat_data,
            'game': self._handle_game_data,
            'activity': self._handle_activity_data,
            'learning': self._handle_learning_data,
            'general': self._handle_general_data
        }
    
    def detect_data_type(self, input_data: Dict) -> str:
        """Automatically detect the type of input data."""
        if 'chat_history' in input_data or 'messages' in input_data:
            return 'chat'
        elif any(key in input_data for key in ['game_sessions', 'gameplay', 'achievements', 'player_actions']):
            return 'game'
        elif any(key in input_data for key in ['activities', 'events', 'actions']):
            return 'activity'
        elif any(key in input_data for key in ['lessons', 'courses', 'learning_progress']):
            return 'learning'
        else:
            return 'general'
    
    def _handle_chat_data(self, data: Dict) -> str:
        """Format chat/conversation data for processing."""
        messages = data.get('chat_history', data.get('messages', []))
        formatted = []
        
        for msg in messages:
            role = msg.get('role', 'unknown')
            content = msg.get('content', str(msg.get('text', '')))
            timestamp = msg.get('timestamp', '')
            formatted.append(f"[{timestamp}] {role}: {content}")
        
        context = data.get('context', {})
        if context:
            formatted.append(f"\nContext: {json.dumps(context, indent=2)}")
            
        return "\n".join(formatted)
    
    def _handle_game_data(self, data: Dict) -> str:
        """Format game data for processing."""
        formatted = ["=== GAME DATA ==="]
        
        # Player info
        if 'player' in data:
            player = data['player']
            formatted.append(f"Player: {player.get('name', 'Unknown')}")
            formatted.append(f"Level: {player.get('level', 'N/A')}")
            formatted.append(f"Experience: {player.get('experience', 'N/A')}")
        
        # Game sessions
        if 'game_sessions' in data:
            formatted.append("\n--- Game Sessions ---")
            for session in data['game_sessions']:
                formatted.append(f"Session {session.get('id', 'N/A')}: {session.get('duration', 'N/A')} minutes")
                if 'actions' in session:
                    for action in session['actions']:
                        formatted.append(f"  - {action.get('type', 'action')}: {action.get('description', '')}")
        
        # Achievements
        if 'achievements' in data:
            formatted.append("\n--- Achievements ---")
            for achievement in data['achievements']:
                formatted.append(f"✓ {achievement.get('name', 'Unknown')}: {achievement.get('description', '')}")
        
        # Player actions
        if 'player_actions' in data:
            formatted.append("\n--- Player Actions ---")
            for action in data['player_actions']:
                timestamp = action.get('timestamp', '')
                action_type = action.get('type', 'action')
                description = action.get('description', '')
                formatted.append(f"[{timestamp}] {action_type}: {description}")
        
        return "\n".join(formatted)
    
    def _handle_activity_data(self, data: Dict) -> str:
        """Format activity/event data for processing."""
        formatted = ["=== ACTIVITY DATA ==="]
        
        activities = data.get('activities', data.get('events', []))
        for activity in activities:
            formatted.append(f"Activity: {activity.get('name', activity.get('type', 'Unknown'))}")
            formatted.append(f"Time: {activity.get('timestamp', activity.get('time', 'N/A'))}")
            formatted.append(f"Description: {activity.get('description', '')}")
            
            if 'participants' in activity:
                formatted.append(f"Participants: {', '.join(activity['participants'])}")
            
            if 'outcome' in activity:
                formatted.append(f"Outcome: {activity['outcome']}")
            
            formatted.append("---")
        
        return "\n".join(formatted)
    
    def _handle_learning_data(self, data: Dict) -> str:
        """Format learning/educational data for processing."""
        formatted = ["=== LEARNING DATA ==="]
        
        if 'courses' in data:
            for course in data['courses']:
                formatted.append(f"Course: {course.get('name', 'Unknown')}")
                formatted.append(f"Progress: {course.get('progress', 'N/A')}%")
                
                if 'lessons' in course:
                    for lesson in course['lessons']:
                        formatted.append(f"  Lesson: {lesson.get('title', 'N/A')}")
                        formatted.append(f"  Completed: {lesson.get('completed', False)}")
        
        if 'learning_progress' in data:
            progress = data['learning_progress']
            formatted.append(f"\nOverall Progress: {progress.get('completion_rate', 'N/A')}%")
            formatted.append(f"Skills Acquired: {', '.join(progress.get('skills', []))}")
        
        return "\n".join(formatted)
    
    def _handle_general_data(self, data: Dict) -> str:
        """Format general dictionary data for processing."""
        def format_dict(d, indent=0):
            formatted = []
            for key, value in d.items():
                if isinstance(value, dict):
                    formatted.append(f"{'  ' * indent}{key}:")
                    formatted.extend(format_dict(value, indent + 1))
                elif isinstance(value, list):
                    formatted.append(f"{'  ' * indent}{key}:")
                    for item in value:
                        if isinstance(item, dict):
                            formatted.extend(format_dict(item, indent + 1))
                        else:
                            formatted.append(f"{'  ' * (indent + 1)}- {item}")
                else:
                    formatted.append(f"{'  ' * indent}{key}: {value}")
            return formatted
        
        return "\n".join(format_dict(data))
    
    def extract_procedural_memory(self, formatted_data: str, data_type: str) -> List[Dict]:
        """Extract procedural memory from formatted data."""
        
        type_specific_context = {
            'chat': "therapeutic techniques, coping strategies, communication skills",
            'game': "gameplay strategies, skill combinations, progression techniques, game mechanics",
            'activity': "activity procedures, workflow processes, task methodologies",
            'learning': "study techniques, problem-solving methods, learning strategies",
            'general': "processes, procedures, step-by-step methods, systematic approaches"
        }
        
        context = type_specific_context.get(data_type, type_specific_context['general'])
        
        prompt = f"""
        Analyze the following {data_type} data and extract PROCEDURAL MEMORY items.
        
        Focus on {context} that represent learnable skills or processes.
        
        Procedural memory includes:
        - Step-by-step processes and procedures
        - Skills and techniques that can be practiced
        - Strategies and approaches for achieving goals
        - Systematic methods and workflows
        - Behavioral patterns that can be replicated
        
        Data:
        {formatted_data}
        
        Return ONLY a JSON array of procedural memory items with this exact format:
        [
            {{
                "type": "procedural",
                "category": "strategy|technique|skill|process|method",
                "content": "detailed description of the procedure/skill",
                "steps": ["step 1", "step 2", "step 3"],
                "triggers": ["when to use this"],
                "effectiveness": "high|medium|low|unknown",
                "last_used": "YYYY-MM-DD or null",
                "confidence_level": 0.0-1.0,
                "source_type": "{data_type}"
            }}
        ]
        
        If no procedural memories are found, return an empty array [].
        """
        
        return self._get_llm_response(prompt)
    
    def extract_semantic_memory(self, formatted_data: str, data_type: str) -> List[Dict]:
        """Extract semantic memory from formatted data."""
        
        type_specific_context = {
            'chat': "personal facts, preferences, relationships, mental health concepts",
            'game': "game knowledge, player preferences, character abilities, game world facts",
            'activity': "activity preferences, skill levels, social connections, interests",
            'learning': "knowledge concepts, subject mastery, learning preferences, academic facts",
            'general': "facts, concepts, preferences, relationships, knowledge"
        }
        
        context = type_specific_context.get(data_type, type_specific_context['general'])
        
        prompt = f"""
        Analyze the following {data_type} data and extract SEMANTIC MEMORY items.
        
        Focus on {context} that represent factual knowledge.
        
        Semantic memory includes:
        - Facts and concepts
        - Personal preferences and characteristics
        - Knowledge about subjects, systems, or domains
        - Relationships and social connections
        - Identity information and attributes
        - Goals, values, and beliefs
        
        Data:
        {formatted_data}
        
        Return ONLY a JSON array of semantic memory items with this exact format:
        [
            {{
                "type": "semantic",
                "category": "personal_fact|concept|preference|relationship|goal|knowledge",
                "content": "the factual information or concept",
                "confidence": 0.0-1.0,
                "source": "stated|inferred|observed",
                "related_concepts": ["concept1", "concept2"],
                "importance": "high|medium|low",
                "last_updated": "YYYY-MM-DD",
                "source_type": "{data_type}"
            }}
        ]
        
        If no semantic memories are found, return an empty array [].
        """
        
        return self._get_llm_response(prompt)
    
    def extract_episodic_memory(self, formatted_data: str, data_type: str) -> List[Dict]:
        """Extract episodic memory from formatted data."""
        
        type_specific_context = {
            'chat': "personal experiences, emotional episodes, significant conversations",
            'game': "gameplay events, achievements, memorable moments, game experiences",
            'activity': "specific events, activities participated in, memorable experiences",
            'learning': "learning experiences, breakthrough moments, educational milestones",
            'general': "specific events, experiences, memorable moments, significant occurrences"
        }
        
        context = type_specific_context.get(data_type, type_specific_context['general'])
        
        prompt = f"""
        Analyze the following {data_type} data and extract EPISODIC MEMORY items.
        
        Focus on {context} that represent specific, memorable events.
        
        Episodic memory includes:
        - Specific events and experiences
        - Memorable moments with context
        - Significant occurrences with outcomes
        - Personal narratives and stories
        - Events with emotional or practical significance
        
        Data:
        {formatted_data}
        
        Return ONLY a JSON array of episodic memory items with this exact format:
        [
            {{
                "type": "episodic",
                "event_description": "what happened",
                "context": {{
                    "temporal": "when it happened",
                    "location": "where it happened if known",
                    "participants": ["person1", "person2"],
                    "emotional_state": "emotional context"
                }},
                "outcome": "result or resolution",
                "emotional_intensity": 1-10,
                "significance": "high|medium|low",
                "learned_from": "insights or lessons gained",
                "date_discussed": "YYYY-MM-DD",
                "source_type": "{data_type}"
            }}
        ]
        
        If no episodic memories are found, return an empty array [].
        """
        
        return self._get_llm_response(prompt)
    
    def _get_llm_response(self, prompt: str, max_retries: int = 3, retry_delay: int = 2) -> List[Dict]:
        """
        Get response from LLM with retry logic and robust JSON parsing.
        
        Args:
            prompt: The prompt to send to the LLM
            max_retries: Maximum number of retry attempts
            retry_delay: Delay in seconds between retries
            
        Returns:
            List of dictionaries containing memory items
            
        Raises:
            Exception: If all retries fail or critical error occurs
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)
                response_text = response.text.strip()
                
                # Clean up markdown code blocks and common artifacts
                response_text = re.sub(r'^```json\s*', '', response_text)
                response_text = re.sub(r'^```\s*', '', response_text)
                response_text = re.sub(r'\s*```$', '', response_text)
                response_text = response_text.strip()
                
                # Try to extract JSON from text if wrapped
                json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
                if json_match:
                    response_text = json_match.group(0)
                
                # Parse JSON
                parsed_response = json.loads(response_text)
                
                # Validate response structure
                if isinstance(parsed_response, list):
                    return parsed_response
                else:
                    self.logger.warning(f"LLM response is not a list (attempt {attempt + 1}/{max_retries}), got type: {type(parsed_response)}")
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay)
                        continue
                    else:
                        raise ValueError("LLM response is not a list after all retries")
                    
            except json.JSONDecodeError as e:
                last_error = e
                self.logger.error(f"JSON parse error (attempt {attempt + 1}/{max_retries}): {e}")
                self.logger.debug(f"Raw response: {response_text}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    raise Exception(f"Failed to parse LLM JSON response after {max_retries} attempts: {e}")
                    
            except Exception as e:
                last_error = e
                self.logger.error(f"Error getting LLM response (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    raise Exception(f"Failed to get LLM response after {max_retries} attempts: {e}")
        
        # Should not reach here, but just in case
        raise Exception(f"Failed to get valid LLM response: {last_error}")

    def extract_all_memories_parallel(self, formatted_data: str, data_type: str) -> Dict[str, List[Dict]]:
        """
        Extract all three memory types in parallel using ThreadPoolExecutor.
        
        Args:
            formatted_data: The formatted data string to extract memories from
            data_type: Type of data being processed
            
        Returns:
            Dictionary with keys 'procedural', 'semantic', 'episodic' containing memory lists
            
        Raises:
            Exception: If any extraction fails
        """
        memories = {
            'procedural': [],
            'semantic': [],
            'episodic': []
        }
        
        # Create tasks for parallel execution
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Submit all three extraction tasks
            future_to_type = {
                executor.submit(self.extract_procedural_memory, formatted_data, data_type): 'procedural',
                executor.submit(self.extract_semantic_memory, formatted_data, data_type): 'semantic',
                executor.submit(self.extract_episodic_memory, formatted_data, data_type): 'episodic'
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_type):
                memory_type = future_to_type[future]
                try:
                    result = future.result()
                    memories[memory_type] = result
                    self.logger.info(f"Extracted {len(result)} {memory_type} memories")
                except Exception as e:
                    self.logger.error(f"Error extracting {memory_type} memories: {e}")
                    raise Exception(f"Failed to extract {memory_type} memories: {e}")
            print("Episodic , procedural and semantic memory parallely computed")
        return memories
    
    def process_data_to_memories(self, input_data: Union[Dict, str]) -> Dict:
        """
        Main function to process any type of input data into memories.
        
        Args:
            input_data: Dictionary containing data to process, or JSON string
            
        Returns:
            Dictionary with extracted memories in structured format
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
        self.logger.info(f"Processing {data_type} data")
        
        # Format data based on type
        if data_type in self.data_handlers:
            formatted_data = self.data_handlers[data_type](input_data)
        else:
            formatted_data = self._handle_general_data(input_data)
        
        # Extract memories in parallel
        self.logger.info("Extracting all memory types in parallel...")
        all_memories = self.extract_all_memories_parallel(formatted_data, data_type)
        
        procedural_memories = all_memories['procedural']
        semantic_memories = all_memories['semantic']
        episodic_memories = all_memories['episodic']
        
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
                "auto_detected_type": data_type == self.detect_data_type(input_data)
            }
        }
        
        self.logger.info(f"Processing complete: {output['memory_summary']['total_memories']} total memories extracted")
        return output
    
    def save_memories_to_file(self, memories: Dict, output_path: str):
        """Save processed memories to JSON file."""
        try:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(memories, f, indent=2, ensure_ascii=False)
            self.logger.info(f"Memories saved to {output_path}")
        except Exception as e:
            self.logger.error(f"Failed to save memories: {e}")
            raise
    
    def load_memories_from_file(self, file_path: str) -> Dict:
        """Load memories from JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self.logger.warning(f"Memory file not found: {file_path}")
            return {"memories": {"procedural": [], "semantic": [], "episodic": []}}
        except Exception as e:
            self.logger.error(f"Failed to load memories: {e}")
            raise
    
    def merge_memories(self, existing_memories: Dict, new_memories: Dict) -> Dict:
        """Simple merge of existing and new memories."""
        merged = existing_memories.copy()
        
        for memory_type in ['procedural', 'semantic', 'episodic']:
            if memory_type in new_memories.get('memories', {}):
                existing_list = merged.setdefault('memories', {}).setdefault(memory_type, [])
                existing_list.extend(new_memories['memories'][memory_type])
        
        merged['last_updated'] = new_memories.get('processed_at', datetime.now(timezone.utc).isoformat())
        merged['total_sessions'] = merged.get('total_sessions', 0) + 1
        
        return merged


def create_sample_data():
    """Create sample data for different input types."""
    
    samples = {
        'chat_sample': {
            "data_type": "chat",
            "user_id": "user_123",
            "session_id": "session_456",
            "chat_history": [
                {
                    "role": "user",
                    "content": "I've been practicing the breathing technique you taught me. It really helps when I feel anxious.",
                    "timestamp": "2024-01-15T10:30:00Z"
                },
                {
                    "role": "assistant",
                    "content": "That's wonderful to hear! The 4-7-8 breathing technique can be very effective for anxiety management. How often are you using it?",
                    "timestamp": "2024-01-15T10:30:30Z"
                },
                {
                    "role": "user", 
                    "content": "Usually when I feel overwhelmed at work. Yesterday I used it before a big presentation and it worked great.",
                    "timestamp": "2024-01-15T10:31:00Z"
                }
            ],
            "context": {
                "therapy_stage": "active_treatment",
                "primary_concerns": ["anxiety", "work_stress"]
            }
        },
        
        'game_sample': {
            "data_type": "game",
            "user_id": "player_789",
            "session_id": "game_session_123",
            "player": {
                "name": "DragonSlayer42",
                "level": 15,
                "experience": 2450,
                "class": "Warrior"
            },
            "game_sessions": [
                {
                    "id": "gs_001",
                    "duration": 45,
                    "actions": [
                        {"type": "combat", "description": "Defeated fire dragon using shield bash combo"},
                        {"type": "exploration", "description": "Discovered hidden treasure room"},
                        {"type": "social", "description": "Formed alliance with wizard NPC"}
                    ]
                }
            ],
            "achievements": [
                {"name": "Dragon Slayer", "description": "Defeat 10 dragons", "unlocked": "2024-01-15"},
                {"name": "Treasure Hunter", "description": "Find 50 hidden items", "unlocked": "2024-01-14"}
            ],
            "player_actions": [
                {
                    "timestamp": "2024-01-15T14:30:00Z",
                    "type": "strategy_use",
                    "description": "Used hit-and-run tactics to defeat boss without taking damage"
                }
            ]
        },
        
        'learning_sample': {
            "data_type": "learning", 
            "user_id": "student_456",
            "session_id": "study_session_789",
            "courses": [
                {
                    "name": "Python Programming",
                    "progress": 75,
                    "lessons": [
                        {"title": "Functions and Modules", "completed": True, "score": 95},
                        {"title": "Object-Oriented Programming", "completed": True, "score": 87}
                    ]
                }
            ],
            "learning_progress": {
                "completion_rate": 75,
                "skills": ["Python", "Problem Solving", "Debugging"],
                "study_techniques": ["Pomodoro Technique", "Active Recall", "Spaced Repetition"]
            },
            "study_session": {
                "duration": 120,
                "focus_areas": ["OOP concepts", "Code debugging"],
                "breakthrough_moment": "Finally understood inheritance and polymorphism"
            }
        },
        
        'activity_sample': {
            "data_type": "activity",
            "user_id": "user_999",
            "session_id": "activity_log_001", 
            "activities": [
                {
                    "name": "Morning Workout",
                    "type": "exercise",
                    "timestamp": "2024-01-15T07:00:00Z",
                    "description": "30-minute HIIT workout focusing on cardio and strength",
                    "participants": ["user_999"],
                    "outcome": "Felt energized and accomplished"
                },
                {
                    "name": "Team Meeting",
                    "type": "work",
                    "timestamp": "2024-01-15T10:00:00Z", 
                    "description": "Weekly project sync with development team",
                    "participants": ["user_999", "Alice", "Bob", "Charlie"],
                    "outcome": "Clarified project timeline and assigned tasks"
                }
            ]
        },
        
        'general_sample': {
            "user_id": "general_user_001",
            "personal_info": {
                "name": "Alex",
                "age": 28,
                "interests": ["reading", "hiking", "cooking"]
            },
            "recent_experiences": [
                {
                    "event": "Completed first marathon",
                    "date": "2024-01-10",
                    "feelings": "proud and exhausted",
                    "learned": "Consistent training and mental preparation are key"
                }
            ],
            "goals": {
                "short_term": ["Learn Spanish", "Read 12 books this year"],
                "long_term": ["Travel to South America", "Start own business"]
            },
            "preferences": {
                "communication_style": "direct but friendly",
                "learning_style": "visual and hands-on"
            }
        }
    }
    
    return samples


def main():
    """Main function demonstrating the universal memory system."""
    
    # Configuration
    API_KEY = os.getenv('GEMINI_API_KEY', 'your_gemini_api_key_here')
    print(API_KEY)
    if API_KEY == 'your_gemini_api_key_here':
        print("Please set your GEMINI_API_KEY environment variable or update the API_KEY variable")
        print("Example: export GEMINI_API_KEY='your_actual_api_key'")
        return
    
    # Initialize the memory system
    try:
        memory_system = UniversalMemorySystem(API_KEY)
        print("✅ Memory system initialized successfully!")
    except ValueError as e:
        print(f"❌ Error initializing memory system: {e}")
        return
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return
    
    # Create and process sample data
    samples = create_sample_data()
    
    print("\n🧠 Universal Memory System Demo")
    print("=" * 50)
    
    for sample_name, sample_data in samples.items():
        print(f"\n📊 Processing {sample_name}...")
        
        try:
            # Process the sample data
            processed_memories = memory_system.process_data_to_memories(sample_data)
            
            # Display results
            summary = processed_memories['memory_summary']
            print(f"   Data Type: {processed_memories['data_type']}")
            print(f"   Procedural Memories: {summary['total_procedural']}")
            print(f"   Semantic Memories: {summary['total_semantic']}")
            print(f"   Episodic Memories: {summary['total_episodic']}")
            print(f"   Total Memories: {summary['total_memories']}")
            
            # Save to file
            output_file = f"memories_{sample_name}{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
            memory_system.save_memories_to_file(processed_memories, output_file)
            print(f"   💾 Saved to: {output_file}")
            
        except Exception as e:
            print(f"   ❌ Error processing {sample_name}: {e}")
    
    print(f"\n✨ Demo completed! Check the generated JSON files for detailed memory extraction results.")
    
    # Example of processing custom data
    print(f"\n📝 Example of processing custom data:")
    custom_data = {
        "user_id": "custom_user",
        "custom_field": "This is custom data",
        "events": [
            {"name": "Learning new skill", "description": "Learned to play guitar"}
        ]
    }
    
    try:
        result = memory_system.process_data_to_memories(custom_data)
        print(f"   Custom data processed successfully! Type detected: {result['data_type']}")
        print(f"   Total memories extracted: {result['memory_summary']['total_memories']}")
    except Exception as e:
        print(f"   Error processing custom data: {e}")


if __name__ == "__main__":
    main()
