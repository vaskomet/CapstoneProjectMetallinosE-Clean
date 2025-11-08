"""
Train Neural Network for Cleaner-Client Matching

This management command trains the CleanerMatchNN model on preprocessed data
with early stopping, model checkpointing, and comprehensive metrics tracking.

Usage:
    python manage.py train_nn_model [options]

Features:
- Configurable hyperparameters
- Early stopping based on validation loss
- Model checkpointing (saves best model)
- Learning rate scheduling
- Comprehensive metrics (MSE, MAE, R²)
- Training history export (JSON + plots)
"""

from django.core.management.base import BaseCommand
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import ReduceLROnPlateau
import numpy as np
import json
import os
from datetime import datetime


class Command(BaseCommand):
    help = 'Train neural network model for cleaner-client matching'

    def add_arguments(self, parser):
        # Data arguments
        parser.add_argument(
            '--data-dir',
            type=str,
            default='nn_data',
            help='Directory with preprocessed data'
        )
        
        # Model arguments
        parser.add_argument(
            '--hidden-sizes',
            type=str,
            default='256,128,64,32',
            help='Comma-separated hidden layer sizes'
        )
        parser.add_argument(
            '--dropout-rates',
            type=str,
            default='0.3,0.3,0.2,0.0',
            help='Comma-separated dropout rates'
        )
        
        # Training arguments
        parser.add_argument(
            '--epochs',
            type=int,
            default=100,
            help='Maximum number of epochs'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=64,
            help='Batch size'
        )
        parser.add_argument(
            '--learning-rate',
            type=float,
            default=0.001,
            help='Initial learning rate'
        )
        parser.add_argument(
            '--weight-decay',
            type=float,
            default=1e-5,
            help='L2 regularization weight decay'
        )
        
        # Early stopping
        parser.add_argument(
            '--patience',
            type=int,
            default=15,
            help='Early stopping patience (epochs)'
        )
        parser.add_argument(
            '--min-delta',
            type=float,
            default=1e-4,
            help='Minimum improvement for early stopping'
        )
        
        # Output arguments
        parser.add_argument(
            '--model-dir',
            type=str,
            default='trained_models',
            help='Directory to save trained models'
        )
        parser.add_argument(
            '--experiment-name',
            type=str,
            default=None,
            help='Name for this experiment (auto-generated if not provided)'
        )

    def handle(self, *args, **options):
        # Parse arguments
        data_dir = options['data_dir']
        hidden_sizes = [int(x) for x in options['hidden_sizes'].split(',')]
        dropout_rates = [float(x) for x in options['dropout_rates'].split(',')]
        epochs = options['epochs']
        batch_size = options['batch_size']
        lr = options['learning_rate']
        weight_decay = options['weight_decay']
        patience = options['patience']
        min_delta = options['min_delta']
        model_dir = options['model_dir']
        experiment_name = options['experiment_name']
        
        # Generate experiment name if not provided
        if experiment_name is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            experiment_name = f'cleanermatch_{timestamp}'
        
        # Create output directory
        experiment_dir = os.path.join(model_dir, experiment_name)
        os.makedirs(experiment_dir, exist_ok=True)
        
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('NEURAL NETWORK TRAINING'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'\n📁 Experiment: {experiment_name}')
        self.stdout.write(f'📁 Output directory: {experiment_dir}')
        
        # Import model classes
        import sys
        sys.path.insert(0, '/app')
        from recommendations.ml_models.cleaner_match_nn import (
            CleanerMatchNN, create_data_loaders
        )
        
        # Load data
        self.stdout.write(f'\n📊 Loading data from {data_dir}...')
        train_loader, val_loader, test_loader = create_data_loaders(
            data_dir=data_dir,
            batch_size=batch_size,
            num_workers=0
        )
        self.stdout.write(f'   Train batches: {len(train_loader)} ({len(train_loader)*batch_size} samples)')
        self.stdout.write(f'   Val batches: {len(val_loader)} ({len(val_loader.dataset)} samples)')
        self.stdout.write(f'   Test batches: {len(test_loader)} ({len(test_loader.dataset)} samples)')
        
        # Create model
        self.stdout.write(f'\n🧠 Creating model...')
        # Get input size from first batch
        sample_features, _ = next(iter(train_loader))
        input_size = sample_features.shape[1]
        
        model = CleanerMatchNN(
            input_size=input_size,
            hidden_sizes=hidden_sizes,
            dropout_rates=dropout_rates
        )
        self.stdout.write(f'   Input size: {input_size}')
        self.stdout.write(f'   Hidden layers: {hidden_sizes}')
        self.stdout.write(f'   Dropout rates: {dropout_rates}')
        self.stdout.write(f'   Total parameters: {model.count_parameters():,}')
        
        # Setup training
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        model = model.to(device)
        self.stdout.write(f'\n⚙️  Training setup:')
        self.stdout.write(f'   Device: {device}')
        self.stdout.write(f'   Learning rate: {lr}')
        self.stdout.write(f'   Weight decay: {weight_decay}')
        self.stdout.write(f'   Batch size: {batch_size}')
        self.stdout.write(f'   Max epochs: {epochs}')
        self.stdout.write(f'   Early stopping patience: {patience}')
        
        # Loss function and optimizer
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
        scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=5)
        
        # Training history
        history = {
            'train_loss': [],
            'val_loss': [],
            'train_mae': [],
            'val_mae': [],
            'train_r2': [],
            'val_r2': [],
            'learning_rates': []
        }
        
        # Early stopping variables
        best_val_loss = float('inf')
        patience_counter = 0
        best_epoch = 0
        
        # Training loop
        self.stdout.write(f'\n🚀 Starting training...\n')
        
        for epoch in range(epochs):
            # Training phase
            model.train()
            train_losses = []
            train_predictions = []
            train_targets = []
            
            for batch_features, batch_targets in train_loader:
                batch_features = batch_features.to(device)
                batch_targets = batch_targets.to(device)
                
                # Forward pass
                optimizer.zero_grad()
                outputs = model(batch_features)
                loss = criterion(outputs, batch_targets)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                # Store metrics
                train_losses.append(loss.item())
                train_predictions.extend(outputs.detach().cpu().numpy())
                train_targets.extend(batch_targets.detach().cpu().numpy())
            
            # Calculate training metrics
            train_loss = np.mean(train_losses)
            train_mae = np.mean(np.abs(np.array(train_predictions) - np.array(train_targets)))
            train_r2 = self.calculate_r2(train_targets, train_predictions)
            
            # Validation phase
            model.eval()
            val_losses = []
            val_predictions = []
            val_targets = []
            
            with torch.no_grad():
                for batch_features, batch_targets in val_loader:
                    batch_features = batch_features.to(device)
                    batch_targets = batch_targets.to(device)
                    
                    outputs = model(batch_features)
                    loss = criterion(outputs, batch_targets)
                    
                    val_losses.append(loss.item())
                    val_predictions.extend(outputs.cpu().numpy())
                    val_targets.extend(batch_targets.cpu().numpy())
            
            # Calculate validation metrics
            val_loss = np.mean(val_losses)
            val_mae = np.mean(np.abs(np.array(val_predictions) - np.array(val_targets)))
            val_r2 = self.calculate_r2(val_targets, val_predictions)
            
            # Update learning rate scheduler
            scheduler.step(val_loss)
            current_lr = optimizer.param_groups[0]['lr']
            
            # Store history
            history['train_loss'].append(float(train_loss))
            history['val_loss'].append(float(val_loss))
            history['train_mae'].append(float(train_mae))
            history['val_mae'].append(float(val_mae))
            history['train_r2'].append(float(train_r2))
            history['val_r2'].append(float(val_r2))
            history['learning_rates'].append(float(current_lr))
            
            # Print progress
            if (epoch + 1) % 5 == 0 or epoch == 0:
                self.stdout.write(
                    f'Epoch {epoch+1:3d}/{epochs} | '
                    f'Train Loss: {train_loss:.4f} | '
                    f'Val Loss: {val_loss:.4f} | '
                    f'Val R²: {val_r2:.4f} | '
                    f'LR: {current_lr:.6f}'
                )
            
            # Check for improvement
            if val_loss < best_val_loss - min_delta:
                best_val_loss = val_loss
                best_epoch = epoch + 1
                patience_counter = 0
                
                # Save best model
                best_model_path = os.path.join(experiment_dir, 'best_model.pth')
                torch.save({
                    'epoch': epoch + 1,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'val_loss': val_loss,
                    'val_r2': val_r2,
                    'model_config': model.get_config(),
                }, best_model_path)
            else:
                patience_counter += 1
            
            # Early stopping check
            if patience_counter >= patience:
                self.stdout.write(f'\n⏹  Early stopping triggered at epoch {epoch+1}')
                self.stdout.write(f'   Best validation loss: {best_val_loss:.4f} at epoch {best_epoch}')
                break
        
        # Save final model
        final_model_path = os.path.join(experiment_dir, 'final_model.pth')
        torch.save({
            'epoch': epoch + 1,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'model_config': model.get_config(),
        }, final_model_path)
        
        # Save training history
        history_path = os.path.join(experiment_dir, 'training_history.json')
        with open(history_path, 'w') as f:
            json.dump(history, f, indent=2)
        
        # Final evaluation on test set
        self.stdout.write(f'\n📊 Evaluating on test set...')
        checkpoint = torch.load(best_model_path, weights_only=False)
        model.load_state_dict(checkpoint['model_state_dict'])
        test_metrics = self.evaluate_model(model, test_loader, criterion, device)
        
        # Save test metrics
        test_results_path = os.path.join(experiment_dir, 'test_results.json')
        with open(test_results_path, 'w') as f:
            json.dump(test_metrics, f, indent=2)
        
        # Print summary
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 70))
        self.stdout.write(self.style.SUCCESS('TRAINING COMPLETE'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'\n📈 Best Results (epoch {best_epoch}):')
        self.stdout.write(f'   Validation Loss: {best_val_loss:.4f}')
        self.stdout.write(f'   Validation R²: {history["val_r2"][best_epoch-1]:.4f}')
        
        self.stdout.write(f'\n🧪 Test Set Performance:')
        self.stdout.write(f'   Test Loss (MSE): {test_metrics["mse"]:.4f}')
        self.stdout.write(f'   Test MAE: {test_metrics["mae"]:.4f}')
        self.stdout.write(f'   Test R²: {test_metrics["r2"]:.4f}')
        
        self.stdout.write(f'\n💾 Saved files:')
        self.stdout.write(f'   {best_model_path}')
        self.stdout.write(f'   {final_model_path}')
        self.stdout.write(f'   {history_path}')
        self.stdout.write(f'   {test_results_path}')
        
        self.stdout.write(self.style.SUCCESS(f'\n✅ Model training completed successfully!'))
    
    def calculate_r2(self, y_true, y_pred):
        """Calculate R² score."""
        y_true = np.array(y_true).flatten()
        y_pred = np.array(y_pred).flatten()
        
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        
        r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
        return r2
    
    def evaluate_model(self, model, data_loader, criterion, device):
        """Evaluate model on a dataset."""
        model.eval()
        predictions = []
        targets = []
        losses = []
        
        with torch.no_grad():
            for batch_features, batch_targets in data_loader:
                batch_features = batch_features.to(device)
                batch_targets = batch_targets.to(device)
                
                outputs = model(batch_features)
                loss = criterion(outputs, batch_targets)
                
                predictions.extend(outputs.cpu().numpy())
                targets.extend(batch_targets.cpu().numpy())
                losses.append(loss.item())
        
        predictions = np.array(predictions).flatten()
        targets = np.array(targets).flatten()
        
        return {
            'mse': float(np.mean(losses)),
            'mae': float(np.mean(np.abs(predictions - targets))),
            'r2': float(self.calculate_r2(targets, predictions)),
            'n_samples': len(targets)
        }
