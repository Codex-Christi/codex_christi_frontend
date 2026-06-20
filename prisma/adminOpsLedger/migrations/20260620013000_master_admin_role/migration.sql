ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'master_admin';

UPDATE "AdminUser"
SET "role" = 'master_admin'
WHERE "role" = 'super_admin';

DROP INDEX IF EXISTS "AdminUser_single_master_admin_key";
