#!/bin/bash
set -e

# Kubernetes Ansible Management Script
# Usage: ./k8s-ansible-manager.sh [command] [options]

SCRIPT_DIR="$(dirname "$0")"
NAMESPACE="${NAMESPACE:-cityforge}"
IMAGE_NAME="${IMAGE_NAME:-ghcr.io/smoltech/cityforge/ansible-runner}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

show_usage() {
    echo "Kubernetes Ansible Management Script"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup           Setup all Kubernetes resources"
    echo "  deploy          Deploy tunnels (run ansible job)"
    echo "  status          Check tunnel status" 
    echo "  logs            View ansible job logs"
    echo "  cleanup         Clean up jobs and resources"
    echo "  build           Build and push Docker image"
    echo "  update-config   Update configuration"
    echo "  shell           Open shell in ansible pod"
    echo ""
    echo "Options:"
    echo "  -e, --environment    Target environment (production|staging|development|all)"
    echo "  -c, --check         Run in check mode (dry run)"
    echo "  -n, --namespace     Kubernetes namespace (default: cityforge)"
    echo "  -i, --image         Docker image (default: ghcr.io/smoltech/cityforge/ansible-runner)"
    echo "  -t, --tag           Image tag (default: latest)"
    echo "  -f, --follow        Follow logs"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 deploy -e production"
    echo "  $0 deploy -e staging --check"
    echo "  $0 logs -f"
    echo "  $0 status"
}

check_requirements() {
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi

    # Check if we can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warn "Namespace $NAMESPACE does not exist. Creating..."
        kubectl create namespace "$NAMESPACE"
    fi
}

setup_resources() {
    log_info "Setting up Kubernetes resources in namespace: $NAMESPACE"
    
    # Apply RBAC first
    log_info "Creating ServiceAccount and RBAC..."
    kubectl apply -f "$SCRIPT_DIR/ansible-rbac.yaml" -n "$NAMESPACE"
    
    # Apply ConfigMaps
    log_info "Creating ConfigMaps..."
    kubectl apply -f "$SCRIPT_DIR/ansible-configmap.yaml" -n "$NAMESPACE"
    
    # Check if secrets exist
    if ! kubectl get secret ansible-ssh-key -n "$NAMESPACE" &> /dev/null; then
        log_warn "SSH key secret not found. You need to create it manually:"
        echo "  kubectl create secret generic ansible-ssh-key --from-file=ssh-key=/path/to/your/ssh/key -n $NAMESPACE"
    fi
    
    if ! kubectl get secret ansible-vault-password -n "$NAMESPACE" &> /dev/null; then
        log_warn "Vault password secret not found. You need to create it manually:"
        echo "  kubectl create secret generic ansible-vault-password --from-literal=vault-password='your-password' -n $NAMESPACE"
    fi
    
    log_info "Setup completed. Remember to create the required secrets!"
}

deploy_tunnels() {
    local environment="${1:-production}"
    local check_mode="${2:-false}"
    local job_name="ansible-tunnel-deploy-$(date +%s)"
    
    log_info "Deploying tunnels to environment: $environment"
    log_info "Check mode: $check_mode"
    
    # Create job from template
    local temp_file=$(mktemp)
    cp "$SCRIPT_DIR/ansible-job.yaml" "$temp_file"
    
    # Replace job name and environment
    sed -i "s/name: ansible-tunnel-deploy/name: $job_name/" "$temp_file"
    sed -i "s/value: \"production\"/value: \"$environment\"/" "$temp_file"
    sed -i "s/value: \"false\"/value: \"$check_mode\"/" "$temp_file"
    sed -i "s|image: ghcr.io/smoltech/cityforge/ansible-runner:latest|image: $IMAGE_NAME:$IMAGE_TAG|" "$temp_file"
    
    # Apply only the deploy job (first document)
    kubectl apply -f "$temp_file" -n "$NAMESPACE"
    rm "$temp_file"
    
    log_info "Job created: $job_name"
    log_info "Waiting for job to start..."
    
    # Wait for job to start
    kubectl wait --for=condition=Ready pod -l job-name="$job_name" -n "$NAMESPACE" --timeout=300s || {
        log_error "Job failed to start within timeout"
        return 1
    }
    
    # Follow logs
    log_info "Following job logs..."
    kubectl logs -f job/"$job_name" -n "$NAMESPACE" || true
    
    # Check job status
    local job_status=$(kubectl get job "$job_name" -n "$NAMESPACE" -o jsonpath='{.status.conditions[0].type}' 2>/dev/null || echo "Unknown")
    if [ "$job_status" = "Complete" ]; then
        log_info "Job completed successfully"
    else
        log_error "Job failed or is still running. Status: $job_status"
        return 1
    fi
}

