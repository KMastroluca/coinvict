import { v4 as uuidv4 } from 'uuid';
import { signData } from './crypto-utils';

interface Wallet {
  wallet_address: string;
  owner_pub: string;
  balance: number;
  network: string;
  metadata?: any;
}

interface IntentPayload {
  from?: string;
  to?: string;
  wallet?: string;
  amount: number;
  network: string;
  transaction_id: string;
  reason?: string;
  metadata?: any;
}

export class WalletAuthority {
  env: any;

  constructor(env: any) { this.env = env; }

  // --- Wallet CRUD ---
  async createWallet(owner_pub: string, network: 'TON' | 'SOL' | 'CUSTOM', wallet_address?: string, metadata?: any) {
    const address = wallet_address || await this.generateWalletAddress(owner_pub, network);
    const now = Date.now();

    await this.env.D1.prepare(
      'INSERT INTO wallets (wallet_address, owner_pub, network, balance, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [address, owner_pub, network, 0, now, JSON.stringify(metadata || {})]
    ).run();

    return address;
  }

  async loadWallet(wallet_address: string, network?: string): Promise<Wallet | null> {
    const res = await this.env.D1.prepare(
      network
        ? 'SELECT * FROM wallets WHERE wallet_address = ? AND network = ?'
        : 'SELECT * FROM wallets WHERE wallet_address = ?',
      network ? [wallet_address, network] : [wallet_address]
    ).first();
    return res ? { ...res } : null;
  }

  async getBalance(wallet_address: string, network?: string): Promise<number> {
    const wallet = await this.loadWallet(wallet_address, network);
    return wallet?.balance || 0;
  }

  async destroyWallet(wallet_address: string) {
    await this.env.D1.prepare('DELETE FROM wallets WHERE wallet_address = ?', [wallet_address]).run();
  }

  async generateWalletAddress(owner_pub: string, network: string) {
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner_pub + network));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
    return `${network}:${hashHex}`;
  }

  // --- Queue intent + sign per active block key ---
  private async queueIntent(type: string, payload: any, signer_pub: string) {
    const transaction_id = payload.transaction_id || uuidv4();
    payload.transaction_id = transaction_id;

    const activeKeyRaw = await this.env.KV.get('active_block_key');
    if (!activeKeyRaw) throw new Error('Active block key not found');
    const activeKey = JSON.parse(activeKeyRaw);

    const signature = await signData(activeKey.priv, JSON.stringify(payload));

    await this.env.D1.prepare(
      'INSERT INTO intents (id, type, payload, signer_pub, signature, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [transaction_id, type, JSON.stringify(payload), signer_pub, signature, Date.now()]
    ).run();

    return transaction_id;
  }

  // --- User Operations ---
  async send(from: string, to: string, amount: number, network: string, reason?: string) {
    const fromWallet = await this.loadWallet(from, network);
    const toWallet = await this.loadWallet(to, network);
    if (!fromWallet || !toWallet) throw new Error('Wallet not found');
    if (fromWallet.balance < amount) throw new Error('Insufficient balance');

    return this.queueIntent('transfer', { from, to, amount, network, reason }, fromWallet.owner_pub);
  }

  async mint(to: string, amount: number, network: string, reason?: string) {
    return this.queueIntent('mint', { wallet: to, amount, network, reason }, 'SYSTEM');
  }

  async burn(from: string, amount: number, network: string, reason?: string) {
    const wallet = await this.loadWallet(from, network);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.balance < amount) throw new Error('Insufficient balance');

    return this.queueIntent('burn', { wallet: from, amount, network, reason }, wallet.owner_pub);
  }

  async fee(from: string, amount: number, network: string, reason?: string) {
    const wallet = await this.loadWallet(from, network);
    if (!wallet) throw new Error('Wallet not found');

    return this.queueIntent('fee', { wallet: from, amount, network, reason }, wallet.owner_pub);
  }

  async stakeReward(to: string, amount: number, network: string, reason?: string) {
    return this.queueIntent('stake', { wallet: to, amount, network, reason }, 'SYSTEM');
  }

  async claimBalance(wallet_address: string, claimed_balance: number, network: string, transaction_id?: string) {
    const wallet = await this.loadWallet(wallet_address, network);
    if (!wallet) throw new Error('Wallet not found');

    return this.queueIntent('claim_balance', { wallet: wallet_address, claimed_balance, network, transaction_id }, wallet.owner_pub);
  }
}