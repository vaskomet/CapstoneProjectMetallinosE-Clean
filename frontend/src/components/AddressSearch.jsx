import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';

/**
 * AddressSearch Component
 * 
 * Reusable address search component using OpenStreetMap's Nominatim geocoding service.
 * Provides address suggestions as user types and returns full address details with coordinates.
 * 
 * @param {Function} onAddressSelect - Callback function when address is selected
 *   Returns object: { address: { address_line1, city, state, postal_code, country }, coordinates: { lat, lng } }
 */
const AddressSearch = ({ onAddressSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addressSelected, setAddressSelected] = useState(false); // Track if address was selected
  const debounceTimerRef = useRef(null);
  const isSelectingRef = useRef(false); // Track if user is selecting an address

  const searchAddress = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      console.log('🔍 Searching for:', query);
      
      const apiKey = import.meta.env.VITE_GEOAPIFY_KEY;
      
      // Using Geoapify Autocomplete API (optimized for Greece/Athens)
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?` +
        `text=${encodeURIComponent(query)}` +
        `&apiKey=${apiKey}` +
        `&filter=countrycode:gr` +           // Limit to Greece
        `&bias=proximity:23.7275,37.9838` + // Prioritize Athens results
        `&lang=en` +                         // Results in English
        `&limit=5` +                         // Max 5 suggestions
        `&format=json`
      );
      
      const data = await response.json();
      const results = data.results || [];
      
      console.log('📍 Found results:', results.length);
      
      const formattedSuggestions = results.map(result => {
        // Extract address components
        const street = result.street || result.name || '';
        const houseNumber = result.housenumber || '';
        const addressLine1 = houseNumber && street 
          ? `${houseNumber} ${street}` 
          : street || result.formatted?.split(',')[0] || '';
        
        return {
          id: result.place_id || result.osm_id,
          displayName: result.formatted,
          address: {
            address_line1: addressLine1,
            city: result.city || result.municipality || '',
            state: result.state || result.county || '',
            postal_code: result.postcode || '',
            country: result.country || 'Greece'
          },
          coordinates: {
            lat: result.lat,
            lng: result.lon
          }
        };
      });
      
      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to search addresses');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Reset addressSelected flag when user types (modifying selected address)
    if (addressSelected && !isSelectingRef.current) {
      setAddressSelected(false);
    }
    
    // Don't search if user is selecting an address
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Clear suggestions if query is too short
    if (!query || query.length < 3) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }
    
    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      searchAddress(query);
    }, 300);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const selectAddress = (suggestion) => {
    console.log('✅ Selected address:', suggestion);
    
    // Set flag to prevent search when updating query
    isSelectingRef.current = true;
    
    // Mark that an address was selected
    setAddressSelected(true);
    
    // Update search query with selected address
    setSearchQuery(suggestion.displayName);
    
    // Clear suggestions
    setSuggestions([]);
    
    // Call parent callback
    onAddressSelect(suggestion);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        🔍 Search Address (Optional)
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Type an address to search... (e.g., '123 Main St, Athens')"
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>
      
      {isSearching && suggestions.length === 0 && searchQuery.length >= 3 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-1 p-2 z-[100] shadow-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-sm text-gray-600">Searching...</span>
          </div>
        </div>
      )}
      
      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-1 max-h-60 overflow-y-auto z-[100] shadow-lg">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
              onClick={() => selectAddress(suggestion)}
            >
              <div className="text-sm font-medium text-gray-900">
                {suggestion.address.address_line1}
              </div>
              <div className="text-xs text-gray-600">
                {suggestion.address.city}, {suggestion.address.state} {suggestion.address.postal_code}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {searchQuery.length >= 3 && !isSearching && suggestions.length === 0 && !addressSelected && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-1 p-3 z-[100] shadow-lg">
          <p className="text-sm text-gray-500">No addresses found. Try a different search or fill manually.</p>
        </div>
      )}
    </div>
  );
};

export default AddressSearch;
