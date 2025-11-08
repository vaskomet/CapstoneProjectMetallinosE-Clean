"""
Recommendation system services.

Provides three service layers:
1. ScoringService: Rule-based cleaner scoring (always available)
2. ML Models: Neural network models (requires PyTorch in Docker)
3. RecommendationEngine: Unified interface with automatic fallback

Docker-aware: Gracefully handles missing ML dependencies.
"""

# Core services (always available)
from .scoring_service import ScoringService

# ML services (optional - requires PyTorch in Docker container)
try:
    from .ml_models import (
        CollaborativeFilteringModel,
        ContentBasedModel,
        HybridRecommendationModel,
        BidPredictionModel,
        ModelManager,
        train_hybrid_model
    )
    ML_MODELS_AVAILABLE = True
except ImportError as e:
    # PyTorch not installed - will use rule-based mode only
    ML_MODELS_AVAILABLE = False
    import logging
    logger = logging.getLogger(__name__)
    logger.info(
        f'ML models not available (PyTorch not installed): {e}. '
        'Recommendation system will use rule-based mode only. '
        'To enable neural networks, rebuild Docker container with ML dependencies.'
    )

# Recommendation engine (uses both if available)
from .recommendation_engine import RecommendationEngine

__all__ = [
    'ScoringService',
    'RecommendationEngine',
]

# Export ML components only if available
if ML_MODELS_AVAILABLE:
    __all__.extend([
        'CollaborativeFilteringModel',
        'ContentBasedModel',
        'HybridRecommendationModel',
        'BidPredictionModel',
        'ModelManager',
        'train_hybrid_model',
    ])

