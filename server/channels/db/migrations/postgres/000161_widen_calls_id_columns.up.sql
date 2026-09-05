-- Widen call identifier columns from varchar(26) to varchar(32).
--
-- Call IDs are derived as "ch:" + channelID (see calls.callIDForChannel) = 29
-- characters, which exceeds the original varchar(26) width and made every
-- INSERT INTO calls fail with:
--   pq: value too long for type character varying(26) (22001)
-- i.e. no call could ever be persisted (call start failed after the insert).
--
-- Widening varchar length limits is a metadata-only change in PostgreSQL (no
-- table rewrite, existing indexes remain valid). The foreign keys from
-- call_sessions / call_jobs / call_stats to calls(id) are dropped and re-added
-- around the type changes because the referenced and referencing columns must
-- be altered together.
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
