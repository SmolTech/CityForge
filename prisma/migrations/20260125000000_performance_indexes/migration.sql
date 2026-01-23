-- Performance optimization: Add indexes for common query patterns

-- Card queries - these run frequently with filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_approved_featured_created 
ON cards(approved, featured, "createdDate" DESC) 
WHERE approved = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_approved_created 
ON cards(approved, "createdDate" DESC) 
WHERE approved = true;

-- Card submissions for admin dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_submissions_status 
ON "CardSubmission"(status);

-- Card modifications for admin dashboard 
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_modifications_status
ON "CardModification"(status);

-- Reviews for admin dashboard (reported reviews)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_reported
ON "Review"("reportedAt") 
WHERE "reportedAt" IS NOT NULL;

-- Forum queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_threads_category_updated
ON "ForumThread"("categoryId", "updatedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forum_posts_thread_created
ON "ForumPost"("threadId", "createdAt" DESC);

-- Help wanted posts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_help_wanted_active_created
ON "HelpWantedPost"(active, "createdAt" DESC)
WHERE active = true;

-- Support tickets by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_support_tickets_status_updated
ON "SupportTicket"(status, "updatedAt" DESC);

-- Card tags for filtering (many-to-many relationship)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_tags_cardid_tagid
ON "CardTag"("cardId", "tagId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_card_tags_tagid
ON "CardTag"("tagId");

-- User queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created
ON users(role, "createdAt" DESC);

-- Text search optimization for cards
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_name_text_search
ON cards USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Webhook tables performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_deliveries_endpoint_created
ON "WebhookDelivery"("endpointId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_deliveries_status
ON "WebhookDelivery"(status);