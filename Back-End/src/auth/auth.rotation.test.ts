import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { auth } from './auth.service';

// Light unit-style test (does not hit database) for sign/verify roundtrip

describe('auth token basics', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const priv = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();

  const oldEnv = { ...process.env };
  beforeAll(() => {
    process.env.JWT_PRIVATE_KEY = priv;
    process.env.JWT_PUBLIC_KEY = pub;
  });
  afterAll(() => {
    process.env = oldEnv;
  });

  it('signs and verifies access token', () => {
    const payload = { id: 'u1', email: 'a@b.c', role: 'customer' } as const;
    const token = auth.signAccess(payload);
    expect(typeof token).toBe('string');
    const decoded = auth.verify(token);
    expect(decoded).toMatchObject(payload);
  });
});
