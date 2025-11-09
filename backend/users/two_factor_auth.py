"""
Two-Factor Authentication utilities using TOTP (Time-based One-Time Password).
Uses pyotp library for generating and verifying codes.
"""
import pyotp
import qrcode
from io import BytesIO
import base64


def generate_totp_secret():
    """
    Generate a new random TOTP secret key.
    Returns base32-encoded string (16 characters).
    """
    return pyotp.random_base32()


def get_totp_uri(user, secret):
    """
    Generate provisioning URI for authenticator apps.
    
    Args:
        user: User instance
        secret: TOTP secret key
    
    Returns:
        otpauth:// URI string that can be encoded in QR code
    """
    totp = pyotp.TOTP(secret)
    # Format: otpauth://totp/E-Clean:user@example.com?secret=XXX&issuer=E-Clean
    return totp.provisioning_uri(
        name=user.email,
        issuer_name='E-Clean Platform'
    )


def generate_qr_code(uri):
    """
    Generate QR code image from TOTP URI.
    
    Args:
        uri: otpauth:// URI string
    
    Returns:
        Base64-encoded PNG image string
    """
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64 for easy transfer
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"


def verify_totp_code(secret, code):
    """
    Verify a TOTP code against the secret.
    
    Args:
        secret: TOTP secret key
        code: 6-digit code from authenticator app
    
    Returns:
        Boolean indicating if code is valid
    """
    totp = pyotp.TOTP(secret)
    # Allow 1 interval (30 seconds) of tolerance for time drift
    return totp.verify(code, valid_window=1)


def generate_backup_codes(count=10):
    """
    Generate backup codes for account recovery.
    
    Args:
        count: Number of backup codes to generate
    
    Returns:
        List of backup codes (8 characters each, alphanumeric)
    """
    import secrets
    import string
    
    codes = []
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(count):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        # Format as XXXX-XXXX for readability
        formatted_code = f"{code[:4]}-{code[4:]}"
        codes.append(formatted_code)
    
    return codes
