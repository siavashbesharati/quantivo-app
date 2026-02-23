import jwt, { Secret } from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET: Secret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this_in_production';
// Default to 7 days in seconds. The 'jsonwebtoken' library can take a string like "7d",
// but its TypeScript types are very strict. Using a number for seconds is more reliable.
// If you set JWT_EXPIRY in .env, make sure it is a number of seconds.
const JWT_EXPIRY = process.env.JWT_EXPIRY || 604800; // Default: 7 days in seconds

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: Number(JWT_EXPIRY) });
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
