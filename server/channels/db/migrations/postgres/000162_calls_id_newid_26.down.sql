-- Reverse of 000162: widen the call identifier columns to varchar(32) to
-- accommodate channel-derived ("ch:" + channelID = 29 char) call ids.
-- Kept for parity with the retired 000161 widening; the current schema and
-- code never produce ids longer than 26 chars (model.NewId()).
ALTER TABLE call_jobs DROP CONSTRAINT IF EXISTS fk_call_jobs_callid;
ALTER TABLE call_sessions DROP CONSTRAINT IF EXISTS fk_call_sessions_callid;
ALTER TABLE call_stats DROP CONSTRAINT IF EXISTS fk_call_stats_callid;

ALTER TABLE calls ALTER COLUMN id TYPE varchar(32);
ALTER TABLE call_sessions ALTER COLUMN callid TYPE varchar(32);
ALTER TABLE call_jobs ALTER COLUMN callid TYPE varchar(32);
ALTER TABLE call_stats ALTER COLUMN callid TYPE varchar(32);

ALTER TABLE call_sessions
    ADD CONSTRAINT fk_call_sessions_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
ALTER TABLE call_jobs
    ADD CONSTRAINT fk_call_jobs_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
ALTER TABLE call_stats
    ADD CONSTRAINT fk_call_stats_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE;
