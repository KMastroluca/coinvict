import { KVNamespace } from '@cloudflare/workers-types'; // example for CF Workers KV

export async function initKV(kv: KVNamespace) {
  // Default app_data snapshot
  const initialData = {
    gameVersion: "0.1.0",
    globalSupply: 0,
    totalBurned: 0,
    inGameTokens: {}
  };

  await kv.put('app_data', JSON.stringify(initialData));
  console.log('KV datastore initialized with app_data snapshot.');
}