-- Safe timestamped backups for existing app tables (non-destructive)
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

-- DROP existing app tables (will remove current app data)
DROP TABLE IF EXISTS borrowing_records CASCADE;
DROP TABLE IF EXISTS library_cards CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Recreate schema and seed (full schema + seed)
create extension if not exists "pgcrypto";

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_code text unique not null,
  name text not null,
  email text unique not null,
  course text not null,
  year_level text not null default '4th Year',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  book_code text unique not null,
  title text not null,
  author text not null,
  category text not null,
  copies integer not null default 1,
  available integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists library_cards (
  id uuid primary key default gen_random_uuid(),
  card_no text unique not null,
  student_id uuid not null references students(id) on delete cascade,
  issue_date date not null default current_date,
  expiry_date date not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table if not exists borrowing_records (
  id uuid primary key default gen_random_uuid(),
  txn_code text unique not null,
  student_id uuid not null references students(id) on delete cascade,
  book_id uuid not null references books(id) on delete cascade,
  borrow_date date not null default current_date,
  due_date date not null,
  return_date date,
  status text not null default 'active' check (status in ('active', 'due-soon', 'overdue', 'returned')),
  notified boolean not null default false,
  condition text,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  role text not null check (role in ('student', 'admin')),
  student_id uuid references students(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  library_name text not null default 'Greenfield College Library',
  borrow_period_days integer not null default 14,
  max_books_per_student integer not null default 3,
  fine_per_day numeric(10,2) not null default 5.00,
  admin_email text not null default 'librarian@greenfield.edu'
);

alter table students disable row level security;
alter table books disable row level security;
alter table library_cards disable row level security;
alter table borrowing_records disable row level security;
alter table app_users disable row level security;
alter table settings disable row level security;

-- Seed students
insert into students (student_code, name, email, course, year_level, status) values
  ('STU-2021-001', 'Maria Santos', 'maria.santos@college.edu', 'BS Computer Science', '4th Year', 'active'),
  ('STU-2021-002', 'Juan dela Cruz', 'juan.delacruz@college.edu', 'BSIT', '4th Year', 'active'),
  ('STU-2022-015', 'Ana Reyes', 'ana.reyes@college.edu', 'BSCS', '3rd Year', 'suspended'),
  ('STU-2023-008', 'Carlo Bautista', 'carlo.bautista@college.edu', 'BSECE', '2nd Year', 'active'),
  ('STU-2023-019', 'Lena Villanueva', 'lena.villanueva@college.edu', 'BSME', '2nd Year', 'active')
on conflict (student_code) do nothing;

-- Seed books
insert into books (book_code, title, author, category, copies, available) values
  ('BK-001', 'Introduction to Algorithms', 'Cormen, Leiserson, Rivest', 'Computer Science', 3, 2),
  ('BK-002', 'The Art of Computer Programming', 'Donald E. Knuth', 'Computer Science', 2, 0),
  ('BK-003', 'Clean Code', 'Robert C. Martin', 'Software Engineering', 4, 3),
  ('BK-004', 'Design Patterns', 'Gang of Four', 'Software Engineering', 2, 1),
  ('BK-005', 'Structure and Interpretation', 'Abelson & Sussman', 'Computer Science', 1, 1),
  ('BK-006', 'Database System Concepts', 'Silberschatz et al.', 'Database', 5, 4),
  ('BK-007', 'Computer Networks', 'Andrew Tanenbaum', 'Networking', 3, 3),
  ('BK-008', 'Operating System Concepts', 'Silberschatz et al.', 'Computer Science', 2, 2)
on conflict (book_code) do nothing;

-- Seed library cards
insert into library_cards (card_no, student_id, issue_date, expiry_date, status)
select 'LC-0042', id, '2025-08-01', '2026-08-01', 'active' from students where student_code = 'STU-2021-001'
on conflict (card_no) do nothing;

insert into library_cards (card_no, student_id, issue_date, expiry_date, status)
select 'LC-0043', id, '2025-08-01', '2026-08-01', 'active' from students where student_code = 'STU-2021-002'
on conflict (card_no) do nothing;

insert into library_cards (card_no, student_id, issue_date, expiry_date, status)
select 'LC-0061', id, '2025-08-01', '2026-08-01', 'suspended' from students where student_code = 'STU-2022-015'
on conflict (card_no) do nothing;

insert into library_cards (card_no, student_id, issue_date, expiry_date, status)
select 'LC-0089', id, '2025-08-01', '2026-08-01', 'active' from students where student_code = 'STU-2023-008'
on conflict (card_no) do nothing;

insert into library_cards (card_no, student_id, issue_date, expiry_date, status)
select 'LC-0104', id, '2025-08-01', '2026-08-01', 'active' from students where student_code = 'STU-2023-019'
on conflict (card_no) do nothing;

-- Seed borrowing records
insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified)
select 'TXN-2025-001', s.id, b.id, '2025-07-25', '2025-08-08', null, 'overdue', true
from students s, books b where s.student_code = 'STU-2021-001' and b.book_code = 'BK-001'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified)
select 'TXN-2025-002', s.id, b.id, '2025-08-01', '2025-08-15', null, 'due-soon', false
from students s, books b where s.student_code = 'STU-2021-002' and b.book_code = 'BK-003'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified)
select 'TXN-2025-003', s.id, b.id, '2025-08-05', '2025-08-19', null, 'active', false
from students s, books b where s.student_code = 'STU-2023-008' and b.book_code = 'BK-004'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified)
select 'TXN-2025-004', s.id, b.id, '2025-08-03', '2025-08-17', null, 'active', false
from students s, books b where s.student_code = 'STU-2023-019' and b.book_code = 'BK-006'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified)
select 'TXN-2025-005', s.id, b.id, '2025-07-10', '2025-07-24', null, 'overdue', false
from students s, books b where s.student_code = 'STU-2022-015' and b.book_code = 'BK-002'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified, condition)
select 'TXN-2025-006', s.id, b.id, '2025-06-01', '2025-06-15', '2025-06-15', 'returned', false, 'Good'
from students s, books b where s.student_code = 'STU-2021-001' and b.book_code = 'BK-008'
on conflict (txn_code) do nothing;

insert into borrowing_records (txn_code, student_id, book_id, borrow_date, due_date, return_date, status, notified, condition)
select 'TXN-2025-007', s.id, b.id, '2025-05-10', '2025-05-22', '2025-05-22', 'returned', false, 'Good'
from students s, books b where s.student_code = 'STU-2021-001' and b.book_code = 'BK-005'
on conflict (txn_code) do nothing;

-- Seed app users (demo passwords)
insert into app_users (email, password, role, student_id)
select 'maria.santos@college.edu', 'password123', 'student', id from students where student_code = 'STU-2021-001'
on conflict (email) do nothing;

insert into app_users (email, password, role, student_id)
select '2021-001', 'password123', 'student', id from students where student_code = 'STU-2021-001'
on conflict (email) do nothing;

insert into app_users (email, password, role, student_id)
values ('librarian@college.edu', 'admin123', 'admin', null)
on conflict (email) do nothing;

insert into settings (id, library_name, borrow_period_days, max_books_per_student, fine_per_day, admin_email)
values (1, 'Greenfield College Library', 14, 3, 5.00, 'librarian@greenfield.edu')
on conflict (id) do nothing;