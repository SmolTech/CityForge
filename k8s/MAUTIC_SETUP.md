# Mautic Marketing Automation Setup

This document describes how to set up Mautic marketing automation for CityForge.

## Overview

Mautic provides marketing automation capabilities including:

- Email marketing campaigns
- Contact segmentation and lead scoring
- Campaign workflows with conditional logic
- Landing pages and forms
- Analytics and reporting
- Multi-channel campaigns (email, SMS, web notifications)

## Architecture

The Mautic setup consists of:

- **MySQL Database**: Managed by Percona XtraDB Cluster Operator
- **Mautic Application**: PHP-based marketing automation platform
- **Background Jobs**: CronJobs for segments, campaigns, and email processing

## Prerequisites

Before deploying Mautic, ensure you have:

1. **Percona Operator Installed**:

   ```bash
   kubectl apply -f https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/v1.14.0/deploy/bundle.yaml
   ```

2. **cert-manager** (for TLS certificates):

   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
   ```

3. **NGINX Ingress Controller**:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
   ```

## Deployment Steps

### 1. Deploy MySQL Cluster

```bash
kubectl apply -f k8s/mautic-mysql.yaml
```

Wait for the MySQL cluster to be ready:

```bash
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=percona-xtradb-cluster -n community --timeout=300s
```

Get the auto-generated root password:

```bash
kubectl get secret mautic-mysql-secrets -n community -o jsonpath='{.data.root}' | base64 -d
```

### 2. Deploy Mautic Application

```bash
kubectl apply -f k8s/mautic-deployment.yaml
kubectl apply -f k8s/mautic-service.yaml
```

Wait for Mautic to be ready:

```bash
kubectl wait --for=condition=ready pod -l app=mautic -n community --timeout=300s
```

### 3. Access Mautic

Mautic will be available at: `https://mautic.community.community`

**First-time Setup**:

1. Navigate to the Mautic URL
2. Complete the installation wizard
3. Database configuration will be pre-filled from environment variables
4. Create your admin account
5. Configure SMTP settings for email sending

## Configuration

### Environment Variables

Key environment variables (configured in `mautic-deployment.yaml`):

- `MAUTIC_DB_HOST`: MySQL host (mautic-mysql-haproxy)
- `MAUTIC_DB_NAME`: Database name (mautic)
- `MAUTIC_DB_USER`: Database user (root)
- `MAUTIC_DB_PASSWORD`: From secret (mautic-mysql-secrets)
- `PHP_MEMORY_LIMIT`: 512M
- `PHP_MAX_UPLOAD`: 128M
- `PHP_MAX_EXECUTION_TIME`: 300 seconds

### Background Jobs

Mautic requires background jobs (cron) to process campaigns, segments, and emails. These are configured as Kubernetes CronJobs:

- **mautic-segments-update**: Updates contact segments (every 5 minutes)
- **mautic-campaigns-update**: Updates campaign membership (every 5 minutes)
- **mautic-campaigns-trigger**: Triggers campaign actions (every 5 minutes)
- **mautic-messages-send**: Sends SMS/push notifications (every 2 minutes)
- **mautic-emails-send**: Sends queued emails (every 2 minutes)

### SMTP Configuration

For production email sending, configure SMTP in Mautic:

1. Go to Settings → Configuration → Email Settings
2. Choose "Other SMTP Server"
3. Configure your SMTP provider (SendGrid, Mailgun, Amazon SES, etc.)
4. Test the connection

**Recommended Providers**:

- SendGrid (100 emails/day free)
- Mailgun (5,000 emails/month free)
- Amazon SES (pay-as-you-go)

## Database Management

### Access MySQL

```bash
# Get root password
MYSQL_ROOT_PASSWORD=$(kubectl get secret mautic-mysql-secrets -n community -o jsonpath='{.data.root}' | base64 -d)

# Connect to MySQL
kubectl exec -it mautic-mysql-pxc-0 -n community -- mysql -uroot -p$MYSQL_ROOT_PASSWORD
```

### Backup and Restore

Backups are automatically configured:

- Schedule: Daily at 2:00 AM
- Retention: 7 days
- Storage: Persistent volume

