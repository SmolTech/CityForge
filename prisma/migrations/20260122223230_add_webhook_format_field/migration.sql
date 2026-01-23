-- Add format field to webhook_endpoints table
ALTER TABLE "webhook_endpoints" ADD COLUMN "format" TEXT DEFAULT 'mattermost';