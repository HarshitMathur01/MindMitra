"""
RAG Memory Retrieval System for MindMitra
Hybrid search combining vector similarity and keyword matching with pgvector
"""
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class MemoryRetriever:
    """
    Retrieves memories using hybrid search (vector + keyword)
    Integrates with Supabase pgvector for efficient similarity search
    """
    
    def __init__(self, supabase_client, embedding_service):
        """
        Args:
            supabase_client: Supabase client instance
            embedding_service: EmbeddingService instance
        """
        self.supabase = supabase_client
        self.embedding_service = embedding_service
        
        logger.info("✅ [RAG] Memory retriever initialized")
    
    def retrieve_global_memories(
        self,
        query: str,
        query_embedding: List[float],
        memory_types: List[str],
        confidence_threshold: float,
        user_id: str,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Retrieve global memories using hybrid search
        
        Args:
            query: Natural language query
            query_embedding: 384-dim embedding vector
            memory_types: List of memory types to search (semantic, procedural)
            confidence_threshold: Minimum confidence score
            user_id: User ID for filtering
            top_k: Maximum results to return
            
        Returns:
            List of memory dicts with content, type, confidence, score
        """
        if not self.supabase:
            logger.warning("⚠️ [RAG] Supabase not available, skipping retrieval")
            return []
        
        logger.info(
            f"🔍 [RAG] Hybrid search: query='{query[:50]}...', "
            f"types={memory_types}, threshold={confidence_threshold:.2f}"
        )
        
        try:
            # Call SQL function for hybrid search
            response = self.supabase.rpc(
                'search_memories_hybrid',
                {
                    'p_embedding': query_embedding,
                    'p_query_text': query,
                    'p_user_id': user_id,
                    'p_memory_types': memory_types,
                    'p_confidence_threshold': confidence_threshold,
                    'p_limit': top_k
                }
            ).execute()
            
            results = response.data if response.data else []
            
            logger.info(f"  → Found {len(results)} global memories")
            
            # Log top results
            if results:
                for i, mem in enumerate(results[:3]):
                    logger.debug(
                        f"    📌 {i+1}. {mem['memory_type']}: {mem['content'][:80]}... "
                        f"(conf={mem['confidence_score']:.2f}, score={mem['combined_score']:.3f})"
                    )
            
            return results
        
        except Exception as e:
            logger.error(f"❌ [RAG] Global memory retrieval failed: {e}")
            return []
    
    def fetch_session_memories(
        self,
        session_id: str,
        memory_types: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Fetch session-level memories (confidence 0.4-0.6)
        
        Args:
            session_id: Current session ID
            memory_types: Memory types to fetch
            
        Returns:
            List of session memory dicts
        """
        if not self.supabase:
            return []
        
        try:
            response = self.supabase.from_('session_memories').select('*').eq(
                'session_id', session_id
            ).in_('memory_type', memory_types).order('created_at').execute()
            
            results = response.data if response.data else []
            
            logger.debug(f"🔍 [RAG] Session memories: found {len(results)} for session")
            
            return results
        
        except Exception as e:
            logger.error(f"❌ [RAG] Session memory fetch failed: {e}")
            return []
    
    def fetch_current_session_episodics(
        self,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """
        Fetch all episodic memories from current session
        
        Args:
            session_id: Current session ID
            
        Returns:
            List of episodic memory dicts
        """
        if not self.supabase:
            return []
        
        try:
            # Query from memories table (existing structure)
            response = self.supabase.from_('memories').select(
                'episodic_memories, created_at'
            ).eq('session_id', session_id).order('created_at').execute()
            
            # Flatten JSONB arrays into list
            episodics = []
            for record in (response.data or []):
                ep_list = record.get('episodic_memories', [])
                if isinstance(ep_list, list):
                    episodics.extend(ep_list)
            
            logger.debug(f"🔍 [RAG] Episodic memories: found {len(episodics)} from current session")
            
            return episodics
        
        except Exception as e:
            logger.error(f"❌ [RAG] Episodic memory fetch failed: {e}")
            return []
    
    def retrieve_memories(
        self,
        query: str,
        query_embedding: List[float],
        memory_types: List[str],
        confidence_threshold: float,
        user_id: str,
        session_id: str,
        top_k: int = 10
    ) -> Dict[str, List[Dict]]:
        """
        Main retrieval method - fetches global + session + episodic memories
        
        Args:
            query: Search query
            query_embedding: Query vector
            memory_types: Types to search
            confidence_threshold: Minimum confidence
            user_id: User ID
            session_id: Session ID
            top_k: Max results
            
        Returns:
            Dict with keys: semantic, procedural, episodic (lists of memories)
        """
        result = {
            'semantic': [],
            'procedural': [],
            'episodic': []
        }
        
        try:
            # Fetch global memories (high confidence)
            if 'semantic' in memory_types or 'procedural' in memory_types:
                global_mems = self.retrieve_global_memories(
                    query, query_embedding, memory_types, 
                    confidence_threshold, user_id, top_k
                )
                
                # Separate by type
                for mem in global_mems:
                    mem_type = mem.get('memory_type', '')
                    if mem_type in result:
                        result[mem_type].append(mem)
            
            # Fetch session memories (medium confidence)
            session_mems = self.fetch_session_memories(session_id, memory_types)
            for mem in session_mems:
                mem_type = mem.get('memory_type', '')
                if mem_type in result:
                    result[mem_type].append(mem)
            
            # Fetch current session episodics
            episodics = self.fetch_current_session_episodics(session_id)
            result['episodic'] = episodics
            
            logger.info(
                f"✅ [RAG] Retrieved total: {len(result['semantic'])} semantic, "
                f"{len(result['procedural'])} procedural, {len(result['episodic'])} episodic"
            )
        
        except Exception as e:
            logger.error(f"❌ [RAG] Memory retrieval failed: {e}")
        
        return result
