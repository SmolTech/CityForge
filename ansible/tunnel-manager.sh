#!/bin/bash
set -e

# Cloudflare Tunnel Management Script
# Usage: ./tunnel-manager.sh [command] [environment]

ANSIBLE_DIR="$(dirname "$0")"
INVENTORY_FILE="$ANSIBLE_DIR/inventory.ini"
PLAYBOOK_FILE="$ANSIBLE_DIR/cloudflare-tunnel.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

show_usage() {
    echo "Cloudflare Tunnel Management Script"
    echo ""
    echo "Usage: $0 [command] [environment]"
    echo ""
    echo "Commands:"
    echo "  deploy      Deploy tunnels to specified environment"
    echo "  status      Check tunnel status"
    echo "  restart     Restart tunnel services"
    echo "  logs        View tunnel logs"
    echo "  validate    Validate configuration"
    echo "  update      Update cloudflared version"
    echo ""
    echo "Environments:"
    echo "  all         All servers"
    echo "  production  Production servers"
    echo "  staging     Staging servers" 
    echo "  development Development servers"
    echo ""
    echo "Examples:"
    echo "  $0 deploy production"
    echo "  $0 status all"
    echo "  $0 restart web-server-1"
}

check_requirements() {
    # Check if ansible is installed
    if ! command -v ansible &> /dev/null; then
        log_error "Ansible is not installed. Please install it first."
        exit 1
    fi

    # Check if inventory file exists
    if [ ! -f "$INVENTORY_FILE" ]; then
        log_error "Inventory file not found: $INVENTORY_FILE"
        exit 1
    fi

    # Check if playbook exists
    if [ ! -f "$PLAYBOOK_FILE" ]; then
        log_error "Playbook file not found: $PLAYBOOK_FILE"
        exit 1
    fi
}

test_connectivity() {
    local target="${1:-all}"
    log_info "Testing connectivity to $target..."
    
    if ansible "$target" -i "$INVENTORY_FILE" -m ping; then
        log_info "Connectivity test successful"
    else
        log_error "Connectivity test failed"
        exit 1
    fi
}

deploy_tunnels() {
    local target="${1:-all}"
    log_info "Deploying Cloudflare tunnels to $target..."
    
    # Test connectivity first
    test_connectivity "$target"
    
    # Ask for vault password if vault file exists
    local vault_args=""
    if [ -f "$ANSIBLE_DIR/vault.yml" ]; then
        vault_args="--ask-vault-pass"
        log_info "Vault file detected, you'll be prompted for the vault password"
    fi
    
    # Run deployment
    if ansible-playbook "$PLAYBOOK_FILE" -i "$INVENTORY_FILE" -l "$target" $vault_args; then
        log_info "Deployment completed successfully"
    else
        log_error "Deployment failed"
        exit 1
    fi
}

check_status() {
    local target="${1:-all}"
    log_info "Checking tunnel status on $target..."
    
    ansible "$target" -i "$INVENTORY_FILE" -m shell -a "systemctl is-active cloudflared && systemctl status cloudflared --no-pager -l"
}

restart_tunnels() {
    local target="${1:-all}"
    log_info "Restarting tunnel services on $target..."
    
    ansible "$target" -i "$INVENTORY_FILE" -m shell -a "systemctl restart cloudflared" --become
    
    # Wait a moment and check status
    sleep 3
    check_status "$target"
}

view_logs() {
    local target="${1:-all}"
    log_info "Viewing tunnel logs from $target..."
    
    ansible "$target" -i "$INVENTORY_FILE" -m shell -a "journalctl -u cloudflared -n 50 --no-pager"
}

validate_config() {
    local target="${1:-all}"
    log_info "Validating tunnel configuration on $target..."
    
    ansible "$target" -i "$INVENTORY_FILE" -m shell -a "cloudflared tunnel ingress validate --config /etc/cloudflared/config.yml"
}

update_cloudflared() {
    local target="${1:-all}"
    log_info "Updating cloudflared on $target..."
    
    # This will re-run the playbook to update to the latest version defined in vars
    deploy_tunnels "$target"
}

# Main script logic
main() {
    check_requirements
    
    local command="${1:-help}"
    local environment="${2:-all}"
    
    case "$command" in
        "deploy")
            deploy_tunnels "$environment"
            ;;
        "status")
            check_status "$environment"
            ;;
        "restart")
            restart_tunnels "$environment"
            ;;
        "logs")
            view_logs "$environment"
            ;;
        "validate")
            validate_config "$environment"
            ;;
        "update")
            update_cloudflared "$environment"
            ;;
        "test"|"ping")
            test_connectivity "$environment"
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