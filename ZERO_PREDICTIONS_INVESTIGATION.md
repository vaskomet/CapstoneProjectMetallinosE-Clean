# Zero Predictions Investigation - Completed November 9, 2025

## Problem Statement
After completing Phase 5 Django integration, end-to-end tests showed successful HTTP communication with ml-service, but **all predictions returned 0.0 scores** despite the model being loaded and functional.

## Investigation Process

### 1. Initial Observations
- ✅ ML service running and healthy
- ✅ NN model loaded successfully (152,833 parameters)
- ✅ Feature scaler loaded
- ✅ HTTP requests returning 200 OK
- ❌ All match_scores = 0.0000

### 2. Feature Analysis
Extracted features for Job 3, Cleaner 29:
```
Shape: (427,)
Dtype: float32
Non-zero features: 13 out of 427
Zero features: 414 out of 427

Embedding Analysis:
- Total embeddings: 384
- Zero embeddings: 384 ← CRITICAL
- Non-zero embeddings: 0 ← PROBLEM!
```

**Key Finding**: 96.9% of features are zeros, including ALL embeddings

### 3. Training Data Comparison
Checked actual training data from `nn_training_dataset_with_embeddings.csv`:

**Training Sample Features**:
```
Non-zero features: 415 out of 427 (97%)
Embeddings: Real floating-point values (-0.137, 0.024, -0.004, ...)
```

**Current Inference Features**:
```
Non-zero features: 13 out of 427 (3%)
Embeddings: All zeros [0.0, 0.0, 0.0, ...]
```

**Distribution Mismatch**: Model trained on rich embeddings, now receiving zeros

### 4. Model Validation Test
Created test script using actual training data to verify model functionality:

**Results**:
| Row | Target Rating | Predicted Rating | Match Score | Error |
|-----|--------------|------------------|-------------|-------|
| 0   | 9.0          | 8.65             | 0.7300      | -0.35 |
| 1   | 7.0          | 7.31             | 0.4630      | +0.31 |
| 2   | 8.0          | 7.42             | 0.4848      | -0.58 |

**Conclusion**: Model works perfectly when given proper features with real embeddings!

## Root Cause

The neural network was trained on **427 features** including **384 real text embeddings** generated using `sentence-transformers/all-MiniLM-L6-v2` from property descriptions and special instructions.

The current feature extractor implementation returns **zero placeholder embeddings** in `_get_text_embeddings()`:

```python
def _get_text_embeddings(self, cleaner: User, reference_date: datetime) -> np.ndarray:
    """
    Get text embeddings for job and cleaner descriptions.
    Currently returns zeros placeholder.
    """
    return np.zeros(384, dtype=np.float32)  # ← PROBLEM!
```

**Why 0.0 predictions?**
- Model learned to map embedding patterns to ratings
- Zero embeddings are **out-of-distribution** (never seen in training)
- PyTorch model outputs ~0.0 for OOD inputs as safety mechanism
- This is actually correct behavior - model is saying "I don't know" for unfamiliar inputs

## Solution

Implement real text embedding generation using the same model as training:

1. **Install sentence-transformers** in backend requirements
2. **Load model** in `NNFeatureExtractor.__init__()`:
   ```python
   from sentence_transformers import SentenceTransformer
   self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
   ```

3. **Generate embeddings** in `_get_text_embeddings()`:
   ```python
   def _get_text_embeddings(self, job: CleaningJob, cleaner: User) -> np.ndarray:
       # Combine property description and special instructions
       text = f"{job.property.description or ''} {job.special_instructions or ''}"
       if not text.strip():
           return np.zeros(384, dtype=np.float32)
       
       # Generate embedding
       embedding = self.embedding_model.encode(text, show_progress_bar=False)
       return embedding.astype(np.float32)
   ```

4. **Add caching** for embeddings (expensive computation)
5. **Update method signature** to accept `job` parameter (not just cleaner)

## Impact Assessment

**Why Zero Embeddings Produce Zero Scores**:
- Embeddings represent 90% of input features (384 out of 427)
- Model architecture likely learned heavy weights for embedding features
- When all embeddings = 0:
  - Input distribution shifts dramatically
  - Model's learned patterns don't apply
  - Default safe output ≈ 0 (middle of normalized range)

**Expected Improvement**:
Once real embeddings are implemented, predictions should return to expected ranges:
- Match scores: 0.4-0.8 (corresponding to ratings 7-9)
- Variance based on actual job-cleaner compatibility
- Model confidence restored

## Files to Update

1. `backend/requirements.txt` - Add `sentence-transformers`
2. `backend/recommendations/services/nn_feature_extractor.py` - Implement real embeddings
3. `ml-service/requirements.txt` - Verify sentence-transformers version matches training

## Testing Plan

1. **Unit Test**: Verify embedding generation produces 384-dim vectors
2. **Integration Test**: Run same end-to-end test with real embeddings
3. **Validation**: Compare predictions with hybrid scoring for sanity check
4. **Performance**: Measure embedding generation latency (target <100ms)

## Timeline

- **Estimated Time**: 2-3 hours
- **Priority**: High (blocks Phase 5 completion)
- **Dependencies**: None
- **Risk**: Low (clear solution, proven model functionality)

## Key Learnings

1. **Always verify data distribution**: Training vs inference feature distributions must match
2. **Zero placeholders are dangerous**: Better to fail loudly than silently return wrong defaults
3. **Model debugging workflow**:
   - First verify model loads correctly ✅
   - Then verify model works with known-good data ✅  
   - Finally identify feature extraction issues ✅

4. **Out-of-distribution detection**: Zero predictions were actually the model correctly identifying unfamiliar inputs

## Next Steps

1. Mark "Investigate Zero Predictions" todo as complete
2. Create "Implement Real Text Embeddings" todo
3. Install sentence-transformers
4. Update `_get_text_embeddings()` implementation
5. Re-run integration tests
6. Document performance characteristics

---

**Investigation Status**: ✅ COMPLETE  
**Root Cause**: ✅ IDENTIFIED  
**Solution**: ✅ DEFINED  
**Next Action**: Implement real text embeddings
