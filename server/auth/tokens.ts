import jwt from 'jsonwebtoken';
import { getPrivateKey, getPublicKey, publicKeyToJWK } from './keys';

export interface TokenPayload {
  iss: string;
  aud: string | string[];
  sub: string;
  exp: number;
  iat: number;
  scope?: string;
}

export function signToken(payload: Omit<TokenPayload, 'iat'>): string {
  const privateKey = getPrivateKey();
  const jwk = publicKeyToJWK();
  
  return jwt.sign(
    { ...payload, iat: Math.floor(Date.now() / 1000) },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: jwk.kid
    }
  );
}

export function verifyToken(token: string): TokenPayload {
  const publicKey = getPublicKey();
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256']
  }) as TokenPayload;
}
