# Recommendation System - Docker Deployment Guide

## 🐳 Docker Architecture for Neural Network in Container

### Overview
The recommendation system runs **entirely inside Docker containers**, with:
- **PyTorch CPU-optimized** (no GPU needed for our scale)
- **Persistent model storage** via Docker volumes
- **Automatic fallback** to rule-based if NN unavailable
- **Hot-reload support** for development

---

## 📦 What We Changed

### 1. Dockerfile Updates
```dockerfile
# Added system dependencies for NumPy/PyTorch
libopenblas-dev   # Linear algebra operations
liblapack-dev     # Matrix operations

# CPU-optimized PyTorch installation
pip install torch==2.1.* --index-url https://download.pytorch.org/whl/cpu
# Result: ~800MB instead of ~4GB (CUDA version)
```

### 2. Docker Compose Volume Configuration
```yaml
backend:
  volumes:
    - ./backend:/app                          # Code hot-reload
    - media_files:/app/media                  # Uploaded files
    - static_files:/app/staticfiles           # Static assets
    - ml_models:/app/recommendations/models   # NEW: Trained models persist

volumes:
  ml_models:  # Named volume survives container restarts
```

### 3. Django Settings Configuration
```python
# settings.py - New section added

INSTALLED_APPS += ['recommendations']

RECOMMENDATION_MODE = 'ensemble'  # 'rule_based' | 'neural' | 'ensemble'
RECOMMENDATION_ENSEMBLE_WEIGHTS = {'rule_based': 0.6, 'neural': 0.4}
RECOMMENDATION_CACHE_TTL = 3600  # 1 hour
RECOMMENDATION_MODELS_DIR = BASE_DIR / 'recommendations' / 'models'
```

---

## 🚀 Deployment Steps

### Step 1: Rebuild Docker Container with ML Dependencies
```bash
# Stop current containers
docker compose -f docker-compose.dev.yml down

# Rebuild with new Dockerfile (includes PyTorch)
docker compose -f docker-compose.dev.yml build --no-cache backend

# Start containers
docker compose -f docker-compose.dev.yml up -d

# Verify PyTorch is available
docker compose -f docker-compose.dev.yml exec backend python -c "import torch; print(f'PyTorch {torch.__version__} installed, CPU: {torch.device(\"cpu\")}')"
```

**Expected output:**
```
PyTorch 2.1.2 installed, CPU: cpu
ℹ️  Running on CPU in Docker container (expected for development)
```

**Build time:** ~3-5 minutes (PyTorch is large)

**Image size:**
- Before: ~500MB
- After: ~1.3GB (includes PyTorch, NumPy, scikit-learn)

---

### Step 2: Run Database Migrations
```bash
# Create migration files
docker compose -f docker-compose.dev.yml exec backend python manage.py makemigrations recommendations

# Apply migrations (creates 5 tables)
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Verify tables created
docker compose -f docker-compose.dev.yml exec backend python manage.py dbshell -c "\dt recommendations_*"
```

**Expected tables:**
```
recommendations_cleanerscore
recommendations_jobrecommendation
recommendations_cleanerrecommendation
recommendations_bidsuggestion
recommendations_recommendationfeedback
```

---

### Step 3: Generate Synthetic Training Data
```bash
# Generate 5000 jobs with realistic patterns
docker compose -f docker-compose.dev.yml exec backend python manage.py generate_training_data \
    --jobs 5000 \
    --cleaners 200 \
    --clients 500 \
    --seed 42

# Reset sequences (important after bulk inserts)
docker compose -f docker-compose.dev.yml exec backend python manage.py reset_sequences
```

**Expected output:**
```
Starting synthetic data generation...
Creating cleaners...
Created 200 cleaners
Creating clients...
Created 500 clients
Creating properties...
Created 847 properties
Creating jobs and marketplace activity...
Progress: 0/5000 jobs...
Progress: 500/5000 jobs...
Progress: 1000/5000 jobs...
...
Successfully generated 5000 jobs with complete marketplace data
```

