-- Calls: one row per call (a realtime session in a channel).
-- Live state lives in-memory in the calls service; this table is the
-- durability / history record, written on call start and end only.
CREATE TABLE IF NOT EXISTS calls (
    id          varchar(26) NOT NULL PRIMARY KEY,
    channelid   varchar(26) NOT NULL,
    ownerid     varchar(26) NOT NULL,
    postid      varchar(26) NOT NULL DEFAULT '',
    startat     bigint NOT NULL DEFAULT 0,
    endat       bigint NOT NULL DEFAULT 0,
    createat    bigint NOT NULL,
    updateat    bigint NOT NULL,
    CONSTRAINT fk_calls_channelid FOREIGN KEY (channelid) REFERENCES channels(id) ON DELETE CASCADE,
    CONSTRAINT fk_calls_ownerid FOREIGN KEY (ownerid) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_calls_channelid ON calls (channelid);
CREATE INDEX IF NOT EXISTS idx_calls_startat ON calls (startat);
