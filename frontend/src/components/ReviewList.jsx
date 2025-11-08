import React, { useState, useEffect } from 'react';
import ReviewCard from './ReviewCard';
import '../styles/ReviewList.css';

const ReviewList = ({ revieweeId, currentUser, onResponseSubmit, onFlag }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', '8+', '6-7', '<6'

  useEffect(() => {
    fetchReviews();
  }, [revieweeId]);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `http://localhost:8000/api/reviews/?reviewee_id=${revieweeId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load reviews');
      }

      const data = await response.json();
      setReviews(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getFilteredReviews = () => {
    if (filter === 'all') return reviews;
    if (filter === '8+') return reviews.filter(r => r.overall_rating >= 8);
    if (filter === '6-7') return reviews.filter(r => r.overall_rating >= 6 && r.overall_rating < 8);
    if (filter === '<6') return reviews.filter(r => r.overall_rating < 6);
    return reviews;
  };

  const filteredReviews = getFilteredReviews();

  if (loading) {
    return <div className="review-list-loading">Loading reviews...</div>;
  }

  if (error) {
    return <div className="review-list-error">Error: {error}</div>;
  }

  return (
    <div className="review-list-container">
      <div className="review-list-header">
        <h3>Reviews ({reviews.length})</h3>
        <div className="review-filter">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === '8+' ? 'active' : ''}`}
            onClick={() => setFilter('8+')}
          >
            8+ ⭐
          </button>
          <button
            className={`filter-btn ${filter === '6-7' ? 'active' : ''}`}
            onClick={() => setFilter('6-7')}
          >
            6-7
          </button>
          <button
            className={`filter-btn ${filter === '<6' ? 'active' : ''}`}
            onClick={() => setFilter('<6')}
          >
            &lt;6
          </button>
        </div>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="no-reviews">
          {filter === 'all' 
            ? 'No reviews yet' 
            : `No reviews matching filter "${filter}"`
          }
        </div>
      ) : (
        <div className="reviews-grid">
          {filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUser={currentUser}
              onResponseSubmit={onResponseSubmit}
              onFlag={onFlag}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ReviewList;
