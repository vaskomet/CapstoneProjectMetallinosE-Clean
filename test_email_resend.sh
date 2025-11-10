#!/bin/bash

# Email Verification Resend - Test Script
# Tests the improved email verification endpoint with retry logic

echo "=================================================="
echo "Email Verification Resend - Test Script"
echo "=================================================="
echo ""

# Check if JWT token is provided
if [ -z "$1" ]; then
    echo "❌ ERROR: JWT token required"
    echo ""
    echo "Usage: ./test_email_resend.sh YOUR_JWT_TOKEN"
    echo ""
    echo "To get a JWT token:"
    echo "  1. Log into the app (http://localhost:3000)"
    echo "  2. Open browser console"
    echo "  3. Run: localStorage.getItem('access_token')"
    echo ""
    exit 1
fi

JWT_TOKEN="$1"

echo "📧 Testing resend verification email endpoint..."
echo "Endpoint: POST /api/auth/resend-verification/"
echo ""

# Make the API call
echo "Making request..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST http://localhost:8000/api/auth/resend-verification/ \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json")

# Extract HTTP status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo ""
echo "=================================================="
echo "RESPONSE:"
echo "=================================================="
echo "HTTP Status: $HTTP_STATUS"
echo ""
echo "Body:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

# Interpret the result
echo "=================================================="
echo "INTERPRETATION:"
echo "=================================================="

if [ "$HTTP_STATUS" = "200" ]; then
    if echo "$BODY" | grep -q "debug_mode"; then
        echo "✅ SUCCESS (Development Mode)"
        echo ""
        echo "Email sending failed, but in development mode."
        echo "Check the backend console logs for the verification URL:"
        echo ""
        echo "  docker compose -f docker-compose.dev.yml logs backend --tail=50 | grep -A 5 'VERIFICATION URL'"
        echo ""
    else
        echo "✅ SUCCESS"
        echo ""
        echo "Verification email sent successfully!"
        echo "Check your inbox (including spam folder)."
    fi
elif [ "$HTTP_STATUS" = "400" ]; then
    echo "⚠️  BAD REQUEST"
    echo ""
    if echo "$BODY" | grep -q "already verified"; then
        echo "Your email is already verified. No action needed."
    elif echo "$BODY" | grep -q "OAuth users"; then
        echo "OAuth users are automatically verified."
    else
        echo "Invalid request. Check the error message above."
    fi
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ UNAUTHORIZED"
    echo ""
    echo "JWT token is invalid or expired."
    echo "Please log in again and get a fresh token."
elif [ "$HTTP_STATUS" = "503" ]; then
    echo "⚠️  SERVICE UNAVAILABLE"
    echo ""
    echo "Email service is temporarily unavailable."
    echo "This is normal if:"
    echo "  - SendGrid credentials are not configured"
    echo "  - Network connectivity issues"
    echo "  - SendGrid rate limits exceeded"
    echo ""
    echo "The system attempted 3 times with retry logic."
    echo "Try again later or contact support."
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "❌ INTERNAL SERVER ERROR"
    echo ""
    echo "This should NOT happen with the new fix."
    echo "If you see this, something went wrong."
    echo "Check backend logs:"
    echo ""
    echo "  docker compose -f docker-compose.dev.yml logs backend --tail=100"
else
    echo "❓ UNEXPECTED STATUS: $HTTP_STATUS"
    echo ""
    echo "Check backend logs for details."
fi

echo ""
echo "=================================================="
echo "BACKEND LOGS (Last 20 lines):"
echo "=================================================="
docker compose -f docker-compose.dev.yml logs backend --tail=20 2>&1 | grep -v "WARN\[0000\]"

echo ""
echo "=================================================="
echo "Test Complete"
echo "=================================================="
