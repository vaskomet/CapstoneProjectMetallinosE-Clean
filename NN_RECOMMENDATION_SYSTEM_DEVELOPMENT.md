# Neural Network Recommendation System Development

**Project**: E-Clean Platform - Cleaner Recommendation System  
**Developer**: Vasko Metallinos  
**Start Date**: November 9, 2025  
**Branch**: `feature/neural-network-recommendations`  
**Purpose**: Academic project report documentation for Capstone Project

---

## Executive Summary

This document chronicles the development of an advanced Neural Network-based recommendation system for the E-Clean marketplace platform. The system aims to predict optimal cleaner-client matches by analyzing historical job data, property characteristics, cleaner performance metrics, and client preferences. This represents a significant enhancement over the existing hybrid scoring algorithm, introducing machine learning capabilities to improve match quality and client satisfaction.

---

## Table of Contents

1. [Project Context](#project-context)
2. [Problem Statement](#problem-statement)
3. [Research & Planning Phase](#research--planning-phase)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Phases](#implementation-phases)
6. [Development Log](#development-log)
7. [Testing & Validation](#testing--validation)
8. [Performance Metrics](#performance-metrics)
9. [Challenges & Solutions](#challenges--solutions)
10. [Future Enhancements](#future-enhancements)
11. [Academic Contribution](#academic-contribution)

---

## Project Context

### Platform Overview

E-Clean is a Django REST Framework + React marketplace connecting clients with professional cleaning service providers in Athens, Greece. The platform features:

- **Real-time communication** via WebSockets (Django Channels)
- **Payment processing** through Stripe integration
- **Bidding system** for job assignments
- **Photo documentation** workflow
- **Review & rating** system
- **Service area management** with GPS-based matching

### Existing Recommendation System

Prior to NN implementation, the platform used a **hybrid scoring algorithm**:

```python
# Quality-first scoring (implemented November 2025)
score = (
    0.60 * normalized_rating +      # 60% weight on service quality
    0.25 * normalized_experience +  # 25% weight on job count
    0.15 * normalized_completion    # 15% weight on completion rate
)

# History boost for returning cleaners
if previous_jobs == 1:
    score *= 1.25  # 25% boost
elif previous_jobs >= 2:
    score *= 1.30  # 30% boost
```

**Limitations identified**:
- Rule-based weights cannot adapt to individual client preferences
- No learning from successful/unsuccessful matches
- Cannot capture complex interaction patterns
- No property-specific matching intelligence
- Limited feature utilization (only 3 metrics)

### Motivation for Neural Network

The decision to implement a neural network was driven by:

1. **Personalization**: Each client has unique preferences that rule-based systems cannot capture
2. **Pattern Recognition**: Historical data contains complex patterns indicating compatibility
3. **Scalability**: As the platform grows, manual rule tuning becomes impractical
4. **Academic Merit**: Demonstrates application of advanced ML techniques in real-world marketplace
5. **Competitive Advantage**: Modern platforms increasingly leverage AI for recommendations

---

## Problem Statement

### Research Question

**"Can a neural network trained on completed job data predict cleaner-client compatibility more accurately than rule-based hybrid scoring, and what features are most indicative of successful matches?"**

### Success Criteria

1. **Prediction Accuracy**: NN predictions correlate with actual client ratings (target: R² > 0.70)
2. **Business Impact**: Increase in average job ratings when using NN recommendations (target: +0.3 stars)
3. **User Adoption**: Clients opt to use NN recommendations over hybrid scoring (target: >60% adoption)
4. **Performance**: Recommendation latency remains acceptable (target: <500ms)
5. **Scalability**: System handles growing dataset without performance degradation

### Constraints

- **Computational**: Must run efficiently in Docker container on standard hardware
- **Data Privacy**: Cannot expose sensitive client/cleaner information
- **Integration**: Must work seamlessly with existing Django REST API
- **Fallback**: Hybrid scoring must remain available if NN fails
- **Training**: Automated retraining pipeline required for continuous improvement

---

## Research & Planning Phase

### Literature Review

**Recommendation Systems Background**:
- Collaborative filtering (user-based, item-based)
- Content-based filtering
- Hybrid approaches combining multiple techniques
- Deep learning for recommendations (Neural Collaborative Filtering)

**Relevant Academic Papers**:
1. He et al. (2017) - "Neural Collaborative Filtering" (WWW '17)
2. Covington et al. (2016) - "Deep Neural Networks for YouTube Recommendations" (RecSys '16)
3. Cheng et al. (2016) - "Wide & Deep Learning for Recommender Systems" (DLRS '16)

**Key Insights Applied**:
- Wide & Deep architecture pattern (combining learned features + engineered features)
- Embedding layers for categorical variables
- Multi-task learning potential (rating prediction + match probability)
- Importance of negative sampling in training data

### Feature Engineering Analysis

**Data Sources Available**:

| Source | Tables | Key Features |
|--------|--------|--------------|
| **Jobs** | `cleaning_jobs_cleaningjob` | Job type, services, price, status, completion metrics |
| **Properties** | `properties_property` | Size, type, GPS coordinates, address |
| **Users** | `users_user` | Role, registration date, activity level |
| **Cleaner Profiles** | `users_cleanerprofile` | Experience, rating, job count, completion rate |
| **Reviews** | `cleaning_jobs_review` | Rating, review text, timestamp |
| **Bids** | `cleaning_jobs_jobbid` | Bid amount, acceptance status |

**Feature Categories Designed**:

1. **Property Features** (10 features)
   - Size (square meters)
   - Property type (one-hot encoded: apartment, house, office, other)
   - GPS coordinates (latitude, longitude)
   - Property age (derived from data)
   - Number of previous jobs at property

2. **Cleaner Features** (15 features)
   - Overall rating (0-5 scale)
   - Total job count
   - Completion rate (%)
   - Average response time
   - Specialization scores (deep_clean, regular_clean, move_in_out, post_construction)
   - Years of experience
   - Client retention rate
   - Average job value
   - Rating trend (last 10 jobs)
   - Bid competitiveness (avg bid vs market rate)

3. **Historical Match Features** (10 features)
   - Previous jobs between this client-cleaner pair
   - Average rating from previous jobs
   - Days since last job together
   - Property type match history
   - Service type match history
   - Price range compatibility
   - Communication responsiveness
   - Issue resolution rate
   - Rebooking probability
   - Client satisfaction trend

4. **Contextual Features** (8 features)
   - Job urgency (days until scheduled date)
   - Price point (budget category)
   - Service complexity score
   - Time of year (seasonal encoding)
   - Day of week (weekend vs weekday)
   - Client tenure (account age)
   - Client booking frequency
   - Market demand level

5. **Text Embeddings** (512 features)
   - Review text embeddings using `sentence-transformers/all-MiniLM-L6-v2`
   - Captures semantic meaning of client feedback
   - Averaged across all reviews for the cleaner

**Total Input Features**: ~55 engineered features + 512 embedding features = **567 features**

### Architecture Design Decisions

**Model Selection Rationale**:

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **Linear Regression** | Simple, interpretable | Cannot capture non-linear patterns | ❌ Rejected |
| **Random Forest** | Good with tabular data, feature importance | Large model size, slow inference | ❌ Rejected |
| **Gradient Boosting** | High accuracy on tabular data | Difficult to deploy, no GPU acceleration | ❌ Rejected |
| **Deep Neural Network** | Learns complex patterns, GPU-accelerated, easy to deploy | Requires more data, hyperparameter tuning | ✅ **Selected** |

**Neural Network Architecture Chosen**:

```
Input Layer (567 features)
    ↓
Dense Layer (256 neurons, ReLU, Dropout 0.3)
    ↓
Dense Layer (128 neurons, ReLU, Dropout 0.3)
    ↓
Dense Layer (64 neurons, ReLU, Dropout 0.2)
    ↓
Dense Layer (32 neurons, ReLU)
    ↓
Output Layer (1 neuron, Sigmoid) → Match Score [0-1]
```

**Design Rationale**:
- **Deep architecture**: Captures hierarchical feature interactions
- **Decreasing layer sizes**: Funnel pattern for abstraction
- **Dropout regularization**: Prevents overfitting on limited training data
- **ReLU activation**: Standard choice for hidden layers (non-linear, computationally efficient)
- **Sigmoid output**: Maps to probability-like match score
- **Batch normalization**: Considered but omitted to reduce complexity (can add if needed)

### Microservice Architecture

**Why Separate ML Service?**

1. **Technology Stack Isolation**: PyTorch/FastAPI vs Django
2. **Resource Management**: ML inference can be resource-intensive
3. **Independent Scaling**: Scale ML service separately from main backend
4. **Development Agility**: Update ML models without touching Django codebase
5. **Fault Isolation**: ML service failures don't crash main application

**Communication Pattern**:

```
Client (React) 
    ↓ HTTP POST /api/recommendations/get/
Django Backend
    ↓ HTTP POST /predict (with features)
FastAPI ML Service
    ↓ PyTorch Model Inference
    ↑ Match Scores
Django Backend (combines with hybrid scores)
    ↑ Sorted Recommendations
Client (React)
```

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React Frontend (FindCleaners.jsx)                       │  │
│  │  - Property selection dropdown                           │  │
│  │  - "Use AI Recommendations" toggle                       │  │
│  │  - Results display with scores                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      Django Backend                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  recommendations/views.py                                │  │
│  │  - GetRecommendationsView (API endpoint)                 │  │
│  │  - Feature extraction pipeline                           │  │
│  │  - Score normalization & ranking                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  recommendations/services/                               │  │
│  │  - ml_client.py (FastAPI communication)                  │  │
│  │  - recommendation_engine.py (orchestration)              │  │
│  │  - scoring_service.py (hybrid fallback)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP (internal network)
┌─────────────────────────────────────────────────────────────────┐
│                      ML Service (FastAPI)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  main.py                                                 │  │
│  │  - /predict endpoint (POST)                              │  │
│  │  - /health endpoint (GET)                                │  │
│  │  - /model/info endpoint (GET)                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  models.py                                               │  │
│  │  - CleanerMatchNN (PyTorch model)                        │  │
│  │  - Model loading & caching                               │  │
│  │  - Batch prediction                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Database Query
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                          │
│  - cleaning_jobs_cleaningjob                                    │
│  - users_cleanerprofile                                         │
│  - properties_property                                          │
│  - cleaning_jobs_review                                         │
│  - recommendations_trainedmodel (metadata)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **ML Framework** | PyTorch | 2.0+ | Neural network training & inference |
| **NLP** | sentence-transformers | Latest | Review text embeddings |
| **API Framework** | FastAPI | 0.104+ | ML service REST API |
| **Backend** | Django | 4.2+ | Main application logic |
| **Database** | PostgreSQL | 14+ | Data storage |
| **Containerization** | Docker | 24+ | Service deployment |
| **Orchestration** | Docker Compose | 2.0+ | Multi-container management |
| **Frontend** | React | 18+ | User interface |

### Data Pipeline

```
1. DATA COLLECTION
   └─> Export completed jobs from PostgreSQL
       └─> Include: jobs, reviews, properties, cleaner profiles
           └─> Filter: status='completed', has_review=True
   
2. FEATURE EXTRACTION
   └─> Property features (size, type, location)
   └─> Cleaner features (rating, experience, specialization)
   └─> Historical match features (previous jobs, ratings)
   └─> Contextual features (timing, pricing, urgency)
   └─> Text embeddings (review content)
   
3. DATA PREPARATION
   └─> Handle missing values (imputation strategies)
   └─> Normalize numerical features (StandardScaler)
   └─> Encode categorical features (one-hot encoding)
   └─> Generate embeddings (sentence-transformers)
   └─> Split dataset (80% train, 10% validation, 10% test)
   
4. MODEL TRAINING
   └─> Initialize PyTorch model
   └─> Define loss function (MSE or Binary Cross-Entropy)
   └─> Set optimizer (Adam with learning rate scheduling)
   └─> Training loop (epochs, batching, validation)
   └─> Save best model checkpoint
   
5. MODEL DEPLOYMENT
   └─> Load trained model in FastAPI service
   └─> Expose prediction endpoint
   └─> Integrate with Django backend
   
6. CONTINUOUS IMPROVEMENT
   └─> Collect new job completions
   └─> Retrain model periodically (weekly/monthly)
   └─> A/B test new model versions
   └─> Monitor performance metrics
```

---

## Implementation Phases

### Phase 1: Data Analysis & Feature Engineering ⏳ IN PROGRESS

**Objectives**:
- Analyze available training data volume and quality
- Implement feature extraction functions
- Create training dataset with all 567 features
- Validate feature distributions and correlations

**Tasks**:
- [ ] Query database for completed jobs count
- [ ] Analyze data quality (missing values, outliers)
- [ ] Implement property feature extraction
- [ ] Implement cleaner feature extraction
- [ ] Implement historical match feature extraction
- [ ] Implement contextual feature extraction
- [ ] Generate review text embeddings
- [ ] Create training dataset CSV
- [ ] Perform exploratory data analysis (EDA)
- [ ] Document feature engineering decisions

**Expected Output**:
- `training_dataset.csv` with all features
- `feature_engineering_report.md` with EDA findings
- SQL queries for data extraction
- Python scripts for feature generation

**Timeline**: 3-4 days

---

### Phase 2: Dataset Preparation & Cleaning ⏳ PENDING

**Objectives**:
- Clean and preprocess training data
- Handle missing values and outliers
- Normalize features for neural network input
- Split into train/validation/test sets

**Tasks**:
- [ ] Implement missing value imputation
- [ ] Remove outliers (IQR method or z-score)
- [ ] Normalize numerical features (StandardScaler)
- [ ] Encode categorical variables (one-hot)
- [ ] Balance dataset if needed (SMOTE for edge cases)
- [ ] Create train/val/test splits (80/10/10)
- [ ] Save preprocessing pipeline (joblib/pickle)
- [ ] Validate data distributions

**Expected Output**:
- `preprocessed_training_data.pkl`
- `feature_scaler.pkl`
- `preprocessing_pipeline.py`
- Data quality report

**Timeline**: 2-3 days

---

### Phase 3: Neural Network Architecture Implementation ⏳ PENDING

**Objectives**:
- Implement PyTorch model architecture
- Create training loop with validation
- Implement early stopping and checkpointing
- Tune hyperparameters

**Tasks**:
- [ ] Define `CleanerMatchNN` PyTorch model class
- [ ] Implement forward pass
- [ ] Create custom dataset class (PyTorch Dataset)
- [ ] Create data loaders (training, validation, test)
- [ ] Implement training loop
- [ ] Add validation metrics (MSE, R², correlation)
- [ ] Implement early stopping callback
- [ ] Add model checkpointing (save best model)
- [ ] Implement learning rate scheduling
- [ ] Hyperparameter tuning (grid search or Optuna)

**Expected Output**:
- `models/cleaner_match_nn.py` (model definition)
- `training/train.py` (training script)
- `best_model.pth` (trained weights)
- `training_history.json` (loss curves, metrics)

**Timeline**: 4-5 days

---

### Phase 4: FastAPI Microservice Setup ⏳ PENDING

**Objectives**:
- Create FastAPI application for ML inference
- Implement prediction endpoint
- Add health checks and monitoring
- Containerize with Docker

**Tasks**:
- [ ] Set up FastAPI project structure
- [ ] Implement `/predict` POST endpoint
- [ ] Implement `/health` GET endpoint
- [ ] Implement `/model/info` GET endpoint
- [ ] Add request/response validation (Pydantic models)
- [ ] Implement model loading and caching
- [ ] Add batch prediction support
- [ ] Create Dockerfile for ML service
- [ ] Configure CORS for Django integration
- [ ] Add logging and error handling

**Expected Output**:
- `ml-service/main.py`
- `ml-service/models.py`
- `ml-service/Dockerfile`
- `ml-service/requirements.txt`
- API documentation (auto-generated by FastAPI)

**Timeline**: 3-4 days

---

### Phase 5: Django Backend Integration ⏳ PENDING

**Objectives**:
- Create Django app for recommendation orchestration
- Implement API client for ML service communication
- Add fallback to hybrid scoring
- Create public API endpoint

**Tasks**:
- [ ] Create `recommendations` Django app (already exists, enhance)
- [ ] Implement `ml_client.py` for FastAPI communication
- [ ] Create `recommendation_engine.py` orchestration service
- [ ] Implement feature extraction in Django context
- [ ] Add caching layer (Redis) for frequent requests
- [ ] Create `GetRecommendationsView` API endpoint
- [ ] Implement graceful fallback to hybrid scoring
- [ ] Add request rate limiting
- [ ] Write unit tests for recommendation logic
- [ ] Add admin interface for model monitoring

**Expected Output**:
- `backend/recommendations/services/ml_client.py`
- `backend/recommendations/services/recommendation_engine.py`
- `backend/recommendations/views.py`
- API endpoint: `POST /api/recommendations/get/`
- Unit tests with >80% coverage

**Timeline**: 4-5 days

---

### Phase 6: Training Pipeline Automation ⏳ PENDING

**Objectives**:
- Automate data export from PostgreSQL
- Create scheduled retraining jobs
- Implement model versioning
- Add performance monitoring

**Tasks**:
- [ ] Create `export_training_data.py` management command
- [ ] Create `train_recommendation_model.py` management command
- [ ] Implement model versioning (track model metadata)
- [ ] Set up automated retraining schedule (weekly)
- [ ] Add performance tracking (log predictions vs actuals)
- [ ] Create model comparison dashboard
- [ ] Implement A/B testing framework
- [ ] Add alerts for performance degradation
- [ ] Document retraining procedures

**Expected Output**:
- `backend/recommendations/management/commands/export_training_data.py`
- `backend/recommendations/management/commands/train_recommendation_model.py`
- `backend/recommendations/models.py` (TrainedModel metadata)
- Automated training schedule (cron or Celery)
- Performance monitoring dashboard

**Timeline**: 3-4 days

---

### Phase 7: Docker Deployment ⏳ PENDING

**Objectives**:
- Add ML service to docker-compose
- Configure networking between services
- Set up volume mounts for models
- Optimize for production

**Tasks**:
- [ ] Update `docker-compose.dev.yml` with ML service
- [ ] Configure internal Docker network
- [ ] Set up shared volume for model files
- [ ] Add health checks in docker-compose
- [ ] Configure environment variables
- [ ] Optimize Docker image sizes (multi-stage builds)
- [ ] Test full stack deployment
- [ ] Create `docker-compose.prod.yml` for production
- [ ] Document deployment procedures

**Expected Output**:
- Updated `docker-compose.dev.yml`
- Updated `docker-compose.prod.yml`
- Deployment documentation
- Health check monitoring

**Timeline**: 2-3 days

---

### Phase 8: Frontend Integration ⏳ PENDING

**Objectives**:
- Add "Use AI Recommendations" toggle
- Display NN confidence scores
- Show feature explanations
- A/B test UI variants

**Tasks**:
- [ ] Add toggle in `FindCleaners.jsx`
- [ ] Update `recommendations.js` API client
- [ ] Display match scores with visual indicators
- [ ] Add tooltip explanations for scores
- [ ] Implement loading states for ML predictions
- [ ] Add fallback UI if ML service unavailable
- [ ] Create comparison view (NN vs Hybrid)
- [ ] Implement user preference storage
- [ ] A/B test toggle placement and copy
- [ ] Add user feedback mechanism

**Expected Output**:
- Enhanced `frontend/src/pages/FindCleaners.jsx`
- Updated `frontend/src/services/recommendations.js`
- UI mockups and user testing results
- A/B test results documentation

**Timeline**: 3-4 days

---

### Phase 9: Testing & Validation ⏳ PENDING

**Objectives**:
- Unit test all components
- Integration test full pipeline
- Performance test under load
- Validate prediction accuracy

**Tasks**:
- [ ] Write unit tests for feature extraction
- [ ] Write unit tests for ML client
- [ ] Write integration tests for full recommendation flow
- [ ] Load test ML service (concurrent requests)
- [ ] Validate prediction accuracy on test set
- [ ] Compare NN vs Hybrid on historical data
- [ ] User acceptance testing (UAT)
- [ ] Edge case testing (new users, sparse data)
- [ ] Security testing (input validation)
- [ ] Documentation review

**Expected Output**:
- Test suite with >80% coverage
- Load testing report
- Accuracy comparison report
- UAT feedback summary
- Security audit results

**Timeline**: 4-5 days

---

### Phase 10: Monitoring & Documentation ⏳ PENDING

**Objectives**:
- Set up production monitoring
- Create comprehensive documentation
- Knowledge transfer materials
- Final report for academic submission

**Tasks**:
- [ ] Set up logging (structured logs)
- [ ] Create performance monitoring dashboard
- [ ] Implement alerting (model degradation)
- [ ] Write API documentation
- [ ] Write system architecture documentation
- [ ] Create user guide for AI recommendations
- [ ] Document model training procedures
- [ ] Write academic report sections
- [ ] Create presentation materials
- [ ] Code cleanup and refactoring

**Expected Output**:
- Monitoring dashboard
- Complete API documentation
- System architecture diagrams
- Academic report ready for submission
- Presentation slides
- Clean, documented codebase

**Timeline**: 5-6 days

---

## Development Log

### Session 1: November 9, 2025

**Time**: Start of NN development  
**Branch**: `feature/neural-network-recommendations`

**Actions Taken**:
1. ✅ Committed all hybrid recommendation work to `main` branch
2. ✅ Pushed to GitHub repository
3. ✅ Created new branch `feature/neural-network-recommendations`
4. ✅ Created comprehensive documentation file

**Git Commit**:
```
commit bb0ef09
Author: Vasko Metallinos
Date: November 9, 2025

feat: Complete ML-powered cleaner recommendation system with client history tracking

- Quality-first hybrid scoring (60% rating, 25% experience, 15% completion)
- Property-aware recommendations with history detection
- Client history boost (25-30%) for returning cleaners
- JWT authentication via api client
- Pagination and toggle filters
- Full ML service infrastructure
```

**Next Steps**:
- Begin Phase 1: Data Analysis & Feature Engineering
- Query database for completed jobs
- Start feature extraction implementation

**Development Environment**:
- Docker Compose development setup active
- PostgreSQL database populated with test data
- Django backend running on port 8000
- React frontend running on port 3000

**Notes**:
- Existing ML service structure already in place from previous work
- Will refine and enhance for production-grade NN implementation
- Focus on academic rigor for final report

---

### Session 2: [Date TBD]

[To be filled during development]

---

## Testing & Validation

### Test Strategy

**Unit Testing**:
- Feature extraction functions (100% coverage goal)
- ML client communication (mock FastAPI responses)
- Recommendation engine logic
- Data preprocessing pipeline

**Integration Testing**:
- End-to-end recommendation flow (React → Django → FastAPI → PyTorch)
- Fallback mechanisms (ML service down → hybrid scoring)
- Database integration (feature extraction from PostgreSQL)

**Performance Testing**:
- Load test ML service (target: 100 concurrent requests)
- Latency benchmarks (target: <500ms p95)
- Resource utilization (CPU, memory, GPU if available)

**Accuracy Validation**:
- Test set evaluation (R², MSE, correlation)
- Historical backtesting (compare predictions to actual ratings)
- A/B test in production (measure impact on client satisfaction)

**Edge Case Testing**:
- New cleaners (no historical data)
- New clients (cold start problem)
- Sparse properties (minimal previous jobs)
- Extreme values (very high/low ratings)

### Acceptance Criteria

- [ ] Model achieves R² > 0.70 on test set
- [ ] Recommendation API responds in <500ms (p95)
- [ ] Graceful fallback when ML service unavailable
- [ ] No data leakage in training/test split
- [ ] All unit tests passing (>80% coverage)
- [ ] Integration tests passing (full flow)
- [ ] Load tests passing (100 concurrent users)
- [ ] User acceptance testing positive feedback (>70% satisfaction)
- [ ] Documentation complete and reviewed
- [ ] Code reviewed and approved

---

## Performance Metrics

### Key Performance Indicators (KPIs)

**Model Performance**:
- R² Score (coefficient of determination)
- Mean Squared Error (MSE)
- Mean Absolute Error (MAE)
- Pearson correlation coefficient
- Precision@K (top-K recommendations quality)

**Business Metrics**:
- Average job rating (NN vs Hybrid comparison)
- Client rebooking rate
- Time to job acceptance
- Client satisfaction survey scores
- Feature adoption rate (% users choosing NN)

**System Metrics**:
- Recommendation API latency (p50, p95, p99)
- ML service uptime
- Prediction throughput (requests/second)
- Error rate
- Fallback rate (when ML service fails)

### Baseline Measurements

**Current Hybrid Scoring Performance** (as of November 9, 2025):
- Average client rating: [To be measured]
- Recommendation acceptance rate: [To be measured]
- Time to decision: [To be measured]

**Target NN Performance**:
- R² > 0.70 (on test set)
- +0.3 stars average rating improvement
- -20% time to job acceptance
- >60% user adoption rate

---

## Challenges & Solutions

### Challenge 1: Limited Training Data

**Problem**: Platform is relatively new, may have insufficient completed jobs for robust training.

**Solutions Considered**:
1. **Data Augmentation**: Generate synthetic training examples
2. **Transfer Learning**: Pre-train on similar marketplace data
3. **Regularization**: Heavy dropout, L2 penalty to prevent overfitting
4. **Simpler Model**: Start with fewer layers, add complexity as data grows

**Decision**: Start with strong regularization (dropout 0.3-0.4), monitor for overfitting, gradually increase model complexity as more data accumulates.

---

### Challenge 2: Cold Start Problem

**Problem**: New cleaners/clients have no historical data for feature extraction.

**Solutions Considered**:
1. **Fallback to Hybrid**: Use rule-based scoring for new entities
2. **Content-Based Features**: Rely more on property/service type features
3. **Popularity Baseline**: Recommend highly-rated cleaners by default
4. **Gradual Transition**: Mix NN and hybrid scores (weighted average)

**Decision**: Implement hybrid approach - for new cleaners, use 70% hybrid + 30% NN (based on available features), gradually shift to 100% NN as history accumulates.

---

### Challenge 3: Feature Drift

**Problem**: Cleaner performance/client preferences may change over time, making old training data less relevant.

**Solutions Considered**:
1. **Recency Weighting**: Weight recent jobs more heavily in training
2. **Sliding Window**: Only train on jobs from last N months
3. **Continuous Learning**: Retrain frequently (weekly/bi-weekly)
4. **Concept Drift Detection**: Monitor prediction accuracy over time

**Decision**: Implement monthly sliding window (train on last 12 months) + weekly retraining + automated alerts if accuracy drops >10%.

---

### Challenge 4: Explainability

**Problem**: Neural networks are "black boxes", clients may want to understand why a cleaner is recommended.

**Solutions Considered**:
1. **Feature Importance**: SHAP or LIME for per-prediction explanations
2. **Attention Mechanisms**: Add attention layer to highlight influential features
3. **Rule Extraction**: Approximate NN with decision rules
4. **Hybrid Display**: Show both NN score and key traditional metrics

**Decision**: Implement SHAP explanations for top 3 recommendations, display in tooltip with key features (e.g., "High rating + Previous experience with your property type").

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Multi-Task Learning**
   - Predict both rating AND probability of rebooking
   - Joint optimization for multiple objectives

2. **Contextual Bandits**
   - Online learning from user interactions
   - Explore/exploit tradeoff for recommendations

3. **Cleaner Embeddings**
   - Learn dense representations of cleaners
   - Similarity-based recommendations

4. **Client Preference Learning**
   - Explicit preference collection (surveys)
   - Implicit learning from booking behavior

5. **Time-Series Forecasting**
   - Predict cleaner availability
   - Seasonal demand patterns

6. **Image Analysis**
   - Analyze "before/after" job photos
   - Visual quality scoring

### Research Opportunities

1. **Fairness in Recommendations**
   - Ensure equal opportunity for new cleaners
   - Mitigate bias in ratings

2. **Active Learning**
   - Intelligently select which predictions to get human feedback on
   - Optimize learning with minimal labels

3. **Federated Learning**
   - Train models without centralizing sensitive data
   - Privacy-preserving recommendations

---

## Academic Contribution

### Thesis/Report Sections

This development work will contribute to the following sections of the Capstone Project report:

**1. Literature Review**
- Comparison of recommendation system approaches
- Neural networks in marketplace platforms
- Feature engineering for service matching

**2. Methodology**
- System architecture design
- Feature engineering process
- Model selection rationale
- Training procedure

**3. Implementation**
- Technical stack selection
- Code architecture
- Integration patterns
- DevOps practices

**4. Results**
- Quantitative evaluation (R², MSE, business metrics)
- Qualitative evaluation (user feedback)
- Comparison with baseline (hybrid scoring)

**5. Discussion**
- Challenges encountered
- Design decisions and trade-offs
- Limitations and threats to validity
- Lessons learned

**6. Conclusion**
- Summary of achievements
- Practical implications for marketplace platforms
- Future research directions

### Learning Outcomes

**Technical Skills Demonstrated**:
- Deep learning with PyTorch
- NLP with sentence-transformers
- Microservice architecture (FastAPI)
- RESTful API design
- Docker containerization
- Full-stack integration (React + Django + ML)

**Software Engineering Practices**:
- Version control (Git branching strategy)
- Documentation-driven development
- Test-driven development (TDD)
- Continuous integration/deployment (CI/CD)
- Performance optimization
- Error handling and logging

**Data Science Skills**:
- Feature engineering
- Exploratory data analysis
- Model training and validation
- Hyperparameter tuning
- A/B testing
- Performance monitoring

---

## References

### Academic Papers

1. He, X., Liao, L., Zhang, H., Nie, L., Hu, X., & Chua, T. S. (2017). Neural collaborative filtering. In Proceedings of the 26th international conference on world wide web (pp. 173-182).

2. Covington, P., Adams, J., & Sargin, E. (2016). Deep neural networks for youtube recommendations. In Proceedings of the 10th ACM conference on recommender systems (pp. 191-198).

3. Cheng, H. T., Koc, L., Harmsen, J., Shaked, T., Chandra, T., Aradhye, H., ... & Shah, H. (2016). Wide & deep learning for recommender systems. In Proceedings of the 1st workshop on deep learning for recommender systems (pp. 7-10).

### Technical Documentation

- PyTorch Documentation: https://pytorch.org/docs/stable/index.html
- Sentence-Transformers: https://www.sbert.net/
- FastAPI Documentation: https://fastapi.tiangolo.com/
- Django REST Framework: https://www.django-rest-framework.org/

### Project Documentation

- `HYBRID_RECOMMENDATION_SYSTEM.md` - Hybrid scoring implementation
- `ML_FIND_CLEANERS_INTEGRATION_COMPLETE.md` - Initial ML integration
- `RECOMMENDATION_DOCKER_DEPLOYMENT.md` - Deployment guide
- `NN_TRAINING_ANALYSIS.md` - Training data analysis

---

## Appendix

### A. Feature Definitions

[Detailed documentation of all 567 features to be added during Phase 1]

### B. Model Hyperparameters

[Final hyperparameter configuration to be documented after tuning]

### C. API Specifications

[Complete API documentation to be generated from FastAPI]

### D. Database Schema

[Relevant database tables and relationships]

### E. Code Repository

GitHub: https://github.com/vaskomet/CapstoneProjectMetallinosE-Clean  
Branch: `feature/neural-network-recommendations`

---

**Document Status**: Living document, updated throughout development  
**Last Updated**: November 9, 2025  
**Version**: 1.0.0
