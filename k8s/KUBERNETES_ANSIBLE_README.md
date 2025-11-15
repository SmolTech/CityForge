# Kubernetes Ansible Automation

This configuration enables running Ansible playbooks within Kubernetes pods to automate Cloudflare tunnel deployments. The setup provides a secure, scalable way to manage infrastructure from within your Kubernetes cluster.

## Overview

The Kubernetes Ansible automation consists of:

- **Containerized Ansible Runner**: Custom Docker image with Ansible and dependencies
- **Kubernetes Jobs**: On-demand execution of Ansible playbooks
- **CronJobs**: Scheduled tunnel deployments and health checks
- **ConfigMaps**: Ansible configuration and inventory management
- **Secrets**: Secure storage of SSH keys and vault passwords
- **RBAC**: Proper permissions for service account

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   kubectl       │    │  Kubernetes     │    │  Target Servers │
│   (trigger)     │───▶│  Job/CronJob    │───▶│  (via SSH)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Ansible Pod    │
                       │  - Playbooks    │
                       │  - Inventory    │
                       │  - SSH Keys     │
                       │  - Vault Creds  │
                       └─────────────────┘
```

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the Ansible runner image
cd ansible/
docker build -t ghcr.io/smoltech/cityforge/ansible-runner:latest .

# Push to registry
docker push ghcr.io/smoltech/cityforge/ansible-runner:latest
```

### 2. Create Required Secrets

```bash
# Create SSH key secret
kubectl create secret generic ansible-ssh-key \
  --from-file=ssh-key=/path/to/your/ssh/private/key \
  -n cityforge

# Create vault password secret
kubectl create secret generic ansible-vault-password \
  --from-literal=vault-password='your-vault-password' \
  -n cityforge

# Create vault file secret (optional, if using encrypted variables)
kubectl create secret generic ansible-vault \
  --from-file=vault.yml=/path/to/your/encrypted/vault.yml \
  -n cityforge
```

### 3. Setup Kubernetes Resources

```bash
# Use the management script
./k8s/k8s-ansible-manager.sh setup

# Or apply manually
kubectl apply -f k8s/ansible-rbac.yaml -n cityforge
kubectl apply -f k8s/ansible-configmap.yaml -n cityforge
```

### 4. Deploy Tunnels

```bash
# Deploy to production
./k8s/k8s-ansible-manager.sh deploy -e production

# Deploy to staging with dry run
./k8s/k8s-ansible-manager.sh deploy -e staging --check

# Check tunnel status
./k8s/k8s-ansible-manager.sh status
```

## File Structure

```
k8s/
├── ansible-rbac.yaml           # ServiceAccount and RBAC
├── ansible-configmap.yaml      # Ansible configuration and scripts
├── ansible-secrets.yaml        # Secret templates (for reference)
├── ansible-job.yaml           # Job definitions for on-demand runs
├── ansible-cronjob.yaml       # CronJobs for scheduled operations
└── k8s-ansible-manager.sh     # Management script

ansible/
├── Dockerfile                 # Ansible runner container
├── ansible.cfg               # Ansible configuration
├── cloudflare-tunnel.yml     # Main playbook
├── inventory.ini            # Server inventory
├── group_vars/              # Variable files
└── templates/               # Configuration templates
```

## Management Script Usage

The `k8s-ansible-manager.sh` script provides easy management of Kubernetes Ansible operations:

### Commands

```bash
# Setup all resources
./k8s-ansible-manager.sh setup

# Deploy tunnels
./k8s-ansible-manager.sh deploy -e production
./k8s-ansible-manager.sh deploy -e staging --check  # Dry run

# Check status
./k8s-ansible-manager.sh status

# View logs
./k8s-ansible-manager.sh logs
./k8s-ansible-manager.sh logs --follow

# Cleanup old jobs
./k8s-ansible-manager.sh cleanup

# Build and push image
./k8s-ansible-manager.sh build

# Update configuration
./k8s-ansible-manager.sh update-config

# Open shell in ansible pod
./k8s-ansible-manager.sh shell
```

### Options

- `-e, --environment`: Target environment (production|staging|development|all)
- `-c, --check`: Run in check mode (dry run)
- `-n, --namespace`: Kubernetes namespace (default: cityforge)
- `-i, --image`: Docker image (default: ghcr.io/smoltech/cityforge/ansible-runner)
- `-t, --tag`: Image tag (default: latest)
- `-f, --follow`: Follow logs

## Scheduled Operations

The configuration includes CronJobs for automated operations:

### Tunnel Deployment (Weekly)

- **Schedule**: Every Monday at 2 AM UTC
- **Purpose**: Regular tunnel updates and maintenance
- **File**: `k8s/ansible-cronjob.yaml` (ansible-tunnel-deploy-scheduled)

### Health Checks (Every 30 minutes)

- **Schedule**: Every 30 minutes
- **Purpose**: Monitor tunnel status and auto-restart failed services
- **File**: `k8s/ansible-cronjob.yaml` (ansible-tunnel-health-check)

## Configuration Management

### Ansible Configuration

Configuration is managed through Kubernetes ConfigMaps:

1. **`ansible-config`**: Core Ansible configuration, inventory, and run scripts
2. **`ansible-group-vars-all`**: Global variables for all environments
3. **`ansible-group-vars-production`**: Production-specific variables

