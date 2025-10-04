#!/bin/bash

# PostgreSQL Database Restore Script for CityForge
# Uses kubectl to restore the PostgreSQL database managed by Zalando operator

set -euo pipefail

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

# Usage function
usage() {
    echo "Usage: $0 <namespace> <backup_file>"
    echo
    echo "Arguments:"
    echo "  namespace      Kubernetes namespace containing the PostgreSQL database"
    echo "  backup_file    Path to the backup file (.sql or .sql.gz)"
    echo
    echo "Examples:"
    echo "  $0 community ./backups/community_community_backup_20241201_120000.sql.gz"
    echo "  $0 production ./backups/production_mydb_backup_20241201_120000.sql"
    exit 1
}

# Validate arguments
if [[ $# -ne 2 ]]; then
    usage
fi

NAMESPACE="$1"
BACKUP_FILE="$2"

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

    if [[ ! -f "$BACKUP_FILE" ]]; then
        error "Backup file not found: $BACKUP_FILE"
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
}

# Find backend deployments that connect to the database
find_backend_deployments() {
    log "Finding backend deployments..."

    # Look for deployments that likely connect to the database
    # Common patterns: *-backend, *-api, contains "backend" or "api"
    BACKEND_DEPLOYMENTS=$(kubectl get deployments -n "$NAMESPACE" -o name | grep -E "(backend|api)" | sed 's|deployment.apps/||' || echo "")

    if [[ -n "$BACKEND_DEPLOYMENTS" ]]; then
        log "Found backend deployments: $BACKEND_DEPLOYMENTS"
    else
        log "No backend deployments found (this is fine if none exist)"
    fi
}

# Scale down backend deployments
scale_down_backends() {
    if [[ -z "$BACKEND_DEPLOYMENTS" ]]; then
        log "No backend deployments to scale down"
        return
    fi

    log "Scaling down backend deployments to close database connections..."

    # Store original replica counts in a temp file
    REPLICA_COUNTS_FILE=$(mktemp)

    for deployment in $BACKEND_DEPLOYMENTS; do
        local replicas=$(kubectl get deployment -n "$NAMESPACE" "$deployment" -o jsonpath='{.spec.replicas}')
        echo "$deployment=$replicas" >> "$REPLICA_COUNTS_FILE"
        log "Scaling down $deployment (current replicas: $replicas)"
        kubectl scale deployment -n "$NAMESPACE" "$deployment" --replicas=0
    done

    # Wait for pods to terminate
    log "Waiting for backend pods to terminate..."
    for deployment in $BACKEND_DEPLOYMENTS; do
        kubectl wait --for=delete pod -l app=$deployment -n "$NAMESPACE" --timeout=60s 2>/dev/null || true
    done

    log "Backend deployments scaled down successfully"

    # Export for use in scale_up_backends
    export BACKEND_DEPLOYMENTS
    export REPLICA_COUNTS_FILE
}

# Scale up backend deployments
scale_up_backends() {
    if [[ -z "$BACKEND_DEPLOYMENTS" ]]; then
        log "No backend deployments to scale up"
        return
    fi

    log "Scaling backend deployments back up..."

    for deployment in $BACKEND_DEPLOYMENTS; do
        local replicas=2  # Default to 2

        # Read original replica count from temp file
        if [[ -f "$REPLICA_COUNTS_FILE" ]]; then
            while IFS='=' read -r dep rep; do
                if [[ "$dep" == "$deployment" ]]; then
                    replicas=$rep
                    break
                fi
            done < "$REPLICA_COUNTS_FILE"
        fi

        log "Scaling up $deployment to $replicas replicas"
        kubectl scale deployment -n "$NAMESPACE" "$deployment" --replicas="$replicas"
    done

    # Clean up temp file
    if [[ -f "$REPLICA_COUNTS_FILE" ]]; then
        rm -f "$REPLICA_COUNTS_FILE"
    fi

    log "Backend deployments scaled up successfully"
}

# Confirm restore operation
confirm_restore() {
    warn "This will restore the database '$DB_NAME' from backup: $BACKUP_FILE"
    warn "ALL EXISTING DATA IN THE DATABASE WILL BE LOST!"
    echo
    read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

    if [[ "$confirm" != "yes" ]]; then
        log "Restore operation cancelled"
        exit 0
    fi
}

# Create database backup before restore
create_pre_restore_backup() {
    log "Creating pre-restore backup..."

    # Use same backup directory as backup script, default to ./backups
    local backup_dir="${BACKUP_DIR:-./backups}"
    mkdir -p "$backup_dir"

    local pre_restore_backup="$backup_dir/${NAMESPACE}_${DB_NAME}_pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"

    # Get database credentials
    local db_user=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.password}' | base64 -d)

    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- bash -c "
        PGPASSWORD='$db_password' pg_dump -h localhost -U '$db_user' -d '$DB_NAME' --clean --if-exists --create
    " > "$pre_restore_backup" 2>/dev/null

    if [[ -f "$pre_restore_backup" ]]; then
        gzip "$pre_restore_backup"
        log "Pre-restore backup created: $pre_restore_backup.gz"
    else
        warn "Failed to create pre-restore backup, continuing anyway..."
    fi
}

