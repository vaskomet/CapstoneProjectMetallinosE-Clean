import React from 'react';
import HighlightedText from './HighlightedText';
import { getStatusTailwind, getStatusLabel } from '../../config/jobStatusConfig';
import { getDotColor, getStatusConfig } from '../../constants/statusColors';

/**
 * JobListItem Component - Compact list view for cleaning job with search highlighting
 * 
 * Displays job information in a row format suitable for list view:
 * - Status indicator
 * - Job details (title, location, date, budget)
 * - Bid count and statistics
 * - Quick action button
 * 
 * @param {Object} job - Job object from API
 * @param {Function} onViewDetails - Callback when clicking the row or "View" button
 * @param {Function} onBid - Callback when clicking "Bid" button (cleaners only)
 * @param {String} userRole - Current user's role (client/cleaner)
 */
const JobListItem = ({ job, onViewDetails, onBid, userRole }) => {
  // Get property address
  const address = job.property?.city || job.property?.address || 'No location';

  // Check if user can bid
  const canBid = userRole === 'cleaner' && 
                 job.status === 'open_for_bids' && 
                 job.client?.id !== job.id;

  // Get status config for unified styling
  const statusConfig = getStatusConfig(job.status);

  return (
    <div 
      className="bg-white border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
      onClick={() => onViewDetails(job)}
    >
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Left section: Status + Job Info */}
        <div className="flex items-center flex-1 min-w-0">
          {/* Status Indicator */}
          <div className="flex-shrink-0 mr-4">
            <div className={`w-3 h-3 rounded-full ${getDotColor(job.status)}`} 
                 title={statusConfig.label}></div>
          </div>

          {/* Job Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4">
              {/* Title */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 truncate">
                  <HighlightedText 
                    highlighted={job.highlighted_description}
                    fallback={job.services_description || 'Cleaning Service'}
                  />
                </h4>
                <p className="text-xs text-gray-500 truncate">
                  <HighlightedText 
                    highlighted={job.highlighted_city || job.highlighted_address}
                    fallback={address}
                  />
                </p>
              </div>

              {/* Date */}
              <div className="hidden md:block flex-shrink-0 w-32">
                <p className="text-sm text-gray-700">
                  {new Date(job.scheduled_date).toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
                {job.start_time && (
                  <p className="text-xs text-gray-500">
                    {job.start_time.slice(0, 5)}
                  </p>
                )}
              </div>

              {/* Budget */}
              <div className="hidden sm:block flex-shrink-0 w-24 text-right">
                <p className="text-sm font-bold text-green-600">
                  €{parseFloat(job.client_budget || 0).toFixed(0)}
                </p>
              </div>

              {/* Bids */}
              <div className="hidden lg:block flex-shrink-0 w-24 text-center">
                {job.bid_stats && job.bid_stats.count > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-blue-600">
                      {job.bid_stats.count} bids
                    </p>
                    <p className="text-xs text-gray-500">
                      €{job.bid_stats.lowest}-{job.bid_stats.highest}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">
                    {job.bids?.length || 0} bids
                  </p>
                )}
              </div>

              {/* Status Badge (hidden on mobile) */}
              <div className="hidden xl:block flex-shrink-0 w-32">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {formatStatus(job.status)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right section: Actions */}
        <div className="flex-shrink-0 ml-4 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(job);
            }}
            className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-150"
          >
            View
          </button>
          
          {canBid && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBid(job);
              }}
              className="px-3 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors duration-150"
            >
              Bid
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobListItem;
