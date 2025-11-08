"""
PyTorch Neural Network Model for Cleaner-Client Matching

Architecture:
    Input (427 features)
      ↓
    Dense(256) + ReLU + Dropout(0.3)
      ↓
    Dense(128) + ReLU + Dropout(0.3)
      ↓
    Dense(64) + ReLU + Dropout(0.2)
      ↓
    Dense(32) + ReLU
      ↓
    Dense(1) + Sigmoid → Match Score [0-1]

This deep architecture learns hierarchical feature interactions
to predict cleaner-client compatibility from historical job data.
"""

import torch
import torch.nn as nn


class CleanerMatchNN(nn.Module):
    """
    Deep Neural Network for predicting cleaner-client match quality.
    
    Args:
        input_size (int): Number of input features (default: 427)
        hidden_sizes (list): Sizes of hidden layers (default: [256, 128, 64, 32])
        dropout_rates (list): Dropout rates for each layer (default: [0.3, 0.3, 0.2, 0.0])
    """
    
    def __init__(self, input_size=427, hidden_sizes=None, dropout_rates=None):
        super(CleanerMatchNN, self).__init__()
        
        if hidden_sizes is None:
            hidden_sizes = [256, 128, 64, 32]
        if dropout_rates is None:
            dropout_rates = [0.3, 0.3, 0.2, 0.0]
        
        self.input_size = input_size
        self.hidden_sizes = hidden_sizes
        self.dropout_rates = dropout_rates
        
        # Build network layers
        layers = []
        prev_size = input_size
        
        for i, (hidden_size, dropout_rate) in enumerate(zip(hidden_sizes, dropout_rates)):
            # Dense layer
            layers.append(nn.Linear(prev_size, hidden_size))
            
            # Activation
            layers.append(nn.ReLU())
            
            # Dropout (if rate > 0)
            if dropout_rate > 0:
                layers.append(nn.Dropout(dropout_rate))
            
            prev_size = hidden_size
        
        # Output layer (1 neuron with sigmoid for [0-1] range)
        layers.append(nn.Linear(prev_size, 1))
        layers.append(nn.Sigmoid())
        
        # Combine into sequential model
        self.network = nn.Sequential(*layers)
        
        # Initialize weights
        self._initialize_weights()
    
    def forward(self, x):
        """
        Forward pass through the network.
        
        Args:
            x (torch.Tensor): Input features of shape (batch_size, input_size)
        
        Returns:
            torch.Tensor: Predicted match scores of shape (batch_size, 1)
        """
        return self.network(x)
    
    def _initialize_weights(self):
        """
        Initialize network weights using He initialization for ReLU.
        """
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, mode='fan_in', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
    
    def get_config(self):
        """
        Get model configuration for saving/loading.
        """
        return {
            'input_size': self.input_size,
            'hidden_sizes': self.hidden_sizes,
            'dropout_rates': self.dropout_rates,
        }
    
    def count_parameters(self):
        """
        Count total trainable parameters.
        """
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


class CleanerMatchDataset(torch.utils.data.Dataset):
    """
    PyTorch Dataset for loading preprocessed cleaner-client match data.
    
    Args:
        features_path (str): Path to .npy file with features
        target_path (str): Path to .npy file with target values
    """
    
    def __init__(self, features_path, target_path):
        import numpy as np
        
        self.features = np.load(features_path).astype(np.float32)
        self.target = np.load(target_path).astype(np.float32)
        
        assert len(self.features) == len(self.target), \
            f"Feature/target length mismatch: {len(self.features)} vs {len(self.target)}"
    
    def __len__(self):
        return len(self.features)
    
    def __getitem__(self, idx):
        """
        Get a single sample.
        
        Returns:
            tuple: (features, target) as torch tensors
        """
        return (
            torch.tensor(self.features[idx], dtype=torch.float32),
            torch.tensor(self.target[idx], dtype=torch.float32).unsqueeze(0)  # Shape: (1,)
        )


def create_data_loaders(data_dir='nn_data', batch_size=64, num_workers=0):
    """
    Create PyTorch DataLoaders for train, validation, and test sets.
    
    Args:
        data_dir (str): Directory containing preprocessed .npy files
        batch_size (int): Batch size for training
        num_workers (int): Number of worker processes for data loading
    
    Returns:
        tuple: (train_loader, val_loader, test_loader)
    """
    import os
    
    # Create datasets
    train_dataset = CleanerMatchDataset(
        os.path.join(data_dir, 'train_features.npy'),
        os.path.join(data_dir, 'train_target.npy')
    )
    
    val_dataset = CleanerMatchDataset(
        os.path.join(data_dir, 'val_features.npy'),
        os.path.join(data_dir, 'val_target.npy')
    )
    
    test_dataset = CleanerMatchDataset(
        os.path.join(data_dir, 'test_features.npy'),
        os.path.join(data_dir, 'test_target.npy')
    )
    
    # Create data loaders
    train_loader = torch.utils.data.DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True
    )
    
    val_loader = torch.utils.data.DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    test_loader = torch.utils.data.DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    return train_loader, val_loader, test_loader


if __name__ == '__main__':
    # Test model creation
    model = CleanerMatchNN()
    print(f"Model created with {model.count_parameters():,} trainable parameters")
    print(f"\nArchitecture:")
    print(model)
    
    # Test forward pass
    batch_size = 32
    dummy_input = torch.randn(batch_size, 427)
    output = model(dummy_input)
    print(f"\nTest forward pass:")
    print(f"  Input shape: {dummy_input.shape}")
    print(f"  Output shape: {output.shape}")
    print(f"  Output range: [{output.min():.3f}, {output.max():.3f}]")
