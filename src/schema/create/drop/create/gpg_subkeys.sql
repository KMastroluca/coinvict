-- UP
CREATE TABLE IF NOT EXISTS gpg_subkeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_fingerprint TEXT NOT NULL,
  subkey_fingerprint TEXT NOT NULL,
  algorithm TEXT NOT NULL,
  key_size INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_fingerprint) REFERENCES gpg_keys(fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_subkeys_parent 
ON gpg_subkeys(parent_fingerprint);

CREATE INDEX IF NOT EXISTS idx_subkeys_fingerprint
ON gpg_subkeys(subkey_fingerprint);