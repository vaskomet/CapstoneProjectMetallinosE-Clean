#!/usr/bin/env python
"""Debug script to check if embeddings are being generated"""
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

# Get job and cleaner objects
job = CleaningJob.objects.get(id=3)
cleaner = User.objects.get(id=29)

extractor = NNFeatureExtractor()
features = extractor.extract_for_job_cleaner_pair(job, cleaner)

print("\n=== Feature Analysis with Real Embeddings ===")
print(f"Shape: {features.shape}")
print(f"Dtype: {features.dtype}")
print(f"Min: {features.min():.4f}")
print(f"Max: {features.max():.4f}")
print(f"Mean: {features.mean():.4f}")
print(f"Std: {features.std():.4f}")
print(f"Has NaN: {np.isnan(features).any()}")
print(f"Has Inf: {np.isinf(features).any()}")
print(f"Non-zero count: {np.count_nonzero(features)} / {len(features)}")
print(f"Zero count: {(features == 0).sum()}")

# Check embeddings specifically
embedding_start = 43
embeddings = features[embedding_start:]
print(f"\n=== Embedding Analysis ===")
print(f"Total embeddings: {len(embeddings)}")
print(f"Zero embeddings: {(embeddings == 0).sum()}")
print(f"Non-zero embeddings: {np.count_nonzero(embeddings)}")
print(f"Embedding min: {embeddings.min():.6f}")
print(f"Embedding max: {embeddings.max():.6f}")
print(f"First 10 embeddings: {embeddings[:10]}")
