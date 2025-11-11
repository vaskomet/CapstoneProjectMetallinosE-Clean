import React, { useState, useEffect, useRef } from 'react';
import { cleaningJobsAPI } from '../../services/api';

/**
 * SearchAutocomplete Component
 * 
 * Provides real-time autocomplete suggestions while typing in the search field.
 * Shows suggestions from:
 * - Service descriptions
 * - Cities
 * - Postal codes
 * - Addresses
 * 
 * @param {string} value - Current search input value
 * @param {function} onChange - Callback when user selects a suggestion
 * @param {function} onInputChange - Callback when input value changes (typing)
 */
const SearchAutocomplete = ({ value, onChange, onInputChange }) => {
  const [suggestions, setSuggestions] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Fetch suggestions when user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value && value.length >= 2) {
        try {
          const data = await cleaningJobsAPI.autocomplete(value);
          setSuggestions(data);
          setIsOpen(true);
        } catch (error) {
          console.error('Autocomplete error:', error);
          setSuggestions(null);
        }
      } else {
        setSuggestions(null);
        setIsOpen(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || !suggestions) return;

    const allSuggestions = [
      ...suggestions.postal_codes,
      ...suggestions.cities,
      ...suggestions.descriptions,
      ...suggestions.addresses,
    ];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < allSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && allSuggestions[selectedIndex]) {
        handleSelect(allSuggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleInputChange = (e) => {
    onInputChange(e.target.value);
    setSelectedIndex(-1);
  };

  // Render suggestions list
  const renderSuggestions = () => {
    if (!isOpen || !suggestions) return null;

    const hasSuggestions =
      suggestions.postal_codes.length > 0 ||
      suggestions.cities.length > 0 ||
      suggestions.descriptions.length > 0 ||
      suggestions.addresses.length > 0;

    if (!hasSuggestions) return null;

    let currentIndex = 0;

    return (
      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
        {/* Postal Codes */}
        {suggestions.postal_codes.length > 0 && (
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              Postal Codes
            </div>
            {suggestions.postal_codes.map((postal) => {
              const index = currentIndex++;
              return (
                <div
                  key={`postal-${postal}`}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                    selectedIndex === index ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelect(postal)}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span className="font-mono text-sm">{postal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cities */}
        {suggestions.cities.length > 0 && (
          <div className="py-1 border-t border-gray-100">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              Cities
            </div>
            {suggestions.cities.map((city) => {
              const index = currentIndex++;
              return (
                <div
                  key={`city-${city}`}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                    selectedIndex === index ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelect(city)}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">{city}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Descriptions */}
        {suggestions.descriptions.length > 0 && (
          <div className="py-1 border-t border-gray-100">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              Services
            </div>
            {suggestions.descriptions.slice(0, 3).map((desc) => {
              const index = currentIndex++;
              return (
                <div
                  key={`desc-${desc}`}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                    selectedIndex === index ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelect(desc)}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm truncate">{desc.substring(0, 60)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Addresses */}
        {suggestions.addresses.length > 0 && (
          <div className="py-1 border-t border-gray-100">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase bg-gray-50">
              Addresses
            </div>
            {suggestions.addresses.slice(0, 3).map((address) => {
              const index = currentIndex++;
              return (
                <div
                  key={`addr-${address}`}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                    selectedIndex === index ? 'bg-blue-100' : ''
                  }`}
                  onClick={() => handleSelect(address)}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span className="text-sm truncate">{address}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions) setIsOpen(true);
        }}
        placeholder="Search jobs by service, location, or postal code..."
        className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {renderSuggestions()}
    </div>
  );
};

export default SearchAutocomplete;