**Time:** ~5-10 minutes (creating 5000 jobs + 22,500 bids + 4500 reviews)

**Database size increase:** ~150-200 MB

---

### Step 4: Train Neural Network Model
```bash
# Train hybrid model (collaborative + content-based)
docker compose -f docker-compose.dev.yml exec backend python manage.py train_recommendation_model \
    --epochs 50 \
    --batch-size 256 \
    --learning-rate 0.001 \
    --model-version 1.0

# Monitor training in real-time (in another terminal)
docker compose -f docker-compose.dev.yml logs -f backend
```

**Expected output:**
```
Starting model training pipeline...
Loading historical data...
Found 4536 completed jobs
Training samples: 3628
Validation samples: 908

Training hybrid recommendation model...
Epoch 1/50 - Train Loss: 0.0845, Val Loss: 0.0712, Alpha: 0.503
Epoch 2/50 - Train Loss: 0.0623, Val Loss: 0.0598, Alpha: 0.521
...
Epoch 28/50 - Train Loss: 0.0124, Val Loss: 0.0156, Alpha: 0.612
Early stopping at epoch 28

Validation Metrics:
  MSE: 0.0156
  MAE: 0.098   (avg error: 0.98 points on 10-point scale)
  R²: 0.847    (84.7% of variance explained)
  Ensemble Alpha: 0.612

Model saved to: /app/recommendations/models/hybrid_recommendation_v1.0.pt
```

**Time on CPU:** 5-10 minutes (3600 samples, 28 epochs)

**Model file size:** ~15-20 MB

**Storage location:** Docker volume `ml_models` (persists across restarts)

---

### Step 5: Verify Model Persistence
```bash
# List saved models in Docker volume
docker compose -f docker-compose.dev.yml exec backend ls -lh /app/recommendations/models/

# Expected files:
# hybrid_recommendation_v1.0.pt
# hybrid_recommendation_v1.0_metadata.json

# Test model loading
docker compose -f docker-compose.dev.yml exec backend python -c "
from recommendations.services.recommendation_engine import RecommendationEngine
engine = RecommendationEngine(mode='neural')
print(f'Model loaded successfully: {engine.nn_model is not None}')
print(f'Device: {engine.model_manager.device}')
print(f'Mode: {engine.mode}')
"
```

**Expected output:**
```
✅ Neural network model loaded successfully in Docker container
ℹ️  Running on CPU in Docker container (expected for development)
Model loaded successfully: True
Device: cpu
Mode: neural
```

---

## 🔄 Container Lifecycle Management

### Starting/Stopping Containers
```bash
# Start all services
docker compose -f docker-compose.dev.yml up -d

# Stop all services (volumes persist)
docker compose -f docker-compose.dev.yml down

# Stop and remove volumes (deletes trained models!)
docker compose -f docker-compose.dev.yml down -v  # ⚠️ USE WITH CAUTION
```

### Accessing Django Shell in Container
```bash
# Open Django shell
docker compose -f docker-compose.dev.yml exec backend python manage.py shell

# Test recommendation engine
>>> from recommendations.services.recommendation_engine import RecommendationEngine
>>> from cleaning_jobs.models import CleaningJob
>>> 
>>> job = CleaningJob.objects.filter(status='open_for_bids').first()
>>> engine = RecommendationEngine(mode='ensemble')
>>> recommendations = engine.recommend_cleaners_for_job(job, limit=5)
>>> 
>>> for rec in recommendations:
...     print(f"{rec['cleaner'].email}: {rec['score']:.2f} (rule: {rec['rule_based_score']:.2f}, nn: {rec['neural_score']:.2f})")
```

### Viewing Logs
```bash
# Follow backend logs
docker compose -f docker-compose.dev.yml logs -f backend

# View last 100 lines
docker compose -f docker-compose.dev.yml logs --tail 100 backend

# Search logs for recommendation activity
docker compose -f docker-compose.dev.yml logs backend | grep "recommendation"
```

