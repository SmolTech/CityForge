#!/bin/bash
set -e

echo "=== GitHub Container Registry Authentication Setup ==="
echo ""
echo "This script will create a Kubernetes secret for pulling images from ghcr.io"
echo ""

# Check if required parameters are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <github-username> <github-token>"
    echo ""
    echo "To create a GitHub Personal Access Token:"
    echo "1. Go to https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Give it a name like 'CityForge Docker Registry'"
    echo "4. Select expiration time"
    echo "5. Select scope: 'read:packages' (to read container images)"
    echo "6. Click 'Generate token'"
    echo "7. Copy the token and run this script with your GitHub username and token"
    echo ""
    echo "Example:"
    echo "  $0 yourusername ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    exit 1
fi

GITHUB_USERNAME="$1"
GITHUB_TOKEN="$2"
NAMESPACE="worcester"
SECRET_NAME="ghcr-auth"

# Validate inputs
if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]] && [[ ! "$GITHUB_TOKEN" =~ ^github_pat_ ]]; then
    echo "⚠️  Warning: GitHub token doesn't look like a valid Personal Access Token"
    echo "   Expected format: ghp_... or github_pat_..."
    echo "   Continuing anyway..."
fi

# Check if kubectl is configured
if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo "❌ Namespace '$NAMESPACE' not found"
    echo "Please ensure you're connected to the correct Kubernetes cluster"
    exit 1
fi

# Delete existing secret if it exists
echo "🧹 Cleaning up existing registry secret..."
kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE" --ignore-not-found=true

# Create the image pull secret
echo "🔑 Creating GitHub Container Registry secret..."
kubectl create secret docker-registry "$SECRET_NAME" \
    --namespace="$NAMESPACE" \
    --docker-server=ghcr.io \
    --docker-username="$GITHUB_USERNAME" \
    --docker-password="$GITHUB_TOKEN" \
    --docker-email="$GITHUB_USERNAME@users.noreply.github.com"

if [ $? -eq 0 ]; then
    echo "✅ Secret '$SECRET_NAME' created successfully"
else
    echo "❌ Failed to create secret"
    exit 1
fi

# Test the secret by trying to pull the image
echo ""
echo "🧪 Testing image pull with new credentials..."

# Create a test pod to verify the secret works
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: test-image-pull
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  imagePullSecrets:
  - name: $SECRET_NAME
  containers:
  - name: test
    image: ghcr.io/smoltech/cityforge/cityforge-frontend:latest
    command: ['echo', 'Image pull test successful']
  activeDeadlineSeconds: 60
EOF

# Wait for pod to start
echo "⏳ Waiting for test pod..."
sleep 5

# Check if the test pod successfully pulled the image
if kubectl get pod test-image-pull -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null | grep -q "Succeeded\|Running"; then
    echo "✅ Image pull test successful!"
    TEST_SUCCESS=true
else
    echo "❌ Image pull test failed"
    kubectl describe pod test-image-pull -n "$NAMESPACE" || true
    TEST_SUCCESS=false
fi

# Clean up test pod
kubectl delete pod test-image-pull -n "$NAMESPACE" --ignore-not-found=true

echo ""
echo "📝 Next steps:"
echo "1. Update the migration job to use the image pull secret"
echo "2. Redeploy the migration job"
echo ""
echo "The secret is now available as: $SECRET_NAME"

if [ "$TEST_SUCCESS" = true ]; then
    echo ""
    echo "🎉 Setup completed successfully!"
    exit 0
else
    echo ""
    echo "⚠️  Setup completed but image pull test failed"
    echo "Please check the GitHub token permissions and try again"
    exit 1
fi