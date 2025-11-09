#!/usr/bin/env python
"""Test ML service directly with real embeddings"""
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
sys.path.insert(0, '/app')
django.setup()

from recommendations.services.nn_feature_extractor import NNFeatureExtractor
from recommendations.services import ml_client
from cleaning_jobs.models import CleaningJob
from users.models import User

# Get job and cleaner objects
job = CleaningJob.objects.get(id=3)
cleaner = User.objects.get(id=29)

# Extract features
extractor = NNFeatureExtractor()
features = extractor.extract_for_job_cleaner_pair(job, cleaner)

print(f"\n=== Testing ML Service with Real Embeddings ===")
print(f"Features shape: {features.shape}")
print(f"Non-zero count: {(features != 0).sum()} / {len(features)}")

# Call ML service directly
try:
    result = ml_client.predict_nn_single(features.tolist())
    print(f"\n✅ ML Service Response:")
    print(f"   Match Score: {result['match_score']:.4f}")
    print(f"   Denormalized Rating: {result['denormalized_rating']:.2f}")
    print(f"   Inference Time: {result['inference_time_ms']:.2f}ms")
    
    if result['match_score'] > 0:
        print(f"\n🎉 SUCCESS! Model is now producing non-zero predictions!")
    else:
        print(f"\n⚠️  Still getting zero predictions")
        
except Exception as e:
    print(f"\n❌ Error: {e}")
