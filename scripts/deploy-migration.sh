#!/bin/bash
set -e

echo "=== Deploying Prisma Migration Job to Kubernetes ==="

# Configuration
NAMESPACE="worcester"
JOB_NAME="prisma-migration"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "Error: kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
    echo "Error: Cannot connect to Kubernetes cluster"
    exit 1
fi

echo "Using namespace: $NAMESPACE"

# Delete existing job if it exists (ignore errors if not found)
echo "Cleaning up any existing migration job..."
kubectl delete job "$JOB_NAME" -n "$NAMESPACE" --ignore-not-found=true

# Wait a moment for cleanup
sleep 2

# Apply the migration job
echo "Deploying migration job..."
kubectl apply -f k8s/migration-job.yaml

# Wait for the job to start
echo "Waiting for job to start..."
sleep 5

# Show job status
echo "Job status:"
kubectl get job "$JOB_NAME" -n "$NAMESPACE"

# Follow logs if job is running
echo ""
echo "Following job logs (press Ctrl+C to stop)..."
kubectl logs -f job/"$JOB_NAME" -n "$NAMESPACE" || true

echo ""
echo "=== Migration deployment completed ==="
echo "To check job status: kubectl get job $JOB_NAME -n $NAMESPACE"
echo "To view logs: kubectl logs job/$JOB_NAME -n $NAMESPACE"