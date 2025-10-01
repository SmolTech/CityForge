#!/bin/bash

# PostgreSQL Database Restore Script for CityForge
# Uses kubectl to restore the PostgreSQL database managed by Zalando operator

set -euo pipefail

# Configuration
NAMESPACE="community"
DB_NAME="community"
BACKUP_DIR="./backups"

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
    echo "Usage: $0 <backup_file>"
    echo
    echo "Arguments:"
    echo "  backup_file    Path to the backup file (.sql or .sql.gz)"
    echo
    echo "Examples:"
    echo "  $0 ./backups/community_db_backup_20241201_120000.sql.gz"
    echo "  $0 ./backups/community_db_backup_20241201_120000.sql"
    echo
    echo "Available backups:"
    ls -1 "$BACKUP_DIR"/community_db_backup_*.sql.gz 2>/dev/null | tail -5 || echo "  No backups found"
    exit 1
}

# Validate arguments
if [[ $# -ne 1 ]]; then
    usage
fi

BACKUP_FILE="$1"

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."

    if ! command -v kubectl &> /dev/null; then
        error "kubectl is required but not installed"
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

# Find PostgreSQL pod
find_postgres_pod() {
    log "Finding PostgreSQL pod..."

    POSTGRES_POD=$(kubectl get pods -n "$NAMESPACE" -l application=spilo,cluster-name=community-db --no-headers -o custom-columns=":metadata.name" | head -1)

    if [[ -z "$POSTGRES_POD" ]]; then
        error "No PostgreSQL pod found in namespace '$NAMESPACE'"
    fi

    log "Found PostgreSQL pod: $POSTGRES_POD"
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

    local pre_restore_backup="$BACKUP_DIR/pre_restore_backup_$(date +%Y%m%d_%H%M%S).sql"

    # Get database credentials
    local db_user=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.password}' | base64 -d)

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

    # Get database credentials
    local db_user=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.password}' | base64 -d)

    # Copy SQL file to pod
    log "Copying backup file to PostgreSQL pod..."
    kubectl cp "$SQL_FILE" "$NAMESPACE/$POSTGRES_POD:/tmp/restore.sql"

    # Restore database
    log "Executing database restore..."
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- bash -c "
        PGPASSWORD='$db_password' psql -h localhost -U '$db_user' -d postgres -f /tmp/restore.sql
    "

    # Clean up temp file in pod
    kubectl exec -n "$NAMESPACE" "$POSTGRES_POD" -- rm -f /tmp/restore.sql

    log "Database restore completed"
}

# Verify restore
verify_restore() {
    log "Verifying restore..."

    # Get database credentials
    local db_user=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.username}' | base64 -d)
    local db_password=$(kubectl get secret -n "$NAMESPACE" community.community-db.credentials.postgresql.acid.zalan.do -o jsonpath='{.data.password}' | base64 -d)

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

# Main execution
main() {
    log "Starting CityForge PostgreSQL restore"

    check_dependencies
    find_postgres_pod
    confirm_restore
    create_pre_restore_backup
    prepare_backup_file

    # Set trap for cleanup
    trap cleanup EXIT

    restore_database
    verify_restore

    log "Database restore completed successfully"
    log "Backup restored from: $BACKUP_FILE"
}

# Handle interruption
trap 'error "Restore interrupted"' INT TERM

# Execute main function
main "$@"