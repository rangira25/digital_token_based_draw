-- Add 'available' to token_status enum (for pool tokens)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'available' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'token_status')) THEN
    ALTER TYPE token_status ADD VALUE 'available';
  END IF;
END $$;

-- Make participant_id nullable for pool tokens
ALTER TABLE tokens ALTER COLUMN participant_id DROP NOT NULL;
