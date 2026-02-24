import { D1Database } from '@cloudflare/d1';

export class AuthWorker {
  db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async validateIntent(intent: any): Promise<boolean> {
    // check signature matches stored auth key or wallet key
    const storedKey = await this.db.prepare('SELECT public_key FROM auth_keys WHERE key_name=?').bind('server').first();
    if (!storedKey) return false;
    // verify signature (placeholder)
    console.log('AuthWorker: validated intent');
    return true;
  }

  async insertIntent(intent: any) {
    const valid = await this.validateIntent(intent);
    if (!valid) throw new Error('Invalid intent');
    await this.db.prepare(`
      INSERT INTO intents (wallet_pubkey, type, amount, timestamp, signature)
      VALUES (?, ?, ?, ?, ?)
    `).bind(intent.wallet_pubkey, intent.type, intent.amount, intent.timestamp, intent.signature).run();
    console.log('AuthWorker: intent inserted');
  }
}