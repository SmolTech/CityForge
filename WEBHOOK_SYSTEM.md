# Webhook System Implementation

## Overview

Added a comprehensive webhook system to CityForge that triggers on all email events. This allows external systems to receive notifications instead of or in addition to email notifications.

## Key Features

### 📡 **Event Types Supported**

- `submission.created` - New business submissions
- `modification.created` - Business modification requests
- `forum.report.created` - Forum post/thread reports
- `forum.category_request.created` - New forum category requests
- `auth.email_verification.requested` - Email verification requests
- `auth.password_reset.requested` - Password reset requests
- `admin.notification` - General admin notifications

### 🔧 **Webhook Configuration**

- Configure webhooks via admin API routes or environment variables
- Supports multiple endpoints with different event subscriptions
- HMAC signature verification with configurable secrets
- Custom headers and retry policies per endpoint
- Automatic retry with exponential backoff

### 🛠️ **API Routes**

- `GET /api/admin/webhooks` - List all webhook endpoints
- `POST /api/admin/webhooks` - Create new webhook endpoint
- `GET /api/admin/webhooks/{id}` - Get specific endpoint
- `PUT /api/admin/webhooks/{id}` - Update endpoint
- `DELETE /api/admin/webhooks/{id}` - Delete endpoint
- `POST /api/admin/webhooks/test` - Send test webhook

### ⚙️ **Environment Configuration**

```env
# Enable/disable webhook system globally
WEBHOOKS_ENABLED=true

# Whether to fallback to email if webhooks fail
WEBHOOK_FALLBACK_TO_EMAIL=true

# JSON configuration for webhook endpoints
WEBHOOK_CONFIG=[{"id":"webhook1","name":"Slack","url":"https://hooks.slack.com/...","events":["submission.created"],"enabled":true}]
```

## Implementation Details

### 🔄 **Integration Points**

All existing email notification functions now also send webhooks:

1. **Admin Notifications** (`src/lib/email/admin-notifications.ts`):
   - `sendSubmissionNotification()` → `sendSubmissionWebhook()`
   - `sendModificationNotification()` → `sendModificationWebhook()`
   - `sendForumReportNotification()` → `sendForumReportWebhook()`
   - `sendCategoryRequestNotification()` → `sendCategoryRequestWebhook()`

2. **Auth Events**:
   - `sendVerificationEmail()` → `sendEmailVerificationWebhook()`
   - Password reset → `sendPasswordResetWebhook()`

### 🔐 **Security Features**

- HMAC-SHA256 signatures with configurable secrets
- Request timeout configuration (default: 30s)
- Rate limiting via existing middleware
- Admin-only webhook management
- Webhook secrets hidden in API responses

### 📊 **Delivery & Retry Logic**

- Automatic retry with exponential backoff
- Configurable max retries per endpoint
- Delivery status tracking
- Response logging for debugging
- Non-blocking webhook delivery (doesn't affect email sending)

### 🎯 **Example Webhook Payloads**

**Business Submission:**

```json
{
  "id": "evt_123",
  "type": "submission.created",
  "timestamp": "2024-01-17T02:00:00Z",
  "data": {
    "submission": {
      "id": 123,
      "name": "New Business",
      "description": "..."
    },
    "submitter": {
      "id": 456,
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "admin_url": "https://yoursite.com/admin/submissions"
  }
}
```

**Password Reset:**

```json
{
  "id": "evt_124",
  "type": "auth.password_reset.requested",
  "timestamp": "2024-01-17T02:00:00Z",
  "data": {
    "user": {
      "email": "user@example.com",
      "firstName": "Jane"
    },
    "reset_url": "https://yoursite.com/reset-password?token=...",
    "token": "secure_token",
    "expires_at": "2024-01-17T03:00:00Z"
  }
}
```

## Usage Examples

### 📱 **Slack Integration**

Create a webhook endpoint pointing to a Slack webhook URL to get admin notifications in Slack.

### 🔔 **Discord Bot**

Set up webhook endpoint for Discord bot to notify team channels of important events.

### 📧 **Email Service Replacement**

Use webhooks with external email services like SendGrid, Mailchimp, etc.

### 📈 **Analytics & Monitoring**

Send events to analytics platforms like Segment, Mixpanel for tracking.

### 🤖 **Automation Systems**

Trigger automated workflows in tools like Zapier, Make.com, or custom systems.

## Getting Started

1. **Enable webhooks** in environment:

   ```env
   WEBHOOKS_ENABLED=true
   ```

2. **Create webhook endpoint** via admin panel or API:

   ```bash
   curl -X POST /api/admin/webhooks \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Slack Notifications",
       "url": "https://hooks.slack.com/services/...",
       "events": ["submission.created", "forum.report.created"],
       "secret": "your_webhook_secret"
     }'
   ```

3. **Test webhook**:
   ```bash
   curl -X POST /api/admin/webhooks/test \
     -H "Content-Type: application/json" \
     -d '{"eventType": "submission.created"}'
   ```

The system will now send webhooks for all email events while maintaining backward compatibility with existing email functionality.
