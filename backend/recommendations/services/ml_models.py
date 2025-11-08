"""
Neural network models for recommendation system.

Hybrid Architecture:
1. Collaborative Filtering: User-Cleaner interaction embeddings
2. Content-Based: Job/Cleaner feature neural network
3. Ensemble: Combines both approaches with learned weights

Uses PyTorch for flexibility and production deployment.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, List, Tuple, Optional
import json
from pathlib import Path
from django.conf import settings


class CollaborativeFilteringModel(nn.Module):
    """
    Matrix factorization using neural embeddings.
    
    Learns latent representations of clients and cleaners from their
    interaction history (bids, hires, reviews).
    """
    def __init__(
        self,
        num_clients: int,
        num_cleaners: int,
        embedding_dim: int = 64,
        hidden_dims: List[int] = [128, 64, 32]
    ):
        super().__init__()
        
        # Embeddings
        self.client_embedding = nn.Embedding(num_clients, embedding_dim)
        self.cleaner_embedding = nn.Embedding(num_cleaners, embedding_dim)
        
        # Deep layers to learn non-linear interactions
        layers = []
        input_dim = embedding_dim * 2
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(input_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.3))
            input_dim = hidden_dim
        
        layers.append(nn.Linear(input_dim, 1))
        self.mlp = nn.Sequential(*layers)
        
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Xavier initialization for better convergence"""
        nn.init.xavier_uniform_(self.client_embedding.weight)
        nn.init.xavier_uniform_(self.cleaner_embedding.weight)
    
    def forward(self, client_ids: torch.Tensor, cleaner_ids: torch.Tensor) -> torch.Tensor:
        """
        Args:
            client_ids: Tensor of client indices [batch_size]
            cleaner_ids: Tensor of cleaner indices [batch_size]
        
        Returns:
            Predicted scores [batch_size]
        """
        client_embeds = self.client_embedding(client_ids)
        cleaner_embeds = self.cleaner_embedding(cleaner_ids)
        
        # Concatenate embeddings
        x = torch.cat([client_embeds, cleaner_embeds], dim=1)
        
        # Pass through MLP
        output = self.mlp(x)
        
        return output.squeeze()


