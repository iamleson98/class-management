-- Restores the constraint dropped by 000164. Requires every lesson_id to be
-- a valid course_lessons.id (or NULL); sessions created without a lesson
-- ('' sentinel) must be re-linked or deleted first — the ALTER fails loudly
-- otherwise, which is the desired guardrail.
ALTER TABLE lms_sessions
    ADD CONSTRAINT IF NOT EXISTS fk_lesson_id FOREIGN KEY (lesson_id) REFERENCES course_lessons(id) ON DELETE SET NULL;
