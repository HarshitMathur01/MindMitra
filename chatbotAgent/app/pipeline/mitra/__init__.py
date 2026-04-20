"""
MITRA pipeline (v2) — feature-flagged unified turn orchestrator.

Public entry point: `MitraPipeline.process_turn(...)`.
Compose with injected services so it can run in unit tests with no I/O.
"""
from .classifier import IntentClassifier, TurnClassification
from .retriever import RetrieverOrchestrator, RetrievedContext
from .assembler import ContextAssembler, AssembledPrompt, stage_weights
from .generator import TwoPassGenerator, GenerationResult
from .dual_track import DualTrackGenerator, DualTrackResult
from .stance_selector import Stance, StanceConstraints, select_stance
from .orchestrator import MitraPipeline, TurnInput, TurnResult

__all__ = [
    "IntentClassifier", "TurnClassification",
    "RetrieverOrchestrator", "RetrievedContext",
    "ContextAssembler", "AssembledPrompt", "stage_weights",
    "TwoPassGenerator", "GenerationResult",
    "DualTrackGenerator", "DualTrackResult",
    "Stance", "StanceConstraints", "select_stance",
    "MitraPipeline", "TurnInput", "TurnResult",
]
