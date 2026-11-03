-- Two-step sign-in (emailed 6-digit code) is on by default. Existing accounts are switched on
-- too; anyone can turn it off under Account settings -> Two-Factor Authentication.
ALTER TABLE "users" ALTER COLUMN "two_factor_enabled" SET DEFAULT true;
UPDATE "users" SET "two_factor_enabled" = true;
