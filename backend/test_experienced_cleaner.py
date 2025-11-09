#!/usr/bin/env python
"""Test with an experienced cleaner who has job history"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
sys.path.insert(0, '/app')
django.setup()

from recommendations.services.nn_recommendation_engine import NNRecommendationEngine
from cleaning_jobs.models import CleaningJob
from users.models import User
from reviews.models import Review

# Find cleaners with actual reviews
cleaners_with_reviews = Review.objects.values('cleaner_id').annotate(
    count=models.Count('id')
).filter(count__gt=0).order_by('-count')[:5]

print("=== Cleaners with Reviews ===")
from django.db import models
for c in cleaners_with_reviews:
    cleaner = User.objects.get(id=c['cleaner_id'])
    print(f"Cleaner {cleaner.id}: {cleaner.email} - {c['count']} reviews")

# Get job 3
job = CleaningJob.objects.get(id=3)

if cleaners_with_reviews:
    # Test with first experienced cleaner
    experienced_cleaner_id = cleaners_with_reviews[0]['cleaner_id']
    
    print(f"\n=== Testing with Experienced Cleaner {experienced_cleaner_id} ===")
    
    engine = NNRecommendationEngine()
    recommendations = engine.get_recommendations(
        job=job,
        cleaner_ids=[experienced_cleaner_id],
        top_k=1,
        min_score=0.0
    )
    
    if recommendations:
        rec = recommendations[0]
        cleaner = rec.get('cleaner') or rec.get('user')
        print(f"\nCleaner: {cleaner.email}")
        print(f"Match Score: {rec['match_score']:.4f}")
        print(f"Denormalized Rating: {rec['denormalized_rating']:.2f}")
        print(f"Method: {rec.get('method_used', 'unknown')}")
        
        if rec['match_score'] > 0:
            print(f"\n✅ SUCCESS! Non-zero prediction with experienced cleaner!")
        else:
            print(f"\n⚠️  Still zero even with experienced cleaner")
else:
    print("\n❌ No cleaners with reviews found in database")
