-- Add missing 'support' column to users table
ALTER TABLE "users" ADD COLUMN "support" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable password_reset_tokens
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(6),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "ix_password_reset_tokens_token" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "ix_password_reset_tokens_user_id" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ix_password_reset_tokens_expires_at" ON "password_reset_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;