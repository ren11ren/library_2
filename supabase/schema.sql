-- Library Management System schema for Supabase
-- Run this script in the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'librarian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  total_copies INTEGER NOT NULL CHECK (total_copies > 0),
  available_copies INTEGER NOT NULL CHECK (available_copies >= 0),
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    'member',
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Books are viewable by everyone" ON public.books;
CREATE POLICY "Books are viewable by everyone"
ON public.books
FOR SELECT
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

-- Realistic library dataset for the dashboard UI
INSERT INTO public.books (title, author, isbn, category, total_copies, available_copies)
VALUES
  ('Introduction to Algorithms', 'Thomas H. Cormen', '9780262033848', 'Computer Science', 3, 2),
  ('The Art of Computer Programming', 'Donald E. Knuth', '9780201896831', 'Computer Science', 2, 0),
  ('Clean Code', 'Robert C. Martin', '9780132350884', 'Technology', 4, 3),
  ('Design Patterns', 'Erich Gamma', '9780201633610', 'Technology', 2, 1),
  ('Structure and Interpretation of Computer Programs', 'Harold Abelson', '9780262510875', 'Computer Science', 1, 1),
  ('Database System Concepts', 'Abraham Silberschatz', '9780073523323', 'Database', 5, 4),
  ('Operating System Concepts', 'Abraham Silberschatz', '9781118063330', 'Operating Systems', 3, 1),
  ('Discrete Mathematics', 'Kenneth Rosen', '9780073383095', 'Mathematics', 4, 2),
  ('Software Engineering', 'Ian Sommerville', '9781292096131', 'Software Engineering', 3, 2),
  ('Computer Organization and Design', 'David Patterson', '9780128201091', 'Computer Architecture', 2, 2)
ON CONFLICT (isbn) DO NOTHING;

-- Optional sample active borrow records for a realistic dashboard
-- These records will only work if matching test users already exist in profiles.
-- Replace the UUIDs below with real profile ids from your Supabase auth/users table.
DO $$
DECLARE
  user_1 UUID := '11111111-1111-4111-8111-111111111111';
  user_2 UUID := '22222222-2222-4222-8222-222222222222';
  user_3 UUID := '33333333-3333-4333-8333-333333333333';
  book_algo UUID;
  book_clean UUID;
  book_design UUID;
BEGIN
  SELECT id INTO book_algo FROM public.books WHERE isbn = '9780262033848';
  SELECT id INTO book_clean FROM public.books WHERE isbn = '9780132350884';
  SELECT id INTO book_design FROM public.books WHERE isbn = '9780201633610';

  IF book_algo IS NOT NULL THEN
    INSERT INTO public.borrow_records (user_id, book_id, borrow_date, due_date, return_date, status)
    VALUES
      (user_1, book_algo, NOW() - INTERVAL '14 days', NOW() - INTERVAL '1 day', NULL, 'overdue'),
      (user_2, book_clean, NOW() - INTERVAL '8 days', NOW() + INTERVAL '6 days', NULL, 'borrowed')
    ON CONFLICT DO NOTHING;
  END IF;

  IF book_design IS NOT NULL THEN
    INSERT INTO public.borrow_records (user_id, book_id, borrow_date, due_date, return_date, status)
    VALUES
      (user_3, book_design, NOW() - INTERVAL '5 days', NOW() + INTERVAL '9 days', NULL, 'borrowed')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
