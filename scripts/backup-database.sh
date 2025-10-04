#!/bin/bash

# PostgreSQL Database Backup Script for CityForge
# Uses kubectl to backup the PostgreSQL database managed by Zalando operator

set -euo pipefail

# Usage function
usage() {
    echo "Usage: $0 <namespace> [backup_dir] [retention_days]"
    echo
    echo "Arguments:"
    echo "  namespace        Kubernetes namespace containing the PostgreSQL database"
    echo "  backup_dir       Optional: Directory to store backups (default: ./backups)"
    echo "  retention_days   Optional: Number of days to retain backups (default: 30)"
    echo
    echo "Examples:"
    echo "  $0 community"
    echo "  $0 production ./prod-backups 90"
    exit 1
}

# Validate arguments
if [[ $# -lt 1 ]]; then
    usage
fi

# Configuration
NAMESPACE="$1"
BACKUP_DIR="${2:-./backups}"
RETENTION_DAYS="${3:-30}"
DATE=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."

    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
    fi

    if ! command -v jq &> /dev/null; then
        error "jq is required but not installed"
    fi

    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
    fi

    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' does not exist"
    fi
}

# Find PostgreSQL pod and extract cluster information
find_postgres_pod() {
    log "Finding PostgreSQL pod..."

    # Find any Spilo (Zalando Postgres) pod in the namespace
    POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l application=spilo --no-headers -o custom-columns=":metadata.name" | head -1)

    if [[ -z "$POSTGRES_POD" ]]; then
        error "No PostgreSQL pod found in namespace '$NAMESPACE'"
    fi

    log "Found PostgreSQL pod: $POSTGRES_POD"

    # Extract cluster name from pod labels
    CLUSTER_NAME=$(kubectl get pod -n "$NAMESPACE" "$POSTGRES_POD" -o jsonpath='{.metadata.labels.cluster-name}')

    if [[ -z "$CLUSTER_NAME" ]]; then
        error "Could not determine cluster name from pod labels"
    fi

    log "Cluster name: $CLUSTER_NAME"

    # Find the database credentials secret
    # Zalando operator creates secrets with pattern: <username>.<cluster-name>.credentials.postgresql.acid.zalan.do
    SECRET_NAME=$(kubectl get secrets -n "$NAMESPACE" -o name | grep "\.${CLUSTER_NAME}\.credentials\.postgresql\.acid\.zalan\.do" | head -1 | sed 's|secret/||')

    if [[ -z "$SECRET_NAME" ]]; then
        error "Could not find credentials secret for cluster '$CLUSTER_NAME'"
    fi

    log "Found secret: $SECRET_NAME"

    # Get database name from the postgresql custom resource spec
    DB_NAME=$(kubectl get postgresql -n "$NAMESPACE" "$CLUSTER_NAME" -o jsonpath='{.spec.databases}' | jq -r 'keys[0]' 2>/dev/null)

    if [[ -z "$DB_NAME" || "$DB_NAME" == "null" ]]; then
        error "Could not determine database name from postgresql resource '$CLUSTER_NAME'"
    fi

    log "Database name: $DB_NAME"

    # Update backup file name to include namespace
    BACKUP_FILE="${NAMESPACE}_${DB_NAME}_backup_${DATE}.sql"
    log "Backup file: $BACKUP_FILE"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    log "Backup directory: $BACKUP_DIR"
}

# Perform database backup
backup_database() {
    log "Starting database backup..."

    local backup_path="$BACKUP_DIR/$BACKUP_FILE"

    # Get database credentials from secret
    local db_user=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.password}' | base64 -d)

    # Run pg_dump inside the PostgreSQL pod
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- bash -c "
        PGPASSWORD='$db_password' pg_dump -h localhost -U '$db_user' -d '$DB_NAME' --clean --if-exists --create --verbose
    " > "$backup_path" 2>/dev/null

    if [[ $? -eq 0 && -f "$backup_path" ]]; then
        log "Database backup completed: $backup_path"

        # Get backup size
        local backup_size=$(du -h "$backup_path" | cut -f1)
        log "Backup size: $backup_size"

        # Compress backup
        log "Compressing backup..."
        gzip "$backup_path"

        local compressed_size=$(du -h "$backup_path.gz" | cut -f1)
        log "Compressed backup: $backup_path.gz ($compressed_size)"
    else
        error "Database backup failed"
    fi
}

# Test backup integrity
test_backup() {
    log "Testing backup integrity..."

    local backup_path="$BACKUP_DIR/$BACKUP_FILE.gz"

    if gzip -t "$backup_path" 2>/dev/null; then
        log "Backup integrity test passed"
    else
        error "Backup integrity test failed"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."

    local deleted_count=0

    while IFS= read -r -d '' file; do
        rm "$file"
        deleted_count=$((deleted_count + 1))
        log "Deleted old backup: $(basename "$file")"
    done < <(find "$BACKUP_DIR" -name "${NAMESPACE}_${DB_NAME}_backup_*.sql.gz" -mtime +$RETENTION_DAYS -print0 2>/dev/null)

    if [[ $deleted_count -eq 0 ]]; then
        log "No old backups to clean up"
    else
        log "Cleaned up $deleted_count old backup(s)"
    fi
}

# List recent backups
list_backups() {
    log "Recent backups:"
    ls -lah "$BACKUP_DIR"/${NAMESPACE}_${DB_NAME}_backup_*.sql.gz 2>/dev/null | tail -5 || log "No backups found"
}

# Main execution
main() {
    log "Starting CityForge PostgreSQL backup"

    check_dependencies
    find_postgres_pod
    create_backup_dir
    backup_database
    test_backup
    cleanup_old_backups
    list_backups

    log "Backup completed successfully"
}

# Handle interruption
trap 'error "Backup interrupted"' INT TERM

# Execute main function
main "$@"