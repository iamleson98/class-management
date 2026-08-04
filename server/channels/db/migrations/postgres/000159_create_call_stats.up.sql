-- Call stats: one aggregate row per completed call. Written once at call end
-- (or asynchronously by a cleanup job) for historical reporting. Cheap to write,
-- never updated in the live (hot) path.
CREATE TABLE IF NOT EXISTS call_stats (
    id                  varchar(26) NOT NULL PRIMARY KEY,
    callid              varchar(26) NOT NULL,
    channelid           varchar(26) NOT NULL,
    participants        integer NOT NULL DEFAULT 0,
    peak_participants   integer NOT NULL DEFAULT 0,
    duration_seconds    integer NOT NULL DEFAULT 0,
    createat            bigint NOT NULL,
    CONSTRAINT fk_call_stats_callid FOREIGN KEY (callid) REFERENCES calls(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_call_stats_channelid ON call_stats (channelid);
CREATE INDEX IF NOT EXISTS idx_call_stats_createat ON call_stats (createat);
