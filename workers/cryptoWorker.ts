import * as crypto from 'crypto';

export class CryptoWorker {
  currentEphemeralKey: crypto.KeyPairSyncResult<string, string> | null = null;

  rotateKey() {
    this.currentEphemeralKey = crypto.generateKeyPairSync('ed25519');
    console.log('CryptoWorker: Generated new ephemeral key');
  }

  getPublicKey(): string {
    if (!this.currentEphemeralKey) this.rotateKey();
    return this.currentEphemeralKey!.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }

  signData(data: Buffer | string): string {
    if (!this.currentEphemeralKey) this.rotateKey();
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    sign.end();
    return sign.sign(this.currentEphemeralKey!.privateKey, 'hex');
  }
}