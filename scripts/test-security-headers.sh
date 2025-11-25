#!/bin/bash

# Security Headers Testing and Validation Script
# Tests security headers implementation for CityForge
# Usage: ./scripts/test-security-headers.sh [URL]

# Default to localhost if no URL provided
TARGET_URL="${1:-http://localhost:3000}"

echo "🔒 Security Headers Testing for CityForge"
echo "Target URL: $TARGET_URL"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a header is present and has expected value
check_header() {
    local header_name="$1"
    local expected_pattern="$2"
    local actual_value="$3"
    local is_optional="$4"
    
    if [ -z "$actual_value" ]; then
        if [ "$is_optional" = "true" ]; then
            echo -e "${YELLOW}⚠️  $header_name: Not present (optional)${NC}"
        else
            echo -e "${RED}❌ $header_name: Missing${NC}"
            return 1
        fi
    elif [[ "$actual_value" =~ $expected_pattern ]]; then
        echo -e "${GREEN}✅ $header_name: $actual_value${NC}"
        return 0
    else
        echo -e "${RED}❌ $header_name: $actual_value (expected pattern: $expected_pattern)${NC}"
        return 1
    fi
}

# Function to test security headers for a given URL
test_security_headers() {
    local url="$1"
    local endpoint_name="$2"
    
    echo -e "\n${BLUE}Testing $endpoint_name: $url${NC}"
    echo "----------------------------------------"
    
    # Fetch headers using curl
    local headers_file=$(mktemp)
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" -D "$headers_file" "$url")
    
    if [ "$status_code" != "200" ] && [ "$status_code" != "404" ]; then
        echo -e "${RED}❌ HTTP Status: $status_code (expected 200 or 404)${NC}"
        rm -f "$headers_file"
        return 1
    fi
    
    echo -e "${GREEN}✅ HTTP Status: $status_code${NC}"
    
    # Extract security headers
    local csp=$(grep -i "content-security-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local hsts=$(grep -i "strict-transport-security:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local frame_options=$(grep -i "x-frame-options:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local content_type_options=$(grep -i "x-content-type-options:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local referrer_policy=$(grep -i "referrer-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local permissions_policy=$(grep -i "permissions-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local coep=$(grep -i "cross-origin-embedder-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local coop=$(grep -i "cross-origin-opener-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    local corp=$(grep -i "cross-origin-resource-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    
    # Test security headers
    local failed_checks=0
    
    # Required headers
    check_header "Content-Security-Policy" "default-src" "$csp" false || ((failed_checks++))
    check_header "X-Frame-Options" "DENY" "$frame_options" false || ((failed_checks++))
    check_header "X-Content-Type-Options" "nosniff" "$content_type_options" false || ((failed_checks++))
    check_header "Referrer-Policy" "strict-origin" "$referrer_policy" false || ((failed_checks++))
    
    # Optional headers (HSTS only for HTTPS)
    if [[ "$url" == https://* ]]; then
        check_header "Strict-Transport-Security" "max-age" "$hsts" false || ((failed_checks++))
    else
        check_header "Strict-Transport-Security" "max-age" "$hsts" true
    fi
    
    # Additional security headers
    check_header "Permissions-Policy" "accelerometer" "$permissions_policy" false || ((failed_checks++))
    check_header "Cross-Origin-Embedder-Policy" "require-corp" "$coep" false || ((failed_checks++))
    check_header "Cross-Origin-Opener-Policy" "same-origin" "$coop" false || ((failed_checks++))
    check_header "Cross-Origin-Resource-Policy" "same-site" "$corp" false || ((failed_checks++))
    
    rm -f "$headers_file"
    
    if [ $failed_checks -eq 0 ]; then
        echo -e "\n${GREEN}✅ All security headers passed for $endpoint_name${NC}"
        return 0
    else
        echo -e "\n${RED}❌ $failed_checks security header check(s) failed for $endpoint_name${NC}"
        return 1
    fi
}

# Function to test CSP directive parsing
test_csp_directives() {
    echo -e "\n${BLUE}Testing CSP Directive Parsing${NC}"
    echo "----------------------------------------"
    
    local url="$TARGET_URL"
    local headers_file=$(mktemp)
    curl -s -D "$headers_file" "$url" > /dev/null
    
    local csp=$(grep -i "content-security-policy:" "$headers_file" | cut -d' ' -f2- | tr -d '\r\n')
    
    if [ -z "$csp" ]; then
        echo -e "${RED}❌ No CSP header found${NC}"
        rm -f "$headers_file"
        return 1
    fi
    
    echo -e "CSP Header: ${YELLOW}$csp${NC}"
    
    # Check for specific directives
    echo -e "\nChecking CSP directives:"
    
    if [[ "$csp" == *"default-src 'self'"* ]]; then
        echo -e "${GREEN}✅ default-src 'self'${NC}"
    else
        echo -e "${RED}❌ Missing or incorrect default-src directive${NC}"
    fi
    
    if [[ "$csp" == *"object-src 'none'"* ]]; then
        echo -e "${GREEN}✅ object-src 'none'${NC}"
    else
        echo -e "${RED}❌ Missing or incorrect object-src directive${NC}"
    fi
    
    if [[ "$csp" == *"frame-ancestors 'none'"* ]]; then
        echo -e "${GREEN}✅ frame-ancestors 'none'${NC}"
    else
        echo -e "${RED}❌ Missing or incorrect frame-ancestors directive${NC}"
    fi
    
    rm -f "$headers_file"
}

# Function to test with different endpoints
test_multiple_endpoints() {
    local base_url="$1"
    local total_failed=0
    
    echo -e "\n${BLUE}Testing Multiple Endpoints${NC}"
    echo "========================================"
    
    # Test homepage
    test_security_headers "$base_url" "Homepage" || ((total_failed++))
    
    # Test API endpoint
    test_security_headers "$base_url/api/cards" "API Endpoint" || ((total_failed++))
    
    # Test static assets (if accessible)
    test_security_headers "$base_url/favicon.ico" "Static Asset" || ((total_failed++))
    
    return $total_failed
}

# Function to test development vs production differences
test_environment_differences() {
    echo -e "\n${BLUE}Environment-Specific Tests${NC}"
    echo "========================================"
    
    if [[ "$TARGET_URL" == *"localhost"* ]] || [[ "$TARGET_URL" == *"127.0.0.1"* ]]; then
        echo -e "${YELLOW}⚠️  Development environment detected${NC}"
        echo "• CSP may include 'unsafe-inline' and 'unsafe-eval' for development"
        echo "• HSTS should not be enabled for HTTP"
        echo "• WebSocket connections should be allowed for hot reload"
    else
        echo -e "${GREEN}ℹ️  Production environment detected${NC}"
        echo "• CSP should be strict (no 'unsafe-inline' or 'unsafe-eval')"
        echo "• HSTS should be enabled for HTTPS"
        echo "• WebSocket connections should not be allowed"
    fi
}

# Main execution
main() {
    # Basic connectivity test
    echo -e "\n${BLUE}Testing Connectivity${NC}"
    echo "----------------------------------------"
    
    if curl -s --connect-timeout 10 "$TARGET_URL" > /dev/null; then
        echo -e "${GREEN}✅ Can connect to $TARGET_URL${NC}"
    else
        echo -e "${RED}❌ Cannot connect to $TARGET_URL${NC}"
        echo "Make sure the server is running and accessible."
        exit 1
    fi
    
    # Test CSP directive parsing
    test_csp_directives
    
    # Test multiple endpoints
    local failed_endpoints=0
    test_multiple_endpoints "$TARGET_URL" || failed_endpoints=$?
    
    # Environment-specific tests
    test_environment_differences
    
    # Summary
    echo -e "\n${BLUE}Summary${NC}"
    echo "========================================"
    
    if [ $failed_endpoints -eq 0 ]; then
        echo -e "${GREEN}🎉 All security header tests passed!${NC}"
        echo -e "${GREEN}Your application has proper security headers implemented.${NC}"
        exit 0
    else
        echo -e "${RED}💥 $failed_endpoints endpoint(s) failed security header tests.${NC}"
        echo -e "${YELLOW}Please review the security headers configuration.${NC}"
        exit 1
    fi
}

# Show usage if help requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Security Headers Testing Script for CityForge"
    echo ""
    echo "Usage: $0 [URL]"
    echo ""
    echo "Arguments:"
    echo "  URL    Target URL to test (default: http://localhost:3000)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test localhost"
    echo "  $0 https://yourdomain.com            # Test production"
    echo "  $0 http://localhost:3000             # Test local dev"
    echo ""
    echo "This script tests:"
    echo "• Content Security Policy (CSP)"
    echo "• HTTP Strict Transport Security (HSTS)"  
    echo "• X-Frame-Options"
    echo "• X-Content-Type-Options"
    echo "• Referrer-Policy"
    echo "• Permissions-Policy"
    echo "• Cross-Origin policies (COEP, COOP, CORP)"
    exit 0
fi

# Check dependencies
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is required but not installed.${NC}"
    exit 1
fi

# Run main function
main