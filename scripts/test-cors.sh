#!/bin/bash

# Test CORS configuration for CityForge API endpoints
# Usage: ./test-cors.sh [api-url]

API_URL="${1:-http://localhost:3000}"
TEST_ENDPOINT="/api/cards"

echo "Testing CORS configuration for: ${API_URL}${TEST_ENDPOINT}"
echo "=============================================="

# Test origins that should be allowed
ALLOWED_ORIGINS=(
    "http://localhost:3000"
    "https://localhost:3000"
    "http://127.0.0.1:3000"
    "https://community.community"
    "https://www.community.community"
    "https://cityforge.cityforge"
    "https://www.cityforge.cityforge"
)

# Test origins that should be blocked
BLOCKED_ORIGINS=(
    "https://evil-site.com"
    "http://malicious.example"
    "https://subdomain.evil-site.com"
)

echo "Testing ALLOWED origins:"
echo "------------------------"

for origin in "${ALLOWED_ORIGINS[@]}"; do
    echo -n "Testing origin: $origin ... "
    
    # Test preflight request
    response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -X OPTIONS \
        "${API_URL}${TEST_ENDPOINT}")
    
    if [ "$response" = "204" ]; then
        # Check if CORS headers are present
        cors_origin=$(curl -s -I \
            -H "Origin: $origin" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type,Authorization" \
            -X OPTIONS \
            "${API_URL}${TEST_ENDPOINT}" | grep -i "access-control-allow-origin")
        
        if [[ "$cors_origin" == *"$origin"* ]]; then
            echo "✅ ALLOWED (CORS headers present)"
        else
            echo "❌ FAILED (No CORS headers)"
        fi
    else
        echo "❌ FAILED (HTTP $response)"
    fi
done

echo ""
echo "Testing BLOCKED origins:"
echo "------------------------"

for origin in "${BLOCKED_ORIGINS[@]}"; do
    echo -n "Testing origin: $origin ... "
    
    # Test preflight request  
    cors_origin=$(curl -s -I \
        -H "Origin: $origin" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization" \
        -X OPTIONS \
        "${API_URL}${TEST_ENDPOINT}" | grep -i "access-control-allow-origin")
    
    if [[ "$cors_origin" == *"$origin"* ]]; then
        echo "❌ FAILED (Should be blocked but CORS headers present)"
    else
        echo "✅ BLOCKED (No CORS headers - as expected)"
    fi
done

echo ""
echo "Testing actual API request:"
echo "---------------------------"

# Test a real API request with an allowed origin
echo -n "GET request from localhost:3000 ... "
response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: http://localhost:3000" \
    -H "Content-Type: application/json" \
    "${API_URL}${TEST_ENDPOINT}")

if [ "$response" = "200" ]; then
    echo "✅ SUCCESS (HTTP 200)"
else
    echo "❌ FAILED (HTTP $response)"
fi

echo ""
echo "CORS test completed."
echo ""
echo "Note: This test checks basic CORS functionality."
echo "For production testing, verify that only your intended"
echo "domains are allowed and all others are properly blocked."