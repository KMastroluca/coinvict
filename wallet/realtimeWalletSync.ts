import { WalletSync } from './walletSync';

type WalletSyncEvents = {
  onNewBlock?: (blockNumber: number) => void;
  onBalanceUpdate?: (walletPubKey: string, newBalance: bigint) => void;
  onAppDataUpdate?: (appData: any) => void;
};

export class RealtimeWalletSync {
  walletSync: WalletSync;
  events: WalletSyncEvents;
  pollIntervalMs: number;
  private polling: boolean = false;

  constructor(walletSync: WalletSync, events: WalletSyncEvents = {}, pollIntervalMs: number = 5000) {
    this.walletSync = walletSync;
    this.events = events;
    this.pollIntervalMs = pollIntervalMs;
  }

  async start() {
    if (this.polling) return;
    this.polling = true;
    console.log('RealtimeWalletSync started.');
    while (this.polling) {
      try {
        const previousBlock = this.walletSync.state.lastBlockNumber;
        await this.walletSync.sync();
        const latestBlock = this.walletSync.state.lastBlockNumber;

        if (latestBlock > previousBlock && this.events.onNewBlock) {
          this.events.onNewBlock(latestBlock);
        }

        // Fire balance updates for all wallets
        if (this.events.onBalanceUpdate) {
          for (const [walletPubKey, balance] of this.walletSync.state.ledger.entries()) {
            this.events.onBalanceUpdate(walletPubKey, balance);
          }
        }

        // Fire app_data update
        if (this.events.onAppDataUpdate) {
          this.events.onAppDataUpdate(this.walletSync.state.appData);
        }

      } catch (err) {
        console.error('RealtimeWalletSync error:', err);
      }

      await new Promise(res => setTimeout(res, this.pollIntervalMs));
    }
  }

  stop() {
    this.polling = false;
    console.log('RealtimeWalletSync stopped.');
  }
}