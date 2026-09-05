-- Optional planned end date for a class ("hết thời gian của lớp học").
-- Backs the session-create repeat option "lặp lại hàng tuần cho đến hết
-- thời gian của lớp học": the expansion runs from the session date to this
-- date inclusive. NULL = open-ended class (the UI falls back to a custom
-- repeat-until date for those).
ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_date DATE NULL;
