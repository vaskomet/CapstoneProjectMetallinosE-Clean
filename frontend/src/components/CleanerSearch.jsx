/**
 * CleanerSearch Component
 * 
 * Search for cleaners by GPS location with radius matching.
 * Uses browser's geolocation API to find nearby cleaners who service your area.
 * 
 * Matches against cleaner service areas (center point + radius model).
 * Displays results with distance, service areas, and direct messaging option.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanerSearchAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const CleanerSearch = ({ 
  onSelectCleaners, 
  selectedCleaners = [], 
  multiSelect = true,
  onMessageCleaner = null // Optional: callback when clicking message button for individual cleaner
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useState({
    latitude: '',
    longitude: '',
    max_radius: 15  // Default 15km radius (reasonable for metro areas)
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
      toast.error('Unable to get your location. Try the test location button below.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseTestLocation = async () => {
    const testLocation = {
      latitude: 37.9755,
      longitude: 23.7348
    };
    
    setSearchParams(prev => ({
      ...prev,
      latitude: testLocation.latitude,
      longitude: testLocation.longitude
    }));
    toast.success('Using test location: Athens Centre (Syntagma Square)');
    
    // Auto-search with test location
    await handleSearch({
      latitude: testLocation.latitude,
      longitude: testLocation.longitude,
      max_radius: searchParams.max_radius
    });
  };

  const handleUseTestLocationKifisia = async () => {
    const testLocation = {
      latitude: 38.0746,
      longitude: 23.8098
    };
    
    setSearchParams(prev => ({
      ...prev,
      latitude: testLocation.latitude,
      longitude: testLocation.longitude
    }));
    toast.success('Using test location: Kifisia (North Suburbs)');
    
    // Auto-search with test location
    await handleSearch({
      latitude: testLocation.latitude,
      longitude: testLocation.longitude,
      max_radius: searchParams.max_radius
    });
  };

  const handleUseTestLocationGlyfada = async () => {
    const testLocation = {
      latitude: 37.8652,
      longitude: 23.7530
    };
    
    setSearchParams(prev => ({
      ...prev,
      latitude: testLocation.latitude,
      longitude: testLocation.longitude
    }));
    toast.success('Using test location: Glyfada (Coastal South)');
    
    // Auto-search with test location
    await handleSearch({
      latitude: testLocation.latitude,
      longitude: testLocation.longitude,
      max_radius: searchParams.max_radius
    });
  };

  const handleSearch = async (customParams = null) => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const params = customParams || {
        latitude: searchParams.latitude,
        longitude: searchParams.longitude,
        max_radius: searchParams.max_radius
      };
      
      if (!params.latitude || !params.longitude) {
        toast.error('Please use "Get My Location" button first');
        setIsSearching(false);
        return;
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
      {/* Search Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Search by Your Location</h3>
          <p className="text-sm text-gray-600">
            Find cleaners who service areas near you (uses GPS + radius matching)
          </p>
        </div>
        
        <div className="space-y-4">
          {/* Step 1: Get Location */}
          <div>
            <div className="grid grid-cols-1 gap-3 mb-3">
              <button
                onClick={handleGetCurrentLocation}
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{isSearching ? 'Getting Location...' : 'Use My GPS'}</span>
              </button>
            </div>
            
            <div className="text-center text-sm text-gray-500 mb-2">
              Or try test locations:
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleUseTestLocation}
                disabled={isSearching}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Athens Centre</span>
              </button>
              
              <button
                onClick={handleUseTestLocationKifisia}
                disabled={isSearching}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Kifisia</span>
              </button>
              
              <button
                onClick={handleUseTestLocationGlyfada}
                disabled={isSearching}
                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span>Glyfada</span>
              </button>
            </div>
            
            {searchParams.latitude && searchParams.longitude && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Location found:</span>
                  <span>{searchParams.latitude.toFixed(6)}, {searchParams.longitude.toFixed(6)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Step 2: Adjust Radius */}
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
                    className={`px-4 py-4 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className={`flex-1 ${multiSelect && onSelectCleaners ? 'cursor-pointer' : ''}`}
                        onClick={() => multiSelect && handleToggleSelect(cleaner)}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          {multiSelect && onSelectCleaners && (
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
                      
                      {/* Quick Message Button */}
                      {onMessageCleaner && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMessageCleaner(cleaner);
                          }}
                          className="ml-4 flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
                          title={`Message ${cleaner.first_name}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span>Message</span>
                        </button>
                      )}
                      
                      {/* View Profile Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/cleaner/${cleaner.id}`);
                        }}
                        className="ml-2 flex-shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
                        title={`View ${cleaner.first_name}'s profile`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>View Profile</span>
                      </button>
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

