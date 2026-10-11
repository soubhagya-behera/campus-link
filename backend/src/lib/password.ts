import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

// scrypt(cost N=2^14, block r=8, parallel p=1), 64-byte derived key.
// Stored format: scrypt$v1$16384$8$1$<base64 salt>$<base64 key>
// Chosen over bcrypt/argon2 here to avoid native bindings on Windows while
// keeping a memory-hard, salted, maintained KDF from node:crypto.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

function scryptAsync(password: string, salt: Buffer, keylen: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: n, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

export function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  return scryptAsync(plain, salt, KEY_LEN, N, R, P).then((k) => {
    return `scrypt$v1$${N}$${R}$${P}$${salt.toString("base64")}$${k.toString("base64")}`;
  });
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
  const n = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);
  if (![n, r, p].every(Number.isInteger) || n <= 0 || r <= 0 || p <= 0) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[5], "base64");
    expected = Buffer.from(parts[6], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scryptAsync(plain, salt, expected.length, n, r, p);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** 32-byte session token (raw value lives only in the HttpOnly cookie). */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of the raw token — the only form persisted in PostgreSQL. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