### Updating Configuration

```bash
# Edit the ConfigMap files
vim k8s/ansible-configmap.yaml

# Apply changes
kubectl apply -f k8s/ansible-configmap.yaml -n cityforge

# Or use the script
./k8s-ansible-manager.sh update-config
```

### Environment Variables

Jobs support these environment variables:

- `PLAYBOOK`: Ansible playbook to run (default: cloudflare-tunnel.yml)
- `ENVIRONMENT`: Target environment (default: production)
- `CHECK_MODE`: Run in check mode (default: false)
- `EXTRA_VARS`: Additional Ansible variables

## Security Considerations

### Secret Management

- **SSH Keys**: Stored as Kubernetes secrets with 0600 permissions
- **Vault Passwords**: Stored as Kubernetes secrets
- **Encrypted Variables**: Use Ansible Vault for sensitive data

### Pod Security

- Runs as non-root user (ansible:1000)
- Read-only root filesystem where possible
- No privilege escalation
- Minimal RBAC permissions

### Network Security

- Pods only need outbound SSH access to target servers
- No inbound network access required
- SSH connections use key-based authentication

## Monitoring and Logging

### Job Status

```bash
# List all ansible jobs
kubectl get jobs -n cityforge -l app=ansible-runner

# Get job details
kubectl describe job <job-name> -n cityforge

# Check CronJob status
kubectl get cronjobs -n cityforge
```

### Logs

```bash
# View job logs
kubectl logs job/<job-name> -n cityforge

# View CronJob logs (latest)
kubectl logs -l app=ansible-runner -n cityforge --tail=100

# Follow logs
kubectl logs -f job/<job-name> -n cityforge
```

### Debugging

```bash
# Open shell in ansible pod
./k8s-ansible-manager.sh shell

# Run ansible commands manually
kubectl run debug-ansible \
  --image=ghcr.io/smoltech/cityforge/ansible-runner:latest \
  --rm -it --restart=Never \
  --serviceaccount=ansible-runner \
  -n cityforge \
  -- /bin/bash
```

## Troubleshooting

### Common Issues

1. **SSH Connection Failures**:
   - Check SSH key secret is correctly mounted
   - Verify SSH key has proper permissions (0600)
   - Test SSH connectivity from ansible pod

2. **Job Failures**:
   - Check job logs: `kubectl logs job/<job-name> -n cityforge`
   - Verify ConfigMap and Secret mounts
   - Check RBAC permissions

3. **Image Pull Errors**:
   - Ensure image is built and pushed to registry
   - Check image name and tag in job specification
   - Verify registry access from cluster

4. **Permission Errors**:
   - Check ServiceAccount and RBAC configuration
   - Verify namespace permissions
   - Review security context settings

### Debug Commands

```bash
# Check all resources
kubectl get all -n cityforge -l app=ansible-runner

# Check ConfigMaps
kubectl get configmaps -n cityforge -l app=ansible-runner
kubectl describe configmap ansible-config -n cityforge

# Check Secrets
kubectl get secrets -n cityforge -l app=ansible-runner

# Check RBAC
kubectl describe serviceaccount ansible-runner -n cityforge
kubectl describe role ansible-runner-role -n cityforge
```

## Backup and Recovery

### Configuration Backup

```bash
# Backup all Kubernetes resources
kubectl get -o yaml \
  configmaps,secrets,serviceaccounts,roles,rolebindings,jobs,cronjobs \
  -l app=ansible-runner -n cityforge > ansible-k8s-backup.yaml
```

### Recovery

```bash
# Restore from backup
kubectl apply -f ansible-k8s-backup.yaml -n cityforge
```

## Scaling and Performance

### Resource Limits

Current resource configuration per job:

- **Requests**: 256Mi memory, 200m CPU
- **Limits**: 512Mi memory, 500m CPU

### Concurrency

- Jobs use `concurrencyPolicy: Forbid` to prevent overlapping executions
- Multiple environments can run simultaneously
- Adjust `backoffLimit` for retry behavior

### Optimization

- Use `imagePullPolicy: IfNotPresent` for faster startup
- Consider using init containers for pre-checks
- Implement caching for Ansible facts if needed

## Integration with CI/CD

### GitHub Actions Integration

```yaml
# Example: Trigger tunnel deployment from GitHub Actions
- name: Deploy Tunnels
  run: |
    kubectl create job ansible-deploy-$(date +%s) \
      --from=cronjob/ansible-tunnel-deploy-scheduled \
      -n cityforge
```

### Webhook Integration

Consider adding webhook endpoints to trigger deployments:

- API endpoint that creates Kubernetes jobs
- Integration with infrastructure change notifications
- Automated deployment on configuration changes

## Future Enhancements

- **Multi-cluster Support**: Deploy to multiple Kubernetes clusters
- **Web UI**: Dashboard for job management and monitoring
- **Notifications**: Slack/email notifications for job results
- **Git Integration**: Sync configuration from Git repositories
- **Metrics**: Prometheus metrics for job success/failure rates
- **Audit Logging**: Enhanced logging for compliance requirements

## License

This Kubernetes Ansible automation is part of the CityForge project and follows the same license terms.
