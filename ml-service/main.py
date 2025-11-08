"""
ML Service - FastAPI microservice for recommendation model inference

Provides HTTP endpoints for:
- Cleaner recommendations for jobs
- Job recommendations for cleaners
- Bid price suggestions
- Model health checks and metrics
"""
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import torch
import numpy as np
from pathlib import Path
import logging
import time
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="E-Clean ML Service",
    description="Neural network recommendation engine for cleaner-job matching",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model manager (loaded on startup)
model_manager = None
model_loaded = False
model_load_time = None


# ===========================
# Pydantic Models
# ===========================

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    model_loaded: bool
    model_version: Optional[str] = None
    uptime_seconds: Optional[float] = None
    timestamp: str


class CleanerRecommendationRequest(BaseModel):
    """Request for cleaner recommendations"""
    job_id: int
    client_id: int
    property_type: str = Field(..., description="apartment, house, office, or commercial")
    features: List[float] = Field(..., min_length=18, max_length=18, description="18 continuous features")
    top_k: int = Field(5, ge=1, le=50, description="Number of recommendations to return")
    use_hybrid: bool = Field(True, description="Use hybrid model (True) or rule-based only (False)")


class JobRecommendationRequest(BaseModel):
    """Request for job recommendations"""
    cleaner_id: int
    job_ids: List[int] = Field(..., description="List of job IDs to score")
    features_list: List[List[float]] = Field(..., description="Features for each job")
    property_types: List[str] = Field(..., description="Property type for each job")
    top_k: int = Field(10, ge=1, le=100)


class BidSuggestionRequest(BaseModel):
    """Request for bid price suggestion"""
    job_id: int
    cleaner_id: int
    client_id: int
    property_type: str
    features: List[float] = Field(..., min_length=18, max_length=18)


class RecommendationScore(BaseModel):
    """Single recommendation score"""
    id: int
    score: float = Field(..., ge=0.0, le=1.0)
    rule_based_score: float
    neural_score: float
    confidence: float


class CleanerRecommendationResponse(BaseModel):
    """Response with cleaner recommendations"""
    job_id: int
    recommendations: List[RecommendationScore]
    model_version: str
    inference_time_ms: float


class JobRecommendationResponse(BaseModel):
    """Response with job recommendations"""
    cleaner_id: int
    recommendations: List[RecommendationScore]
    model_version: str
    inference_time_ms: float


class BidSuggestionResponse(BaseModel):
    """Response with bid suggestion"""
    job_id: int
    cleaner_id: int
    suggested_bid: float
    confidence_interval: List[float]
    model_version: str


# ===========================
# Model Manager
# ===========================