check_status() {
    log_info "Checking tunnel status..."
    
    local job_name="ansible-tunnel-status-$(date +%s)"
    local temp_file=$(mktemp)
    
    # Extract status job from template
    grep -A 100 "name: ansible-tunnel-status" "$SCRIPT_DIR/ansible-job.yaml" > "$temp_file"
    sed -i "s/name: ansible-tunnel-status/name: $job_name/" "$temp_file"
    sed -i "s|image: ghcr.io/smoltech/cityforge/ansible-runner:latest|image: $IMAGE_NAME:$IMAGE_TAG|" "$temp_file"
    
    kubectl apply -f "$temp_file" -n "$NAMESPACE"
    rm "$temp_file"
    
    # Wait and show logs
    kubectl wait --for=condition=Ready pod -l job-name="$job_name" -n "$NAMESPACE" --timeout=120s
    kubectl logs -f job/"$job_name" -n "$NAMESPACE" || true
    
    # Cleanup
    kubectl delete job "$job_name" -n "$NAMESPACE" --ignore-not-found=true
}

view_logs() {
    local follow="${1:-false}"
    
    # Find most recent ansible job
    local latest_job=$(kubectl get jobs -n "$NAMESPACE" -l app=ansible-runner --sort-by='.metadata.creationTimestamp' -o name | tail -1 | cut -d'/' -f2)
    
    if [ -z "$latest_job" ]; then
        log_error "No ansible jobs found"
        return 1
    fi
    
    log_info "Viewing logs for job: $latest_job"
    
    if [ "$follow" = "true" ]; then
        kubectl logs -f job/"$latest_job" -n "$NAMESPACE"
    else
        kubectl logs job/"$latest_job" -n "$NAMESPACE"
    fi
}

cleanup_jobs() {
    log_info "Cleaning up completed and failed jobs..."
    
    # Delete completed jobs older than 1 hour
    kubectl get jobs -n "$NAMESPACE" -l app=ansible-runner -o json | \
    jq -r '.items[] | select(.status.conditions[]?.type == "Complete" and (.metadata.creationTimestamp | fromdateiso8601) < (now - 3600)) | .metadata.name' | \
    xargs -r kubectl delete job -n "$NAMESPACE"
    
    # Delete failed jobs older than 24 hours  
    kubectl get jobs -n "$NAMESPACE" -l app=ansible-runner -o json | \
    jq -r '.items[] | select(.status.conditions[]?.type == "Failed" and (.metadata.creationTimestamp | fromdateiso8601) < (now - 86400)) | .metadata.name' | \
    xargs -r kubectl delete job -n "$NAMESPACE"
    
    log_info "Cleanup completed"
}

build_image() {
    log_info "Building Docker image: $IMAGE_NAME:$IMAGE_TAG"
    
    # Build from ansible directory
    docker build -t "$IMAGE_NAME:$IMAGE_TAG" "$SCRIPT_DIR/../ansible/"
    
    log_info "Pushing image to registry..."
    docker push "$IMAGE_NAME:$IMAGE_TAG"
    
    log_info "Image built and pushed successfully"
}

update_config() {
    log_info "Updating configuration..."
    kubectl apply -f "$SCRIPT_DIR/ansible-configmap.yaml" -n "$NAMESPACE"
    log_info "Configuration updated"
}

open_shell() {
    log_info "Opening shell in ansible pod..."
    
    local pod_name="ansible-shell-$(date +%s)"
    
    # Create temporary pod
    kubectl run "$pod_name" \
        --image="$IMAGE_NAME:$IMAGE_TAG" \
        --rm -it \
        --restart=Never \
        --serviceaccount=ansible-runner \
        -n "$NAMESPACE" \
        -- /bin/bash
}

# Main script logic
main() {
    local command="${1:-help}"
    local environment="production"
    local check_mode="false"
    local follow="false"
    
    # Parse options
    shift || true
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            -c|--check)
                check_mode="true"
                shift
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -i|--image)
                IMAGE_NAME="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -f|--follow)
                follow="true"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    check_requirements
    
    case "$command" in
        "setup")
            setup_resources
            ;;
        "deploy")
            deploy_tunnels "$environment" "$check_mode"
            ;;
        "status")
            check_status
            ;;
        "logs")
            view_logs "$follow"
            ;;
        "cleanup")
            cleanup_jobs
            ;;
        "build")
            build_image
            ;;
        "update-config")
            update_config
            ;;
        "shell")
            open_shell
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"