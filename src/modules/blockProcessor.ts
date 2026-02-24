// block-processor.ts
import { verifySignature, generateNextBlockKey } from './crypto-utils';

interface Intent {
  id: string;
  type: string;
  payload: any;
  signer_pub: string;
  signature: string;
  created_at: number;
}

interface WalletState {
  [walletAddress: string]: { balance: number; network: string; owner_pub: string };
}

interface LedgerEntry {
  id: string;
  type: string;
  wallet_from?: string;
  wallet_to?: string;
  amount: number;
  network: string;
  block_id: string;
  timestamp: number;
  metadata?: any;
}

export class BlockProcessor {
  env: any;

  constructor(env: any) { this.env = env; }

  // --- Process all pending intents into a new block ---
  async processBlock() {
    // 1️⃣ Load active block key
    const activeKeyRaw = await this.env.KV.get('active_block_key');
    if (!activeKeyRaw) throw new Error('No active block key');
    const activeKey = JSON.parse(activeKeyRaw);

    // 2️⃣ Fetch pending intents
    const intentsRes = await this.env.D1.prepare('SELECT * FROM intents ORDER BY created_at ASC').all();
    const intents: Intent[] = intentsRes.results;

    if (!intents.length) return null; // nothing to process

    // 3️⃣ Load current wallet state
    const walletRes = await this.env.D1.prepare('SELECT * FROM wallets').all();
    const walletState: WalletState = {};
    for (const w of walletRes.results) {
      walletState[w.wallet_address] = { balance: w.balance, network: w.network, owner_pub: w.owner_pub };
    }

    // 4️⃣ Process intents
    const ledgerEntries: LedgerEntry[] = [];
    for (const intent of intents) {
      if (!verifySignature(activeKey.pub, JSON.stringify(intent.payload), intent.signature)) {
        console.warn(`Intent ${intent.id} invalid signature, skipping`);
        continue;
      }

      switch(intent.type) {
        case 'mint':
          walletState[intent.payload.wallet].balance += intent.payload.amount;
          ledgerEntries.push({
            id: intent.id,
            type: 'mint',
            wallet_to: intent.payload.wallet,
            amount: intent.payload.amount,
            network: intent.payload.network,
            block_id: '', // filled later
            timestamp: Date.now(),
            metadata: { reason: intent.payload.reason }
          });
          break;

        case 'burn':
          walletState[intent.payload.wallet].balance -= intent.payload.amount;
          ledgerEntries.push({
            id: intent.id,
            type: 'burn',
            wallet_from: intent.payload.wallet,
            amount: intent.payload.amount,
            network: intent.payload.network,
            block_id: '',
            timestamp: Date.now(),
            metadata: { reason: intent.payload.reason }
          });
          break;

        case 'transfer':
          walletState[intent.payload.from].balance -= intent.payload.amount;
          walletState[intent.payload.to].balance += intent.payload.amount;
          ledgerEntries.push({
            id: intent.id,
            type: 'transfer',
            wallet_from: intent.payload.from,
            wallet_to: intent.payload.to,
            amount: intent.payload.amount,
            network: intent.payload.network,
            block_id: '',
            timestamp: Date.now(),
            metadata: { reason: intent.payload.reason }
          });
          break;

        case 'fee':
          walletState[intent.payload.wallet].balance -= intent.payload.amount;
          // send to transaction fee wallet
          walletState['tx_fee_wallet'] = walletState['tx_fee_wallet'] || { balance:0, network: intent.payload.network, owner_pub: 'SYSTEM' };
          walletState['tx_fee_wallet'].balance += intent.payload.amount;
          ledgerEntries.push({
            id: intent.id,
            type: 'fee',
            wallet_from: intent.payload.wallet,
            wallet_to: 'tx_fee_wallet',
            amount: intent.payload.amount,
            network: intent.payload.network,
            block_id: '',
            timestamp: Date.now(),
            metadata: { reason: intent.payload.reason }
          });
          break;

        case 'stake':
          walletState[intent.payload.wallet].balance += intent.payload.amount;
          ledgerEntries.push({
            id: intent.id,
            type: 'stake',
            wallet_to: intent.payload.wallet,
            amount: intent.payload.amount,
            network: intent.payload.network,
            block_id: '',
            timestamp: Date.now(),
            metadata: { reason: intent.payload.reason }
          });
          break;

        case 'claim_balance':
          // optional claim logic; depends on your app rules
          ledgerEntries.push({
            id: intent.id,
            type: 'claim_balance',
            wallet_to: intent.payload.wallet,
            amount: intent.payload.claimed_balance,
            network: intent.payload.network,
            block_id: '',
            timestamp: Date.now(),
            metadata: {}
          });
          break;

        default:
          console.warn(`Unknown intent type ${intent.type}`);
          continue;
      }
    }

    // 5️⃣ Apply wallet state changes to D1
    const tx = this.env.D1.prepare('BEGIN');
    for (const [addr, w] of Object.entries(walletState)) {
      await this.env.D1.prepare('UPDATE wallets SET balance=? WHERE wallet_address=?', [w.balance, addr]).run();
    }
    await this.env.D1.prepare('COMMIT').run();

    // 6️⃣ Insert ledger entries with block_id
    const blockId = uuidv4();
    for (const entry of ledgerEntries) {
      entry.block_id = blockId;
      await this.env.D1.prepare(
        'INSERT INTO public_ledger (id, type, wallet_from, wallet_to, amount, network, block_id, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [entry.id, entry.type, entry.wallet_from, entry.wallet_to, entry.amount, entry.network, entry.block_id, entry.timestamp, JSON.stringify(entry.metadata)]
      ).run();
    }

    // 7️⃣ Delete processed intents
    await this.env.D1.prepare('DELETE FROM intents').run();

    // 8️⃣ Rotate block key
    const nextKeypair = generateNextBlockKey(activeKey);
    await this.env.KV.put('active_block_key', JSON.stringify(nextKeypair));

    return { block_id: blockId, processed_intents: intents.length, ledger_entries: ledgerEntries.length };
  }
}