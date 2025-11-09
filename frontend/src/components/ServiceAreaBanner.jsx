import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Service Area Banner Component
 * Prompts cleaners with no service areas to add their coverage zones
 */
export default function ServiceAreaBanner({ user }) {
  const navigate = useNavigate();

  // Only show for cleaners with no service areas
  if (!user || user.role !== 'cleaner' || (user.service_areas_count && user.service_areas_count > 0)) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded-r-lg shadow-sm">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Add Your Service Areas
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>Define the areas where you're available to work to start receiving job opportunities.</p>
            <p className="mt-1">Clients will only see jobs in the areas you service.</p>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => navigate('/settings/profile')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-800 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Add Service Areas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
