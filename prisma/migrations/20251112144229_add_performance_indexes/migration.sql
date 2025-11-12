-- Add performance indexes to Card table
CREATE INDEX IF NOT EXISTS "ix_cards_approved" ON "cards"("approved");
CREATE INDEX IF NOT EXISTS "ix_cards_created_date" ON "cards"("created_date");
CREATE INDEX IF NOT EXISTS "ix_cards_approved_created_date" ON "cards"("approved", "created_date");

-- Add performance indexes to ForumPost table
CREATE INDEX IF NOT EXISTS "ix_forum_posts_thread_created" ON "forum_posts"("thread_id", "created_date");
CREATE INDEX IF NOT EXISTS "ix_forum_posts_created_by" ON "forum_posts"("created_by");

-- Add performance index to card_tags table for reverse lookups
CREATE INDEX IF NOT EXISTS "ix_card_tags_tag_id" ON "card_tags"("tag_id");

-- Add composite index to ForumThread for category listings
CREATE INDEX IF NOT EXISTS "ix_forum_threads_category_pinned_updated" ON "forum_threads"("category_id", "is_pinned", "updated_date");
