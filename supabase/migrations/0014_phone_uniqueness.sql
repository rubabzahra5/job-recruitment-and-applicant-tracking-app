-- Migration 0014: Prevent duplicate accounts via phone uniqueness
--
-- One verified phone number = one account. This is the primary
-- anti-duplicate-accounts mechanism (free-tier friendly, no SMS API needed
-- for the constraint itself — verification happens via the existing
-- phone_verified flow).
--
-- A partial unique index: the same phone number cannot appear on two
-- different profiles. NULL phones are allowed (not everyone has verified yet).

-- Ensure the phone column exists on profiles (added in an earlier migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- Partial unique index: one phone per account (NULLs excluded)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND phone <> '';

-- Helpful comment
COMMENT ON INDEX public.profiles_phone_unique IS
  'Anti-duplicate-accounts: the same phone number cannot be registered on two profiles.';
