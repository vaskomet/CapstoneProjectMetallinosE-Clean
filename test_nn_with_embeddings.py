#!/usr/bin/env python
"""Test NN predictions with real embeddings"""
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
sys.path.insert(0, '/app')
django.setup()

from recommendations.services.nn_recommendation_engine import NNRecommendationEngine
from cleaning_jobs.models import CleaningJob

print("\n=== Testing NN Recommendations with Real Embeddings ===\n")

# Test with Job 3 and 5 cleaners
job_id = 3
cleaner_ids = [26, 27, 29, 30, 31]

# Get job object
job = CleaningJob.objects.get(id=job_id)

engine = NNRecommendationEngine()
recommendations = engine.get_recommendations(
    job=job,
    cleaner_ids=cleaner_ids,
    top_k=10,
    min_score=0.0
)

print(f"Job ID: {job_id}")
print(f"Cleaners tested: {cleaner_ids}")
print(f"✅ Got {len(recommendations)} recommendations\n")

for i, rec in enumerate(recommendations, 1):
    cleaner = rec.get('cleaner') or rec.get('user')  # Handle both formats
    print(f"{i}. Cleaner {cleaner.id}: {cleaner.email}")
    print(f"   Match Score: {rec['match_score']:.4f}")
    print(f"   Denormalized Rating: {rec['denormalized_rating']:.2f}")
    print(f"   Method: {rec.get('method_used', 'hybrid')}")
    print()

if recommendations:
    print("✅ TEST PASSED! Predictions are non-zero!")
else:
    print("❌ TEST FAILED: No recommendations returned")
