// authority-service.ts
import { MintReason } from './mint-reason'; // your enum from before

interface Intent {
  type: string;
  payload: any;
  signer_pub: string;
  signature: string;
  created_at: number;
}

interface BlockStaging {
  intents: Intent[];
  blockHeight: number;
  prevHash: string;
  merkleRoot: string;
}

interface WalletState {
  [wallet: string]: number; // current coin balance
}

interface IntentPayload {
  wallet?: string;          // for mint/burn
  from?: string;            // for transfer
  to?: string;              // for transfer
  amount: number;
  reason?: string;          // mint reason or burn/transfer reason
  transaction_id: string;
  timestamp: number;
}
export default {
    
  async fetch(request: Request, env: any) {
      
      console.log("AuthorityService Activated.")
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const intent: Intent = await request.json();
    console.log(intent);
    // 1. Verify TreasuryService signature
    const validSignature = await verifySignature(
      intent.signer_pub,
      JSON.stringify(intent.payload),
      intent.signature
    );

    if (!validSignature) {
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Validate intent
    const valid = validateIntent(intent);
    if (!valid) {
      return new Response('Invalid intent', { status: 400 });
    }

    // 3. Store in INTENTDB (D1)
    await env.INTENTDB.prepare(`INSERT INTO intents (id, type, payload, signer_pub, signature, created_at)
                           VALUES (?, ?, ?, ?, ?, ?)`,
      [
        intent.payload.transaction_id,
        intent.type,
        JSON.stringify(intent.payload),
        intent.signer_pub,
        intent.signature,
        intent.created_at
      ]
    );

    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
  }
};

// --- helpers ---

async function verifySignature(pubKey: string, data: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const dataBuf = encoder.encode(data);
  const sigBuf = Uint8Array.from(Buffer.from(signature, 'hex'));

  try {
    return await crypto.subtle.verify(
      'Ed25519',
      await importPublicKey(pubKey),
      sigBuf,
      dataBuf
    );
  } catch {
    return false;
  }
}

async function importPublicKey(pubKey: string) {
  // pubKey is base64 or hex string
  const rawKey = Uint8Array.from(Buffer.from(pubKey, 'hex'));
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    true,
    ['verify']
  );
}

function validateIntent(intent: Intent, walletState: WalletState) {
  const { type, payload } = intent;

  if (!payload.amount || payload.amount <= 0) return false;
  if (!payload.transaction_id) return false;

  switch (type) {
    case 'mint':
      return Object.values(MintReason).includes(payload.reason);

    case 'burn':
      if (!payload.wallet) return false;
      if ((walletState[payload.wallet] || 0) < payload.amount) return false;
      return true;

    case 'transfer':
      if (!payload.from || !payload.to) return false;
      if ((walletState[payload.from] || 0) < payload.amount) return false;
      return true;

    default:
      return false;
  }
}

function applyIntent(intent: Intent, walletState: WalletState) {
  const { type, payload } = intent;

  switch (type) {
    case 'mint':
      walletState[payload.wallet] = (walletState[payload.wallet] || 0) + payload.amount;
      break;

    case 'burn':
      walletState[payload.wallet] -= payload.amount;
      break;

    case 'transfer':
      walletState[payload.from] -= payload.amount;
      walletState[payload.to] = (walletState[payload.to] || 0) + payload.amount;
      break;
  }

  return walletState;
}