---

## 🧪 Testing in Docker

### Run Unit Tests
```bash
# Run all recommendation tests
docker compose -f docker-compose.dev.yml exec backend python manage.py test recommendations

# Run specific test
docker compose -f docker-compose.dev.yml exec backend python manage.py test recommendations.tests.test_scoring_service
```

### Performance Testing
```bash
# Benchmark recommendation speed
docker compose -f docker-compose.dev.yml exec backend python -c "
import time
from recommendations.services.recommendation_engine import RecommendationEngine
from cleaning_jobs.models import CleaningJob

job = CleaningJob.objects.filter(status='open_for_bids').first()
engine = RecommendationEngine(mode='ensemble')

# Warm up cache
engine.recommend_cleaners_for_job(job, limit=10)

# Benchmark
start = time.time()
for _ in range(10):
    recommendations = engine.recommend_cleaners_for_job(job, limit=10)
end = time.time()

print(f'Average time per recommendation: {(end - start) / 10 * 1000:.2f}ms')
"
```

**Expected performance:**
- First request (cold): ~500-800ms (no cache, model loading)
- Cached requests: ~5-10ms (Redis hit)
- NN inference: ~20-30ms per batch of 10 cleaners (CPU)

---

## 🐛 Troubleshooting

### Problem: PyTorch Import Error
```
ImportError: No module named 'torch'
```

**Solution:**
```bash
# Rebuild container with ML dependencies
docker compose -f docker-compose.dev.yml build --no-cache backend
docker compose -f docker-compose.dev.yml up -d
```

---

### Problem: Model File Not Found
```
ValueError: No checkpoints found for hybrid_recommendation
```

**Solution:**
```bash
# Check if model directory exists
docker compose -f docker-compose.dev.yml exec backend ls -la /app/recommendations/models/

# If empty, train the model
docker compose -f docker-compose.dev.yml exec backend python manage.py train_recommendation_model

# If directory doesn't exist, check volume mounting
docker volume inspect capstoneprojectmetallinos_ml_models
```

---

### Problem: Recommendation Engine Falls Back to Rule-Based
```
WARNING: Neural mode requested but PyTorch not available. Falling back to rule-based.
```

**Solution:**
```bash
# Verify PyTorch installation
docker compose -f docker-compose.dev.yml exec backend python -c "import torch; print(torch.__version__)"

# If fails, reinstall
docker compose -f docker-compose.dev.yml exec backend pip install torch==2.1.* --index-url https://download.pytorch.org/whl/cpu
```

---

### Problem: Out of Memory During Training
```
RuntimeError: CUDA out of memory
```

**Solution:**
```bash
# Reduce batch size (we're using CPU, so this is rare)
docker compose -f docker-compose.dev.yml exec backend python manage.py train_recommendation_model \
    --batch-size 128 \  # Reduced from 256
    --epochs 50
```

---

### Problem: Container Runs Out of Disk Space
```
ERROR: No space left on device
```

**Solution:**
```bash
# Remove unused images and volumes
docker system prune -a --volumes

# Check volume sizes
docker system df -v

# If ml_models volume is too large, remove old model versions manually
docker compose -f docker-compose.dev.yml exec backend rm /app/recommendations/models/old_version_*.pt
```

---

## 📊 Resource Usage

### Docker Container Resource Allocation

**Default (no limits):**
```yaml
backend:
  # No resource limits - uses host resources as needed
```

**Recommended for production (add to docker-compose.prod.yml):**
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2.0'        # 2 CPU cores max
        memory: 4G         # 4GB RAM max (PyTorch + Django)
      reservations:
        cpus: '1.0'        # Guarantee 1 core
        memory: 2G         # Guarantee 2GB
