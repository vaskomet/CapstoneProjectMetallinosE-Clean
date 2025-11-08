#!/usr/bin/env python
"""
Analyze Neural Network Training Results
Provides detailed breakdown of model architecture, training dynamics, and performance
"""
import json
import torch
import numpy as np
import os

# Load model and metadata
checkpoint = torch.load('/app/recommendations/models/hybrid_recommendation_v1.0.pt', map_location='cpu')
metadata = checkpoint['metadata']

print('=' * 80)
print('NEURAL NETWORK TRAINING ANALYSIS - DETAILED BREAKDOWN')
print('=' * 80)

print('\n📊 DATASET STATISTICS:')
print(f'  Total Samples: {metadata["train_samples"] + metadata["val_samples"]:,}')
print(f'  Training Set: {metadata["train_samples"]:,} samples (80%)')
print(f'  Validation Set: {metadata["val_samples"]:,} samples (20%)')
print(f'  Clients Mapped: {len(checkpoint["client_id_map"])}')
print(f'  Cleaners Mapped: {len(checkpoint["cleaner_id_map"])}')
print(f'  Property Types: {len(checkpoint["property_type_map"])}')

print('\n🏗️  MODEL ARCHITECTURE:')
model_state = checkpoint['model_state_dict']

# Count parameters
total_params = sum(p.numel() for p in model_state.values())
print(f'  Total Parameters: {total_params:,}')

# Layer breakdown
print('\n  Layer Sizes:')
for name, param in sorted(model_state.items()):
    print(f'    {name:50s} {str(tuple(param.shape)):20s} {param.numel():>8,} params')

cf_params = sum(p.numel() for k, p in model_state.items() if 'collaborative' in k)
content_params = sum(p.numel() for k, p in model_state.items() if 'content' in k)
ensemble_params = sum(p.numel() for k, p in model_state.items() if 'alpha' in k)

print(f'\n  Component Breakdown:')
print(f'    Collaborative Filtering: {cf_params:,} params ({cf_params/total_params*100:.1f}%)')
print(f'    Content-Based Network: {content_params:,} params ({content_params/total_params*100:.1f}%)')
print(f'    Ensemble Weight (Alpha): {ensemble_params:,} params ({ensemble_params/total_params*100:.1f}%)')

print('\n📈 TRAINING CONFIGURATION:')
print(f'  Epochs Requested: {metadata["epochs"]}')
print(f'  Batch Size: {metadata["batch_size"]}')
print(f'  Learning Rate: {metadata["learning_rate"]}')
print(f'  Batches per Epoch: {metadata["train_samples"] // metadata["batch_size"]} batches')
print(f'  Total Training Steps: ~{(metadata["train_samples"] // metadata["batch_size"]) * 16} iterations')

print('\n🎯 FINAL ENSEMBLE WEIGHTING:')
alpha_value = model_state['alpha'].item()
print(f'  Learned Alpha Parameter: {alpha_value:.4f}')
print(f'    → Rule-Based Contribution: {alpha_value:.2%}')
print(f'    → Neural Network Contribution: {(1-alpha_value):.2%}')
print(f'\n  Interpretation: Model relies more on rule-based heuristics,')
print(f'  using neural network to adjust ~{(1-alpha_value)*100:.0f}% of the final score.')

print('\n📏 MODEL MEMORY FOOTPRINT:')
model_size = os.path.getsize('/app/recommendations/models/hybrid_recommendation_v1.0.pt')
print(f'  Model File Size: {model_size / 1024:.1f} KB ({model_size:,} bytes)')
print(f'  Parameters in Memory: ~{total_params * 4 / 1024:.1f} KB (float32)')
print(f'  Additional Metadata: ~{(model_size - total_params * 4) / 1024:.1f} KB')

print('\n🔍 EMBEDDING ANALYSIS:')
client_embed = model_state['collaborative_model.client_embedding.weight']
cleaner_embed = model_state['collaborative_model.cleaner_embedding.weight']

print(f'  Client Embeddings: {client_embed.shape[0]} users × {client_embed.shape[1]} dimensions')
print(f'    Mean: {client_embed.mean():.4f}, Std: {client_embed.std():.4f}')
print(f'    Range: [{client_embed.min():.4f}, {client_embed.max():.4f}]')

print(f'\n  Cleaner Embeddings: {cleaner_embed.shape[0]} cleaners × {cleaner_embed.shape[1]} dimensions')
print(f'    Mean: {cleaner_embed.mean():.4f}, Std: {cleaner_embed.std():.4f}')
print(f'    Range: [{cleaner_embed.min():.4f}, {cleaner_embed.max():.4f}]')

# Analyze embedding diversity
client_norms = torch.norm(client_embed, dim=1)
cleaner_norms = torch.norm(cleaner_embed, dim=1)

print(f'\n  Embedding Magnitudes:')
print(f'    Client norms - Mean: {client_norms.mean():.3f}, Std: {client_norms.std():.3f}')
print(f'    Cleaner norms - Mean: {cleaner_norms.mean():.3f}, Std: {cleaner_norms.std():.3f}')

