CREATE TABLE system_wallets (
    wallet_name TEXT PRIMARY KEY,     -- liquidity, burn, tx_fee, staking
    wallet_address TEXT NOT NULL,     -- internal chain wallet address
    balance INTEGER DEFAULT 0,
    network TEXT NOT NULL,            -- TON, SOL, CUSTOM
    metadata JSON
);