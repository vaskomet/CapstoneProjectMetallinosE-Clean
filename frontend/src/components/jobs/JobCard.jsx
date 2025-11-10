import React from 'react';

/**
 * Simple time ago helper (replaces date-fns)
 */
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  
  for (const [name, seconds_in_interval] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / seconds_in_interval);
    if (interval >= 1) {
      return interval === 1 ? `1 ${name} ago` : `${interval} ${name}s ago`;
    }
  }
  return 'just now';
};

/**
 * JobCard Component - Card view for individual cleaning job
 * 
 * Displays job information in an attractive card format with:
 * - Job title, description, and location
 * - Client budget and bid statistics
 * - Job status with color coding
 * - Number of bids received
 * - Quick action buttons
 * 
 * @param {Object} job - Job object from API
 * @param {Function} onViewDetails - Callback when clicking "View Details"
 * @param {Function} onBid - Callback when clicking "Place Bid" (cleaners only)
 * @param {String} userRole - Current user's role (client/cleaner)
 */
const JobCard = ({ job, onViewDetails, onBid, userRole }) => {
  // Status color mapping
  const statusColors = {
    open_for_bids: 'bg-green-100 text-green-800',
    bid_accepted: 'bg-blue-100 text-blue-800',
    confirmed: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  // Format status for display
  const formatStatus = (status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Calculate time ago
  const createdTimeAgo = timeAgo(job.created_at);

  // Get property address
  const address = job.property?.address || job.property?.city || 'No address';

  // Check if user can bid (cleaner, job open, not their own job)
  const canBid = userRole === 'cleaner' && 
                 job.status === 'open_for_bids' && 
                 job.client?.id !== job.id;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Status Badge */}
      <div className="p-4 pb-2">
        <div className="flex justify-between items-start mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[job.status] || 'bg-gray-100 text-gray-800'}`}>
            {formatStatus(job.status)}
          </span>
          <span className="text-xs text-gray-500">{createdTimeAgo}</span>
        </div>

        {/* Job Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
          {job.services_description || 'Cleaning Service'}
        </h3>

        {/* Location */}
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="line-clamp-1">{address}</span>
        </div>

        {/* Scheduled Date */}
        <div className="flex items-center text-sm text-gray-600 mb-3">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{new Date(job.scheduled_date).toLocaleDateString()}</span>
          {job.start_time && (
            <span className="ml-2">at {job.start_time.slice(0, 5)}</span>
          )}
        </div>

        {/* Budget */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm text-gray-600">Budget:</span>
            <span className="ml-2 text-lg font-bold text-green-600">
              €{parseFloat(job.client_budget || 0).toFixed(2)}
            </span>
          </div>

          {/* Bid Statistics */}
          {job.bid_stats && job.bid_stats.count > 0 && (
            <div className="text-right">
              <div className="text-xs text-gray-500">{job.bid_stats.count} bids</div>
              <div className="text-xs text-gray-600">
                €{job.bid_stats.lowest} - €{job.bid_stats.highest}
              </div>
            </div>
          )}
          
          {/* Show bid count even if no stats */}
          {(!job.bid_stats || job.bid_stats.count === 0) && job.bids && (
            <div className="text-xs text-gray-500">
              {job.bids.length} {job.bids.length === 1 ? 'bid' : 'bids'}
            </div>
          )}
        </div>

        {/* Description Preview */}
        {job.notes && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {job.notes}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          onClick={() => onViewDetails(job)}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
        >
          View Details
        </button>
        
        {canBid && (
          <button
            onClick={() => onBid(job)}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm font-medium"
          >
            Place Bid
          </button>
        )}
      </div>
    </div>
  );
};

export default JobCard;
