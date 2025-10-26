/**
 * CleanerSearch Component
 * 
 * Search for cleaners by location with various search methods:
 * - Current GPS location with radius
 * - City and state
 * - Postal/ZIP code
 * 
 * Displays results with distance, service areas, and ratings
 */

import React, { useState } from 'react';
import { cleanerSearchAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const CleanerSearch = ({ onSelectCleaners, selectedCleaners = [], multiSelect = true }) => {
  const [searchMethod, setSearchMethod] = useState('gps'); // 'gps', 'city', 'postal'
  const [searchParams, setSearchParams] = useState({
    latitude: '',
    longitude: '',
    max_radius: 15,  // Athens metro area - reasonable default (15 miles ≈ 24 km)
    city: 'Athens',  // Default to Athens
    state: 'Attica', // Default to Attica region
    postal_code: ''
  });
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const toast = useToast();

  const handleGetCurrentLocation = async () => {
    setIsSearching(true);
    try {
      const location = await cleanerSearchAPI.getCurrentLocation();
      setSearchParams(prev => ({
        ...prev,
        latitude: location.latitude,
        longitude: location.longitude
      }));
      toast.success(`Location found! Accuracy: ${Math.round(location.accuracy)}m`);
      
      // Auto-search with current location
      await handleSearch({
        latitude: location.latitude,
        longitude: location.longitude,
        max_radius: searchParams.max_radius
      });
    } catch (error) {
      console.error('Geolocation error:', error);
      toast.error('Unable to get your location. Please check permissions.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (customParams = null) => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const params = customParams || {};
      
      // Build search params based on method
      if (searchMethod === 'gps') {
        params.latitude = params.latitude || searchParams.latitude;
        params.longitude = params.longitude || searchParams.longitude;
        params.max_radius = params.max_radius || searchParams.max_radius;
        
        if (!params.latitude || !params.longitude) {
          toast.error('Please get your current location first');
          return;
        }
      } else if (searchMethod === 'city') {
        params.city = searchParams.city;
        params.state = searchParams.state;
        
        if (!params.city) {
          toast.error('Please enter a city name');
          return;
        }
      } else if (searchMethod === 'postal') {
        params.postal_code = searchParams.postal_code;
        
        if (!params.postal_code) {
          toast.error('Please enter a postal code');
          return;
        }
      }
      
      const response = await cleanerSearchAPI.searchByLocation(params);
      setSearchResults(response.cleaners || []);
      
      if (response.count === 0) {
        toast.info('No cleaners found in this area. Try increasing the radius.');
      } else {
        toast.success(`Found ${response.count} cleaner${response.count > 1 ? 's' : ''} in your area!`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for cleaners');
    } finally {
      setIsSearching(false);
    }
  };

  const handleToggleSelect = (cleaner) => {
    if (!onSelectCleaners) return;
    
    const isSelected = selectedCleaners.some(c => c.id === cleaner.id);
    
    if (multiSelect) {
      if (isSelected) {
        onSelectCleaners(selectedCleaners.filter(c => c.id !== cleaner.id));
      } else {
        onSelectCleaners([...selectedCleaners, cleaner]);
      }
    } else {
      onSelectCleaners(isSelected ? [] : [cleaner]);
    }
  };

  const isCleanerSelected = (cleaner) => {
    return selectedCleaners.some(c => c.id === cleaner.id);
  };

  return (
    <div className="space-y-6">
      {/* Search Method Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Search Method
        </label>
        <div className="flex space-x-2">
          <button
            onClick={() => setSearchMethod('gps')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              searchMethod === 'gps'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📍 GPS Location
          </button>
          <button
            onClick={() => setSearchMethod('city')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              searchMethod === 'city'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🏙️ City
          </button>
          <button
            onClick={() => setSearchMethod('postal')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              searchMethod === 'postal'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📮 ZIP Code
          </button>
        </div>
      </div>

      {/* Search Inputs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        {searchMethod === 'gps' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGetCurrentLocation}
                disabled={isSearching}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{isSearching ? 'Getting Location...' : 'Use My Location'}</span>
              </button>
              
              {searchParams.latitude && searchParams.longitude && (
                <div className="text-sm text-gray-600">
                  📍 {searchParams.latitude.toFixed(4)}, {searchParams.longitude.toFixed(4)}
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Radius (km)
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={searchParams.max_radius}
                onChange={(e) => setSearchParams({ ...searchParams, max_radius: e.target.value })}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-600 mt-1">
                <span>5 km</span>
                <span className="font-medium text-blue-600">{searchParams.max_radius} km (~{Math.round(searchParams.max_radius * 0.621371)} mi)</span>
                <span>50 km (Athens Metro)</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 Athens center to Piraeus: ~10km | Athens to Marathon: ~42km
              </p>
            </div>
          </div>
        )}

        {searchMethod === 'city' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                value={searchParams.city}
                onChange={(e) => setSearchParams({ ...searchParams, city: e.target.value })}
                placeholder="e.g., Athens, Piraeus, Glyfada"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                💡 Common areas: Kolonaki, Kifisia, Maroussi, Glyfada, Piraeus
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Region
              </label>
              <input
                type="text"
                value={searchParams.state}
                onChange={(e) => setSearchParams({ ...searchParams, state: e.target.value })}
                placeholder="Attica"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {searchMethod === 'postal' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postal Code *
            </label>
            <input
              type="text"
              value={searchParams.postal_code}
              onChange={(e) => setSearchParams({ ...searchParams, postal_code: e.target.value })}
              placeholder="e.g., 10671 (Kolonaki), 16674 (Glyfada)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Athens postal codes typically start with 10xxx-11xxx (central) or 15xxx-19xxx (suburbs)
            </p>
          </div>
        )}

        {searchMethod !== 'gps' && (
          <button
            onClick={() => handleSearch()}
            disabled={isSearching}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : '🔍 Search for Cleaners'}
          </button>
        )}
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Search Results ({searchResults.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {searchResults.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">No cleaners found</p>
                <p className="text-sm mt-1">Try adjusting your search criteria</p>
              </div>
            ) : (
              searchResults.map((cleaner) => {
                const isSelected = isCleanerSelected(cleaner);
                
                return (
                  <div
                    key={cleaner.id}
                    className={`px-4 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => handleToggleSelect(cleaner)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          {onSelectCleaners && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">
                              {cleaner.first_name} {cleaner.last_name}
                            </h4>
                            <p className="text-sm text-gray-600">{cleaner.email}</p>
                          </div>
                        </div>
                        
                        {cleaner.distance_miles !== undefined && (
                          <div className="text-sm text-blue-600 font-medium mb-2">
                            📍 {cleaner.distance_miles} miles away
                          </div>
                        )}
                        
                        {cleaner.service_areas && cleaner.service_areas.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-700 mb-1">Service Areas:</p>
                            <div className="flex flex-wrap gap-2">
                              {cleaner.service_areas.map((area, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                  {area.area_name}
                                  {area.radius_miles && ` (${area.radius_miles}mi radius)`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanerSearch;
