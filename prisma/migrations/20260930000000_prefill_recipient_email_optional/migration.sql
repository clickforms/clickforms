-- Prefills can now be shared as a plain link (copied and sent by text, chat, etc.) without an
-- email recipient, so the recipient email becomes optional.
ALTER TABLE "form_prefills" ALTER COLUMN "recipient_email" DROP NOT NULL;
