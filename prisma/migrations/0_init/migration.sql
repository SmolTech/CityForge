-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(128) NOT NULL,
    "first_name" VARCHAR(50) NOT NULL,
    "last_name" VARCHAR(50) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN,
    "created_date" TIMESTAMP(6),
    "last_login" TIMESTAMP(6),
    "is_supporter_flag" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN DEFAULT false,
    "email_verification_token" VARCHAR(255),
    "email_verification_sent_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "created_date" TIMESTAMP(6),

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "website_url" VARCHAR(255),
    "phone_number" VARCHAR(20),
    "email" VARCHAR(100),
    "address" VARCHAR(255),
    "address_override_url" VARCHAR(500),
    "contact_name" VARCHAR(100),
    "featured" BOOLEAN,
    "image_url" VARCHAR(255),
    "created_by" INTEGER,
    "approved" BOOLEAN,
    "approved_by" INTEGER,
    "approved_date" TIMESTAMP(6),
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_submissions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "website_url" VARCHAR(255),
    "phone_number" VARCHAR(20),
    "email" VARCHAR(100),
    "address" VARCHAR(255),
    "address_override_url" VARCHAR(500),
    "contact_name" VARCHAR(100),
    "image_url" VARCHAR(255),
    "tags_text" TEXT,
    "status" VARCHAR(20),
    "submitted_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "review_notes" TEXT,
    "card_id" INTEGER,
    "created_date" TIMESTAMP(6),
    "reviewed_date" TIMESTAMP(6),

    CONSTRAINT "card_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_modifications" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "website_url" VARCHAR(255),
    "phone_number" VARCHAR(20),
    "email" VARCHAR(100),
    "address" VARCHAR(255),
    "address_override_url" VARCHAR(500),
    "contact_name" VARCHAR(100),
    "image_url" VARCHAR(255),
    "tags_text" TEXT,
    "status" VARCHAR(20),
    "submitted_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "review_notes" TEXT,
    "created_date" TIMESTAMP(6),
    "reviewed_date" TIMESTAMP(6),

    CONSTRAINT "card_modifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER,
    "created_date" TIMESTAMP(6),

    CONSTRAINT "resource_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_access_items" (
    "id" SERIAL NOT NULL,
    "identifier" VARCHAR(50) NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "icon" VARCHAR(50) NOT NULL,
    "display_order" INTEGER,
    "is_active" BOOLEAN,
    "created_date" TIMESTAMP(6),

    CONSTRAINT "quick_access_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_items" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "category_id" INTEGER,
    "phone" VARCHAR(20),
    "address" VARCHAR(500),
    "icon" VARCHAR(50) NOT NULL,
    "display_order" INTEGER,
    "is_active" BOOLEAN,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "resource_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_config" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(500),
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "resource_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "card_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "comment" TEXT,
    "reported" BOOLEAN,
    "reported_by" INTEGER,
    "reported_date" TIMESTAMP(6),
    "reported_reason" TEXT,
    "hidden" BOOLEAN,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "slug" VARCHAR(120) NOT NULL,
    "display_order" INTEGER,
    "is_active" BOOLEAN,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "forum_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_category_requests" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "justification" TEXT,
    "status" VARCHAR(20),
    "requested_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "created_date" TIMESTAMP(6),
    "reviewed_date" TIMESTAMP(6),
    "review_notes" TEXT,
    "category_id" INTEGER,

    CONSTRAINT "forum_category_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_threads" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(280) NOT NULL,
    "is_pinned" BOOLEAN,
    "is_locked" BOOLEAN,
    "report_count" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "forum_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_posts" (
    "id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_first_post" BOOLEAN,
    "report_count" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),
    "edited_by" INTEGER,
    "edited_date" TIMESTAMP(6),

    CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_reports" (
    "id" SERIAL NOT NULL,
    "thread_id" INTEGER NOT NULL,
    "post_id" INTEGER,
    "reason" VARCHAR(50) NOT NULL,
    "details" TEXT,
    "status" VARCHAR(20),
    "reported_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "created_date" TIMESTAMP(6),
    "reviewed_date" TIMESTAMP(6),
    "resolution_notes" TEXT,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_wanted_posts" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20),
    "location" VARCHAR(255),
    "budget" VARCHAR(100),
    "contact_preference" VARCHAR(50),
    "report_count" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "help_wanted_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_wanted_comments" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMP(6),
    "updated_date" TIMESTAMP(6),

    CONSTRAINT "help_wanted_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_wanted_reports" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "reason" VARCHAR(50) NOT NULL,
    "details" TEXT,
    "status" VARCHAR(20),
    "reported_by" INTEGER NOT NULL,
    "reviewed_by" INTEGER,
    "created_date" TIMESTAMP(6),
    "reviewed_date" TIMESTAMP(6),
    "resolution_notes" TEXT,

    CONSTRAINT "help_wanted_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "priority" VARCHAR(20) NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL,
    "created_by" INTEGER NOT NULL,
    "assigned_to" INTEGER,
    "created_date" TIMESTAMPTZ(6),
    "updated_date" TIMESTAMPTZ(6),
    "resolved_date" TIMESTAMPTZ(6),
    "closed_date" TIMESTAMPTZ(6),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal_note" BOOLEAN NOT NULL,
    "created_by" INTEGER NOT NULL,
    "created_date" TIMESTAMPTZ(6),
    "updated_date" TIMESTAMPTZ(6),

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indexing_jobs" (
    "id" SERIAL NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "pages_indexed" INTEGER,
    "total_pages" INTEGER,
    "last_error" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER,
    "created_date" TIMESTAMPTZ(6),
    "updated_date" TIMESTAMPTZ(6),

    CONSTRAINT "indexing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_blacklist" (
    "id" SERIAL NOT NULL,
    "jti" VARCHAR(36) NOT NULL,
    "token_type" VARCHAR(10) NOT NULL,
    "user_id" INTEGER,
    "revoked_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alembic_version" (
    "version_num" VARCHAR(32) NOT NULL,

    CONSTRAINT "alembic_version_pkc" PRIMARY KEY ("version_num")
);

-- CreateTable
CREATE TABLE "card_tags" (
    "card_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "card_tags_pkey" PRIMARY KEY ("card_id","tag_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ix_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ix_tags_name" ON "tags"("name");

-- CreateIndex
CREATE INDEX "ix_cards_name" ON "cards"("name");

-- CreateIndex
CREATE INDEX "ix_cards_approved" ON "cards"("approved");

-- CreateIndex
CREATE INDEX "ix_cards_created_date" ON "cards"("created_date");

-- CreateIndex
CREATE INDEX "ix_cards_approved_created_date" ON "cards"("approved", "created_date");

-- CreateIndex
CREATE UNIQUE INDEX "ix_resource_categories_name" ON "resource_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ix_quick_access_items_identifier" ON "quick_access_items"("identifier");

-- CreateIndex
CREATE INDEX "ix_resource_items_category" ON "resource_items"("category");

-- CreateIndex
CREATE INDEX "ix_resource_items_title" ON "resource_items"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ix_resource_config_key" ON "resource_config"("key");

-- CreateIndex
CREATE INDEX "ix_reviews_card_id" ON "reviews"("card_id");

-- CreateIndex
CREATE INDEX "ix_reviews_created_date" ON "reviews"("created_date");

-- CreateIndex
CREATE INDEX "ix_reviews_hidden" ON "reviews"("hidden");

-- CreateIndex
CREATE INDEX "ix_reviews_reported" ON "reviews"("reported");

-- CreateIndex
CREATE INDEX "ix_reviews_user_id" ON "reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ix_forum_categories_name" ON "forum_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ix_forum_categories_slug" ON "forum_categories"("slug");

-- CreateIndex
CREATE INDEX "ix_forum_category_requests_status" ON "forum_category_requests"("status");

-- CreateIndex
CREATE INDEX "ix_forum_threads_created_date" ON "forum_threads"("created_date");

-- CreateIndex
CREATE INDEX "ix_forum_threads_slug" ON "forum_threads"("slug");

-- CreateIndex
CREATE INDEX "ix_forum_threads_title" ON "forum_threads"("title");

-- CreateIndex
CREATE INDEX "ix_forum_threads_updated_date" ON "forum_threads"("updated_date");

-- CreateIndex
CREATE INDEX "ix_forum_threads_category_pinned_updated" ON "forum_threads"("category_id", "is_pinned", "updated_date");

-- CreateIndex
CREATE INDEX "ix_forum_posts_thread_created" ON "forum_posts"("thread_id", "created_date");

-- CreateIndex
CREATE INDEX "ix_forum_posts_created_by" ON "forum_posts"("created_by");

-- CreateIndex
CREATE INDEX "ix_help_wanted_posts_category" ON "help_wanted_posts"("category");

-- CreateIndex
CREATE INDEX "ix_help_wanted_posts_created_date" ON "help_wanted_posts"("created_date");

-- CreateIndex
CREATE INDEX "ix_help_wanted_posts_status" ON "help_wanted_posts"("status");

-- CreateIndex
CREATE INDEX "ix_help_wanted_posts_title" ON "help_wanted_posts"("title");

-- CreateIndex
CREATE INDEX "ix_support_tickets_category" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "ix_support_tickets_created_date" ON "support_tickets"("created_date");

-- CreateIndex
CREATE INDEX "ix_support_tickets_status" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "ix_support_tickets_title" ON "support_tickets"("title");

-- CreateIndex
CREATE INDEX "ix_indexing_jobs_resource_id" ON "indexing_jobs"("resource_id");

-- CreateIndex
CREATE INDEX "ix_indexing_jobs_status" ON "indexing_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ix_token_blacklist_jti" ON "token_blacklist"("jti");

-- CreateIndex
CREATE INDEX "ix_card_tags_tag_id" ON "card_tags"("tag_id");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_submissions" ADD CONSTRAINT "card_submissions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_submissions" ADD CONSTRAINT "card_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_submissions" ADD CONSTRAINT "card_submissions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_modifications" ADD CONSTRAINT "card_modifications_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_modifications" ADD CONSTRAINT "card_modifications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_modifications" ADD CONSTRAINT "card_modifications_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resource_items" ADD CONSTRAINT "resource_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "resource_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_categories" ADD CONSTRAINT "forum_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_category_requests" ADD CONSTRAINT "forum_category_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_category_requests" ADD CONSTRAINT "forum_category_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_category_requests" ADD CONSTRAINT "forum_category_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_threads" ADD CONSTRAINT "forum_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_posts" ADD CONSTRAINT "forum_posts_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "forum_threads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_posts" ADD CONSTRAINT "help_wanted_posts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_comments" ADD CONSTRAINT "help_wanted_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_comments" ADD CONSTRAINT "help_wanted_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "help_wanted_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_comments" ADD CONSTRAINT "help_wanted_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "help_wanted_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_reports" ADD CONSTRAINT "help_wanted_reports_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "help_wanted_posts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_reports" ADD CONSTRAINT "help_wanted_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "help_wanted_reports" ADD CONSTRAINT "help_wanted_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "token_blacklist" ADD CONSTRAINT "token_blacklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "card_tags" ADD CONSTRAINT "card_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;