# Password Reset Feature

This document describes the password reset functionality and how to configure email delivery via Mailgun.

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

### Mailgun Email Setup

The application uses Mailgun for sending password reset and email verification emails.

#### Step 1: Sign Up for Mailgun

1. Go to https://www.mailgun.com/
2. Create a free account (includes 5,000 free emails/month for first 3 months)
3. Verify your email address

#### Step 2: Add and Verify Your Domain

1. Go to **Sending** → **Domains** in the Mailgun dashboard
2. Click **Add New Domain**
3. Enter your domain (e.g., `mg.yourdomain.com` or `yourdomain.com`)
4. Configure DNS records (SPF, DKIM, CNAME) as shown in the dashboard
5. Wait for DNS verification (can take up to 48 hours)

#### Step 3: Get Your API Key

1. Go to **Settings** → **API Security**
2. Find your **Private API key** (starts with `key-`)
3. Copy the API key

#### Step 4: Note Your Region

Mailgun has two regions:

- **US** (default): `api.mailgun.net` - for US-based accounts
- **EU**: `api.eu.mailgun.net` - for EU-based accounts (GDPR compliance)

Check your region in the Mailgun dashboard.

#### Step 5: Configure Environment Variables

**For Local Development (.env.local):**

```bash
MAILGUN_API_KEY=key-your_api_key_here
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_REGION=us  # or "eu" for European region
EMAIL_FROM=noreply@mg.yourdomain.com
EMAIL_FROM_NAME=YourSiteName
```

**For Kubernetes Deployment:**

```bash
# Create the secret
kubectl create secret generic mailgun-email \
  --from-literal=MAILGUN_API_KEY="key-your_api_key" \
  --from-literal=MAILGUN_DOMAIN="mg.yourdomain.com" \
  --from-literal=MAILGUN_REGION="us" \
  --from-literal=EMAIL_FROM="noreply@mg.yourdomain.com" \
  --from-literal=EMAIL_FROM_NAME="YourSiteName" \
  -n cityforge

# Or use the template file
cp k8s/mailgun-email-secret.yaml.example k8s/mailgun-email-secret.yaml
# Edit with your values
kubectl apply -f k8s/mailgun-email-secret.yaml
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
