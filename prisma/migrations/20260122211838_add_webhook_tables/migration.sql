-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "events" TEXT NOT NULL,
    "headers" TEXT,
    "retryPolicy" TEXT,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "environment" TEXT NOT NULL,
    "sourceInfo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhook_endpoint_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL,
    "next_retry_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "response_status" INTEGER,
    "response_headers" TEXT,
    "response_body" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_events_type_timestamp_idx" ON "webhook_events"("type", "timestamp");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_retry_at_idx" ON "webhook_deliveries"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhook_endpoint_id_created_at_idx" ON "webhook_deliveries"("webhook_endpoint_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_type_created_at_idx" ON "webhook_deliveries"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_endpoint_id_fkey" FOREIGN KEY ("webhook_endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "webhook_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;