import { D1Database } from '@cloudflare/d1';
import { KVNamespace } from '@cloudflare/workers-types';
import crypto from 'crypto';
import { CryptoWorker } from '../workers/cryptoWorker';
import { TreasuryWorker } from '../workers/treasuryWorker';
import { IntentWorker } from '../workers/intentWorker';

interface Block {
  block_number: number;
  previous_block_hash: string;
  minted_amount: number;
  burned_amount: number;
  intents_hash: string;
  app_data_hash: string;
  ephemeral_pubkey: string;
  treasury_sig: string;
  block_hash: string;
}

export async function generateBlock(db: D1Database, kv: KVNamespace) {
  const intentWorker = new IntentWorker(db);
  const cryptoWorker = new CryptoWorker();
  const treasuryWorker = new TreasuryWorker();

  // 1. Fetch unprocessed intents
  const unprocessed = await intentWorker.fetchUnprocessedIntents();
  if (!unprocessed || unprocessed.length === 0) {
    console.log('No new intents to process.');
    return;
  }

  // 2. Compute intentsHash
  const intentsConcat = unprocessed.map(i => JSON.stringify(i)).join('|');
  const intentsHash = crypto.createHash('sha256').update(intentsConcat).digest('hex');

  // 3. Get previous block hash
  const lastBlock = await db.prepare('SELECT block_hash, block_number FROM blockchain ORDER BY block_number DESC LIMIT 1').first();
  const previousBlockHash = lastBlock?.block_hash ?? '0'.repeat(64);
  const nextBlockNumber = (lastBlock?.block_number ?? 0) + 1;

  // 4. Get app_data snapshot and hash
  const appDataRaw = await kv.get('app_data');
  const appDataHash = crypto.createHash('sha256').update(appDataRaw ?? '').digest('hex');

  // 5. Rotate crypto key and get ephemeral pubkey
  cryptoWorker.rotateKey();
  const ephemeralPubKey = cryptoWorker.getPublicKey();

  // 6. Calculate minted and burned totals for this block
  let mintedAmount = 0;
  let burnedAmount = 0;
  for (const intent of unprocessed) {
    if (intent.type === 'mint') mintedAmount += Number(intent.amount);
    if (intent.type === 'burn') burnedAmount += Number(intent.amount);
  }

  // 7. Compute blockHash
  const blockString = previousBlockHash + mintedAmount + burnedAmount + intentsHash + appDataHash + ephemeralPubKey;
  const blockHash = crypto.createHash('sha256').update(blockString).digest('hex');

  // 8. Treasury signs the block
  const treasurySig = treasuryWorker.signBlock(blockHash);

  // 9. Insert block into blockchain table
  const block: Block = {
    block_number: nextBlockNumber,
    previous_block_hash: previousBlockHash,
    minted_amount: mintedAmount,
    burned_amount: burnedAmount,
    intents_hash: intentsHash,
    app_data_hash: appDataHash,
    ephemeral_pubkey: ephemeralPubKey,
    treasury_sig: treasurySig,
    block_hash: blockHash
  };

  await db.prepare(`
    INSERT INTO blockchain (
      block_number,
      previous_block_hash,
      minted_amount,
      burned_amount,
      intents_hash,
      app_data_hash,
      ephemeral_pubkey,
      treasury_sig,
      block_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    block.block_number,
    block.previous_block_hash,
    block.minted_amount,
    block.burned_amount,
    block.intents_hash,
    block.app_data_hash,
    block.ephemeral_pubkey,
    block.treasury_sig,
    block.block_hash
  ).run();

  // 10. Apply intents to MasterLedger
  for (const intent of unprocessed) {
    if (intent.type === 'send' || intent.type === 'mint' || intent.type === 'burn') {
      const existing = await db.prepare('SELECT balance FROM masterledger WHERE wallet_pubkey=?').bind(intent.wallet_pubkey).first();
      let newBalance = BigInt(existing?.balance ?? 0);
      if (intent.type === 'send') newBalance -= BigInt(intent.amount);
      if (intent.type === 'mint') newBalance += BigInt(intent.amount);
      if (intent.type === 'burn') newBalance -= BigInt(intent.amount);
      await db.prepare(`
        INSERT INTO masterledger (wallet_pubkey, balance, last_processed_block)
        VALUES (?, ?, ?)
        ON CONFLICT(wallet_pubkey) DO UPDATE SET
          balance=excluded.balance,
          last_processed_block=excluded.last_processed_block
      `).bind(intent.wallet_pubkey, newBalance.toString(), nextBlockNumber).run();
    }

    // Mark intent as processed
    await intentWorker.markProcessed(intent.id);
  }

  console.log(`Block ${nextBlockNumber} generated: ${blockHash}`);
}