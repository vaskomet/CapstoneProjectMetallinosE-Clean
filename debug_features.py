#!/usr/bin/env python
"""Debug script to analyze extracted features"""
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
sys.path.insert(0, '/app')
django.setup()

from recommendations.services.nn_feature_extractor import NNFeatureExtractor
from cleaning_jobs.models import CleaningJob
from users.models import User
import numpy as np

extractor = NNFeatureExtractor()

# Get job and cleaner objects
job = CleaningJob.objects.get(id=3)
cleaner = User.objects.get(id=29)

features = extractor.extract_for_job_cleaner_pair(job, cleaner)

print("\n=== Feature Analysis ===")
print(f"Shape: {features.shape}")
print(f"Dtype: {features.dtype}")
print(f"Min: {features.min():.4f}")
print(f"Max: {features.max():.4f}")
print(f"Mean: {features.mean():.4f}")
print(f"Std: {features.std():.4f}")
print(f"Has NaN: {np.isnan(features).any()}")
print(f"Has Inf: {np.isinf(features).any()}")
print(f"Non-zero count: {np.count_nonzero(features)}")
print(f"Zero count: {(features == 0).sum()}")

# Show first 50 features
print("\n=== First 50 Features (Non-embedding) ===")
for i in range(min(50, len(features))):
    print(f"Feature {i:3d}: {features[i]:10.4f}")

# Count zero embeddings
embedding_start = 43  # After first 43 engineered features
embeddings = features[embedding_start:]
print(f"\n=== Embedding Analysis ===")
print(f"Total embeddings: {len(embeddings)}")
print(f"Zero embeddings: {(embeddings == 0).sum()}")
print(f"Non-zero embeddings: {np.count_nonzero(embeddings)}")
