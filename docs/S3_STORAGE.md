# S3-Compatible Object Storage Integration

CityForge supports S3-compatible object storage for uploaded images, including:

- Linode Object Storage (recommended for Linode LKE deployments)
- AWS S3
- MinIO
- DigitalOcean Spaces
- Any S3-compatible service

## Upload Priority

The upload system tries storage providers in this order:

1. **S3-compatible storage** (if configured)
2. **Cloudinary** (if configured)
3. **Local filesystem** (fallback)

## Configuration

### Environment Variables

```bash
# S3 endpoint URL (include https://)
S3_ENDPOINT=https://us-east-1.linodeobjects.com

# Bucket name (must be created beforehand)
S3_BUCKET=cityforge-uploads

# Access credentials
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key

# Region (optional, defaults to us-east-1)
S3_REGION=us-east-1
```

### Linode Object Storage Setup

1. **Create a bucket:**

   ```bash
   # Via Linode CLI
   linode-cli object-storage buckets create cityforge-uploads --region us-east-1

   # Or via Cloud Manager: Object Storage > Create Bucket
   ```

2. **Create access keys:**

   ```bash
   # Via Linode CLI
   linode-cli object-storage keys-create cityforge-uploads-key \
     --bucket_access cityforge-uploads:read_write

   # Or via Cloud Manager: Object Storage > Access Keys > Create Access Key
   ```

3. **Set environment variables:**
   ```bash
   export S3_ENDPOINT=https://us-east-1.linodeobjects.com
   export S3_BUCKET=cityforge-uploads
   export S3_ACCESS_KEY_ID=<your-access-key>
   export S3_SECRET_ACCESS_KEY=<your-secret-key>
   export S3_REGION=us-east-1
   ```

### Kubernetes Deployment

1. **Create the S3 credentials secret:**

   ```bash
   # Copy the example file
   cp k8s/s3-secret.yaml.example k8s/s3-secret.yaml

   # Edit with your actual credentials
   nano k8s/s3-secret.yaml

   # Base64 encode your values:
   echo -n "https://us-east-1.linodeobjects.com" | base64
   echo -n "cityforge-uploads" | base64
   echo -n "your-access-key-id" | base64
   echo -n "your-secret-access-key" | base64
   echo -n "us-east-1" | base64

   # Apply the secret
   kubectl apply -f k8s/s3-secret.yaml
   ```

2. **Deploy or restart the application:**

   ```bash
   # For new deployment
   kubectl apply -f k8s/deployment.yaml

   # To restart existing deployment
   kubectl rollout restart deployment/cityforge -n cityforge
   ```

3. **Verify S3 is being used:**

   ```bash
   # Check pod logs
   kubectl logs -f deployment/cityforge -n cityforge

   # Look for: "Using S3-compatible storage for file upload"
   ```

### Docker Compose

Add to your `.env` file or `docker-compose.yml`:

```yaml
services:
  frontend:
    environment:
      - S3_ENDPOINT=https://us-east-1.linodeobjects.com
      - S3_BUCKET=cityforge-uploads
      - S3_ACCESS_KEY_ID=${S3_ACCESS_KEY_ID}
      - S3_SECRET_ACCESS_KEY=${S3_SECRET_ACCESS_KEY}
      - S3_REGION=us-east-1
```

## Benefits

### Why S3 Storage?

1. **Multi-pod scalability:** No shared filesystem needed - multiple pods can handle uploads simultaneously
2. **No PVC limitations:** Linode Block Storage only supports ReadWriteOnce; S3 solves this
3. **Cost-effective:** Pay only for what you store and transfer
4. **Durability:** Built-in redundancy and backups
5. **CDN-ready:** Can add Cloudflare or other CDN in front

### Migration from Local Storage

If you have existing uploads in local storage or PVC:

1. **Enable S3 in deployment** - New uploads go to S3
2. **Copy existing files to S3:**

   ```bash
   # Install AWS CLI or s3cmd
   apt-get install s3cmd

   # Configure s3cmd with your Linode credentials
   s3cmd --configure

   # Sync existing uploads
   s3cmd sync /app/uploads/ s3://cityforge-uploads/uploads/
   ```

3. **Update database URLs** (if needed) - URLs are stored in Card.image_url field
4. **Remove PVC mount** - Once migration complete, remove PVC from deployment

## Troubleshooting

### Uploads fail with "S3 not configured"

Check that all required environment variables are set:

```bash
kubectl exec -it deployment/cityforge -n cityforge -- env | grep S3_
```

### Access denied errors

1. Verify access key has read/write permissions to the bucket
2. Check bucket name is correct
3. Ensure bucket exists in the specified region

### Files not publicly accessible

The upload route sets `ACL: "public-read"`. Verify:

1. Bucket allows public read access (configure in Linode Cloud Manager)
2. CORS is configured if accessing from browser (Bucket Settings > CORS)

### Wrong URL format

For Linode Object Storage, public URLs follow this pattern:

```
https://us-east-1.linodeobjects.com/BUCKET_NAME/uploads/UUID_filename.ext
```

The endpoint in environment variables should be just the base URL:

```
S3_ENDPOINT=https://us-east-1.linodeobjects.com
```

## Cost Estimation

Linode Object Storage pricing (as of 2024):

- **Storage:** $0.02/GB per month
- **Transfer:** $0.005/GB (first 1TB free per month)

Example: 10GB of images with 100GB transfer/month = $0.20 + $0 = **$0.20/month**

Compare to Block Storage PVC: $0.10/GB = $1.00/month for 10GB (but single-pod limitation)

## Security

- Access keys are stored in Kubernetes secrets
- Secrets are marked `optional: true` - app falls back to Cloudinary/local if not configured
- Files are uploaded with UUID prefixes to prevent enumeration
- Path traversal protection ensures files stay in `uploads/` directory
- Content-Type headers prevent MIME confusion attacks
