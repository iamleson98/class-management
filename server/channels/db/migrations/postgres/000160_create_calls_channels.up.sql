-- Calls channels: per-channel call configuration / defaults.
-- One row per channel that has calls enabled (lazily created on first use).
CREATE TABLE IF NOT EXISTS calls_channels (
    channelid           varchar(26) NOT NULL PRIMARY KEY,
    enabled             boolean NOT NULL DEFAULT TRUE,
    max_participants    integer NOT NULL DEFAULT 0,
    allow_screen_sharing boolean NOT NULL DEFAULT TRUE,
    allow_recording     boolean NOT NULL DEFAULT FALSE,
    createat            bigint NOT NULL,
    updateat            bigint NOT NULL,
    CONSTRAINT fk_calls_channels_channelid FOREIGN KEY (channelid) REFERENCES channels(id) ON DELETE CASCADE
);