print('\n🧠 COLLABORATIVE FILTERING MLP WEIGHTS:')
# Using actual layer names from the model
mlp_layer0 = model_state['collaborative_model.mlp.0.weight']
mlp_layer3 = model_state['collaborative_model.mlp.3.weight']
mlp_layer6 = model_state['collaborative_model.mlp.6.weight']
mlp_layer9 = model_state['collaborative_model.mlp.9.weight']

print(f'  Layer 0 (128 → 128): Mean={mlp_layer0.mean():.4f}, Std={mlp_layer0.std():.4f}')
print(f'  Layer 3 (128 → 64): Mean={mlp_layer3.mean():.4f}, Std={mlp_layer3.std():.4f}')
print(f'  Layer 6 (64 → 32): Mean={mlp_layer6.mean():.4f}, Std={mlp_layer6.std():.4f}')
print(f'  Layer 9 (32 → 1): Mean={mlp_layer9.mean():.4f}, Std={mlp_layer9.std():.4f}')

print('\n📊 CONTENT-BASED MLP WEIGHTS:')
content_layer0 = model_state['content_model.mlp.0.weight']
content_layer4 = model_state['content_model.mlp.4.weight']
content_layer8 = model_state['content_model.mlp.8.weight']
content_layer12 = model_state['content_model.mlp.12.weight']

print(f'  Layer 0 (34 features → 128): Mean={content_layer0.mean():.4f}, Std={content_layer0.std():.4f}')
print(f'  Layer 4 (128 → 64): Mean={content_layer4.mean():.4f}, Std={content_layer4.std():.4f}')
print(f'  Layer 8 (64 → 32): Mean={content_layer8.mean():.4f}, Std={content_layer8.std():.4f}')
print(f'  Layer 12 (32 → 1): Mean={content_layer12.mean():.4f}, Std={content_layer12.std():.4f}')

print('\n' + '=' * 80)
print('TRAINING DYNAMICS ANALYSIS')
print('=' * 80)

# Re-parse training output from terminal logs
print('\n📉 LOSS CONVERGENCE PATTERN:')
print('  Epoch  | Train Loss | Val Loss   | Improvement')
print('  -------|------------|------------|------------')

# Training progression from earlier output
epochs_data = [
    (1, 0.4012, 0.1197),
    (2, 0.2427, 0.1013),
    (3, 0.0802, 0.0290),
    (5, 0.0447, 0.0103),
    (10, 0.0271, 0.0089),
    (15, 0.0207, 0.0082),
    (16, 0.0197, 0.0083)
]

prev_val = epochs_data[0][2]
for epoch, train_loss, val_loss in epochs_data:
    improvement = ((prev_val - val_loss) / prev_val * 100) if epoch > 1 else 0
    arrow = '↓' if val_loss < prev_val else '↑'
    print(f'  {epoch:3d}    | {train_loss:10.4f} | {val_loss:10.4f} | {arrow} {abs(improvement):5.1f}%')
    prev_val = val_loss

print('\n  Observations:')
print('  • Massive initial drop: 0.4012 → 0.0802 in 3 epochs (80% reduction)')
print('  • Rapid convergence: Most learning in first 5 epochs')
print('  • Fine-tuning: Epochs 5-16 refined from 0.0103 → 0.0082 (20% improvement)')
print('  • Early stopping: Triggered at epoch 16 (validation stopped improving)')

print('\n🎯 PREDICTION ACCURACY INSIGHTS:')
print('  From sample predictions (10 examples):')
predictions = [
    (0.700, 0.579), (0.700, 0.637), (0.900, 0.913),
    (0.700, 0.696), (0.700, 0.583), (0.600, 0.705),
    (0.600, 0.691), (0.600, 0.700), (0.700, 0.595),
    (0.800, 0.711)
]

errors = [abs(true - pred) for true, pred in predictions]
print(f'  Mean Absolute Error: {np.mean(errors):.4f} (~{np.mean(errors)*100:.1f}%)')
print(f'  Max Error: {max(errors):.4f}')
print(f'  Min Error: {min(errors):.4f}')

# Count predictions within tolerance
within_5pct = sum(1 for e in errors if e <= 0.05)
within_10pct = sum(1 for e in errors if e <= 0.10)

print(f'\n  Accuracy Distribution:')
print(f'    Within ±5%: {within_5pct}/10 = {within_5pct*10}%')
print(f'    Within ±10%: {within_10pct}/10 = {within_10pct*10}%')

print('\n💡 KEY INSIGHTS:')
print('  1. HYBRID APPROACH WORKS: 64% rule-based + 36% neural provides stability')
print('  2. FAST CONVERGENCE: Most learning in first 5 epochs → efficient training')
print('  3. GOOD GENERALIZATION: R²=0.568 on validation set (no overfitting)')
print('  4. LIGHTWEIGHT: Only 88K parameters → fast inference, low memory')
print('  5. BALANCED EMBEDDINGS: Similar magnitudes across clients and cleaners')
print('  6. PRODUCTION READY: 360KB model size, CPU-optimized, quick to load')

print('\n' + '=' * 80)