Manual backup:

```bash
kubectl apply -f - <<EOF
apiVersion: pxc.percona.com/v1
kind: PerconaXtraDBClusterBackup
metadata:
  name: manual-backup-$(date +%Y%m%d-%H%M%S)
  namespace: community
spec:
  pxcCluster: mautic-mysql
  storageName: fs-backup
EOF
```

## Integration with CityForge

### API Integration

Mautic provides a REST API for integration:

**Create Contact on User Registration**:

```python
import requests

def add_to_mautic(user):
    mautic_url = "https://mautic.community.community"
    api_url = f"{mautic_url}/api/contacts/new"

    auth = ("username", "password")  # Or use OAuth2

    data = {
        "email": user.email,
        "firstname": user.first_name,
        "lastname": user.last_name,
        "tags": ["cityforge-user"]
    }

    response = requests.post(api_url, json=data, auth=auth)
    return response.json()
```

### Tracking Code

Add Mautic tracking to Next.js:

**In `src/app/layout.tsx`**:

```typescript
<Script
  src="https://mautic.community.community/mtc.js"
  strategy="afterInteractive"
/>
```

### Webhooks

Configure webhooks in Mautic to trigger actions in CityForge:

1. Settings → Webhooks
2. Create new webhook pointing to your CityForge API
3. Choose events (form submission, email open, etc.)

## Local Development

For local development, use docker-compose:

```bash
# Start Mautic and MySQL
docker-compose up mysql mautic

# Access Mautic
open http://localhost:8080
```

Database credentials (docker-compose):

- Host: mysql
- Database: mautic
- User: mautic
- Password: mautic_password

## Monitoring

### Check Mautic Status

```bash
kubectl get pods -n community -l app=mautic
kubectl logs -n community -l app=mautic --tail=100
```

### Check CronJob Status

```bash
kubectl get cronjobs -n community
kubectl get jobs -n community --sort-by=.status.startTime
```

### View CronJob Logs

```bash
# View latest job logs
kubectl logs -n community $(kubectl get pods -n community -l job-name --sort-by=.status.startTime | tail -1 | awk '{print $1}')
```

## Troubleshooting

### Mautic Won't Start

1. Check pod status:

   ```bash
   kubectl describe pod -n community -l app=mautic
   ```

2. Check MySQL connectivity:
   ```bash
   kubectl exec -n community -l app=mautic -- nc -zv mautic-mysql-haproxy 3306
   ```

### Background Jobs Not Running

1. Check CronJob status:

   ```bash
   kubectl get cronjobs -n community
   ```

2. View recent job logs:
   ```bash
   kubectl logs -n community -l app=mautic-cron --tail=50
   ```

### Email Not Sending

1. Check SMTP configuration in Mautic
2. Verify email queue:
   ```bash
   kubectl exec -n community -l app=mautic -- php bin/console mautic:emails:send --dry-run
   ```

## Upgrading

To upgrade Mautic:

1. Update the image version in `mautic-deployment.yaml`
2. Apply the changes:
   ```bash
   kubectl apply -f k8s/mautic-deployment.yaml
   ```
3. Monitor the rollout:
   ```bash
   kubectl rollout status deployment/mautic -n community
   ```

## Security Considerations

1. **Change Default Passwords**: Update MySQL passwords in secrets
2. **Enable 2FA**: Enable two-factor authentication for admin users
3. **Configure CORS**: Restrict API access to authorized domains
4. **Regular Backups**: Verify backup jobs are running
5. **Update Regularly**: Keep Mautic and MySQL updated

## Resources

- [Mautic Documentation](https://docs.mautic.org/)
- [Mautic API Documentation](https://developer.mautic.org/)
- [Percona Operator Documentation](https://docs.percona.com/percona-operator-for-mysql/)
- [Mautic Community](https://www.mautic.org/community)

## Support

For issues related to:

- **Mautic**: Check [Mautic Forums](https://forum.mautic.org/)
- **Kubernetes Deployment**: Check CityForge repository issues
- **MySQL Operator**: Check [Percona Documentation](https://docs.percona.com/)
