CREATE TABLE public_ledger (
    entry_id TEXT PRIMARY KEY,       -- unique ID for this ledger entry
    block_height INTEGER NOT NULL,   -- the block this entry belongs to
    timestamp INTEGER NOT NULL,      -- when the entry was created
    network TEXT NOT NULL,           -- "TON", "SOL", "CUSTOM"
    
    debit_wallet TEXT NOT NULL,      -- wallet sending the coins
    credit_wallet TEXT NOT NULL,     -- wallet receiving the coins
    amount INTEGER NOT NULL,         -- coin amount
    
    intent_type TEXT NOT NULL,       -- mint, burn, transfer
    transaction_id TEXT NOT NULL,    -- original intent transaction ID
    reason TEXT,                     -- optional reason code
    metadata JSON                    -- optional extra info
);