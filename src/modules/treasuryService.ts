import { WalletAuthority } from './wallet-authority';
import { createHmac } from 'crypto';

export default {
  async fetch(request: Request, env: any) {
    const treasury = new WalletAuthority(env);

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST requests allowed' }), { status: 405 });
    }

    let body: any;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 }); }

    const { op, params, api_key, signature } = body;
    if (!op || !params) return new Response(JSON.stringify({ error: 'Missing op or params' }), { status: 400 });

    const protectedOps = ['mint','burn','fee','stake','send'];
    if (protectedOps.includes(op)) {
      if (!api_key || !signature) return new Response(JSON.stringify({ error: 'Missing API credentials' }), { status: 401 });
      if (!(await verifySignature(api_key, signature, params, env))) return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403 });
    }

    try {
      switch(op){
        case 'create_wallet':
          const newWallet = await treasury.createWallet(params.owner_pub, params.network, params.wallet_address, params.metadata);
          return new Response(JSON.stringify({ wallet_address: newWallet }));

        case 'load_wallet':
          const wallet = await treasury.loadWallet(params.wallet_address, params.network);
          return new Response(JSON.stringify(wallet || { error: 'Wallet not found' }));

        case 'get_balance':
          const balance = await treasury.getBalance(params.wallet_address, params.network);
          return new Response(JSON.stringify({ balance }));

        case 'destroy_wallet':
          await treasury.destroyWallet(params.wallet_address);
          return new Response(JSON.stringify({ status: 'destroyed' }));

        case 'send':
          const txId = await treasury.send(params.from, params.to, params.amount, params.network, params.reason);
          return new Response(JSON.stringify({ transaction_id: txId }));

        case 'mint':
          const mintTx = await treasury.mint(params.to, params.amount, params.network, params.reason);
          return new Response(JSON.stringify({ transaction_id: mintTx }));

        case 'burn':
          const burnTx = await treasury.burn(params.from, params.amount, params.network, params.reason);
          return new Response(JSON.stringify({ transaction_id: burnTx }));

        case 'fee':
          const feeTx = await treasury.fee(params.from, params.amount, params.network, params.reason);
          return new Response(JSON.stringify({ transaction_id: feeTx }));

        case 'stake':
          const stakeTx = await treasury.stakeReward(params.to, params.amount, params.network, params.reason);
          return new Response(JSON.stringify({ transaction_id: stakeTx }));

        case 'claim_balance':
          const claimTx = await treasury.claimBalance(params.wallet_address, params.claimed_balance, params.network, params.transaction_id);
          return new Response(JSON.stringify({ transaction_id: claimTx }));

        default: return new Response(JSON.stringify({ error: 'Unknown operation' }), { status: 400 });
      }
    } catch(err: any){ return new Response(JSON.stringify({ error: err.message }), { status: 500 }); }
  }
};

// --- HMAC signature verification ---
async function verifySignature(api_key: string, signature: string, params: any, env: any) {
  const secretRaw = await env.KV.get(`api_secret_${api_key}`);
  if (!secretRaw) return false;

  const hmac = createHmac('sha256', secretRaw);
  hmac.update(JSON.stringify(params));
  const expected = hmac.digest('hex');
  return expected === signature;
}