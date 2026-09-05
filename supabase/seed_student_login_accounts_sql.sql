-- Paste this into the Supabase SQL editor and run it.
-- This seeds the student login accounts table with default admin and sample user rows.

CREATE TABLE IF NOT EXISTS public.student_login_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE,
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

-- Fix stale rows that were created with missing fields earlier.
UPDATE public.student_login_accounts
SET
  student_id = COALESCE(student_id, student_code, 'STU-' || substr(id::text, 1, 8)),
  student_code = COALESCE(student_code, student_id, 'STU-' || substr(id::text, 1, 8)),
  full_name = COALESCE(full_name, 'Unknown Student'),
  course = COALESCE(course, 'Unassigned'),
  year_level = COALESCE(year_level, 'Unknown'),
  password_hash = COALESCE(password_hash, 'changeme'),
  status = COALESCE(status, 'active'),
  updated_at = NOW()
WHERE student_id IS NULL
   OR student_code IS NULL
   OR full_name IS NULL
   OR course IS NULL
   OR year_level IS NULL
   OR password_hash IS NULL;

INSERT INTO public.student_login_accounts (
  student_id,
  student_code,
  full_name,
  course,
  year_level,
  password_hash,
  status
)
VALUES
  (
    'ADMIN-001',
    'STU-ADMIN-001',
    'Admin User',
    'Administration',
    'Admin',
    'admin123',
    'active'
  ),
  (
    'USER1-001',
    'STU-USER1-001',
    'Sample User',
    'BSCS',
    '1st Year',
    'demo123',
    'active'
  )
ON CONFLICT (student_id) DO UPDATE SET
  student_code = EXCLUDED.student_code,
  full_name = EXCLUDED.full_name,
  course = EXCLUDED.course,
  year_level = EXCLUDED.year_level,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  updated_at = NOW();

SELECT id, student_id, student_code, full_name, course, year_level, status
FROM public.student_login_accounts
ORDER BY created_at; 
