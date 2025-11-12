/**
 * CleanerSearch Component
 * 
 * Search for cleaners by GPS location with intelligent hybrid scoring.
 * Uses browser's geolocation API to find nearby cleaners who service your area.
 * 
 * Features:
 * - Location-based search with service area validation
 * - Hybrid scoring algorithm (distance + quality metrics)
 * - Real-time match score calculation
 * 
 * Scoring Algorithm (Weighted):
 * - Distance/Proximity: 50% (traffic-aware, exponential penalty)
 * - Cleaner Rating: 30% (average review score)
 * - Experience: 15% (completed jobs count)
 * - Completion Rate: 5% (reliability metric)
 * 
 * Note: ML neural network requires job context, so browse mode uses 
 * hybrid scoring combining multiple quality factors.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cleanerSearchAPI, recommendationsAPI, propertiesAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import VerifiedBadge from './VerifiedBadge';

const CleanerSearch = ({ 
  onSelectCleaners, 
  selectedCleaners = [], 
  multiSelect = true,
  onMessageCleaner = null // Optional: callback when clicking message button for individual cleaner
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchParams, setSearchParams] = useState({
    latitude: '',
    longitude: '',
    max_radius: 100,  // Large default - let cleaners' service areas determine eligibility
    property_id: ''   // NEW: Selected property for ML recommendations
  });
  const [properties, setProperties] = useState([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [rankingEnabled, setRankingEnabled] = useState(false); // Algorithm-based ranking
  const [recommendationScores, setRecommendationScores] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage] = useState(10); // Show 10 cleaners per page
  const [showOnlyNew, setShowOnlyNew] = useState(false); // NEW: Toggle to show only cleaners without history
  const toast = useToast();

  // Fetch user's properties on component mount (if user is a client)
  useEffect(() => {
    const fetchProperties = async () => {
      if (user?.role === 'client') {
        setIsLoadingProperties(true);
        try {
          const response = await propertiesAPI.getAll();
          setProperties(response || []);
        } catch (error) {
          console.error('Error fetching properties:', error);
          // Don't show error toast - user might not have properties yet
        } finally {
          setIsLoadingProperties(false);
        }
      }
    };

    fetchProperties();
  }, [user]);

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

  const handlePropertySelect = (event) => {
    const propertyId = event.target.value;
    
    if (!propertyId) {
      // "Browse all cleaners" selected
      setSelectedProperty(null);
      setSearchParams(prev => ({ ...prev, property_id: '' }));
      return;
    }

    const property = properties.find(p => p.id === parseInt(propertyId));
    setSelectedProperty(property);
    setSearchParams(prev => ({
      ...prev,
      property_id: propertyId,
      latitude: property.latitude || prev.latitude,
      longitude: property.longitude || prev.longitude
    }));

    // Auto-search with property location if available
    if (property.latitude && property.longitude) {
      handleSearch({
        latitude: property.latitude,
        longitude: property.longitude,
        max_radius: searchParams.max_radius,
        property_id: propertyId
      });
    }
  };

  const handleSearch = async (customParams = null) => {
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const params = customParams || {
        latitude: searchParams.latitude,
        longitude: searchParams.longitude,
        max_radius: searchParams.max_radius,
        property_id: searchParams.property_id
      };
      
      if (!params.latitude || !params.longitude) {
        toast.error('Please use "Get My Location" button first');
        setIsSearching(false);
        return;
      }
      
      // Step 1: Get cleaners in service area (location-based filter)
      const locationResponse = await cleanerSearchAPI.searchByLocation(params);
      const cleaners = locationResponse.cleaners || [];
      
      if (cleaners.length === 0) {
        setSearchResults([]);
        setRecommendationScores({});
        setRankingEnabled(false);
        setCurrentPage(1); // Reset to first page
        toast.info('No cleaners service this location yet. They may be expanding their areas soon!');
        setIsSearching(false);
        return;
      }
      
      // Step 2: Get algorithm recommendations for ranking
      try {
        const recommendParams = {
          latitude: params.latitude,
          longitude: params.longitude,
          max_radius: params.max_radius,
          top_k: cleaners.length // Request stats for ALL cleaners found
        };

        // Add property context if available
        if (params.property_id) {
          recommendParams.property_id = params.property_id;
        } else {
          // Fallback: use property type from selected property or default
          recommendParams.property_type = selectedProperty?.property_type || 'apartment';
        }

        const response = await recommendationsAPI.getCleanersForLocation(recommendParams);
        
        console.log('Algorithm Response sample:', response.recommendations[0]); // DEBUG
        
        // Build score lookup map with FULL recommendation data
        const scores = {};
        response.recommendations.forEach(rec => {
          scores[rec.cleaner.id] = {
            score: rec.score,
            stats: rec.stats,
            // Include history metadata
            previous_jobs: rec.previous_jobs,
            last_cleaned: rec.last_cleaned,
            previous_rating: rec.previous_rating,
            last_review: rec.last_review,
            last_property_address: rec.last_property_address
          };
        });
        
        setRecommendationScores(scores);
        setRankingEnabled(true); // Algorithm ranking is active
        
        // Sort cleaners by algorithm score (highest first)
        const sortedCleaners = cleaners.sort((a, b) => {
          const scoreA = scores[a.id]?.score || 0;
          const scoreB = scores[b.id]?.score || 0;
          return scoreB - scoreA; // Descending order
        });
        
        setSearchResults(sortedCleaners);
        setCurrentPage(1); // Reset to first page on new search
        
        toast.success(`Found ${cleaners.length} cleaner${cleaners.length > 1 ? 's' : ''} - Ranked by match quality!`);
        
      } catch (error) {
        // Algorithm failed, use location results only
        console.warn('Recommendation algorithm unavailable, using distance-based sorting:', error);
        setRecommendationScores({});
        setRankingEnabled(false);
        setSearchResults(cleaners);
        setCurrentPage(1); // Reset to first page
        toast.success(`Found ${cleaners.length} cleaner${cleaners.length > 1 ? 's' : ''} in your area!`);
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

  // Filter results based on "show only new" toggle
  const filteredResults = showOnlyNew
    ? searchResults.filter(cleaner => {
        const recData = recommendationScores[cleaner.id];
        return !recData?.previous_jobs; // Only show cleaners without history
      })
    : searchResults;

  // Pagination calculations (use filtered results)
  const totalPages = Math.ceil(filteredResults.length / resultsPerPage);
  const indexOfLastResult = currentPage * resultsPerPage;
  const indexOfFirstResult = indexOfLastResult - resultsPerPage;
  const currentResults = filteredResults.slice(indexOfFirstResult, indexOfLastResult);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Find Cleaners in Your Area</h3>
          <p className="text-sm text-gray-600">
            {selectedProperty 
              ? `Finding cleaners for: ${selectedProperty.address_line1}, ${selectedProperty.city}`
              : 'Cleaners define their own service areas - we\'ll show you all who can reach your location'}
          </p>
        </div>
        
        <div className="space-y-4">
          {/* Property Selection (for clients) */}
          {user?.role === 'client' && properties.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Search for a specific property (optional)
              </label>
              <select
                value={selectedProperty?.id || ''}
                onChange={handlePropertySelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                disabled={isLoadingProperties}
              >
                <option value="">Browse all cleaners near me (no property context)</option>
                {properties.map(property => (
                  <option key={property.id} value={property.id}>
                    {property.address_line1}, {property.city} - {property.property_type} ({property.size_sqft} sqft)
                  </option>
                ))}
              </select>
              
              {selectedProperty && (
                <div className="mt-3 p-3 bg-white rounded border border-blue-300">
                  <p className="text-xs font-semibold text-blue-800 mb-1">✨ ML-Powered Matching Active</p>
                  <p className="text-xs text-gray-600">
                    Using property details for personalized recommendations
                    {selectedProperty.latitude && selectedProperty.longitude && ' • Using property GPS coordinates'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Client with no properties prompt */}
          {user?.role === 'client' && properties.length === 0 && !isLoadingProperties && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-2">
                💡 <strong>Tip:</strong> Add a property to get personalized cleaner recommendations based on your property type, size, and location!
              </p>
              <button
                onClick={() => navigate('/properties')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
              >
                + Add your first property
              </button>
            </div>
          )}
          
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
                  <span className="font-medium">Location set -</span>
                  <span>Finding cleaners who service this area...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Search Results ({filteredResults.length} total{filteredResults.length > resultsPerPage ? ` - Page ${currentPage} of ${totalPages}` : ''})
              </h3>
              {rankingEnabled && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Smart Ranking</span>
                  <span className="text-xs text-green-700">(Quality-First)</span>
                </div>
              )}
            </div>
            
            {/* Toggle to show only new cleaners */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showOnlyNew}
                    onChange={(e) => {
                      setShowOnlyNew(e.target.checked);
                      setCurrentPage(1); // Reset to first page when toggling
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors">
                    <div className="absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Show only new cleaners (hide previous)
                </span>
              </label>
              
              {showOnlyNew && (
                <span className="text-xs text-gray-500 italic">
                  ({searchResults.filter(c => !recommendationScores[c.id]?.previous_jobs).length} without history)
                </span>
              )}
            </div>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredResults.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">
                  {showOnlyNew ? 'No new cleaners found' : 'No cleaners found'}
                </p>
                <p className="text-sm mt-1">
                  {showOnlyNew ? 'All available cleaners have worked with you before. Try turning off the filter.' : 'Try adjusting your search criteria'}
                </p>
              </div>
            ) : (
              currentResults.map((cleaner, index) => {
                const isSelected = isCleanerSelected(cleaner);
                const recData = recommendationScores[cleaner.id];
                const mlScore = recData?.score;
                const stats = recData?.stats;
                const rec = recData || {};  // Full recommendation data including history
                // Calculate actual index in full results for "Top 3" determination
                const actualIndex = indexOfFirstResult + index;
                const isTopRecommendation = rankingEnabled && actualIndex < 3; // Top 3 overall are "highly recommended"
                
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {cleaner.first_name} {cleaner.last_name}
                              </h4>

                              {/* Verified Cleaner Badge */}
                              {cleaner.is_verified_cleaner && (
                                <VerifiedBadge size="sm" showText={true} />
                              )}
                              
                              {/* ML Recommendation Badge */}
                              {isTopRecommendation && mlScore && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                  Top Match
                                </span>
                              )}
                              
                              {/* Match Score Display */}
                              {mlScore && (
                                <span 
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                                  title="Score based on: Distance (50%), Rating (30%), Experience (15%), Completion Rate (5%)"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  {(mlScore * 100).toFixed(0)}% match
                                </span>
                              )}
                              
                              {/* Previously Cleaned Badge */}
                              {rec.previous_jobs && rec.previous_jobs > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md" title={`Cleaned your properties ${rec.previous_jobs} time${rec.previous_jobs > 1 ? 's' : ''} • Last: ${new Date(rec.last_cleaned).toLocaleDateString()} ${rec.previous_rating ? `• Rated ${rec.previous_rating}/10` : ''}`}>
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Previously Cleaned for You
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{cleaner.email}</p>
                            
                            {/* Previous Job Details (if applicable) */}
                            {rec.previous_jobs && rec.previous_jobs > 0 && (
                              <div className="mt-2 p-2.5 bg-amber-50 border-l-4 border-amber-400 rounded-r-md">
                                <p className="text-xs font-semibold text-amber-900 mb-1">
                                  🏡 Cleaned your properties {rec.previous_jobs} time{rec.previous_jobs > 1 ? 's' : ''} before
                                </p>
                                <div className="flex items-center gap-3 text-xs text-amber-800 flex-wrap">
                                  {rec.last_cleaned && (
                                    <span>
                                      <span className="font-medium">Last cleaned:</span> {new Date(rec.last_cleaned).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                  )}
                                  {rec.previous_rating && (
                                    <span className="flex items-center gap-1">
                                      <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                      <span className="font-medium">{rec.previous_rating}/10</span> avg rating
                                    </span>
                                  )}
                                </div>
                                {rec.last_property_address && (
                                  <p className="mt-1 text-xs text-amber-700">
                                    <span className="font-medium">Last location:</span> {rec.last_property_address}
                                  </p>
                                )}
                                {rec.last_review && (
                                  <p className="mt-1.5 text-xs italic text-amber-700">
                                    "{rec.last_review}..."
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Stats Row */}
                        {stats && (
                          <div className="flex items-center gap-4 mb-2 text-sm flex-wrap">
                            {stats.avg_rating > 0 ? (
                              <div className="flex items-center gap-1">
                                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                <span className="font-medium">{stats.avg_rating.toFixed(1)}/10</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">No ratings yet</span>
                            )}
                            
                            {stats.total_jobs >= 0 && (
                              <span className="text-gray-600">
                                <span className="font-medium text-gray-900">{stats.total_jobs}</span> job{stats.total_jobs !== 1 ? 's' : ''} completed
                              </span>
                            )}
                            
                            {stats.completion_rate >= 0 && (
                              <span className="text-green-600 font-medium">
                                {(stats.completion_rate * 100).toFixed(0)}% completion
                              </span>
                            )}
                          </div>
                        )}
                        
                        {cleaner.distance_miles !== undefined && (
                          <div className="flex items-center gap-2 text-sm mb-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {(cleaner.distance_miles * 1.609).toFixed(1)} km ({cleaner.distance_miles.toFixed(1)} mi)
                            </span>
                          </div>
                        )}

                        {/* Score Breakdown (if ranking is active) */}
                        {rankingEnabled && stats && mlScore && (
                          <div className="mt-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Quality Score Breakdown</span>
                              <span className="text-lg font-bold text-blue-600">{(mlScore * 100).toFixed(0)}%</span>
                            </div>
                            <div className="space-y-1.5">
                              {/* Rating Factor - PRIMARY */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">
                                  <span className="font-medium">⭐ Rating:</span> {stats.avg_rating > 0 ? `${stats.avg_rating.toFixed(1)}/10` : 'Unrated (5.0 default)'}
                                </span>
                                <span className="font-semibold text-yellow-600">60% weight</span>
                              </div>
                              {/* Experience Factor */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">
                                  <span className="font-medium">💼 Experience:</span> {stats.total_jobs} jobs
                                </span>
                                <span className="font-semibold text-purple-600">25% weight</span>
                              </div>
                              {/* Completion Factor */}
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">
                                  <span className="font-medium">✅ Reliability:</span> {(stats.completion_rate * 100).toFixed(0)}%
                                </span>
                                <span className="font-semibold text-green-600">15% weight</span>
                              </div>
                              <div className="mt-2 pt-2 border-t border-blue-200">
                                <p className="text-xs text-gray-500 italic">
                                  📍 All cleaners service your area equally - ranked by quality
                                </p>
                              </div>
                            </div>
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

          {/* Pagination Controls */}
          {searchResults.length > resultsPerPage && (
            <div className="px-4 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                {/* Results info */}
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstResult + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(indexOfLastResult, searchResults.length)}</span> of{' '}
                  <span className="font-medium">{searchResults.length}</span> cleaners
                </div>

                {/* Pagination buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === 1
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      // Show first page, last page, current page, and pages around current
                      const showPage = 
                        pageNum === 1 || 
                        pageNum === totalPages || 
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1);
                      
                      const showEllipsis = 
                        (pageNum === currentPage - 2 && currentPage > 3) ||
                        (pageNum === currentPage + 2 && currentPage < totalPages - 2);

                      if (showEllipsis) {
                        return <span key={pageNum} className="px-2 text-gray-400">...</span>;
                      }

                      if (!showPage) {
                        return null;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === totalPages
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CleanerSearch;

