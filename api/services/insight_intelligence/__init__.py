"""
Insight Intelligence Services - Các module tăng tính thông minh cho chatbot
"""

from .context_builder import ContextBuilder, ChatContext
from .reference_resolver import ReferenceResolver
from .entity_linker import EntityLinker
from .intent_classifier import IntentClassifier, Intent, IntentType
from .conversation_memory import ConversationMemory
from .calculator_agent import CalculatorAgent, ComputationResult, format_computation_for_response
from .visualization_planner import VisualizationPlanner, ChartSuggestion, VisualizationPlan, format_visualization_for_response
from .response_formatter import ResponseFormatter, FormattedResponse, format_response_for_api
from .data_manipulation_agent import DataManipulationAgent, ManipulationResult, format_manipulation_result
from .guidance_agent import GuidanceAgent, GuidanceResult, format_guidance_for_response

__all__ = [
    # Core modules
    "ContextBuilder",
    "ChatContext",
    "ReferenceResolver",
    "EntityLinker",
    "IntentClassifier",
    "Intent",
    "IntentType",
    "ConversationMemory",
    # Calculator
    "CalculatorAgent",
    "ComputationResult",
    "format_computation_for_response",
    # Visualization
    "VisualizationPlanner",
    "ChartSuggestion",
    "VisualizationPlan",
    "format_visualization_for_response",
    # Response Formatter
    "ResponseFormatter",
    "FormattedResponse",
    "format_response_for_api",
    # Data Manipulation
    "DataManipulationAgent",
    "ManipulationResult",
    "format_manipulation_result",
    # Guidance
    "GuidanceAgent",
    "GuidanceResult",
    "format_guidance_for_response",
]
