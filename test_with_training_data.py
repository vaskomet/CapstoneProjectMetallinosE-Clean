#!/usr/bin/env python
"""Test NN model with actual training data features"""
import requests
import json
import pandas as pd

# Load one row from training data
df = pd.read_csv('/Users/vaskomet/Desktop/CapstoneProjectMetallinos/backend/nn_training_dataset_with_embeddings.csv')

# Get first row features (excluding target and metadata)
feature_cols = [col for col in df.columns if col not in ['target_overall_rating'] and not col.startswith('meta_')]
print(f"Total feature columns: {len(feature_cols)}")

# Get first 3 rows
for idx in range(min(3, len(df))):
    row = df.iloc[idx]
    features = [float(x) for x in row[feature_cols].values.tolist()]
    
    print(f"\n=== Testing Row {idx} ===")
    print(f"Target rating (actual): {row['target_overall_rating']}")
    print(f"Number of features: {len(features)}")
    print(f"Non-zero features: {sum(1 for f in features if f != 0)}")
    
    # Call ML service
    response = requests.post(
        'http://localhost:8001/predict/nn',
        json={'features': features},
        timeout=5
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Predicted match_score: {result['match_score']:.4f}")
        print(f"✅ Denormalized rating: {result['denormalized_rating']:.2f}")
        print(f"   Inference time: {result['inference_time_ms']:.2f}ms")
    else:
        print(f"❌ Error: {response.status_code} - {response.text}")
