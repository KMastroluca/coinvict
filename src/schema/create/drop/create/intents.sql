CREATE TABLE intents (
  id TEXT PRIMARY KEY,             -- could be transaction_id
  type TEXT NOT NULL,              -- "mint", "burn", etc.
  payload JSON NOT NULL,
  signer_pub TEXT NOT NULL,        -- TreasuryService public key
  signature TEXT NOT NULL,         -- cryptographic signature
  created_at INTEGER NOT NULL      -- timestamp
);