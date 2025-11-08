import React, { useState } from 'react';
import '../styles/ReviewForm.css';

const ReviewForm = ({ jobId, revieweeName, onSubmit, onCancel }) => {
  const [overallRating, setOverallRating] = useState(5);
  const [ratings, setRatings] = useState({
    quality: 5,
    communication: 5,
    professionalism: 5,
    timeliness: 5
  });
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleRatingChange = (category, value) => {
    setRatings(prev => ({
      ...prev,
      [category]: parseInt(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validate comment
    if (comment.trim().length < 10) {
      setError('Please write at least 10 characters in your review.');
      setIsSubmitting(false);
      return;
    }

    // Prepare review data
    const reviewData = {
      job: jobId,
      overall_rating: overallRating,
      comment: comment.trim(),
      ratings: [
        { category: 'quality', rating: ratings.quality },
        { category: 'communication', rating: ratings.communication },
        { category: 'professionalism', rating: ratings.professionalism },
        { category: 'timeliness', rating: ratings.timeliness }
      ]
    };

    try {
      await onSubmit(reviewData);
    } catch (err) {
      setError(err.message || 'Failed to submit review');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="review-form-container">
      <h3>Leave a Review{revieweeName && ` for ${revieweeName}`}</h3>
      
      {error && (
        <div className="review-form-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="review-form">
        {/* Overall Rating */}
        <div className="form-group">
          <label>Overall Rating: <span className="rating-value">{overallRating}/10</span></label>
          <input
            type="range"
            min="1"
            max="10"
            value={overallRating}
            onChange={(e) => setOverallRating(parseInt(e.target.value))}
            className="rating-slider"
            required
          />
          <div className="slider-labels">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Sub-Ratings */}
        <div className="sub-ratings">
          <h4>Detailed Ratings</h4>

          <div className="form-group">
            <label>Quality of Work: <span className="rating-value">{ratings.quality}/10</span></label>
            <input
              type="range"
              min="1"
              max="10"
              value={ratings.quality}
              onChange={(e) => handleRatingChange('quality', e.target.value)}
              className="rating-slider"
              required
            />
          </div>

          <div className="form-group">
            <label>Communication: <span className="rating-value">{ratings.communication}/10</span></label>
            <input
              type="range"
              min="1"
              max="10"
              value={ratings.communication}
              onChange={(e) => handleRatingChange('communication', e.target.value)}
              className="rating-slider"
              required
            />
          </div>

          <div className="form-group">
            <label>Professionalism: <span className="rating-value">{ratings.professionalism}/10</span></label>
            <input
              type="range"
              min="1"
              max="10"
              value={ratings.professionalism}
              onChange={(e) => handleRatingChange('professionalism', e.target.value)}
              className="rating-slider"
              required
            />
          </div>

          <div className="form-group">
            <label>Timeliness: <span className="rating-value">{ratings.timeliness}/10</span></label>
            <input
              type="range"
              min="1"
              max="10"
              value={ratings.timeliness}
              onChange={(e) => handleRatingChange('timeliness', e.target.value)}
              className="rating-slider"
              required
            />
          </div>
        </div>

        {/* Comment */}
        <div className="form-group">
          <label>Your Review</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience... (minimum 10 characters)"
            rows="5"
            required
            minLength={10}
            className="review-textarea"
          />
          <div className="character-count">
            {comment.length} characters
          </div>
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={isSubmitting || comment.trim().length < 10}
            className="btn btn-primary"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
