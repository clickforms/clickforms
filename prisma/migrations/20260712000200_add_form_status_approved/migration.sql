-- Add approved step between draft and published in the form lifecycle.
ALTER TYPE "form_status" ADD VALUE IF NOT EXISTS 'approved';
