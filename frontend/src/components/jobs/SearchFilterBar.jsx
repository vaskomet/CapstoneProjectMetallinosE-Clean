import React, { useState } from 'react';
import SearchAutocomplete from './SearchAutocomplete';

/**
 * SearchFilterBar Component - Advanced search and filtering for jobs with autocomplete
 * 
 * Provides UI for Phase 2 API features:
 * - Search across job descriptions, addresses, notes
 * - Price range filtering (min/max budget)
 * - Date range filtering (scheduled date)
 * - Status filtering (open_for_bids, confirmed, etc.)
 * 
 * @param {Object} filters - Current filter values { search, priceMin, priceMax, dateFrom, dateTo, status }
 * @param {Function} onFilterChange - Callback when filters change
 * @param {Function} onReset - Callback to reset all filters
 * @param {Boolean} isExpanded - Whether filters are expanded (default: false)
 * @param {String} userRole - User role (client/cleaner) for role-specific filters
 */
const SearchFilterBar = ({ filters = {}, onFilterChange, onReset, isExpanded = false, userRole }) => {
  const [showAdvanced, setShowAdvanced] = useState(isExpanded);

  // Status options based on user role
  const statusOptions = userRole === 'cleaner' 
    ? [
        { value: '', label: 'All Statuses' },
        { value: 'open_for_bids', label: 'Open for Bids' },
        { value: 'bid_accepted', label: 'Bid Accepted (Awaiting Payment)' },
        { value: 'confirmed', label: 'Confirmed (Paid)' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
      ]
    : userRole === 'client'
    ? [
        { value: '', label: 'All Statuses' },
        { value: 'open_for_bids', label: 'Open for Bids' },
        { value: 'bid_accepted', label: 'Bid Accepted (Pending Payment)' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ]
    : [
        { value: '', label: 'All Statuses' },
        { value: 'open_for_bids', label: 'Open for Bids' },
        { value: 'bid_accepted', label: 'Bid Accepted' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ];

  // Handle filter changes
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  // Clear all filters
  const handleReset = () => {
    onReset();
    setShowAdvanced(false);
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(val => val && val !== '');

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      {/* Search Input Row */}
      <div className="flex gap-3 items-center">
        {/* Main Search with Autocomplete */}
        <div className="flex-1">
          <SearchAutocomplete
            value={filters.search || ''}
            onChange={(suggestion) => handleChange('search', suggestion)}
            onInputChange={(value) => handleChange('search', value)}
          />
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
            showAdvanced || hasActiveFilters
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Filters</span>
            {hasActiveFilters && (
              <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {Object.values(filters).filter(val => val && val !== '').length}
              </span>
            )}
          </div>
        </button>

        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Advanced Filters (Collapsible) */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Price (€)
              </label>
              <input
                type="number"
                placeholder="0"
                min="0"
                value={filters.priceMin || ''}
                onChange={(e) => handleChange('priceMin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Price (€)
              </label>
              <input
                type="number"
                placeholder="1000"
                min="0"
                value={filters.priceMax || ''}
                onChange={(e) => handleChange('priceMax', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Status {userRole && <span className="text-xs text-gray-500">({userRole} view)</span>}
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm font-medium text-gray-700">Active filters:</span>
                {filters.search && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Search: "{filters.search}"
                    <button
                      onClick={() => handleChange('search', '')}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.priceMin && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Min: €{filters.priceMin}
                    <button
                      onClick={() => handleChange('priceMin', '')}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.priceMax && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Max: €{filters.priceMax}
                    <button
                      onClick={() => handleChange('priceMax', '')}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.dateFrom && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    From: {new Date(filters.dateFrom).toLocaleDateString()}
                    <button
                      onClick={() => handleChange('dateFrom', '')}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.dateTo && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    To: {new Date(filters.dateTo).toLocaleDateString()}
                    <button
                      onClick={() => handleChange('dateTo', '')}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                )}
                {filters.status && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Status: {filters.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    <button
                      onClick={() => handleChange('status', '')}
                      className="ml-2 text-yellow-600 hover:text-yellow-800"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
