# Daily Admin Digest

The Daily Admin Digest automatically sends a summary of pending approvals to administrators every morning, helping them stay on top of administrative tasks that require attention.

## What's Included

The digest aggregates pending items from these areas:

### 📧 **Business Submissions** (`/admin/submissions`)

- New business listings awaiting approval
- Shows business name, days pending, submitter info

### ✏️ **Business Modifications** (`/admin/modifications`)

- User-requested changes to existing businesses
- Shows business name, days pending, submitter info

### ⚠️ **Forum Reports** (`/admin/forums`)

- Reported forum posts requiring moderation
- Shows report reason, thread title, days pending

### 📁 **Category Requests** (`/admin/forums`)

- Requests for new forum categories
- Shows category name, days pending, requester info

### 🆘 **Help Wanted Reports** (`/admin/classifieds`)

- Reported classified/help wanted posts
- Shows report reason, post title, days pending

### ⭐ **Reported Reviews** (`/admin/reviews`)

- Business reviews that have been reported
- Shows business name, days pending since report

## Delivery Methods

The digest is sent via:

1. **📧 Email** - To all active, verified admin users
2. **🔗 Webhooks** - If webhooks are enabled (e.g., Mattermost/Slack)

## Schedule

- **Time**: 8:00 AM daily (configurable in `k8s/admin-digest-cronjob.yaml`)
- **Condition**: Only sent if there are pending items (no spam when queue is empty)
- **Format**: Summarized view with links to admin panels for full details

## Configuration

### Kubernetes CronJob

The digest runs as a Kubernetes CronJob (`admin-digest-cronjob.yaml`):

```yaml
schedule: "0 8 * * *" # 8:00 AM daily
```

### Environment Variables

Required:

- `DATABASE_URL` - Database connection
- `NEXT_PUBLIC_SITE_URL` - For generating admin panel links
- `JWT_SECRET_KEY` - Required by the application

Optional (for email):

- `SMTP_*` variables for direct SMTP
- `MAILGUN_*` variables for Mailgun
- `CLOUDFLARE_*` variables for Cloudflare Email

### Webhook Integration

If `WEBHOOKS_ENABLED=true`, the digest also sends notifications to configured webhook endpoints with Mattermost-compatible formatting.

## Manual Execution

### Local Development

```bash
npm run admin-digest
```

### Kubernetes One-Time Job

```bash
kubectl create job --from=cronjob/daily-admin-digest admin-digest-manual -n cityforge
kubectl logs job/admin-digest-manual -n cityforge
```

## Sample Output

```
Daily Admin Digest - 7 items pending approval

🏢 Business Submissions (3):
  • Joe's Pizza (5d old) - John Smith
  • Best Cleaners (2d old) - Jane Doe
  • Auto Repair Plus (1d old) - Mike Johnson
  View all: https://example.com/admin/submissions

⚠️ Forum Reports (2):
  • Spam content in "Community Events" (3d old)
  • Inappropriate language in "General Discussion" (1d old)
  View all: https://example.com/admin/forums

⭐ Reported Reviews (2):
  • Review of Joe's Pizza (4d old)
  • Review of Best Cleaners (1d old)
  View all: https://example.com/admin/reviews

Admin Panel: https://example.com/admin
Generated: 1/23/2026, 8:00:00 AM
```

## Benefits

1. **📊 Daily Overview** - Single consolidated view of all pending work
2. **⏰ Aging Awareness** - See how long items have been waiting
3. **🔗 Quick Access** - Direct links to relevant admin panels
4. **📱 Multi-Channel** - Email + webhook notifications
5. **🎯 Smart Filtering** - Only sends when there's actual work to do
6. **⚡ Low Impact** - Lightweight query, runs in minutes

## Customization

### Change Schedule

Edit the cron schedule in `k8s/admin-digest-cronjob.yaml`:

```yaml
schedule: "0 9 * * 1-5" # 9 AM weekdays only
```

### Modify Content

Edit `scripts/daily-admin-digest.mjs` to:

- Add new approval types
- Change email formatting
- Adjust age thresholds
- Add priority indicators

### Add Filters

Extend queries to filter by:

- Age thresholds (e.g., only items >3 days old)
- Priority levels
- Assignment status
- Category types

## Monitoring

### Kubernetes

```bash
# View CronJob status
kubectl get cronjobs -n cityforge

# View recent job runs
kubectl get jobs -n cityforge | grep admin-digest

# Check job logs
kubectl logs job/admin-digest-manual -n cityforge
```

### Troubleshooting

**No digest received?**

- Check if there are actually pending items
- Verify admin email addresses in database
- Check email service configuration
- Review job logs for errors

**Wrong time zone?**

- CronJob uses UTC by default
- Adjust schedule accordingly (e.g., `"0 13 * * *"` for 8 AM EST)

**Missing data?**

- Verify status field values match expected strings
- Check database queries in script for correct field names
- Review Prisma schema relationships