# Prepare backup file for restore
prepare_backup_file() {
    log "Preparing backup file..."

    if [[ "$BACKUP_FILE" == *.gz ]]; then
        log "Decompressing backup file..."
        TEMP_SQL_FILE=$(mktemp)
        gunzip -c "$BACKUP_FILE" > "$TEMP_SQL_FILE"
        SQL_FILE="$TEMP_SQL_FILE"
    else
        SQL_FILE="$BACKUP_FILE"
    fi

    log "Using SQL file: $SQL_FILE"
}

# Restore database
restore_database() {
    log "Starting database restore..."

    # Get postgres superuser credentials
    local postgres_user=$(kubectl get secret -n "$NAMESPACE" "postgres.${CLUSTER_NAME}.credentials.postgresql.acid.zalan.do" -o jsonpath='{.data.username}' | base64 -d 2>/dev/null)
    local postgres_password=$(kubectl get secret -n "$NAMESPACE" "postgres.${CLUSTER_NAME}.credentials.postgresql.acid.zalan.do" -o jsonpath='{.data.password}' | base64 -d 2>/dev/null)

    # If postgres user secret doesn't exist, try to use the database user
    if [[ -z "$postgres_user" || -z "$postgres_password" ]]; then
        warn "Postgres superuser secret not found, attempting with database user credentials"
        postgres_user=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.username}' | base64 -d)
        postgres_password=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.password}' | base64 -d)
    else
        log "Using postgres superuser credentials for restore"
    fi

    # Copy SQL file to pod
    log "Copying backup file to PostgreSQL pod..."
    kubectl cp "$SQL_FILE" "$NAMESPACE/$POSTGRES_POD:/tmp/restore.sql"

    # Restore database
    log "Executing database restore..."
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- bash -c "
        PGPASSWORD='$postgres_password' psql -h localhost -U '$postgres_user' -d postgres -f /tmp/restore.sql
    "

    # Clean up temp file in pod
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- rm -f /tmp/restore.sql

    log "Database restore completed"
}

# Verify restore
verify_restore() {
    log "Verifying restore..."

    # Get database credentials
    local db_user=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" "$SECRET_NAME" -o jsonpath='{.data.password}' | base64 -d)

    # Check if database exists and has tables
    local table_count=$(kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- bash -c "
        PGPASSWORD='$db_password' psql -h localhost -U '$db_user' -d '$DB_NAME' -t -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';\"
    " | tr -d ' \n')

    if [[ "$table_count" -gt 0 ]]; then
        log "Restore verification successful - found $table_count tables"
    else
        error "Restore verification failed - no tables found"
    fi
}

# Cleanup temporary files
cleanup() {
    if [[ -n "${TEMP_SQL_FILE:-}" && -f "$TEMP_SQL_FILE" ]]; then
        rm -f "$TEMP_SQL_FILE"
        log "Cleaned up temporary files"
    fi
}

# Cleanup and restore backends on exit
cleanup_and_restore() {
    cleanup

    # Always scale backends back up, even if restore failed
    if [[ -n "${BACKEND_DEPLOYMENTS:-}" ]]; then
        scale_up_backends
    fi
}

# Main execution
main() {
    log "Starting CityForge PostgreSQL restore"

    check_dependencies
    find_postgres_pod
    find_backend_deployments
    confirm_restore

    # Set trap for cleanup and scaling backends back up
    trap cleanup_and_restore EXIT

    scale_down_backends
    create_pre_restore_backup
    prepare_backup_file
    restore_database
    verify_restore

    # Scale backends back up (also happens in trap, but doing it here for clean exit)
    scale_up_backends

    log "Database restore completed successfully"
    log "Backup restored from: $BACKUP_FILE"
}

# Handle interruption
trap 'error "Restore interrupted"' INT TERM

# Execute main function
main "$@"