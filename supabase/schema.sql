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

CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY,
  student_code TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  course TEXT,
  year_level TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowing_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

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

INSERT INTO public.books (id, title, author, isbn, category, total_copies, available_copies, created_at)
VALUES
  ('11111111-aaaa-0000-0000-000000000001','Introduction to Algorithms','Cormen, Leiserson, Rivest','BK-001','Computer Science',3,2,'2025-01-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000002','The Art of Computer Programming','Donald E. Knuth','BK-002','Computer Science',2,0,'2025-02-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000003','Clean Code','Robert C. Martin','BK-003','Software Engineering',4,3,'2025-03-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000004','Design Patterns','Gang of Four','BK-004','Software Engineering',2,1,'2025-04-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000005','Structure and Interpretation','Abelson & Sussman','BK-005','Computer Science',1,1,'2025-05-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000006','Database System Concepts','Silberschatz et al.','BK-006','Database',5,4,'2025-06-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000007','Computer Networks','Andrew Tanenbaum','BK-007','Networking',3,3,'2025-07-01T00:00:00Z'),
  ('11111111-aaaa-0000-0000-000000000008','Operating System Concepts','Silberschatz et al.','BK-008','Computer Science',2,2,'2025-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.students (id, student_code, name, email, course, year_level, status, created_at)
VALUES
  ('11111111-1111-1111-1111-111111111111','STU-2021-001','Maria Santos','maria.santos@college.edu','BS Computer Science','4th Year','active','2025-01-01T00:00:00Z'),
  ('11111111-1111-1111-1111-222222222222','STU-2021-002','Juan dela Cruz','juan.delacruz@college.edu','BSIT','4th Year','active','2025-01-02T00:00:00Z'),
  ('11111111-1111-1111-1111-333333333333','STU-2022-015','Ana Reyes','ana.reyes@college.edu','BSCS','3rd Year','suspended','2026-01-01T00:00:00Z'),
  ('11111111-1111-1111-1111-444444444444','STU-2023-008','Carlo Bautista','carlo.bautista@college.edu','BSECE','2nd Year','active','2025-06-01T00:00:00Z'),
  ('11111111-1111-1111-1111-555555555555','STU-2023-019','Lena Villanueva','lena.villanueva@college.edu','BSME','2nd Year','active','2025-07-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_users (id, email, password, role, student_id, created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','maria.santos@college.edu','user123','student','11111111-1111-1111-1111-111111111111','2025-01-01T00:00:00Z'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','juan.delacruz@college.edu','user123','student','11111111-1111-1111-1111-222222222222','2025-01-02T00:00:00Z'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','librarian@college.edu','admin123','admin',NULL,'2025-01-03T00:00:00Z')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.library_cards (id, card_no, student_id, issue_date, expiry_date, status, created_at)
VALUES
  ('22222222-aaaa-0000-0000-000000000001','LC-0042','11111111-1111-1111-1111-111111111111','2025-08-01','2026-08-01','active','2025-08-01T00:00:00Z'),
  ('22222222-aaaa-0000-0000-000000000002','LC-0043','11111111-1111-1111-1111-222222222222','2025-08-01','2026-08-01','active','2025-08-01T00:00:00Z'),
  ('22222222-aaaa-0000-0000-000000000003','LC-0061','11111111-1111-1111-1111-333333333333','2025-08-01','2026-08-01','suspended','2025-08-01T00:00:00Z'),
  ('22222222-aaaa-0000-0000-000000000004','LC-0089','11111111-1111-1111-1111-444444444444','2025-08-01','2026-08-01','active','2025-08-01T00:00:00Z'),
  ('22222222-aaaa-0000-0000-000000000005','LC-0104','11111111-1111-1111-1111-555555555555','2025-08-01','2026-08-01','active','2025-08-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.borrowing_records (id, txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified, condition, created_at)
VALUES
  (gen_random_uuid(),'TXN-2025-001','11111111-1111-1111-1111-111111111111','11111111-aaaa-0000-0000-000000000001','2025-07-25','2025-08-08',NULL,'overdue',true,NULL,'2025-07-25T00:00:00Z'),
  (gen_random_uuid(),'TXN-2025-002','11111111-1111-1111-1111-222222222222','11111111-aaaa-0000-0000-000000000003','2025-08-01','2025-08-15',NULL,'due-soon',false,NULL,'2025-08-01T00:00:00Z')
ON CONFLICT (txn_code) DO NOTHING;

INSERT INTO public.settings (id, library_name, borrow_period_days, max_books_per_student, fine_per_day, admin_email)
VALUES
  (1, 'Greenfield College Library', 14, 3, 5.0, 'librarian@college.edu')
ON CONFLICT (id) DO NOTHING;