-- Call sessions: one row per participant per call, written on join and on leave.
-- Transient presence (mute / voice / screen / video) is NOT persisted; only the
-- join/leave boundaries are recorded here for attendance history.
CREATE TABLE IF NOT EXISTS call_sessions (
    id          varchar(26) NOT NULL PRIMARY KEY,
    callid      varchar(26) NOT NULL,
    userid      varchar(26) NOT NULL,
    connid      varchar(26) NOT NULL,
    startat     bigint NOT NULL DEFAULT 0,
    endat       bigint NOT NULL DEFAULT 0,
    createat    bigint NOT NULL,
    updateat    bigint NOT NULL,
    CONSTRAINT fk_call_sessions_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE,
    CONSTRAINT fk_call_sessions_userid FOREIGN KEY (userid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_call_sessions_callid ON call_sessions (callid);
CREATE INDEX IF NOT EXISTS idx_call_sessions_userid ON call_sessions (userid);