class MLModelManager:
    """Manages ML model loading and inference"""
    
    def __init__(self):
        self.model = None
        self.model_version = None
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.client_id_map = {}
        self.cleaner_id_map = {}
        self.property_type_map = {}
        logger.info(f"Initialized model manager on device: {self.device}")
    
    def load_model(self, model_path: str):
        """Load PyTorch model from checkpoint"""
        try:
            start_time = time.time()
            path = Path(model_path)
            
            if not path.exists():
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            logger.info(f"Loading model from {model_path}")
            checkpoint = torch.load(model_path, map_location=self.device)
            
            # Extract metadata
            metadata = checkpoint.get('metadata', {})
            self.model_version = metadata.get('version', 'unknown')
            
            # Load ID mappings
            self.client_id_map = checkpoint.get('client_id_map', {})
            self.cleaner_id_map = checkpoint.get('cleaner_id_map', {})
            self.property_type_map = checkpoint.get('property_type_map', {})
            
            # Reconstruct model - get sizes from model state dict
            model_state = checkpoint['model_state_dict']
            
            # Infer actual sizes from embedding weights
            client_embed_shape = model_state['collaborative_model.client_embedding.weight'].shape
            cleaner_embed_shape = model_state['collaborative_model.cleaner_embedding.weight'].shape
            
            num_clients = client_embed_shape[0]
            num_cleaners = cleaner_embed_shape[0]
            
            logger.info(f"Detected model sizes - Clients: {num_clients}, Cleaners: {num_cleaners}")
            
            # Import model class dynamically
            from models import HybridRecommendationModel
            
            self.model = HybridRecommendationModel(
                num_clients=num_clients,
                num_cleaners=num_cleaners
            ).to(self.device)
            
            self.model.load_state_dict(checkpoint['model_state_dict'])
            self.model.eval()  # Set to evaluation mode
            
            load_time = time.time() - start_time
            logger.info(f"Model loaded successfully in {load_time:.2f}s")
            logger.info(f"Model version: {self.model_version}")
            logger.info(f"Clients: {num_clients}, Cleaners: {num_cleaners}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            raise
    
    def predict_cleaners(
        self,
        client_id: int,
        cleaner_ids: List[int],
        property_type: str,
        features_list: List[List[float]]
    ) -> np.ndarray:
        """
        Predict scores for multiple cleaners for a given client/job
        
        Args:
            client_id: Client ID
            cleaner_ids: List of cleaner IDs to score
            property_type: Property type string
            features_list: List of feature vectors (one per cleaner)
        
        Returns:
            Array of scores for each cleaner
        """
        if self.model is None:
            raise RuntimeError("Model not loaded")
        
        try:
            # Map IDs
            client_idx = self.client_id_map.get(str(client_id), 0)
            cleaner_indices = [self.cleaner_id_map.get(str(cid), 0) for cid in cleaner_ids]
            prop_type_idx = self.property_type_map.get(property_type, 0)
            
            # Convert to tensors
            client_ids_tensor = torch.tensor([client_idx] * len(cleaner_ids), dtype=torch.long).to(self.device)
            cleaner_ids_tensor = torch.tensor(cleaner_indices, dtype=torch.long).to(self.device)
            property_types_tensor = torch.tensor([prop_type_idx] * len(cleaner_ids), dtype=torch.long).to(self.device)
            features_tensor = torch.tensor(features_list, dtype=torch.float32).to(self.device)
            
            # Run inference
            with torch.no_grad():
                scores = self.model(client_ids_tensor, cleaner_ids_tensor, property_types_tensor, features_tensor)
            
            # Convert to numpy and clamp to [0, 1]
            scores_np = scores.cpu().numpy().flatten()
            scores_np = np.clip(scores_np, 0.0, 1.0)
            
            return scores_np
            
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            raise
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model metadata"""
        return {
            "version": self.model_version,
            "device": str(self.device),
            "num_clients": len(self.client_id_map),
            "num_cleaners": len(self.cleaner_id_map),
            "property_types": list(self.property_type_map.keys()),
            "model_loaded": self.model is not None
        }


# ===========================
# Startup/Shutdown Events
# ===========================

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    global model_manager, model_loaded, model_load_time
    
    logger.info("Starting ML service...")
    model_load_time = time.time()
    
    try:
        model_manager = MLModelManager()
        
        # Try to load model from mounted volume
        model_path = "/app/models/hybrid_recommendation_v1.0.pt"
        
        if Path(model_path).exists():
            model_manager.load_model(model_path)
            model_loaded = True
            logger.info("✓ ML service ready")
        else:
            logger.warning(f"Model file not found at {model_path}")
            logger.warning("Service running without model - health checks will fail")
            
    except Exception as e:
        logger.error(f"Startup error: {str(e)}")
        model_loaded = False


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down ML service...")


# ===========================
# API Endpoints
# ===========================

@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "service": "E-Clean ML Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    uptime = time.time() - model_load_time if model_load_time else 0
    
    response = HealthResponse(
        status="healthy" if model_loaded else "degraded",
        model_loaded=model_loaded,
        model_version=model_manager.model_version if model_manager else None,
        uptime_seconds=uptime,
        timestamp=datetime.utcnow().isoformat()
    )
    
    if not model_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded"
        )
    
    return response


@app.get("/model/info")
async def model_info():
    """Get model information"""
    if not model_loaded or model_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded"
        )
    
    return model_manager.get_model_info()


@app.post("/recommend/cleaners", response_model=CleanerRecommendationResponse)
async def recommend_cleaners(request: CleanerRecommendationRequest):
    """
    Get top-K cleaner recommendations for a job
    
    This is the main endpoint used by the Django backend to get recommendations.
    """
    if not model_loaded or model_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded"
        )
    
    try:
        start_time = time.time()
        
        # For now, we'll return mock cleaner IDs
        # In production, Django will pass the list of candidate cleaners
        # This is a simplified version - Django should send cleaner_ids and their features
        
        # Mock: Score top cleaners (in reality, Django passes cleaner IDs)
        cleaner_ids = list(range(1, min(request.top_k * 3, 50)))  # Get more than needed
        
        # Replicate features for each cleaner (simplified)
        features_list = [request.features] * len(cleaner_ids)
        
        # Get predictions
        scores = model_manager.predict_cleaners(
            client_id=request.client_id,
            cleaner_ids=cleaner_ids,
            property_type=request.property_type,
            features_list=features_list
        )
        
        # Sort by score and get top-K
        sorted_indices = np.argsort(-scores)[:request.top_k]
        
        recommendations = [
            RecommendationScore(
                id=cleaner_ids[idx],
                score=float(scores[idx]),
                rule_based_score=float(scores[idx] * 0.6),  # Simplified
                neural_score=float(scores[idx] * 0.4),
                confidence=0.85
            )
            for idx in sorted_indices
        ]
        
        inference_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return CleanerRecommendationResponse(
            job_id=request.job_id,
            recommendations=recommendations,
            model_version=model_manager.model_version,
            inference_time_ms=inference_time
        )
        
    except Exception as e:
        logger.error(f"Error in recommend_cleaners: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@app.post("/recommend/jobs", response_model=JobRecommendationResponse)
async def recommend_jobs(request: JobRecommendationRequest):
    """Get top-K job recommendations for a cleaner"""
    if not model_loaded or model_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded"
        )
    
    try:
        start_time = time.time()
        
        # Note: For job recommendations, we score from cleaner perspective
        # This requires a slightly different approach (cleaner stays constant)
        
        # Simplified implementation - would need to adapt model for this direction
        scores = np.random.rand(len(request.job_ids))  # Placeholder
        
        sorted_indices = np.argsort(-scores)[:request.top_k]
        
        recommendations = [
            RecommendationScore(
                id=request.job_ids[idx],
                score=float(scores[idx]),
                rule_based_score=float(scores[idx] * 0.6),
                neural_score=float(scores[idx] * 0.4),
                confidence=0.80
            )
            for idx in sorted_indices
        ]
        
        inference_time = (time.time() - start_time) * 1000
        
        return JobRecommendationResponse(
            cleaner_id=request.cleaner_id,
            recommendations=recommendations,
            model_version=model_manager.model_version,
            inference_time_ms=inference_time
        )
        
    except Exception as e:
        logger.error(f"Error in recommend_jobs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@app.post("/suggest/bid", response_model=BidSuggestionResponse)
async def suggest_bid(request: BidSuggestionRequest):
    """Suggest optimal bid price for a cleaner-job pair"""
    if not model_loaded or model_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded"
        )
    
    try:
        # Get match score
        scores = model_manager.predict_cleaners(
            client_id=request.client_id,
            cleaner_ids=[request.cleaner_id],
            property_type=request.property_type,
            features_list=[request.features]
        )
        
        match_score = scores[0]
        
        # Simplified bid suggestion logic
        # In reality, you'd have a separate bid prediction model
        base_bid = request.features[5] if len(request.features) > 5 else 100.0
        suggested_bid = base_bid * (0.9 + match_score * 0.2)
        
        confidence_interval = [
            suggested_bid * 0.95,
            suggested_bid * 1.05
        ]
        
        return BidSuggestionResponse(
            job_id=request.job_id,
            cleaner_id=request.cleaner_id,
            suggested_bid=round(suggested_bid, 2),
            confidence_interval=[round(ci, 2) for ci in confidence_interval],
            model_version=model_manager.model_version
        )
        
    except Exception as e:
        logger.error(f"Error in suggest_bid: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bid suggestion failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
