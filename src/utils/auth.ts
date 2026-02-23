import jwt, { Secret } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
// JWT expiry can be a number (seconds) or a string duration (e.g. '7d').
// Preserve the original env value if it's a non-numeric duration so `jsonwebtoken`
// can accept strings like '7d'. If it's numeric, convert to Number.
const rawExpiry = process.env.JWT_EXPIRY ?? '604800'; // default 7 days in seconds
const JWT_EXPIRY: string | number = isNaN(Number(rawExpiry)) ? rawExpiry : Number(rawExpiry);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWT token management
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

export function decodeToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.decode(token) as JWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
}
