CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  student_id TEXT,
  student_code TEXT,
  course TEXT,
  year_level TEXT,
  card TEXT,
  membership_status TEXT,
  borrowed_books INTEGER NOT NULL DEFAULT 0,
  active_holds INTEGER NOT NULL DEFAULT 0,
  fines_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'librarian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS student_id TEXT,
  ADD COLUMN IF NOT EXISTS student_code TEXT,
  ADD COLUMN IF NOT EXISTS course TEXT,
  ADD COLUMN IF NOT EXISTS year_level TEXT,
  ADD COLUMN IF NOT EXISTS card TEXT,
  ADD COLUMN IF NOT EXISTS membership_status TEXT,
  ADD COLUMN IF NOT EXISTS borrowed_books INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_holds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fines_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  total_copies INTEGER NOT NULL CHECK (total_copies > 0),
  available_copies INTEGER NOT NULL CHECK (available_copies >= 0),
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.borrow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  return_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue'))
);

CREATE TABLE IF NOT EXISTS public.book_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrow_record_id UUID NOT NULL REFERENCES public.borrow_records(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  return_date DATE NOT NULL,
  condition TEXT,
  remark TEXT,
  status TEXT NOT NULL DEFAULT 'returned' CHECK (status IN ('returned', 'late', 'damaged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    student_id,
    student_code,
    course,
    year_level,
    card,
    membership_status,
    borrowed_books,
    active_holds,
    fines_due,
    avatar_url,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'Active',
    0,
    0,
    0,
    NULL,
    'member',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.decrement_book_copies_on_borrow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.books
  SET available_copies = available_copies - 1
  WHERE id = NEW.book_id
    AND available_copies > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This book is not currently available to borrow.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_borrow_decrement ON public.borrow_records;
CREATE TRIGGER trg_borrow_decrement
AFTER INSERT ON public.borrow_records
FOR EACH ROW
WHEN (NEW.status = 'borrowed')
EXECUTE FUNCTION public.decrement_book_copies_on_borrow();

CREATE OR REPLACE FUNCTION public.increment_book_copies_on_return()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.return_date IS NOT NULL AND OLD.return_date IS NULL THEN
    UPDATE public.books
    SET available_copies = available_copies + 1
    WHERE id = NEW.book_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_return_increment ON public.borrow_records;
CREATE TRIGGER trg_return_increment
AFTER UPDATE OF return_date ON public.borrow_records
FOR EACH ROW
EXECUTE FUNCTION public.increment_book_copies_on_return();

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY,
  student_code TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  course TEXT,
  year_level TEXT,
  status TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.student_login_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT UNIQUE NOT NULL,
  student_code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  course TEXT NOT NULL,
  year_level TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_login_accounts_student_id
ON public.student_login_accounts (student_id);

CREATE INDEX IF NOT EXISTS idx_student_login_accounts_student_code
ON public.student_login_accounts (student_code);

CREATE TABLE IF NOT EXISTS public.library_cards (
  id UUID PRIMARY KEY,
  card_no TEXT UNIQUE NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  issue_date DATE,
  expiry_date DATE,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.borrowing_records (
  id UUID PRIMARY KEY,
  txn_code TEXT UNIQUE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  book_id UUID NOT NULL,
  borrow_date DATE,
  due_date DATE,
  return_date DATE,
  status TEXT,
  notified BOOLEAN DEFAULT FALSE,
  condition TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY,
  library_name TEXT,
  borrow_period_days INTEGER,
  max_books_per_student INTEGER,
  fine_per_day NUMERIC,
  admin_email TEXT
);

CREATE TABLE IF NOT EXISTS public.library_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_login_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Books are viewable by everyone" ON public.books;
CREATE POLICY "Books are viewable by everyone"
ON public.books
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Books are writable by everyone" ON public.books;
CREATE POLICY "Books are writable by everyone"
ON public.books
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Books are updatable by everyone" ON public.books;
CREATE POLICY "Books are updatable by everyone"
ON public.books
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Books are deletable by everyone" ON public.books;
CREATE POLICY "Books are deletable by everyone"
ON public.books
FOR DELETE
USING (true);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own borrow records" ON public.borrow_records;
CREATE POLICY "Users can read own borrow records"
ON public.borrow_records
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own borrow records" ON public.borrow_records;
CREATE POLICY "Users can insert own borrow records"
ON public.borrow_records
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own borrow records" ON public.borrow_records;
CREATE POLICY "Users can update own borrow records"
ON public.borrow_records
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Book returns are viewable by everyone" ON public.book_returns;
CREATE POLICY "Book returns are viewable by everyone"
ON public.book_returns
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Book returns are writable by everyone" ON public.book_returns;
CREATE POLICY "Book returns are writable by everyone"
ON public.book_returns
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Book returns are updatable by everyone" ON public.book_returns;
CREATE POLICY "Book returns are updatable by everyone"
ON public.book_returns
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Students are viewable by everyone" ON public.students;
CREATE POLICY "Students are viewable by everyone"
ON public.students
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Students are writable by everyone" ON public.students;
CREATE POLICY "Students are writable by everyone"
ON public.students
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Students are updatable by everyone" ON public.students;
CREATE POLICY "Students are updatable by everyone"
ON public.students
FOR UPDATE
USING (true)
WITH CHECK (true);

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

DROP POLICY IF EXISTS "Library cards are viewable by everyone" ON public.library_cards;
CREATE POLICY "Library cards are viewable by everyone"
ON public.library_cards
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Library cards are writable by everyone" ON public.library_cards;
CREATE POLICY "Library cards are writable by everyone"
ON public.library_cards
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Library cards are updatable by everyone" ON public.library_cards;
CREATE POLICY "Library cards are updatable by everyone"
ON public.library_cards
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Borrowing records are viewable by everyone" ON public.borrowing_records;
CREATE POLICY "Borrowing records are viewable by everyone"
ON public.borrowing_records
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Borrowing records are writable by everyone" ON public.borrowing_records;
CREATE POLICY "Borrowing records are writable by everyone"
ON public.borrowing_records
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Borrowing records are updatable by everyone" ON public.borrowing_records;
CREATE POLICY "Borrowing records are updatable by everyone"
ON public.borrowing_records
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "App users are viewable by everyone" ON public.app_users;
CREATE POLICY "App users are viewable by everyone"
ON public.app_users
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "App users are writable by everyone" ON public.app_users;
CREATE POLICY "App users are writable by everyone"
ON public.app_users
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "App users are updatable by everyone" ON public.app_users;
CREATE POLICY "App users are updatable by everyone"
ON public.app_users
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.settings;
CREATE POLICY "Settings are viewable by everyone"
ON public.settings
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Settings are writable by everyone" ON public.settings;
CREATE POLICY "Settings are writable by everyone"
ON public.settings
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Settings are updatable by everyone" ON public.settings;
CREATE POLICY "Settings are updatable by everyone"
ON public.settings
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Announcements are viewable by everyone" ON public.library_announcements;
CREATE POLICY "Announcements are viewable by everyone"
ON public.library_announcements
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Announcements are writable by everyone" ON public.library_announcements;
CREATE POLICY "Announcements are writable by everyone"
ON public.library_announcements
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Announcements are updatable by everyone" ON public.library_announcements;
CREATE POLICY "Announcements are updatable by everyone"
ON public.library_announcements
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Announcements are deletable by everyone" ON public.library_announcements;
CREATE POLICY "Announcements are deletable by everyone"
ON public.library_announcements
FOR DELETE
USING (true);

-- Seed data is intentionally left empty.
-- The app should create records through its live save flow and persist them into the database.