class ContentBasedModel(nn.Module):
    """
    Feature-based neural network using job and cleaner attributes.
    
    Input features:
    - Job: property_type, size, location, budget, eco_preference
    - Cleaner: quality_score, reliability_score, experience, specialization, distance
    """
    def __init__(
        self,
        num_property_types: int = 4,
        embedding_dim: int = 16,
        hidden_dims: List[int] = [128, 64, 32]
    ):
        super().__init__()
        
        # Categorical embeddings
        self.property_type_embedding = nn.Embedding(num_property_types, embedding_dim)
        
        # Feature dimensions:
        # - property_type: embedding_dim
        # - continuous features: 15 (size, budget, eco, quality, reliability, experience, etc.)
        # - location: 2 (lat, lng offset)
        # - distance: 1
        input_dim = embedding_dim + 18
        
        layers = []
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(input_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.BatchNorm1d(hidden_dim))
            layers.append(nn.Dropout(0.2))
            input_dim = hidden_dim
        
        layers.append(nn.Linear(input_dim, 1))
        self.mlp = nn.Sequential(*layers)
    
    def forward(
        self,
        property_type: torch.Tensor,
        continuous_features: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            property_type: Tensor of property type indices [batch_size]
            continuous_features: Tensor of continuous features [batch_size, 18]
        
        Returns:
            Predicted scores [batch_size]
        """
        # Embed categorical features
        prop_type_embed = self.property_type_embedding(property_type)
        
        # Concatenate all features
        x = torch.cat([prop_type_embed, continuous_features], dim=1)
        
        # Pass through MLP
        output = self.mlp(x)
        
        return output.squeeze()


class HybridRecommendationModel(nn.Module):
    """
    Ensemble model combining collaborative filtering and content-based approaches.
    
    Uses learned weight to balance both models:
    final_score = alpha * collaborative_score + (1 - alpha) * content_score
    
    Where alpha is learned during training.
    """
    def __init__(
        self,
        num_clients: int,
        num_cleaners: int,
        num_property_types: int = 4,
        cf_embedding_dim: int = 64,
        content_embedding_dim: int = 16,
        cf_hidden_dims: List[int] = [128, 64, 32],
        content_hidden_dims: List[int] = [128, 64, 32]
    ):
        super().__init__()
        
        self.collaborative_model = CollaborativeFilteringModel(
            num_clients=num_clients,
            num_cleaners=num_cleaners,
            embedding_dim=cf_embedding_dim,
            hidden_dims=cf_hidden_dims
        )
        
        self.content_model = ContentBasedModel(
            num_property_types=num_property_types,
            embedding_dim=content_embedding_dim,
            hidden_dims=content_hidden_dims
        )
        
        # Learnable ensemble weight
        self.alpha = nn.Parameter(torch.tensor(0.5))
    
    def forward(
        self,
        client_ids: torch.Tensor,
        cleaner_ids: torch.Tensor,
        property_type: torch.Tensor,
        continuous_features: torch.Tensor
    ) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
        """
        Args:
            client_ids: Client indices [batch_size]
            cleaner_ids: Cleaner indices [batch_size]
            property_type: Property type indices [batch_size]
            continuous_features: Continuous features [batch_size, 18]
        
        Returns:
            final_scores: Combined scores [batch_size]
            breakdown: Dict with individual model outputs
        """
        # Get predictions from both models
        cf_scores = self.collaborative_model(client_ids, cleaner_ids)
        content_scores = self.content_model(property_type, continuous_features)
        
        # Normalize alpha to [0, 1] using sigmoid
        normalized_alpha = torch.sigmoid(self.alpha)
        
        # Ensemble
        final_scores = normalized_alpha * cf_scores + (1 - normalized_alpha) * content_scores
        
        breakdown = {
            'collaborative': cf_scores,
            'content': content_scores,
            'alpha': normalized_alpha
        }
        
        return final_scores, breakdown
    
    def get_alpha_value(self) -> float:
        """Get current ensemble weight (for monitoring)"""
        return torch.sigmoid(self.alpha).item()


class BidPredictionModel(nn.Module):
    """
    Neural network to predict optimal bid amount.
    
    Predicts the bid amount that maximizes win probability while
    maintaining profitability for the cleaner.
    
    Input features:
    - Job characteristics: property type, size, estimated_duration
    - Market data: current_bid_count, lowest_bid, avg_bid
    - Cleaner data: avg_winning_bid, win_rate, quality_score
    - Client data: budget_indicator, past_accepted_bids_avg
    """
    def __init__(
        self,
        num_property_types: int = 4,
        embedding_dim: int = 16,
        hidden_dims: List[int] = [128, 64, 32]
    ):
        super().__init__()
        
        self.property_type_embedding = nn.Embedding(num_property_types, embedding_dim)
        
        # Input: embedding + 12 continuous features
        input_dim = embedding_dim + 12
        
        layers = []
        for hidden_dim in hidden_dims:
            layers.append(nn.Linear(input_dim, hidden_dim))
            layers.append(nn.ReLU())
            layers.append(nn.BatchNorm1d(hidden_dim))
            layers.append(nn.Dropout(0.2))
            input_dim = hidden_dim
        
        # Output 3 values: min_bid, optimal_bid, max_bid
        layers.append(nn.Linear(input_dim, 3))
        self.mlp = nn.Sequential(*layers)
    
    def forward(
        self,
        property_type: torch.Tensor,
        continuous_features: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Args:
            property_type: Property type indices [batch_size]
            continuous_features: Continuous features [batch_size, 12]
        
        Returns:
            min_bid: Minimum suggested bid [batch_size]
            optimal_bid: Optimal bid for win/profit balance [batch_size]
            max_bid: Maximum reasonable bid [batch_size]
        """
        prop_type_embed = self.property_type_embedding(property_type)
        x = torch.cat([prop_type_embed, continuous_features], dim=1)
        
        # Get predictions
        output = self.mlp(x)
        
        # Apply softplus to ensure positive values and proper ordering
        min_bid = F.softplus(output[:, 0])
        optimal_bid = min_bid + F.softplus(output[:, 1])
        max_bid = optimal_bid + F.softplus(output[:, 2])
        
        return min_bid, optimal_bid, max_bid


class ModelManager:
    """
    Manages model training, saving, loading, and inference.
    
    Docker-aware: Handles model persistence in container volumes.
    Models are stored in a volume-mounted directory for persistence across container restarts.
    
    Handles:
    - Model versioning
    - Checkpoint management
    - Training state persistence
    - Feature preprocessing
    """
    def __init__(self, model_dir: Optional[Path] = None):
        # Use settings if available, otherwise default
        if model_dir is None:
            try:
                from django.conf import settings
                self.model_dir = Path(getattr(settings, 'RECOMMENDATION_MODELS_DIR', 
                                             Path('/app/recommendations/models')))
            except:
                # Fallback for non-Django context
                self.model_dir = Path('/app/recommendations/models')
        else:
            self.model_dir = model_dir
        
        # Create directory if it doesn't exist (important in Docker)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        
        # Device detection (CPU in Docker container by default)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        if torch.cuda.is_available():
            print(f"✅ GPU available in Docker container: {torch.cuda.get_device_name(0)}")
        else:
            print(f"ℹ️  Running on CPU in Docker container (expected for development)")
        
        # Feature mappings (populated during training)
        self.client_id_map = {}
        self.cleaner_id_map = {}
        self.property_type_map = {
            'apartment': 0,
            'house': 1,
            'office': 2,
            'commercial': 3,
        }
    
    def save_model(
        self,
        model: nn.Module,
        model_name: str,
        version: str,
        metadata: Optional[Dict] = None
    ):
        """Save model checkpoint with metadata"""
        checkpoint_path = self.model_dir / f'{model_name}_v{version}.pt'
        
        checkpoint = {
            'model_state_dict': model.state_dict(),
            'model_class': model.__class__.__name__,
            'metadata': metadata or {},
            'client_id_map': self.client_id_map,
            'cleaner_id_map': self.cleaner_id_map,
            'property_type_map': self.property_type_map,
        }
        
        torch.save(checkpoint, checkpoint_path)
        
        # Save metadata as JSON for easy inspection
        metadata_path = self.model_dir / f'{model_name}_v{version}_metadata.json'
        with open(metadata_path, 'w') as f:
            json.dump(checkpoint['metadata'], f, indent=2)
        
        return checkpoint_path
    
    def load_model(
        self,
        model: nn.Module,
        model_name: str,
        version: str = 'latest'
    ) -> nn.Module:
        """Load model checkpoint"""
        if version == 'latest':
            # Find latest version
            checkpoints = list(self.model_dir.glob(f'{model_name}_v*.pt'))
            if not checkpoints:
                raise ValueError(f'No checkpoints found for {model_name}')
            checkpoint_path = max(checkpoints, key=lambda p: p.stat().st_mtime)
        else:
            checkpoint_path = self.model_dir / f'{model_name}_v{version}.pt'
        
        checkpoint = torch.load(checkpoint_path, map_location=self.device)
        
        model.load_state_dict(checkpoint['model_state_dict'])
        self.client_id_map = checkpoint['client_id_map']
        self.cleaner_id_map = checkpoint['cleaner_id_map']
        self.property_type_map = checkpoint['property_type_map']
        
        model.to(self.device)
        model.eval()
        
        return model
    
    def build_feature_maps(self, clients: List[int], cleaners: List[int]):
        """Build ID mappings for embeddings"""
        self.client_id_map = {client_id: idx for idx, client_id in enumerate(sorted(set(clients)))}
        self.cleaner_id_map = {cleaner_id: idx for idx, cleaner_id in enumerate(sorted(set(cleaners)))}
    
    def get_client_index(self, client_id: int, default: int = 0) -> int:
        """Map client ID to embedding index"""
        return self.client_id_map.get(client_id, default)
    
    def get_cleaner_index(self, cleaner_id: int, default: int = 0) -> int:
        """Map cleaner ID to embedding index"""
        return self.cleaner_id_map.get(cleaner_id, default)
    
    def get_property_type_index(self, property_type: str) -> int:
        """Map property type to index"""
        return self.property_type_map.get(property_type, 0)


# Example training function (to be called from management command)
def train_hybrid_model(
    train_data: Dict,
    val_data: Dict,
    num_epochs: int = 50,
    batch_size: int = 256,
    learning_rate: float = 0.001,
    patience: int = 5
) -> HybridRecommendationModel:
    """
    Train hybrid recommendation model with early stopping.
    
    Args:
        train_data: Dict with 'client_ids', 'cleaner_ids', 'property_types', 'features', 'labels'
        val_data: Same structure as train_data
        num_epochs: Maximum training epochs
        batch_size: Batch size for training
        learning_rate: Initial learning rate
        patience: Early stopping patience
    
    Returns:
        Trained model
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # Build model - use map sizes from training data
    num_clients = train_data.get('num_clients', len(set(train_data['client_ids'])))
    num_cleaners = train_data.get('num_cleaners', len(set(train_data['cleaner_ids'])))
    
    model = HybridRecommendationModel(
        num_clients=num_clients,
        num_cleaners=num_cleaners
    ).to(device)
    
    # Loss and optimizer
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=3
    )
    
    best_val_loss = float('inf')
    patience_counter = 0
    
    for epoch in range(num_epochs):
        # Training
        model.train()
        train_loss = 0.0
        
        # Create batches
        num_batches = len(train_data['labels']) // batch_size
        
        for batch_idx in range(num_batches):
            start_idx = batch_idx * batch_size
            end_idx = start_idx + batch_size
            
            # Get batch
            client_ids = torch.tensor(train_data['client_ids'][start_idx:end_idx]).to(device)
            cleaner_ids = torch.tensor(train_data['cleaner_ids'][start_idx:end_idx]).to(device)
            property_types = torch.tensor(train_data['property_types'][start_idx:end_idx]).to(device)
            features = torch.tensor(train_data['features'][start_idx:end_idx], dtype=torch.float32).to(device)
            labels = torch.tensor(train_data['labels'][start_idx:end_idx], dtype=torch.float32).to(device)
            
            # Forward
            optimizer.zero_grad()
            predictions, _ = model(client_ids, cleaner_ids, property_types, features)
            loss = criterion(predictions, labels)
            
            # Backward
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
        
        train_loss /= num_batches
        
        # Validation
        model.eval()
        with torch.no_grad():
            val_client_ids = torch.tensor(val_data['client_ids']).to(device)
            val_cleaner_ids = torch.tensor(val_data['cleaner_ids']).to(device)
            val_property_types = torch.tensor(val_data['property_types']).to(device)
            val_features = torch.tensor(val_data['features'], dtype=torch.float32).to(device)
            val_labels = torch.tensor(val_data['labels'], dtype=torch.float32).to(device)
            
            val_predictions, breakdown = model(
                val_client_ids, val_cleaner_ids, val_property_types, val_features
            )
            val_loss = criterion(val_predictions, val_labels).item()
        
        print(f'Epoch {epoch+1}/{num_epochs} - Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, Alpha: {model.get_alpha_value():.4f}')
        
        # Learning rate scheduling
        scheduler.step(val_loss)
        
        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            # Save best model (you can use ModelManager here)
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f'Early stopping at epoch {epoch+1}')
                break
    
    return model
