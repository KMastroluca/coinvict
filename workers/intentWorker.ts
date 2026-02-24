import { D1Database } from '@cloudflare/d1';

export class IntentWorker {
  db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async fetchUnprocessedIntents() {
    return this.db.prepare('SELECT * FROM intents WHERE processed=0 ORDER BY timestamp ASC').all();
  }

  async markProcessed(intentId: number) {
    await this.db.prepare('UPDATE intents SET processed=1 WHERE id=?').bind(intentId).run();
  }
}