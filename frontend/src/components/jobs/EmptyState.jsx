import React from 'react';

/**
 * EmptyState Component - Displays helpful messages when no content is available
 * 
 * Shows appropriate illustrations and messaging for different empty states:
 * - No jobs found
 * - No search results
 * - No bids yet
 * - Filtered results empty
 * 
 * @param {String} type - Type of empty state ('no-jobs', 'no-results', 'no-bids', 'filtered')
 * @param {String} message - Optional custom message
 * @param {String} actionLabel - Label for action button (optional)
 * @param {Function} onAction - Callback for action button (optional)
 */
const EmptyState = ({ type = 'no-jobs', message, actionLabel, onAction }) => {
  // Default messages and icons based on type
  const stateConfig = {
    'no-jobs': {
      icon: (
        <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: 'No jobs available',
      defaultMessage: 'There are no cleaning jobs at the moment. Check back later or create a new job.',
    },
    'no-results': {
      icon: (
        <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      title: 'No results found',
      defaultMessage: 'Try adjusting your search terms or filters to find what you\'re looking for.',
    },
    'no-bids': {
      icon: (
        <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: 'No bids yet',
      defaultMessage: 'This job hasn\'t received any bids yet. Be the first to submit a competitive offer!',
    },
    'filtered': {
      icon: (
        <svg className="w-24 h-24 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
      title: 'No jobs match your filters',
      defaultMessage: 'Try removing some filters or broadening your search criteria.',
    },
  };

  const config = stateConfig[type] || stateConfig['no-jobs'];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="mb-6">
        {config.icon}
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        {config.title}
      </h3>

      {/* Message */}
      <p className="text-gray-600 max-w-md mb-8">
        {message || config.defaultMessage}
      </p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium shadow-md hover:shadow-lg"
        >
          {actionLabel}
        </button>
      )}

      {/* Helpful Tips */}
      {type === 'no-results' && (
        <div className="mt-8 max-w-md">
          <p className="text-sm text-gray-500 mb-2">Try these suggestions:</p>
          <ul className="text-sm text-gray-600 space-y-1 text-left">
            <li>• Check your spelling</li>
            <li>• Use more general keywords</li>
            <li>• Remove some filters</li>
            <li>• Try different date ranges</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
