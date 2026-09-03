-- Student login table for the new student-ID-based login system.
-- Stores the student login identity with course and year information.

CREATE TABLE IF NOT EXISTS public.student_login_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE NOT NULL,
  student_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_login_accounts_student_id
ON public.student_login_accounts (student_id);

CREATE INDEX IF NOT EXISTS idx_student_login_accounts_student_code
ON public.student_login_accounts (student_code);

ALTER TABLE public.student_login_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student login accounts are viewable by everyone" ON public.student_login_accounts;
CREATE POLICY "Student login accounts are viewable by everyone"
ON public.student_login_accounts
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Student login accounts are writable by everyone" ON public.student_login_accounts;
CREATE POLICY "Student login accounts are writable by everyone"
ON public.student_login_accounts
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Student login accounts are updatable by everyone" ON public.student_login_accounts;
CREATE POLICY "Student login accounts are updatable by everyone"
ON public.student_login_accounts
FOR UPDATE
USING (true)
WITH CHECK (true);
