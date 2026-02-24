interface LedgerWallet {
  wallet_name: string;
  wallet_address: string;
  balance: number;
  network: string;
  metadata?: any;
}

interface LedgerEntryPayload {
  debit_wallet: string;
  credit_wallet: string;
  amount: number;
  network: string;
  intent_type: 'mint' | 'burn' | 'transfer' | 'fee' | 'stake';
  transaction_id: string;
  reason?: string;
  metadata?: any;
}

export class LedgerService {
  env: any;

  constructor(env: any) {
    this.env = env;
  }

  // --- CRUD System Wallets ---
  async createSystemWallet(wallet_name: string, wallet_address: string, network: string, metadata?: any) {
    await this.env.D1.prepare(
      'INSERT INTO system_wallets (wallet_name, wallet_address, balance, network, metadata) VALUES (?, ?, ?, ?, ?)',
      [wallet_name, wallet_address, 0, network, JSON.stringify(metadata || {})]
    ).run();
  }

  async getSystemWallet(wallet_name: string, network?: string): Promise<LedgerWallet | null> {
    const res = await this.env.D1.prepare(
      network
        ? 'SELECT * FROM system_wallets WHERE wallet_name = ? AND network = ?'
        : 'SELECT * FROM system_wallets WHERE wallet_name = ?',
      network ? [wallet_name, network] : [wallet_name]
    ).first();
    return res ? { ...res } : null;
  }

  // --- Apply Credit / Debit ---
  async credit(wallet_address: string, amount: number) {
    await this.env.D1.prepare(
      'UPDATE system_wallets SET balance = balance + ? WHERE wallet_address = ?',
      [amount, wallet_address]
    ).run();
  }

  async debit(wallet_address: string, amount: number) {
    const wallet = await this.env.D1.prepare('SELECT balance FROM system_wallets WHERE wallet_address = ?', [wallet_address]).first();
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient balance');
    await this.env.D1.prepare(
      'UPDATE system_wallets SET balance = balance - ? WHERE wallet_address = ?',
      [amount, wallet_address]
    ).run();
  }

  // --- Record Ledger Entry ---
  async recordLedgerEntry(payload: LedgerEntryPayload, block_height: number) {
    await this.env.D1.prepare(
      `INSERT INTO public_ledger 
        (entry_id, block_height, timestamp, network, debit_wallet, credit_wallet, amount, intent_type, transaction_id, reason, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.transaction_id,
        block_height,
        Date.now(),
        payload.network,
        payload.debit_wallet,
        payload.credit_wallet,
        payload.amount,
        payload.intent_type,
        payload.transaction_id,
        payload.reason || null,
        JSON.stringify(payload.metadata || {})
      ]
    ).run();
  }

  // --- Convenience Functions ---
  async applyMint(toWallet: string, amount: number, network: string, transaction_id: string, reason?: string) {
    const systemWallet = await this.getSystemWallet('treasury', network);
    await this.debit(systemWallet.wallet_address, amount);
    await this.credit(toWallet, amount);
    await this.recordLedgerEntry({
      debit_wallet: systemWallet.wallet_address,
      credit_wallet: toWallet,
      amount,
      network,
      intent_type: 'mint',
      transaction_id,
      reason
    }, await this.getCurrentBlockHeight());
  }

  async applyBurn(fromWallet: string, amount: number, network: string, transaction_id: string, reason?: string) {
    const burnWallet = await this.getSystemWallet('burn', network);
    await this.debit(fromWallet, amount);
    await this.credit(burnWallet.wallet_address, amount);
    await this.recordLedgerEntry({
      debit_wallet: fromWallet,
      credit_wallet: burnWallet.wallet_address,
      amount,
      network,
      intent_type: 'burn',
      transaction_id,
      reason
    }, await this.getCurrentBlockHeight());
  }

  async applyFee(fromWallet: string, amount: number, network: string, transaction_id: string, reason?: string) {
    const feeWallet = await this.getSystemWallet('tx_fee', network);
    await this.debit(fromWallet, amount);
    await this.credit(feeWallet.wallet_address, amount);
    await this.recordLedgerEntry({
      debit_wallet: fromWallet,
      credit_wallet: feeWallet.wallet_address,
      amount,
      network,
      intent_type: 'fee',
      transaction_id,
      reason
    }, await this.getCurrentBlockHeight());
  }

  async applyStakeReward(toWallet: string, amount: number, network: string, transaction_id: string, reason?: string) {
    const stakeWallet = await this.getSystemWallet('staking', network);
    await this.debit(stakeWallet.wallet_address, amount);
    await this.credit(toWallet, amount);
    await this.recordLedgerEntry({
      debit_wallet: stakeWallet.wallet_address,
      credit_wallet: toWallet,
      amount,
      network,
      intent_type: 'stake',
      transaction_id,
      reason
    }, await this.getCurrentBlockHeight());
  }

  // Stub: get current block height
  async getCurrentBlockHeight(): Promise<number> {
    const h = await this.env.KV.get('last_block_height');
    return h ? parseInt(h) : 0;
  }
}