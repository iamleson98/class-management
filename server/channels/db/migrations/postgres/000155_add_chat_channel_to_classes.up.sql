-- Adds a link from each LMS class to its auto-provisioned chat channel.
-- Empty by default; populated by the LMS app layer when a class channel is
-- provisioned in the "teaching" team. Allows class lifecycle (create / enroll /
-- close) to stay in sync with chat without re-resolving the channel by name.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS chat_channel_id varchar(26) NOT NULL DEFAULT '';
