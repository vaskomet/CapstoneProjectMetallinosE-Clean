import React, { useState } from 'react';
import '../styles/ReviewCard.css';

const ReviewCard = ({ review, currentUser, onResponseSubmit, onFlag, showActions = true }) => {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [error, setError] = useState(null);

  // Check if current user can respond (is the reviewee)
  const canRespond = currentUser && review.reviewee === currentUser.id && !review.response && showActions;

  // Check if current user can flag (not their own review)
  const canFlag = currentUser && review.reviewer !== currentUser.id && showActions;

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get rating color based on value
  const getRatingColor = (rating) => {
    if (rating >= 8) return '#2ecc71'; // Green
    if (rating >= 6) return '#f39c12'; // Orange
    return '#e74c3c'; // Red
  };

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    
    if (responseText.trim().length < 10) {
      setError('Response must be at least 10 characters.');
      return;
    }

    setIsSubmittingResponse(true);
    setError(null);

    try {
      await onResponseSubmit(review.id, responseText);
      setShowResponseForm(false);
      setResponseText('');
    } catch (err) {
      setError(err.message || 'Failed to submit response');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  return (
    <div className="review-card">
      {/* Header */}
      <div className="review-header">
        <div className="reviewer-info">
          <div className="reviewer-avatar">
            {review.reviewer_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="reviewer-name">{review.reviewer_name}</div>
            <div className="review-date">{formatDate(review.created_at)}</div>
          </div>
        </div>
        <div className="overall-rating" style={{ color: getRatingColor(review.overall_rating) }}>
          <span className="rating-number">{review.overall_rating}</span>
          <span className="rating-max">/10</span>
        </div>
      </div>

      {/* Sub-ratings */}
      {review.ratings && review.ratings.length > 0 && (
        <div className="sub-ratings-display">
          {review.ratings.map((rating) => (
            <div key={rating.id} className="sub-rating-item">
              <span className="sub-rating-label">{rating.category_display}:</span>
              <div className="sub-rating-bar-container">
                <div 
                  className="sub-rating-bar"
                  style={{
                    width: `${(rating.rating / 10) * 100}%`,
                    backgroundColor: getRatingColor(rating.rating)
                  }}
                />
              </div>
              <span className="sub-rating-value">{rating.rating}/10</span>
            </div>
          ))}
        </div>
      )}

      {/* Comment */}
      <div className="review-comment">
        <p>{review.comment}</p>
      </div>

      {/* Response (if exists) */}
      {review.response && (
        <div className="review-response">
          <div className="response-header">
            <strong>Response from {review.reviewee_name}:</strong>
          </div>
          <p>{review.response.response_text}</p>
          <div className="response-date">
            {formatDate(review.response.created_at)}
          </div>
        </div>
      )}

      {/* Response Form (if user can respond) */}
      {canRespond && showResponseForm && (
        <div className="response-form">
          <h4>Respond to this review</h4>
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleResponseSubmit}>
            <textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Write your response... (minimum 10 characters)"
              rows="4"
              required
              minLength={10}
            />
            <div className="response-form-actions">
              <button type="submit" disabled={isSubmittingResponse} className="btn btn-primary">
                {isSubmittingResponse ? 'Submitting...' : 'Submit Response'}
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setShowResponseForm(false);
                  setResponseText('');
                  setError(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="review-actions">
          {canRespond && !showResponseForm && (
            <button 
              onClick={() => setShowResponseForm(true)}
              className="btn btn-respond"
            >
              Respond
            </button>
          )}
          {canFlag && onFlag && (
            <button 
              onClick={() => onFlag(review.id)}
              className="btn btn-flag"
            >
              Report
            </button>
          )}
        </div>
      )}

      {/* Job Info */}
      {review.job_title && (
        <div className="review-job-info">
          <small>Job: {review.job_title}</small>
          {review.job_date && <small> • {formatDate(review.job_date)}</small>}
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
