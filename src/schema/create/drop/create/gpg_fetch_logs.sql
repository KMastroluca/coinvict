-- UP
CREATE TABLE IF NOT EXISTS gpg_fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT,
  fetched_at INTEGER NOT NULL,
  source TEXT,
  status TEXT
);

CREATE INDEX IF NOT EXISTS idx_fetch_fingerprint 
ON gpg_fetch_log(fingerprint);

CREATE INDEX IF NOT EXISTS idx_fetch_time 
ON gpg_fetch_log(fetched_at);