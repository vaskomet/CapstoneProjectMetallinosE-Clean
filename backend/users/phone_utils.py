"""
Phone number validation utilities using Google's libphonenumber.

This module provides centralized phone validation logic that validates international
phone numbers according to country-specific rules. Uses Google's libphonenumber library,
the same library used by WhatsApp, Signal, and other major applications.

Key Features:
- Country-specific validation (knows exact rules for 200+ countries)
- Handles + vs 00 prefix automatically
- Validates mobile vs landline numbers
- Formats numbers to E.164 international standard
- Provides detailed error messages

Usage:
    from users.phone_utils import validate_international_phone, format_phone_e164
    
    # Validate phone number
    is_valid, formatted, error = validate_international_phone('+30', '6912345678')
    if not is_valid:
        raise ValidationError(error)
    
    # Format to E.164 standard
    formatted = format_phone_e164('+30', '6912345678')
    # Returns: '+306912345678'
"""

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberType
import logging

logger = logging.getLogger(__name__)


def validate_international_phone(country_code, phone_number):
    """
    Validate phone number against country-specific rules.
    
    Args:
        country_code (str): Country dial code with + prefix (e.g., '+30', '+1', '+234')
        phone_number (str): Phone number without country code (e.g., '6912345678')
    
    Returns:
        tuple: (is_valid, formatted_number, error_message)
            - is_valid (bool): True if valid, False otherwise
            - formatted_number (str): E.164 formatted number if valid, None otherwise
            - error_message (str): Error description if invalid, None otherwise
    
    Examples:
        >>> validate_international_phone('+30', '6912345678')
        (True, '+306912345678', None)
        
        >>> validate_international_phone('+30', '123')
        (False, None, 'Phone number is too short for Greece')
        
        >>> validate_international_phone('+234', '8012345678')
        (True, '+2348012345678', None)
    """
    # Handle empty/None values
    if not country_code or not phone_number:
        return (True, None, None)  # Allow empty (optional field)
    
    # Clean input
    phone_number = phone_number.strip()
    country_code = country_code.strip()
    
    # Combine into full international format
    full_number = f"{country_code}{phone_number}"
    
    try:
        # Parse the phone number
        parsed = phonenumbers.parse(full_number, None)
        
        # Check if it's a valid number for its country
        if not phonenumbers.is_valid_number(parsed):
            # Try to provide specific error message
            if not phonenumbers.is_possible_number(parsed):
                number_type = phonenumbers.number_type(parsed)
                region = phonenumbers.region_code_for_number(parsed)
                
                # Get country name for better error message
                from phonenumbers import geocoder
                country_name = geocoder.description_for_number(parsed, 'en') or region
                
                # Check specific issues
                national_number = str(parsed.national_number)
                if len(national_number) < 6:
                    return (False, None, f'Phone number is too short for {country_name}')
                elif len(national_number) > 15:
                    return (False, None, f'Phone number is too long for {country_name}')
                else:
                    return (False, None, f'Invalid phone number format for {country_name}')
            else:
                return (False, None, 'Phone number is not valid for this country')
        
        # Format to E.164 standard
        formatted = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        
        return (True, formatted, None)
        
    except NumberParseException as e:
        # Map exception types to user-friendly messages
        error_map = {
            NumberParseException.INVALID_COUNTRY_CODE: 'Invalid country code',
            NumberParseException.NOT_A_NUMBER: 'Phone number contains invalid characters',
            NumberParseException.TOO_SHORT_NSN: 'Phone number is too short',
            NumberParseException.TOO_SHORT_AFTER_IDD: 'Phone number is too short after country code',
            NumberParseException.TOO_LONG: 'Phone number is too long',
        }
        
        error_msg = error_map.get(e.error_type, f'Invalid phone number format')
        logger.warning(f'Phone validation failed: {error_msg} - {full_number}')
        
        return (False, None, error_msg)
    
    except Exception as e:
        logger.error(f'Unexpected error validating phone: {str(e)} - {full_number}')
        return (False, None, 'Unable to validate phone number')


def format_phone_e164(country_code, phone_number):
    """
    Format phone number to E.164 international standard.
    
    E.164 format: +[country code][subscriber number]
    Example: +306912345678
    
    Args:
        country_code (str): Country dial code with + (e.g., '+30')
        phone_number (str): Phone number without country code
    
    Returns:
        str: E.164 formatted number or None if invalid
    
    Examples:
        >>> format_phone_e164('+30', '6912345678')
        '+306912345678'
        
        >>> format_phone_e164('+1', '202 555 1234')
        '+12025551234'
    """
    is_valid, formatted, _ = validate_international_phone(country_code, phone_number)
    return formatted if is_valid else None


