import { serve } from 'std/server'; // Deno/Cloudflare Workers style
import { D1Database } from '@cloudflare/d1';
import { KVNamespace } from '@cloudflare/workers-types';
import { AuthWorker } from './workers/authWorker';
import { IntentWorker } from './workers/intentWorker';
import { generateBlock } from './cron/generateBlock';

// These will be bound via environment in Cloudflare Workers
declare const COINVIC_D1: D1Database;
declare const COINVIC_KV: KVNamespace;

// Initialize workers
const authWorker = new AuthWorker(COINVIC_D1);
const intentWorker = new IntentWorker(COINVIC_D1);

async function startupInit() {
	  try {
    // Check if blockchain table has data
    const blockCount = await COINVIC_D1.prepare('SELECT COUNT(*) AS cnt FROM blockchain').first();
    if (!blockCount || Number(blockCount.cnt) === 0) {
      console.log('Blockchain table empty, running D1 init...');
      await initD1(COINVIC_D1);
    } else {
      console.log('D1 tables exist with data.');
    }

    // Check if KV app_data exists
    const appDataExists = await COINVIC_KV.get('app_data');
    if (!appDataExists) {
      console.log('KV app_data missing, initializing...');
      await initKV(COINVIC_KV);
    } else {
      console.log('KV app_data exists.');
    }

  } catch (err) {
    console.error('Startup init failed:', err);
    throw err;
  }
}


startupInit().then(() => console.log('Startup check complete.'));


serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  try {
    if (path === '/submitIntent' && method === 'POST') {
      const intent = await req.json();
      await authWorker.insertIntent(intent);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (path === '/latestBlock' && method === 'GET') {
      const block = await COINVIC_D1.prepare(`
        SELECT * FROM blockchain ORDER BY block_number DESC LIMIT 1
      `).first();
      return new Response(JSON.stringify(block), { status: 200 });
    }

    if (path === '/masterLedger' && method === 'GET') {
      const ledger = await COINVIC_D1.prepare('SELECT wallet_pubkey, balance FROM masterledger').all();
      return new Response(JSON.stringify(ledger), { status: 200 });
    }

    if (path === '/app_data' && method === 'GET') {
      const appDataRaw = await COINVIC_KV.get('app_data');
      const appData = appDataRaw ? JSON.parse(appDataRaw) : {};
      return new Response(JSON.stringify(appData), { status: 200 });
    }

    if (path === '/generateBlock' && method === 'POST') {
      // trigger block generation manually (or via cron)
      await generateBlock(COINVIC_D1, COINVIC_KV);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response('Not Found', { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});