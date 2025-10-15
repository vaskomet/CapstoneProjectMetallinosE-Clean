import React from 'react';

// Common country codes with their names and dial codes
const COUNTRY_CODES = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
];

const PhoneInput = ({ 
  countryCode = '+30', 
  phoneNumber = '', 
  onCountryChange, 
  onPhoneChange, 
  error,
  required = false,
  className = "",
  disabled = false 
}) => {
  const selectedCountry = COUNTRY_CODES.find(country => country.dial === countryCode) || COUNTRY_CODES[0];

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit based on total length including country code (14 characters max)
    const maxPhoneLength = 14 - countryCode.length;
    if (digits.length > maxPhoneLength) return phoneNumber;
    
    return digits;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    onPhoneChange(formatted);
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        Phone Number {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex rounded-md shadow-sm">
        {/* Country Code Selector */}
        <div className="relative">
          <select
            value={countryCode}
            onChange={(e) => onCountryChange(e.target.value)}
            disabled={disabled}
            className="h-10 pl-3 pr-8 border border-gray-300 bg-white rounded-l-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-medium appearance-none cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
            style={{ minWidth: '80px' }}
          >
            {COUNTRY_CODES.map((country) => (
              <option key={country.code} value={country.dial}>
                {country.flag} {country.dial}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        {/* Phone Number Input */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder="Enter phone number"
          disabled={disabled}
          className="flex-1 min-w-0 block w-full px-3 py-2 border border-l-0 border-gray-300 rounded-r-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          maxLength="15"
        />
      </div>
      
      {/* Country Name Display */}
      <div className="text-xs text-gray-500 pl-1">
        {selectedCountry.flag} {selectedCountry.name}
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 mt-1">{error}</p>
      )}
      
      {/* Help Text */}
      <p className="text-xs text-gray-500 mt-1">
        Enter your phone number without the country code
      </p>
    </div>
  );
};

export default PhoneInput;