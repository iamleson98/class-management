-- Call jobs: recording / transcription / live-captions jobs. A job corresponds
-- to a bot user joining the call as a participant; rtcd sends the bot a mixed
-- stream that the job captures (e.g. via ffmpeg). props holds job-specific data
-- as JSON.
CREATE TABLE IF NOT EXISTS call_jobs (
    id          varchar(26) NOT NULL PRIMARY KEY,
    callid      varchar(26) NOT NULL,
    type        varchar(50) NOT NULL,
    startat     bigint NOT NULL DEFAULT 0,
    endat       bigint NOT NULL DEFAULT 0,
    props       text NOT NULL DEFAULT '',
    err         text NOT NULL DEFAULT '',
    createat    bigint NOT NULL,
    updateat    bigint NOT NULL,
    CONSTRAINT fk_call_jobs_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_call_jobs_callid ON call_jobs (callid);
CREATE INDEX IF NOT EXISTS idx_call_jobs_type ON call_jobs (type);