def get_country_info_from_code(country_code):
    """
    Get country information from dial code.
    
    Args:
        country_code (str): Country dial code (e.g., '+30', '+1', '+234')
    
    Returns:
        dict: Country information with keys:
            - region_code (str): ISO 3166-1 alpha-2 code (e.g., 'GR', 'US', 'NG')
            - country_name (str): Full country name (e.g., 'Greece', 'United States')
            - example_number (str): Example valid phone number for this country
    
    Examples:
        >>> get_country_info_from_code('+30')
        {'region_code': 'GR', 'country_name': 'Greece', 'example_number': '+302101234567'}
    """
    try:
        # Parse a minimal valid number to get region
        # We use '1' as placeholder since we just need the country code
        parsed = phonenumbers.parse(f"{country_code}1", None)
        region = phonenumbers.region_code_for_number(parsed)
        
        if not region or region == 'ZZ':  # ZZ = unknown region
            return None
        
        # Get country name
        from phonenumbers import geocoder
        country_name = geocoder.description_for_number(parsed, 'en')
        
        # Get example number for this region
        example = phonenumbers.example_number_for_type(region, PhoneNumberType.MOBILE)
        example_formatted = phonenumbers.format_number(example, phonenumbers.PhoneNumberFormat.E164) if example else None
        
        return {
            'region_code': region,
            'country_name': country_name,
            'example_number': example_formatted
        }
        
    except Exception as e:
        logger.warning(f'Could not get country info for {country_code}: {str(e)}')
        return None


def get_phone_number_type(country_code, phone_number):
    """
    Determine if phone number is mobile, landline, or other type.
    
    Args:
        country_code (str): Country dial code
        phone_number (str): Phone number
    
    Returns:
        str: Phone type ('MOBILE', 'FIXED_LINE', 'VOIP', 'UNKNOWN', etc.)
    
    Examples:
        >>> get_phone_number_type('+30', '6912345678')
        'MOBILE'
        
        >>> get_phone_number_type('+30', '2101234567')
        'FIXED_LINE'
    """
    try:
        full_number = f"{country_code}{phone_number}"
        parsed = phonenumbers.parse(full_number, None)
        number_type = phonenumbers.number_type(parsed)
        
        type_map = {
            PhoneNumberType.MOBILE: 'MOBILE',
            PhoneNumberType.FIXED_LINE: 'FIXED_LINE',
            PhoneNumberType.FIXED_LINE_OR_MOBILE: 'FIXED_LINE_OR_MOBILE',
            PhoneNumberType.TOLL_FREE: 'TOLL_FREE',
            PhoneNumberType.PREMIUM_RATE: 'PREMIUM_RATE',
            PhoneNumberType.SHARED_COST: 'SHARED_COST',
            PhoneNumberType.VOIP: 'VOIP',
            PhoneNumberType.PERSONAL_NUMBER: 'PERSONAL_NUMBER',
            PhoneNumberType.PAGER: 'PAGER',
            PhoneNumberType.UAN: 'UAN',
            PhoneNumberType.VOICEMAIL: 'VOICEMAIL',
            PhoneNumberType.UNKNOWN: 'UNKNOWN'
        }
        
        return type_map.get(number_type, 'UNKNOWN')
        
    except Exception:
        return 'UNKNOWN'


def clean_phone_number(phone_number):
    """
    Remove common formatting characters from phone number.
    
    Removes: spaces, dashes, parentheses, dots
    Preserves: digits and + sign
    
    Args:
        phone_number (str): Raw phone number input
    
    Returns:
        str: Cleaned phone number with only digits
    
    Examples:
        >>> clean_phone_number('(691) 234-5678')
        '6912345678'
        
        >>> clean_phone_number('691 234 5678')
        '6912345678'
        
        >>> clean_phone_number('691.234.5678')
        '6912345678'
    """
    if not phone_number:
        return ''
    
    # Remove common formatting characters
    cleaned = phone_number.replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('.', '')
    
    # Remove + if it's not at the start (country code should be separate)
    if cleaned.startswith('+'):
        cleaned = cleaned[1:]
    
    return cleaned
