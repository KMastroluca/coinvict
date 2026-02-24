CREATE TABLE wallets (
  wallet_address TEXT PRIMARY KEY,  -- full address including network prefix
  owner_pub TEXT NOT NULL,          -- owner public key for signing
  network TEXT NOT NULL,            -- e.g., "TON", "SOL", "CUSTOM"
  created_at INTEGER NOT NULL,
  balance INTEGER DEFAULT 0,
  metadata JSON
);