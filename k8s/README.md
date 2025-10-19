# Kubernetes Deployment

## Prerequisites

You'll need the postgres operator installed:

```bash
helm repo add postgres-operator-charts https://opensource.zalando.com/postgres-operator/charts/postgres-operator
helm install postgres-operator postgres-operator-charts/postgres-operator
```

## Deployment

Deploy all resources using kustomize:

```bash
kubectl apply -k k8s/
```

## CronJobs

The deployment includes automated maintenance jobs:

### 1. Resource Indexer (`indexer-cronjob.yaml`)

- **Schedule**: Daily at 2 AM
- **Purpose**: Crawls and indexes business card websites into OpenSearch
- **Resources**: 512Mi memory, 500m CPU

### 2. Token Cleanup (`token-cleanup-cronjob.yaml`)

- **Schedule**: Daily at 3 AM Eastern Time
- **Purpose**: Removes expired JWT tokens from the database blacklist
- **Resources**: 256Mi memory, 200m CPU

### 3. Database Backup (`backup-cronjob.yaml`)

- **Schedule**: Daily at 2 AM Eastern Time
- **Purpose**: Creates compressed PostgreSQL backups
- **Storage**: 5Gi PersistentVolumeClaim
- **Retention**: 30 days

## Manual CronJob Execution

To manually trigger a cronjob:

```bash
# Create a job from the cronjob
kubectl create job --from=cronjob/token-cleanup token-cleanup-manual -n cityforge

# Check job status
kubectl get jobs -n cityforge

# View job logs
kubectl logs job/token-cleanup-manual -n cityforge
```

## Monitoring CronJobs

```bash
# List all cronjobs
kubectl get cronjobs -n cityforge

# View cronjob details
kubectl describe cronjob token-cleanup -n cityforge

# View recent job runs
kubectl get jobs -n cityforge --sort-by=.metadata.creationTimestamp

# View job logs
kubectl logs -l app=token-cleanup -n cityforge
```
