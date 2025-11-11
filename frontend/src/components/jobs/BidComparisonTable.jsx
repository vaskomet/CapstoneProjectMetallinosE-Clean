import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * BidComparisonTable Component
 *
 * A sophisticated bid comparison interface that allows clients to analyze and compare
 * multiple bids side-by-side with sortable columns, cleaner statistics, and inline actions.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.bids - Array of bid objects with cleaner information
 * @param {Function} props.onAcceptBid - Callback when a bid is accepted
 * @param {Function} props.onRejectBid - Callback when a bid is rejected
 * @param {number} props.jobBudget - Client's budget for comparison
 * @param {boolean} props.disabled - Disable all actions (e.g., bid already accepted)
 *
 * @features
 * - Sortable columns (price, rating, experience, duration)
 * - Cleaner statistics display (rating, jobs completed, response time)
 * - Visual indicators for best value, lowest price, highest rated
 * - Inline accept/reject buttons
 * - Budget comparison highlighting
 * - Responsive table design
 *
 * @example
 * <BidComparisonTable
 *   bids={jobBids}
 *   onAcceptBid={(bidId) => handleAccept(bidId)}
 *   onRejectBid={(bidId) => handleReject(bidId)}
 *   jobBudget={150}
 *   disabled={false}
 * />
 */
