# Kubernetes Database Migration Setup

This document explains how to run Prisma database migrations in Kubernetes using init containers and one-time jobs.

## ✅ **What's Been Implemented**

### 1. **Init Container (Auto-Migration on Deployment)**

- **File**: `k8s/deployment.yaml` (lines 32-95)
- **Purpose**: Automatically runs migrations before each pod starts
- **Best for**: Production deployments, ensuring consistency

### 2. **One-Time Migration Job**

- **File**: `k8s/migration-job.yaml`
- **Purpose**: Run migrations manually when needed
- **Best for**: Emergency migrations, troubleshooting

### 3. **Updated Startup Script**

- **File**: `scripts/start-with-db-url.sh`
- **Change**: Removed inline migrations (now handled by init container)

## 🚀 **How to Use**

### **Option A: Run Migration Now (One-Time Job)**

```bash
# Apply the migration job
kubectl apply -f k8s/migration-job.yaml

# Watch the migration progress
kubectl logs -f job/prisma-migration -n cityforge

# Check if migration succeeded
kubectl get job prisma-migration -n cityforge

# Clean up the job when done
kubectl delete job prisma-migration -n cityforge
```

### **Option B: Deploy with Auto-Migration (Init Container)**

```bash
# Deploy the updated deployment with init container
kubectl apply -f k8s/deployment.yaml

# Watch deployment progress (migrations run first)
kubectl rollout status deployment/cityforge -n cityforge

# Check logs of migration init container
kubectl logs -f deployment/cityforge -c prisma-migration -n cityforge

# Check logs of main application container
kubectl logs -f deployment/cityforge -c cityforge -n cityforge
```

## 🔍 **Migration Commands Used**

The init container runs these Prisma commands:

```bash
# Generate the Prisma client
npx prisma generate

# Apply all pending migrations (production-safe)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

## 📊 **Monitoring Migration Success**

### **Check Init Container Logs**

```bash
kubectl logs deployment/cityforge -c prisma-migration -n cityforge
```

### **Check Migration Status**

```bash
# Run a one-time job to check status
kubectl run prisma-status --image=ghcr.io/smoltech/cityforge/cityforge-frontend:latest --restart=Never -n cityforge -- npx prisma migrate status

# View the output
kubectl logs prisma-status -n cityforge

# Clean up
kubectl delete pod prisma-status -n cityforge
```

### **Check Database Connection**

```bash
# Test database connectivity
kubectl run db-test --image=ghcr.io/smoltech/cityforge/cityforge-frontend:latest --restart=Never -n cityforge --env="DATABASE_URL=postgresql://user:pass@host:5432/db" -- npx prisma db execute --stdin
```

## 🛠 **Troubleshooting**

### **Migration Fails**

1. **Check logs**:

   ```bash
   kubectl logs -f job/prisma-migration -n cityforge
   ```

2. **Common issues**:
   - Database connection issues → Check secrets/configmaps
   - Migration conflicts → May need manual intervention
   - Schema drift → Check if manual changes were made

### **Init Container Keeps Failing**

1. **Check deployment events**:

   ```bash
   kubectl describe deployment cityforge -n cityforge
   ```

2. **Check init container logs**:

   ```bash
   kubectl logs deployment/cityforge -c prisma-migration -n cityforge
   ```

3. **Disable init container temporarily**:
   ```bash
   # Comment out the initContainers section in deployment.yaml
   # Apply the deployment
   kubectl apply -f k8s/deployment.yaml
   ```

### **Manual Migration Required**

If automated migration fails and you need to run migrations manually:

```bash
# Get a shell in a temporary pod
kubectl run -it prisma-manual --image=ghcr.io/smoltech/cityforge/cityforge-frontend:latest --restart=Never -n cityforge -- /bin/sh

# Inside the pod:
export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
npx prisma migrate status
npx prisma migrate deploy

# Exit and clean up
exit
kubectl delete pod prisma-manual -n cityforge
```

## 🔐 **Security Features**

- **Non-root user**: Runs as user 1001 (same as main app)
- **Minimal permissions**: Drops all capabilities
- **Read-only filesystem**: Where possible
- **Resource limits**: Prevents resource exhaustion
- **Secrets**: Database credentials loaded from Kubernetes secrets

## 🎯 **Best Practices**

1. **Always test migrations** in a staging environment first
2. **Monitor migration logs** during deployments
3. **Set up alerts** for migration failures
4. **Keep migration jobs** for troubleshooting (TTL: 1 hour)
5. **Use `migrate deploy`** (not `db push`) in production

## 📝 **Next Steps**

1. **Run the immediate migration**:

   ```bash
   kubectl apply -f k8s/migration-job.yaml
   kubectl logs -f job/prisma-migration -n cityforge
   ```

2. **Deploy with auto-migration**:

   ```bash
   kubectl apply -f k8s/deployment.yaml
   ```

3. **Set up monitoring** for migration failures in your CI/CD pipeline

The migration system is now production-ready and will automatically handle database schema updates on every deployment! 🎉
