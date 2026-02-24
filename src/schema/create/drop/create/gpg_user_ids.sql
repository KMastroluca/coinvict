-- UP
CREATE TABLE IF NOT EXISTS gpg_user_ids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  name TEXT,
  email TEXT,
  comment TEXT,
  FOREIGN KEY (fingerprint) REFERENCES gpg_keys(fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_user_email 
ON gpg_user_ids(email);

CREATE INDEX IF NOT EXISTS idx_user_fingerprint 
ON gpg_user_ids(fingerprint);