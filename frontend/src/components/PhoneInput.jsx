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
  disabled = false,
  label = "Phone Number"
}) => {
  const selectedCountry = COUNTRY_CODES.find(country => country.dial === countryCode) || COUNTRY_CODES[7]; // Default to Greece

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit based on total length including country code (15 characters max)
    const maxPhoneLength = 15 - countryCode.length;
    if (digits.length > maxPhoneLength) return phoneNumber;
    
    return digits;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    onPhoneChange(formatted);
  };

  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="flex gap-2">
        {/* Country Code Selector */}
        <div className="relative flex-shrink-0">
          <select
            value={countryCode}
            onChange={(e) => onCountryChange(e.target.value)}
            disabled={disabled}
            className="appearance-none h-[50px] pl-3 pr-10 border-2 border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-4 focus:ring-green-500/20 focus:border-green-500 text-sm font-medium cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"
            style={{ minWidth: '95px' }}
          >
            {COUNTRY_CODES.map((country) => (
              <option key={country.code} value={country.dial}>
                {country.flag} {country.dial}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
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
          placeholder="6912345678"
          disabled={disabled}
          className={`flex-1 px-4 py-3 border-2 ${
            error 
              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-gray-200 focus:ring-green-500/20 focus:border-green-500'
          } rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 transition-all duration-300 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm`}
          maxLength="15"
        />
      </div>
      
      {/* Country Name Display - Subtle helper text */}
      <div className="text-xs text-gray-500 mt-2 pl-1">
        {selectedCountry.flag} {selectedCountry.name}
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;