-- The admin session form has no lesson picker: lesson_id arrives as ''.
-- The fk_lesson_id constraint has therefore been rejecting every
-- lms_sessions INSERT ('' is not a valid course_lessons.id), on top of the
-- wire-format 400 the date parsing produced. Drop the FK — '' stays as the
-- "no lesson" sentinel (the column keeps its NOT NULL).
-- Re-add the constraint only when lesson selection ships, after backfilling
-- or nulling the '' rows.
ALTER TABLE lms_sessions DROP CONSTRAINT IF EXISTS fk_lesson_id;
