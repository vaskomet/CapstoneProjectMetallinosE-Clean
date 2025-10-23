import React, { useState, useEffect, useRef } from 'react';
import { serviceAreasAPI } from '../services/api';

/**
 * Location Filter Component for Job Search
 * Allows cleaners to filter jobs by their service areas or distance ranges
 */
const LocationFilter = ({ onFilterChange, currentFilter }) => {
  const [serviceAreas, setServiceAreas] = useState([]);
  const [filterType, setFilterType] = useState(currentFilter?.type || 'all');
  const [selectedArea, setSelectedArea] = useState(currentFilter?.areaId || '');
  const [distanceRange, setDistanceRange] = useState(currentFilter?.distance || '5');
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const debounceRef = useRef(null);

  const distanceOptions = [
    { value: '1', label: '1 km radius', miles: 0.6 },
    { value: '2', label: '2 km radius', miles: 1.2 },
    { value: '3', label: '3 km radius', miles: 1.9 },
    { value: '5', label: '5 km radius', miles: 3.1 },
    { value: '10', label: '10 km radius', miles: 6.2 },
    { value: '15', label: '15 km radius', miles: 9.3 },
    { value: '20', label: '20 km radius', miles: 12.4 },
    { value: '30', label: '30 km radius', miles: 18.6 },
    { value: '50', label: '50 km radius', miles: 31.1 }
  ];

  useEffect(() => {
    fetchServiceAreas();
  }, []);

  useEffect(() => {
    // Notify parent component of filter changes (skip initial render)
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the filter change call
    debounceRef.current = setTimeout(() => {
      const filter = {
        type: filterType,
        areaId: selectedArea,
        distance: distanceRange
      };
      onFilterChange(filter);
    }, 300); // 300ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filterType, selectedArea, distanceRange]); // Removed onFilterChange dependency

  const fetchServiceAreas = async () => {
    try {
      const response = await serviceAreasAPI.getAll();
      const areas = response.results || response || [];
      // Only show active service areas
      setServiceAreas(areas.filter(area => area.is_active));
    } catch (error) {
      console.error('Failed to fetch service areas:', error);
      setServiceAreas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterTypeChange = (type) => {
    setFilterType(type);
    if (type === 'all') {
      setSelectedArea('');
      setDistanceRange('5');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-600">Loading areas...</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border shadow-sm">
      <h3 className="text-sm font-medium text-gray-900 mb-3">📍 Location Filter</h3>
      
      <div className="space-y-3">
        {/* Filter Type Selection */}
        <div className="grid grid-cols-1 gap-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="filterType"
              value="all"
              checked={filterType === 'all'}
              onChange={(e) => handleFilterTypeChange(e.target.value)}
              className="mr-2 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">All locations</span>
          </label>
          
          {serviceAreas.length > 0 && (
            <label className="flex items-center">
              <input
                type="radio"
                name="filterType"
                value="myAreas"
                checked={filterType === 'myAreas'}
                onChange={(e) => handleFilterTypeChange(e.target.value)}
                className="mr-2 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">My service areas</span>
            </label>
          )}
          
          <label className="flex items-center">
            <input
              type="radio"
              name="filterType"
              value="distance"
              checked={filterType === 'distance'}
              onChange={(e) => handleFilterTypeChange(e.target.value)}
              className="mr-2 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Distance from me</span>
          </label>
        </div>

        {/* Service Area Selection */}
        {filterType === 'myAreas' && serviceAreas.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Select Service Area
            </label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All my areas</option>
              {serviceAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.area_name} 
                  {area.area_type === 'radius' && ` (${(area.radius_miles * 1.609).toFixed(1)} km)`}
                  {area.area_type === 'city' && ` (${area.city})`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Distance Range Selection */}
        {filterType === 'distance' && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Distance Range
            </label>
            <select
              value={distanceRange}
              onChange={(e) => setDistanceRange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {distanceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Based on your current location
            </p>
          </div>
        )}

        {/* No Service Areas Message */}
        {filterType === 'myAreas' && serviceAreas.length === 0 && (
          <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
            💡 No service areas defined. Add service areas in your profile to use this filter.
          </div>
        )}

        {/* Active Filter Summary */}
        {filterType !== 'all' && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            {filterType === 'myAreas' && (
              <>
                🎯 Showing jobs in{' '}
                {selectedArea 
                  ? serviceAreas.find(a => a.id.toString() === selectedArea)?.area_name || 'selected area'
                  : 'all your service areas'
                }
              </>
            )}
            {filterType === 'distance' && (
              <>
                📏 Showing jobs within {distanceRange} km of your location
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationFilter;