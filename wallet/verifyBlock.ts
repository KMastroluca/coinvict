import crypto from 'crypto';
import fetch from 'node-fetch';

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

// Helper to verify Treasury signature using public key
export function verifyTreasurySignature(blockHash: string, treasuryPubKeyPem: string, treasurySigHex: string): boolean {
  const verify = crypto.createVerify('SHA256');
  verify.update(blockHash);
  verify.end();
  return verify.verify(treasuryPubKeyPem, Buffer.from(treasurySigHex, 'hex'));
}

// Compute block hash deterministically
export function computeBlockHash(block: Omit<Block, 'block_hash' | 'treasury_sig'>): string {
  const blockString =
    block.previous_block_hash +
    block.minted_amount +
    block.burned_amount +
    block.intents_hash +
    block.app_data_hash +
    block.ephemeral_pubkey;
  return crypto.createHash('sha256').update(blockString).digest('hex');
}

// Verify block integrity
export function verifyBlock(block: Block, treasuryPubKeyPem: string): boolean {
  // 1. Verify treasury signature
  const sigValid = verifyTreasurySignature(block.block_hash, treasuryPubKeyPem, block.treasury_sig);
  if (!sigValid) {
    console.error('Treasury signature invalid!');
    return false;
  }

  // 2. Recompute block hash and compare
  const recomputedHash = computeBlockHash({
    block_number: block.block_number,
    previous_block_hash: block.previous_block_hash,
    minted_amount: block.minted_amount,
    burned_amount: block.burned_amount,
    intents_hash: block.intents_hash,
    app_data_hash: block.app_data_hash,
    ephemeral_pubkey: block.ephemeral_pubkey
  });

  if (recomputedHash !== block.block_hash) {
    console.error('Block hash mismatch!');
    return false;
  }

  // 3. Optionally, verify ephemeral key signature if signed (not implemented here)
  // 4. Confirm minted/burned totals and app_data hash if wallet has snapshot

  console.log(`Block ${block.block_number} verified successfully.`);
  return true;
}

// Example: fetch latest block and verify
export async function fetchAndVerifyBlock(apiUrl: string, treasuryPubKeyPem: string) {
  const res = await fetch(`${apiUrl}/latestBlock`);
  const block: Block = await res.json();

  const verified = verifyBlock(block, treasuryPubKeyPem);
  return verified;
}