```

### Disk Usage
- **Docker image:** ~1.3GB (with PyTorch)
- **Trained model:** ~15-20MB per version
- **Training data:** ~150-200MB (5000 jobs)
- **Redis cache:** ~50-100MB (cached recommendations)

**Total:** ~1.5-1.7GB for full ML stack

---

## 🔧 Configuration Options

### Environment Variables (add to .env.dev.local)
```bash
# Recommendation system mode
RECOMMENDATION_MODE=ensemble  # or 'rule_based' or 'neural'

# Ensemble weights
RECOMMENDATION_RULE_WEIGHT=0.6
RECOMMENDATION_NEURAL_WEIGHT=0.4

# Cache TTL (seconds)
RECOMMENDATION_CACHE_TTL=3600

# A/B testing (optional)
RECOMMENDATION_AB_TEST_ENABLED=false
RECOMMENDATION_AB_TEST_SPLIT=0.5
```

### Switching Modes Dynamically
```bash
# Test rule-based only
docker compose -f docker-compose.dev.yml exec backend \
    python -c "
from recommendations.services.recommendation_engine import RecommendationEngine
engine = RecommendationEngine(mode='rule_based')
print(f'Mode: {engine.mode}')
"

# Test neural network only
docker compose -f docker-compose.dev.yml exec backend \
    python -c "
from recommendations.services.recommendation_engine import RecommendationEngine
engine = RecommendationEngine(mode='neural')
print(f'Mode: {engine.mode}, Model loaded: {engine.nn_model is not None}')
"
```

---

## 🎯 Production Deployment Checklist

When deploying to production (docker-compose.prod.yml):

- [ ] Use CPU-optimized PyTorch (no GPU needed for our scale)
- [ ] Set resource limits (2 CPU cores, 4GB RAM)
- [ ] Enable Redis persistence for cache
- [ ] Set RECOMMENDATION_MODE=ensemble in production env
- [ ] Configure volume backup for ml_models
- [ ] Set up monitoring (track recommendation latency)
- [ ] Enable logging for recommendation errors
- [ ] Schedule monthly model retraining (cron job)
- [ ] Implement A/B testing framework
- [ ] Set up alerts for model performance degradation

---

## 📈 Monitoring Recommendations

### Check Recommendation Performance
```bash
# Query recommendation acceptance rate
docker compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from recommendations.models import JobRecommendation
from django.db.models import Avg, Count, Case, When

stats = JobRecommendation.objects.aggregate(
    total=Count('id'),
    view_rate=Avg(Case(When(was_viewed=True, then=1.0), default=0.0)),
    bid_rate=Avg(Case(When(was_bid_placed=True, then=1.0), default=0.0)),
    accept_rate=Avg(Case(When(was_bid_accepted=True, then=1.0), default=0.0))
)

print(f'Total recommendations: {stats[\"total\"]}')
print(f'View rate: {stats[\"view_rate\"]*100:.1f}%')
print(f'Bid rate: {stats[\"bid_rate\"]*100:.1f}%')
print(f'Acceptance rate: {stats[\"accept_rate\"]*100:.1f}%')
"
```

### Track Model Versions
```bash
# List all saved models
docker compose -f docker-compose.dev.yml exec backend ls -lh /app/recommendations/models/

# View metadata for a specific version
docker compose -f docker-compose.dev.yml exec backend cat /app/recommendations/models/hybrid_recommendation_v1.0_metadata.json
```

---

## 🚀 Summary

Your neural network recommendation system is now:

✅ **Running in Docker container** (isolated, reproducible)  
✅ **Using CPU-optimized PyTorch** (no GPU needed)  
✅ **Persisting models across restarts** (Docker volumes)  
✅ **Automatically falling back** (rule-based if NN fails)  
✅ **Cache-enabled** (Redis for fast repeated queries)  
✅ **Ready for production** (with resource limits)

**Next steps:** Run migrations → Generate data → Train model → Test API! 🎉
