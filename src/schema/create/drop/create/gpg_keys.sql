-- UP
CREATE TABLE IF NOT EXISTS gpg_keys (
  fingerprint TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  key_size INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  armored_key TEXT NOT NULL,
  latest_seen INTEGER NOT NULL,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_keys_key_id 
ON gpg_keys(key_id);

CREATE INDEX IF NOT EXISTS idx_keys_latest_seen 
ON gpg_keys(latest_seen);