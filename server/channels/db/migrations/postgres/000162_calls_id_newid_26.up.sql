-- Call IDs return to the project-wide 26-char identity convention.
--
-- Call rows are persisted with fresh model.NewId() ids (26 chars), exactly
-- like every other model row (channels.id, posts.id, users.id ...). The
-- historical derivation "ch:" + channelID (29 chars) that motivated the
-- varchar(32) widening in migration 000161 is gone: the channel -> live-call
-- relationship is in-memory runtime state (mirroring the Mattermost Calls
-- plugin, whose channel-keyed call identity never touches an ID column).
--
-- This migration converges every database to varchar(26):
--   * DBs that never ran 000161 are already varchar(26) (no-op ALTERs).
--   * DBs that ran 000161 are narrowed back. Rows with >26-char ids can only
--     exist from that window; they are removed first so the narrowing cannot
--     fail. (Calls are transient history; the affected rows date from the
--     broken-generation window at most.)
ALTER TABLE call_jobs DROP CONSTRAINT IF EXISTS fk_call_jobs_callid;
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS fk_call_sessions_callid;
ALTER TABLE call_stats DROP CONSTRAINT IF EXISTS fk_call_stats_callid;

DELETE FROM call_stats  WHERE length(callid) > 26;
DELETE FROM call_jobs   WHERE length(callid) > 26;
DELETE FROM call_sessions WHERE length(callid) > 26;
DELETE FROM calls WHERE length(id) > 26;

ALTER TABLE calls ALTER COLUMN id TYPE varchar(26);
ALTER TABLE call_sessions ALTER COLUMN callid TYPE varchar(26);
ALTER TABLE call_jobs ALTER COLUMN callid TYPE varchar(26);
ALTER TABLE call_stats ALTER COLUMN callid TYPE varchar(26);

ALTER TABLE call_sessions
    ADD CONSTRAINT fk_call_sessions_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
ALTER TABLE call_jobs
    ADD CONSTRAINT fk_call_jobs_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
ALTER TABLE call_stats
    ADD CONSTRAINT fk_call_stats_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
