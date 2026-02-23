import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!raw) {
    // Fallback to a zeroed key (insecure) if not provided — callers should log a warning.
    return Buffer.alloc(32, 0);
  }

  // Accept hex (64 chars) or base64
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }

  try {
    return Buffer.from(raw, 'base64');
  } catch (err) {
    return Buffer.from(raw);
  }
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(payload: string): string {
  try {
    const [ivHex, tagHex, encryptedHex] = payload.split(':');
    if (!ivHex || !tagHex || !encryptedHex) {
      // Not in expected format — return raw payload
      return payload;
    }

    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    // On any failure, return the original payload (best-effort)
    return payload;
  }
}

export function isEncryptedToken(payload: string): boolean {
  return typeof payload === 'string' && payload.split(':').length === 3;
}