const BidComparisonTable = ({
  bids = [],
  onAcceptBid,
  onRejectBid,
  jobBudget = null,
  disabled = false,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'bid_amount', direction: 'asc' });

  /**
   * Sort bids based on current sort configuration
   */
  const sortedBids = useMemo(() => {
    if (!bids || bids.length === 0) return [];

    const sorted = [...bids].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'bid_amount':
          aValue = parseFloat(a.bid_amount) || 0;
          bValue = parseFloat(b.bid_amount) || 0;
          break;
        case 'rating':
          aValue = a.cleaner?.rating || 0;
          bValue = b.cleaner?.rating || 0;
          break;
        case 'experience':
          aValue = a.cleaner?.jobs_completed || 0;
          bValue = b.cleaner?.jobs_completed || 0;
          break;
        case 'duration':
          aValue = parseFloat(a.estimated_duration) || 0;
          bValue = parseFloat(b.estimated_duration) || 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        default:
          return 0;
      }

      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return sorted;
  }, [bids, sortConfig]);

  /**
   * Handle column header click for sorting
   */
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  /**
   * Get sort indicator icon
   */
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortConfig.direction === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  /**
   * Calculate bid insights (lowest, highest rated, best value)
   */
  const bidInsights = useMemo(() => {
    if (!sortedBids || sortedBids.length === 0) return {};

    const lowestBid = sortedBids.reduce((min, bid) => 
      parseFloat(bid.bid_amount) < parseFloat(min.bid_amount) ? bid : min
    );

    const highestRated = sortedBids.reduce((max, bid) => 
      (bid.cleaner?.rating || 0) > (max.cleaner?.rating || 0) ? bid : max
    );

    // Best value: combination of price and rating
    const bestValue = sortedBids.reduce((best, bid) => {
      const score = (bid.cleaner?.rating || 0) * 10 - parseFloat(bid.bid_amount);
      const bestScore = (best.cleaner?.rating || 0) * 10 - parseFloat(best.bid_amount);
      return score > bestScore ? bid : best;
    });

    return {
      lowestBidId: lowestBid?.id,
      highestRatedId: highestRated?.id,
      bestValueId: bestValue?.id,
    };
  }, [sortedBids]);

  /**
   * Format cleaner name
   */
  const getCleanerName = (cleaner) => {
    if (!cleaner) return 'Unknown Cleaner';
    const fullName = `${cleaner.first_name || ''} ${cleaner.last_name || ''}`.trim();
    return fullName || cleaner.username || cleaner.email || 'Cleaner';
  };

  /**
   * Get badge for special bids
   */
  const getBadge = (bidId) => {
    const badges = [];
    
    if (bidId === bidInsights.lowestBidId) {
      badges.push(
        <span key="lowest" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 ml-2">
          💰 Lowest Price
        </span>
      );
    }
    
    if (bidId === bidInsights.highestRatedId) {
      badges.push(
        <span key="rated" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
          ⭐ Highest Rated
        </span>
      );
    }
    
    if (bidId === bidInsights.bestValueId && bidId !== bidInsights.lowestBidId) {
      badges.push(
        <span key="value" className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-2">
          🏆 Best Value
        </span>
      );
    }

    return badges;
  };

  /**
   * Check if bid is within budget
   */
  const isWithinBudget = (bidAmount) => {
    if (!jobBudget) return true;
    return parseFloat(bidAmount) <= parseFloat(jobBudget);
  };

  /**
   * Format time ago
   */
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!bids || bids.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="mt-2 text-sm">No bids to compare yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Compare {sortedBids.length} {sortedBids.length === 1 ? 'Bid' : 'Bids'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Price range: €{Math.min(...sortedBids.map(b => parseFloat(b.bid_amount)))} - 
              €{Math.max(...sortedBids.map(b => parseFloat(b.bid_amount)))}
              {jobBudget && <span className="ml-2">(Your budget: €{jobBudget})</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Sort by clicking column headers</p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              {/* Cleaner Column */}
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
              >
                Cleaner
              </th>

              {/* Price Column - Sortable */}
              <th
                scope="col"
                onClick={() => handleSort('bid_amount')}
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Price</span>
                  {getSortIcon('bid_amount')}
                </div>
              </th>

              {/* Rating Column - Sortable */}
              <th
                scope="col"
                onClick={() => handleSort('rating')}
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Rating</span>
                  {getSortIcon('rating')}
                </div>
              </th>

              {/* Experience Column - Sortable */}
              <th
                scope="col"
                onClick={() => handleSort('experience')}
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Experience</span>
                  {getSortIcon('experience')}
                </div>
              </th>

              {/* Duration Column - Sortable */}
              <th
                scope="col"
                onClick={() => handleSort('duration')}
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Duration</span>
                  {getSortIcon('duration')}
                </div>
              </th>

              {/* Submitted Column - Sortable */}
              <th
                scope="col"
                onClick={() => handleSort('created_at')}
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Submitted</span>
                  {getSortIcon('created_at')}
                </div>
              </th>

              {/* Actions Column */}
              <th
                scope="col"
                className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 sm:pr-6"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {sortedBids.map((bid) => (
              <tr
                key={bid.id}
                className={`hover:bg-gray-50 transition-colors ${
                  bid.status === 'accepted' ? 'bg-green-50' : ''
                } ${bid.status === 'rejected' ? 'bg-red-50 opacity-60' : ''}`}
              >
                {/* Cleaner Info */}
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                        {getCleanerName(bid.cleaner).charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="font-medium text-gray-900 flex items-center">
                        {getCleanerName(bid.cleaner)}
                        {getBadge(bid.id)}
                      </div>
                      {bid.message && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={bid.message}>
                          "{bid.message}"
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Price */}
                <td className="whitespace-nowrap px-3 py-4 text-sm">
                  <div className="flex items-center">
                    <span
                      className={`font-semibold ${
                        isWithinBudget(bid.bid_amount) ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      €{parseFloat(bid.bid_amount).toFixed(2)}
                    </span>
                    {!isWithinBudget(bid.bid_amount) && (
                      <span className="ml-2 text-xs text-red-600">Over budget</span>
                    )}
                  </div>
                </td>

                {/* Rating */}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="font-medium">
                      {bid.cleaner?.rating ? bid.cleaner.rating.toFixed(1) : 'N/A'}
                    </span>
                    {bid.cleaner?.reviews_count > 0 && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({bid.cleaner.reviews_count})
                      </span>
                    )}
                  </div>
                </td>

                {/* Experience */}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{bid.cleaner?.jobs_completed || 0} jobs</span>
                  </div>
                </td>

                {/* Duration */}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{bid.estimated_duration} hrs</span>
                  </div>
                </td>

                {/* Submitted */}
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {formatTimeAgo(bid.created_at)}
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {bid.status === 'pending' && !disabled ? (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onAcceptBid(bid.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Accept
                      </button>
                      <button
                        onClick={() => onRejectBid(bid.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bid.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : bid.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {bid.status === 'accepted' && '✓ '}
                      {bid.status === 'rejected' && '✗ '}
                      {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">💡 Tips for choosing a bid:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Lowest Price:</strong> Best for budget-conscious projects</li>
          <li>• <strong>Highest Rated:</strong> Best for quality assurance</li>
          <li>• <strong>Best Value:</strong> Optimal balance of price and quality</li>
          <li>• Consider the cleaner's message and experience level</li>
          <li>• Check estimated duration for realistic expectations</li>
        </ul>
      </div>
    </div>
  );
};

BidComparisonTable.propTypes = {
  bids: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      bid_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      estimated_duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      message: PropTypes.string,
      status: PropTypes.string,
      created_at: PropTypes.string,
      cleaner: PropTypes.shape({
        id: PropTypes.number,
        username: PropTypes.string,
        email: PropTypes.string,
        first_name: PropTypes.string,
        last_name: PropTypes.string,
        rating: PropTypes.number,
        jobs_completed: PropTypes.number,
        reviews_count: PropTypes.number,
      }),
    })
  ),
  onAcceptBid: PropTypes.func.isRequired,
  onRejectBid: PropTypes.func.isRequired,
  jobBudget: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  disabled: PropTypes.bool,
};

export default BidComparisonTable;
