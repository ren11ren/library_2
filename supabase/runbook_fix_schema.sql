-- Runbook: Safe fix for students/app_users schema and seeds
-- Instructions: Paste all of this into your Supabase SQL editor for the project referenced by VITE_SUPABASE_URL in your .env. Run as a single script.

-- 0) Ensure pgcrypto exists for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) Timestamped backups for key tables (safe, non-destructive)
DO $$
DECLARE ts text := to_char(now(), 'YYYYMMDD_HH24MI');
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.students_backup_%s AS TABLE public.students WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.students_backup_%s SELECT * FROM public.students', ts);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'books') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.books_backup_%s AS TABLE public.books WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.books_backup_%s SELECT * FROM public.books', ts);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'library_cards') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.library_cards_backup_%s AS TABLE public.library_cards WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.library_cards_backup_%s SELECT * FROM public.library_cards', ts);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'borrowing_records') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.borrowing_records_backup_%s AS TABLE public.borrowing_records WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.borrowing_records_backup_%s SELECT * FROM public.borrowing_records', ts);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_users') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.app_users_backup_%s AS TABLE public.app_users WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.app_users_backup_%s SELECT * FROM public.app_users', ts);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'settings') THEN
    EXECUTE format('CREATE TABLE IF NOT EXISTS public.settings_backup_%s AS TABLE public.settings WITH NO DATA', ts);
    EXECUTE format('INSERT INTO public.settings_backup_%s SELECT * FROM public.settings', ts);
  END IF;
END
$$;

-- 2) Align students table: add/populate columns safely
DO $$
BEGIN
  -- add student_code if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='students' AND column_name='student_code'
  ) THEN
    ALTER TABLE public.students ADD COLUMN student_code text;
  END IF;

  -- if student_no exists, copy to student_code where NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='students' AND column_name='student_no'
  ) THEN
    UPDATE public.students
    SET student_code = student_no
    WHERE student_code IS NULL AND student_no IS NOT NULL;
  END IF;

  -- ensure basic columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='name') THEN
    ALTER TABLE public.students ADD COLUMN name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='email') THEN
    ALTER TABLE public.students ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='course') THEN
    ALTER TABLE public.students ADD COLUMN course text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='status') THEN
    ALTER TABLE public.students ADD COLUMN status text DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='created_at') THEN
    ALTER TABLE public.students ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  -- fill any remaining NULL student_code with a deterministic token
  UPDATE public.students
  SET student_code = concat('STU-', to_char(coalesce(created_at, now()), 'YYYY'), '-', substring(md5(coalesce(id::text, random()::text)) from 1 for 8))
  WHERE student_code IS NULL;
END
$$;

-- 3) Create unique index on student_code if no duplicates
DO $$
DECLARE dup_count int;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT student_code FROM public.students WHERE student_code IS NOT NULL GROUP BY student_code HAVING count(*) > 1
  ) t;
  IF dup_count = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='i' AND c.relname='idx_students_student_code'
    ) THEN
      CREATE UNIQUE INDEX idx_students_student_code ON public.students (student_code);
    END IF;
  ELSE
    RAISE NOTICE 'Duplicate student_code values found: %; unique index skipped', dup_count;
  END IF;
END
$$;

-- 4) Ensure app_users exists (safe) and seed demo accounts
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','admin')),
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- seed: will not overwrite existing
INSERT INTO public.app_users (email, password, role, student_id)
SELECT s.email, 'password123', 'student', s.id
FROM public.students s
WHERE s.student_code = 'STU-2021-001'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.app_users (email, password, role, student_id)
SELECT '2021-001', 'password123', 'student', s.id
FROM public.students s
WHERE s.student_code = 'STU-2021-001'
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.app_users (email, password, role, student_id)
VALUES ('librarian@college.edu', 'admin123', 'admin', NULL)
ON CONFLICT (email) DO NOTHING;

-- 5) Quick verification queries (run after script finishes)
-- SELECT count(*) AS students_count FROM public.students;
-- SELECT count(*) AS app_users_count FROM public.app_users;
-- SELECT * FROM public.app_users LIMIT 10;

-- End of runbook
