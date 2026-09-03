-- Run this in the Supabase SQL Editor to normalize legacy student users to the student-ID model.
-- This updates students, app_users, and auth.users to use a generated SJB email based on student_code.

WITH student_emails AS (
  SELECT
    id,
    lower(
      regexp_replace(
        COALESCE(student_code, ''),
        '^STU-',
        '',
        'i'
      ) || '@sjbcnl.local'
    ) AS derived_email
  FROM public.students
  WHERE student_code IS NOT NULL
    AND trim(student_code) <> ''
)
UPDATE public.students s
SET email = se.derived_email
FROM student_emails se
WHERE s.id = se.id
  AND s.email IS DISTINCT FROM se.derived_email;

WITH student_matches AS (
  SELECT
    au.id AS app_user_id,
    s.id AS student_id,
    lower(regexp_replace(s.student_code, '^STU-', '', 'i') || '@sjbcnl.local') AS derived_email
  FROM public.app_users au
  JOIN public.students s
    ON au.student_id = s.id
    OR lower(au.email) = lower(s.email)
    OR lower(au.email) = lower(regexp_replace(s.student_code, '^STU-', '', 'i') || '@sjbcnl.local')
)
UPDATE public.app_users au
SET
  email = sm.derived_email,
  student_id = sm.student_id,
  role = COALESCE(au.role, 'student')
FROM student_matches sm
WHERE au.id = sm.app_user_id
  AND (
    au.email IS DISTINCT FROM sm.derived_email
    OR au.student_id IS DISTINCT FROM sm.student_id
    OR au.role IS DISTINCT FROM COALESCE(au.role, 'student')
  );

WITH student_matches AS (
  SELECT
    au.id AS app_user_id,
    lower(regexp_replace(s.student_code, '^STU-', '', 'i') || '@sjbcnl.local') AS derived_email
  FROM public.app_users au
  JOIN public.students s
    ON au.student_id = s.id
    OR lower(au.email) = lower(s.email)
    OR lower(au.email) = lower(regexp_replace(s.student_code, '^STU-', '', 'i') || '@sjbcnl.local')
)
UPDATE auth.users au
SET email = sm.derived_email
FROM student_matches sm
WHERE au.id = sm.app_user_id
  AND au.email IS DISTINCT FROM sm.derived_email;

-- Optional: if any app user is still missing a student match, but has an email that looks like a student account,
-- this will try to associate it with a matching student row by student_code in the email.
UPDATE public.app_users au
SET student_id = s.id,
    email = lower(regexp_replace(s.student_code, '^STU-', '', 'i') || '@sjbcnl.local')
FROM public.students s
WHERE au.student_id IS NULL
  AND lower(au.email) LIKE '%@sjbcnl.local'
  AND lower(split_part(au.email, '@', 1)) = lower(regexp_replace(s.student_code, '^STU-', '', 'i'));

-- Final sanity check
SELECT
  s.id,
  s.student_code,
  s.email AS student_email,
  au.email AS app_user_email,
  au.student_id
FROM public.students s
LEFT JOIN public.app_users au ON au.student_id = s.id
ORDER BY s.student_code;
