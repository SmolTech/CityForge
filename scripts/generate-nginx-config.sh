#!/bin/bash

# Generate nginx.conf with proper CORS origins based on environment
# Usage: ./generate-nginx-config.sh [output-file]

OUTPUT_FILE="${1:-nginx.conf}"
TEMP_FILE="/tmp/nginx.conf.tmp"

# Set default values if environment variables are not set
CORS_ORIGINS="${CORS_ALLOWED_ORIGINS:-localhost:3000,127.0.0.1:3000,community.community,cityforge.cityforge}"

# Convert comma-separated origins to nginx regex pattern
generate_cors_pattern() {
    local origins="$1"
    local pattern=""
    
    IFS=',' read -ra ORIGIN_ARRAY <<< "$origins"
    for origin in "${ORIGIN_ARRAY[@]}"; do
        # Escape dots for regex
        escaped_origin=$(echo "$origin" | sed 's/\./\\./g')
        
        # Handle localhost and IP patterns
        if [[ "$origin" =~ ^(localhost|127\.0\.0\.1) ]]; then
            pattern="${pattern}if (\$http_origin ~* ^https?://${escaped_origin}(\$|:[0-9]+\$)) { set \$cors_origin \$http_origin; }\n            "
        else
            # Handle domain patterns (allow subdomains)
            pattern="${pattern}if (\$http_origin ~* ^https://([a-zA-Z0-9-]+\.)*${escaped_origin}\$) { set \$cors_origin \$http_origin; }\n            "
        fi
    done
    
    echo -e "$pattern"
}

# Generate CORS origin pattern
CORS_PATTERN=$(generate_cors_pattern "$CORS_ORIGINS")

# Create nginx.conf with dynamic CORS origins
cat > "$TEMP_FILE" << 'EOF'
events {
    worker_connections 1024;
}

http {
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # MIME types
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    upstream frontend {
        server frontend:3000;
    }

    # Backend upstream removed - all routes now handled by Next.js frontend

    server {
        listen 80;
        server_name localhost;

        # Large file upload support
        client_max_body_size 16M;

        # API routes - now handled by Next.js frontend
        location /api {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            # nosemgrep: generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling
            proxy_set_header Upgrade $http_upgrade;
            # nosemgrep: generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # CORS Configuration - Dynamic origins based on environment
            set $cors_origin "";
            CORS_ORIGIN_PATTERNS
            
            # Add CORS headers if origin is allowed
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' '86400' always;

            # Handle preflight requests
            if ($request_method = 'OPTIONS') {
                add_header 'Access-Control-Allow-Origin' $cors_origin always;
                add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
                add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type, X-Requested-With' always;
                add_header 'Access-Control-Allow-Credentials' 'true' always;
                add_header 'Access-Control-Max-Age' '86400' always;
                add_header 'Content-Length' '0';
                add_header 'Content-Type' 'text/plain';
                return 204;
            }
        }

        # Frontend routes - everything else
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            # nosemgrep: generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling
            proxy_set_header Upgrade $http_upgrade;
            # nosemgrep: generic.nginx.security.possible-h2c-smuggling.possible-nginx-h2c-smuggling
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Next.js specific settings
            proxy_buffering off;
        }

        # Health check endpoint
        location /nginx-health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Replace the CORS_ORIGIN_PATTERNS placeholder with generated patterns
sed "s|CORS_ORIGIN_PATTERNS|$CORS_PATTERN|g" "$TEMP_FILE" > "$OUTPUT_FILE"

# Clean up temp file
rm "$TEMP_FILE"

echo "Generated nginx.conf with CORS origins: $CORS_ORIGINS"
echo "Output file: $OUTPUT_FILE"