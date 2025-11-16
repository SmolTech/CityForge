# Cloudflare Tunnel Ansible Configuration

This Ansible configuration automates the setup and management of Cloudflare Zero Trust tunnels for the CityForge application.

## Overview

Cloudflare Zero Trust tunnels provide secure, encrypted connections between your servers and Cloudflare's edge network without opening inbound firewall ports. This configuration sets up `cloudflared` on your servers with proper service management, logging, and security.

## Directory Structure

```
ansible/
├── ansible.cfg                 # Ansible configuration
├── cloudflare-tunnel.yml       # Main playbook
├── inventory.ini               # Server inventory
├── vault.yml.example          # Example vault file for secrets
├── group_vars/
│   ├── all.yml                # Global variables
│   ├── production.yml         # Production-specific variables
│   └── development.yml        # Development-specific variables
└── templates/
    ├── config.yml.j2          # Cloudflared configuration template
    └── cloudflared.service.j2  # Systemd service template
```

## Prerequisites

1. **Ansible**: Install Ansible on your control machine
2. **Cloudflare Account**: Set up with Zero Trust plan
3. **Domain**: Domain configured in Cloudflare DNS
4. **SSH Access**: SSH key access to target servers

## Setup Instructions

### 1. Install Ansible

```bash
# On Ubuntu/Debian
sudo apt update && sudo apt install ansible

# On macOS
brew install ansible

# Via pip
pip install ansible
```

### 2. Create Cloudflare Tunnel

Before running the playbook, create a tunnel in Cloudflare:

```bash
# Install cloudflared locally (for initial setup)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create your-tunnel-name

# Note the tunnel UUID from the output
```

### 3. Configure Inventory

Edit `inventory.ini` to match your servers:

```ini
[tunnel_servers]
web-server-1 ansible_host=your.server.ip ansible_user=ubuntu
web-server-2 ansible_host=your.server.ip ansible_user=ubuntu

[production]
web-server-1
web-server-2
```

### 4. Configure Variables

Update the group variables in `group_vars/`:

**`group_vars/all.yml`**:

- Set `tunnel_name` to your tunnel name
- Set `tunnel_uuid` to the UUID from step 2
- Configure `tunnel_ingress` rules for your domains
- Update `tunnel_credentials` with your tunnel credentials

**Environment-specific files**:

- `group_vars/production.yml` - Production settings
- `group_vars/development.yml` - Development settings

### 5. Secure Credentials (Recommended)

Create and encrypt a vault file for sensitive data:

```bash
# Copy example vault file
cp vault.yml.example vault.yml

# Edit vault file with your actual credentials
nano vault.yml

# Encrypt the vault file
ansible-vault encrypt vault.yml

# Edit group_vars to reference vault variables
# In group_vars/all.yml:
tunnel_credentials: "{{ tunnel_credentials_vault.production }}"
```

### 6. Run the Playbook

```bash
# Test connectivity
ansible all -m ping

# Run the playbook (with vault password if encrypted)
ansible-playbook cloudflare-tunnel.yml --ask-vault-pass

# Run for specific environment
ansible-playbook cloudflare-tunnel.yml -l production

# Check mode (dry run)
ansible-playbook cloudflare-tunnel.yml --check
```

## Configuration Options

### Tunnel Ingress Rules

Configure how traffic is routed in `group_vars/all.yml`:

```yaml
tunnel_ingress:
  - hostname: "app.yourdomain.com"
    service: "http://localhost:3000"
  - hostname: "api.yourdomain.com"
    service: "http://localhost:5000"
  - hostname: "admin.yourdomain.com"
    service: "http://localhost:3000"
    path: "/admin/*"
  - service: "http_status:404" # Required catch-all
```

### Advanced Options

```yaml
tunnel_options:
  grace_period: "30s" # Graceful shutdown time
  protocol: "http2" # Connection protocol
  retries: 5 # Reconnection attempts
  heartbeat_interval: "10s" # Heartbeat frequency
  max_heartbeats: 10 # Max missed heartbeats

# Logging
cloudflared_log_level: "info" # debug, info, warn, error
cloudflared_log_file: "/var/log/cloudflared/cloudflared.log"

# Monitoring
cloudflared_metrics_port: 8080 # Metrics endpoint port
```

## DNS Configuration

After running the playbook, configure DNS in Cloudflare:

1. Go to Cloudflare Dashboard → Your Domain → DNS
2. Add CNAME records for each hostname:
   ```
   app.yourdomain.com    CNAME   tunnel-uuid.cfargotunnel.com
   api.yourdomain.com    CNAME   tunnel-uuid.cfargotunnel.com
   ```
3. Ensure proxy status is enabled (orange cloud)

## Service Management

The playbook installs cloudflared as a systemd service:

```bash
# Check service status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Restart service
sudo systemctl restart cloudflared

# Check tunnel connectivity
cloudflared tunnel info your-tunnel-name
```

## Monitoring and Troubleshooting

### Logs

- **Service logs**: `sudo journalctl -u cloudflared -f`
- **File logs**: `/var/log/cloudflared/cloudflared.log`
- **Metrics**: `http://localhost:8080/metrics` (if enabled)

### Common Issues

1. **Tunnel not connecting**:
   - Check credentials file permissions
   - Verify tunnel UUID in configuration
   - Check network connectivity

2. **DNS not resolving**:
   - Verify CNAME records in Cloudflare
   - Ensure proxy is enabled
   - Check tunnel status

3. **Service failing**:
   - Check configuration syntax: `cloudflared tunnel ingress validate`
   - Review service logs for errors
   - Verify file permissions

### Health Checks

```bash
# Test tunnel configuration
sudo -u cloudflared cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate

# Test connectivity
curl -H "Host: app.yourdomain.com" http://localhost:3000

# Check tunnel status
cloudflared tunnel info your-tunnel-name
```

## Security Considerations

1. **Credentials**: Always encrypt vault files containing tunnel credentials
2. **File Permissions**: Configuration files are owned by cloudflared user
3. **Service Isolation**: Service runs with limited privileges
4. **Firewall**: Outbound HTTPS (443) must be allowed to Cloudflare
5. **Updates**: Keep cloudflared updated regularly

## Backup and Recovery

### Backup Important Files

```bash
# Backup tunnel credentials
sudo cp /etc/cloudflared/*.json ~/cloudflared-backup/

# Backup configuration
sudo cp /etc/cloudflared/config.yml ~/cloudflared-backup/
```

### Recovery

If you need to restore tunnels:

1. Restore credential and configuration files
2. Run the Ansible playbook to reinstall service
3. Restart cloudflared service

## Multiple Environments

The configuration supports multiple environments:

```bash
# Production deployment
ansible-playbook cloudflare-tunnel.yml -l production

# Development deployment
ansible-playbook cloudflare-tunnel.yml -l development

# Specific server
ansible-playbook cloudflare-tunnel.yml -l web-server-1
```

## Automated Updates

To update cloudflared across all servers:

1. Update `cloudflared_version` in `group_vars/all.yml`
2. Run the playbook: `ansible-playbook cloudflare-tunnel.yml`

The playbook will download and install the new version.

## Support

For issues with:

- **Cloudflare Tunnels**: [Cloudflare Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- **Ansible**: [Ansible Documentation](https://docs.ansible.com/)
- **This Configuration**: Check the troubleshooting section above

## License

This Ansible configuration is part of the CityForge project and follows the same license terms.
