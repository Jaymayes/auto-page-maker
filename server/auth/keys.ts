import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_DIR = process.env.KEY_DIR || path.join(process.cwd(), '.keys');
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEY_DIR, 'public.pem');

export interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

export function ensureKeysExist(): void {
  if (!fs.existsSync(KEY_DIR)) {
    fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    console.log(`[AUTH] Created persistent key directory: ${KEY_DIR}`);
  }
  
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log('[AUTH] Generating new RSA key pair...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
    console.log('[AUTH] RSA key pair generated successfully');
    console.log(`[AUTH] Private key: ${PRIVATE_KEY_PATH} (mode: 0o600)`);
    console.log(`[AUTH] Public key: ${PUBLIC_KEY_PATH} (mode: 0o644)`);
  } else {
    console.log('[AUTH] Using existing RSA key pair from persistent storage');
    
    const privateStats = fs.statSync(PRIVATE_KEY_PATH);
    const privateMode = (privateStats.mode & parseInt('777', 8)).toString(8);
    if (privateMode !== '600') {
      console.warn(`[AUTH] WARNING: Private key has insecure permissions (${privateMode}), setting to 0o600`);
      fs.chmodSync(PRIVATE_KEY_PATH, 0o600);
    }
  }
  
  console.log(`[AUTH] Key storage location: ${KEY_DIR} (persistent across restarts)`);
}

export function publicKeyToJWK(kid: string = 'scholar-auth-2025-01'): JWK {
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const jwk = publicKey.export({ format: 'jwk' }) as any;
  
  return {
    kid,
    kty: 'RSA',
    alg: 'RS256',
    use: 'sig',
    n: jwk.n,
    e: jwk.e
  };
}

export function getPrivateKey(): string {
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

export function getPublicKey(): string {
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}
