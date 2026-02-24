import fetch from 'node-fetch';
import crypto from 'crypto';
import { verifyBlock, computeBlockHash } from './verifyBlock';

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

interface LedgerEntry {
  wallet_pubkey: string;
  balance: bigint;
}

interface WalletState {
  lastBlockNumber: number;
  ledger: Map<string, bigint>;
  appData: any;
}

export class WalletSync {
  apiUrl: string;
  treasuryPubKeyPem: string;
  state: WalletState;

  constructor(apiUrl: string, treasuryPubKeyPem: string) {
    this.apiUrl = apiUrl;
    this.treasuryPubKeyPem = treasuryPubKeyPem;
    this.state = {
      lastBlockNumber: 0,
      ledger: new Map(),
      appData: {}
    };
  }

  async fetchLatestBlock(): Promise<Block> {
    const res = await fetch(`${this.apiUrl}/latestBlock`);
    const block: Block = await res.json();
    return block;
  }

  async fetchMasterLedger(): Promise<LedgerEntry[]> {
    const res = await fetch(`${this.apiUrl}/masterLedger`);
    const ledger: LedgerEntry[] = await res.json();
    return ledger;
  }

  async fetchAppData(): Promise<any> {
    const res = await fetch(`${this.apiUrl}/app_data`);
    return res.json();
  }

  async sync() {
    const latestBlock = await this.fetchLatestBlock();

    if (latestBlock.block_number <= this.state.lastBlockNumber) {
      console.log('Already synced to latest block.');
      return;
    }

    // 1. Verify block
    const verified = verifyBlock(latestBlock, this.treasuryPubKeyPem);
    if (!verified) {
      throw new Error(`Block ${latestBlock.block_number} verification failed!`);
    }

    // 2. Fetch latest ledger and update local balances
    const ledgerEntries = await this.fetchMasterLedger();
    for (const entry of ledgerEntries) {
      this.state.ledger.set(entry.wallet_pubkey, BigInt(entry.balance));
    }

    // 3. Fetch latest app_data snapshot
    const appData = await this.fetchAppData();
    this.state.appData = appData;

    // 4. Update last synced block
    this.state.lastBlockNumber = latestBlock.block_number;

    console.log(`Wallet synced to block ${latestBlock.block_number}.`);
  }

  getBalance(walletPubKey: string): bigint {
    return this.state.ledger.get(walletPubKey) ?? 0n;
  }
}