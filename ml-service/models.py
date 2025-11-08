"""
Neural network models for ML service (standalone version).
Copied from Django backend for independent deployment.
"""
import torch
import torch.nn as nn
from typing import List


class CollaborativeFilteringModel(nn.Module):
    """Matrix factorization using neural embeddings"""
    
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
        
        # Deep layers
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
        nn.init.xavier_uniform_(self.client_embedding.weight)
        nn.init.xavier_uniform_(self.cleaner_embedding.weight)
    
    def forward(self, client_ids: torch.Tensor, cleaner_ids: torch.Tensor) -> torch.Tensor:
        client_embeds = self.client_embedding(client_ids)
        cleaner_embeds = self.cleaner_embedding(cleaner_ids)
        
        x = torch.cat([client_embeds, cleaner_embeds], dim=1)
        output = self.mlp(x)
        
        return output.squeeze()


class ContentBasedModel(nn.Module):
    """Feature-based neural network"""
    
    def __init__(
        self,
        num_property_types: int = 4,
        embedding_dim: int = 16,
        hidden_dims: List[int] = [128, 64, 32]
    ):
        super().__init__()
        
        self.property_type_embedding = nn.Embedding(num_property_types, embedding_dim)
        
        input_dim = embedding_dim + 18  # embedding + 18 continuous features
        
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
        prop_type_embed = self.property_type_embedding(property_type)
        x = torch.cat([prop_type_embed, continuous_features], dim=1)
        output = self.mlp(x)
        
        return output.squeeze()


class HybridRecommendationModel(nn.Module):
    """
    Ensemble model combining collaborative filtering and content-based approaches.
    final_score = alpha * collaborative_score + (1 - alpha) * content_score
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
    ) -> torch.Tensor:
        """Return final scores only (simplified for inference)"""
        cf_scores = self.collaborative_model(client_ids, cleaner_ids)
        content_scores = self.content_model(property_type, continuous_features)
        
        # Normalize alpha to [0, 1] using sigmoid
        normalized_alpha = torch.sigmoid(self.alpha)
        
        # Ensemble
        final_scores = normalized_alpha * cf_scores + (1 - normalized_alpha) * content_scores
        
        return final_scores
    
    def get_alpha_value(self) -> float:
        """Get current ensemble weight"""
        return torch.sigmoid(self.alpha).item()
