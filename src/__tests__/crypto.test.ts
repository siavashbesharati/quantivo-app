import { encryptToken, decryptToken, isEncryptedToken } from '../utils/crypto';

describe('crypto utils', () => {
  const sample = 'my-secret-token-123';

  test('encrypt then decrypt returns original', () => {
    const encrypted = encryptToken(sample);
    expect(isEncryptedToken(encrypted)).toBe(true);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(sample);
  });

  test('decrypt returns input unchanged for non-encrypted strings', () => {
    const raw = 'plain-token';
    const out = decryptToken(raw);
    expect(out).toBe(raw);
  });
});
