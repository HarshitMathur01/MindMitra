import logging
from typing import Any, Dict, List, Optional

from .memory_store import MemoryStore
from .memory_retriever import MemoryRetriever
from .memory_reflection import MemoryReflection

logger = logging.getLogger(__name__)

class MemoryManager:
    def __init__(self):
        self.store = MemoryStore()
        self.retriever = MemoryRetriever(self.store)
        self.reflection = MemoryReflection(self.store, self.retriever)
        
    @property
    def is_ready(self) -> bool:
        return self.store.is_ready

    def add_memories(self, *args, **kwargs):
        return self.store.add_memories(*args, **kwargs)

    def retrieve_memories(self, *args, **kwargs):
        return self.retriever.retrieve_memories(*args, **kwargs)

    def save_session_summary(self, *args, **kwargs):
        return self.reflection.save_session_summary(*args, **kwargs)

    def load_session_summary(self, *args, **kwargs):
        return self.reflection.load_session_summary(*args, **kwargs)

    def synthesize_procedural_memory(self, *args, **kwargs):
        return self.reflection.synthesize_procedural_memory(*args, **kwargs)

    def generate_reflections(self, *args, **kwargs):
        return self.reflection.generate_reflections(*args, **kwargs)

    def get_emotional_trend(self, *args, **kwargs):
        return self.reflection.get_emotional_trend(*args, **kwargs)

    def get_user_memory_stats(self, *args, **kwargs):
        return self.store.get_user_memory_stats(*args, **kwargs)

    def get_all_memories(self, *args, **kwargs):
        return self.store.get_all_memories(*args, **kwargs)
        
    def add_crisis_memory(self, *args, **kwargs):
        return self.store.add_crisis_memory(*args, **kwargs)
        
    def should_generate_reflections(self, *args, **kwargs):
        return self.reflection.should_generate_reflections(*args, **kwargs)
        
    @property
    def _emotional_trend_cache(self):
        return self.reflection._emotional_trend_cache

memory_manager = MemoryManager()
