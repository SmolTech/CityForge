# Password Reset Feature

This document describes the password reset functionality and how to configure email delivery via Cloudflare.

## Overview

Users can reset their password through a secure token-based flow:

1. User requests password reset at `/forgot-password`
2. System generates a secure token and sends reset link via email
3. User clicks link (valid for 1 hour)
4. User sets new password at `/reset-password?token=...`
5. Token is invalidated after use

## Security Features

- **Cryptographically secure tokens**: 32-byte random tokens (64 hex characters)
- **Time-limited**: Tokens expire after 1 hour
- **Single-use**: Tokens are marked as used and cannot be reused
- **Token invalidation**: Old unused tokens are invalidated when new ones are created
- **No email enumeration**: Same response for existing and non-existing emails
- **Account status check**: Inactive accounts cannot reset passwords
- **Password validation**: Enforces same password requirements as registration

## Database Schema

```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  used_at TIMESTAMP,
  INDEX idx_token (token),
  INDEX idx_user_id (user_id),
  INDEX idx_expires_at (expires_at)
);
```

## API Endpoints

### Request Password Reset

```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

Response (always 200 for security):

```json
{
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

### Validate Reset Token

```
GET /api/auth/reset-password?token=<token>
```

Response:

```json
{
  "valid": true,
  "email": "user@example.com"
}
```

Or if invalid:

```json
{
  "valid": false,
  "error": "Invalid or expired reset token"
}
```

### Reset Password

```
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "abc123...",
  "password": "NewSecurePassword123!"
}
```

Response:

```json
{
  "message": "Password has been reset successfully. You can now log in."
}
```

## Email Configuration

### Cloudflare Email Routing Setup

The application uses Cloudflare Email Routing with MailChannels for sending password reset emails.

#### Step 1: Set up Cloudflare Email Routing

1. Go to your Cloudflare dashboard
2. Select your domain
3. Navigate to **Email** → **Email Routing**
4. Follow the setup wizard to configure email routing
5. Verify your domain's DNS records

#### Step 2: Create API Token

1. Go to **Profile** → **API Tokens**
2. Click **Create Token**
3. Use "Email Routing Send" template or create custom with:
   - Permissions: `Email Routing Send`
   - Zone Resources: Include your domain
4. Copy the API token

#### Step 3: Find Account ID

1. Go to your Cloudflare dashboard home
2. Find your Account ID in the right sidebar

#### Step 4: Configure Environment Variables

**For Local Development (.env.local):**

```bash
CLOUDFLARE_EMAIL_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=YourSiteName
```

**For Kubernetes Deployment:**

```bash
# Create the secret
kubectl create secret generic cloudflare-email \
  --from-literal=CLOUDFLARE_EMAIL_API_TOKEN="your_token" \
  --from-literal=CLOUDFLARE_ACCOUNT_ID="your_account_id" \
  --from-literal=EMAIL_FROM="noreply@yourdomain.com" \
  --from-literal=EMAIL_FROM_NAME="YourSiteName" \
  -n cityforge

# Or use the template file
cp k8s/cloudflare-email-secret.yaml.example k8s/cloudflare-email-secret.yaml
# Edit with your values
kubectl apply -f k8s/cloudflare-email-secret.yaml
```

The deployment automatically mounts these secrets as environment variables.

### Development Mode (No Email Service)

If email credentials are not configured, the system will:

- Log the password reset URL to the console
- Return success to the user (same as with email configured)
- Continue to function normally

This allows local development without email service setup.

## Frontend Pages

- `/forgot-password` - Request password reset form
- `/reset-password?token=xxx` - Reset password form

Both pages include:

- Proper error handling
- Loading states
- Validation feedback
- Responsive design
- Dark mode support

## User Flow

1. **Forgot Password Page** (`/forgot-password`)
   - User enters email address
   - Submits form
   - Sees success message (regardless of email existence)

2. **Email Delivery**
   - User receives email with reset link
   - Link format: `https://yoursite.com/reset-password?token=abc123...`
   - Email includes expiration notice (1 hour)

3. **Reset Password Page** (`/reset-password?token=xxx`)
   - Page validates token on load
   - Shows error if token is invalid/expired
   - User enters new password (with confirmation)
   - Password is validated
   - Success confirmation shown
   - Automatic redirect to login

## Security Considerations

1. **Token Storage**: Tokens are stored in plaintext in database (consider hashing for production)
2. **Rate Limiting**: Consider adding rate limiting to prevent abuse
3. **Email Enumeration**: Current implementation prevents email enumeration
4. **HTTPS Required**: Password reset links should only work over HTTPS in production
5. **Token Cleanup**: Consider adding a cleanup job for expired tokens

## Monitoring

Monitor these metrics:

- Password reset request rate
- Token validation failures
- Email delivery failures
- Token expiration rate

## Troubleshooting

### Emails Not Sending

1. Check environment variables are set correctly
2. Verify Cloudflare API token has correct permissions
3. Check application logs for email sending errors
4. Verify DNS records for email routing

### Tokens Expiring Too Quickly

The token lifetime is hardcoded to 1 hour. To change:

```typescript
// In src/app/api/auth/forgot-password/route.ts
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours instead of 1
```

### Invalid Token Errors

Check:

- Token hasn't expired (check `expires_at` column)
- Token hasn't been used (check `used` column)
- User account is active (`is_active` column)
- Token exists in database

## Future Enhancements

- [ ] Hash tokens before storing (use SHA-256)
- [ ] Add rate limiting to prevent abuse
- [ ] Implement token cleanup job for expired tokens
- [ ] Add email delivery tracking/logging
- [ ] Support multiple email providers
- [ ] Add password reset email templates customization
- [ ] Implement "Remember this device" feature
