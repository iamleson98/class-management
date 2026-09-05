-- Narrow call identifier columns back to varchar(26).
-- Only safe when no rows carry a 27+ character call ID ("ch:" + channelID);
-- reverting on a database with such rows fails (value too long), which is the
-- intended guard.
ALTER TABLE call_jobs DROP CONSTRAINT IF EXISTS fk_call_jobs_callid;
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS fk_call_sessions_callid;
ALTER TABLE call_stats DROP CONSTRAINT IF EXISTS fk_call_stats_callid;

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
