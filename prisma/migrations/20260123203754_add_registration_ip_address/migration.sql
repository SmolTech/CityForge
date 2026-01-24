-- AlterTable
ALTER TABLE "users" ADD COLUMN "registration_ip_address" VARCHAR(45);

-- CreateIndex (optional, for analytics queries)
CREATE INDEX "ix_users_registration_ip" ON "users"("registration_ip_address");