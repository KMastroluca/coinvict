import { D1Database } from '@cloudflare/d1'; // example import

export async function initD1(db: D1Database) {
  // Intents Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS intents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_pubkey TEXT NOT NULL,
      type TEXT NOT NULL,
      amount BIGINT,
      timestamp BIGINT NOT NULL,
      signature TEXT NOT NULL,
      processed BOOLEAN DEFAULT FALSE
    );
  `);

  // MasterLedger Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS masterledger (
      wallet_pubkey TEXT PRIMARY KEY,
      balance BIGINT DEFAULT 0,
      last_processed_block INTEGER DEFAULT 0
    );
  `);

  // Auth Key Pairs Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS auth_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_name TEXT UNIQUE,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL
    );
  `);

  // BlockChain Table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS blockchain (
      block_number INTEGER PRIMARY KEY,
      previous_block_hash TEXT,
      minted_amount BIGINT,
      burned_amount BIGINT,
      intents_hash TEXT,
      app_data_hash TEXT,
      ephemeral_pubkey TEXT,
      treasury_sig TEXT,
      block_hash TEXT
    );
  `);

  console.log('D1 database initialized.');
}