import React, { useState, useEffect } from 'react';
import '../styles/ReviewStats.css';

const ReviewStats = ({ userId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `http://localhost:8000/api/reviews/stats/${userId}/`
      );

      if (!response.ok) {
        throw new Error('Failed to load statistics');
      }

      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getRatingColor = (rating) => {
    if (rating >= 8) return '#2ecc71';
    if (rating >= 6) return '#f39c12';
    return '#e74c3c';
  };

  const getRatingLabel = (rating) => {
    if (rating >= 9) return 'Excellent';
    if (rating >= 8) return 'Great';
    if (rating >= 7) return 'Good';
    if (rating >= 6) return 'Fair';
    return 'Needs Improvement';
  };

  if (loading) {
    return <div className="stats-loading">Loading statistics...</div>;
  }

  if (error) {
    return <div className="stats-error">Error: {error}</div>;
  }

  if (!stats || stats.total_reviews === 0) {
    return (
      <div className="stats-no-data">
        <p>No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="review-stats-container">
      <div className="stats-header">
        <h3>Rating Overview</h3>
        <div className="total-reviews">
          Based on {stats.total_reviews} review{stats.total_reviews !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Overall Rating */}
      <div className="overall-stats">
        <div className="overall-rating-circle" style={{ borderColor: getRatingColor(stats.average_overall_rating) }}>
          <div className="rating-number" style={{ color: getRatingColor(stats.average_overall_rating) }}>
            {stats.average_overall_rating.toFixed(1)}
          </div>
          <div className="rating-max">/10</div>
        </div>
        <div className="rating-label" style={{ color: getRatingColor(stats.average_overall_rating) }}>
          {getRatingLabel(stats.average_overall_rating)}
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="detailed-stats">
        <h4>Detailed Ratings</h4>
        <div className="stat-items">
          <div className="stat-item">
            <div className="stat-label">Quality of Work</div>
            <div className="stat-bar-container">
              <div 
                className="stat-bar"
                style={{
                  width: `${(stats.average_quality / 10) * 100}%`,
                  backgroundColor: getRatingColor(stats.average_quality)
                }}
              />
            </div>
            <div className="stat-value">{stats.average_quality.toFixed(1)}/10</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Communication</div>
            <div className="stat-bar-container">
              <div 
                className="stat-bar"
                style={{
                  width: `${(stats.average_communication / 10) * 100}%`,
                  backgroundColor: getRatingColor(stats.average_communication)
                }}
              />
            </div>
            <div className="stat-value">{stats.average_communication.toFixed(1)}/10</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Professionalism</div>
            <div className="stat-bar-container">
              <div 
                className="stat-bar"
                style={{
                  width: `${(stats.average_professionalism / 10) * 100}%`,
                  backgroundColor: getRatingColor(stats.average_professionalism)
                }}
              />
            </div>
            <div className="stat-value">{stats.average_professionalism.toFixed(1)}/10</div>
          </div>

          <div className="stat-item">
            <div className="stat-label">Timeliness</div>
            <div className="stat-bar-container">
              <div 
                className="stat-bar"
                style={{
                  width: `${(stats.average_timeliness / 10) * 100}%`,
                  backgroundColor: getRatingColor(stats.average_timeliness)
                }}
              />
            </div>
            <div className="stat-value">{stats.average_timeliness.toFixed(1)}/10</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewStats;
