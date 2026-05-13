import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, generateKeyPairSync } from 'node:crypto';

// ---------------------------------------------------------------------------
// SHA-256 hashing
// ---------------------------------------------------------------------------

/**
 * Produce a hex-encoded SHA-256 digest of an arbitrary string payload.
 * Used for biometric hashing, audit log hashing, etc.
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Produce a SHA-256 HMAC digest with a secret key.
 */
export function hmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// AES-256-GCM symmetric encryption / decryption
// ---------------------------------------------------------------------------
const AES_ALGORITHM = 'aes-256-gcm' as const;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt plaintext with AES-256-GCM.
 * @param plaintext UTF-8 string to encrypt
 * @param keyHex 64-char hex-encoded 256-bit key
 * @returns base64 encoded `iv:ciphertext:authTag`
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('AES-256 key must be exactly 32 bytes (64 hex chars)');
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Concatenate iv + ciphertext + tag and base64-encode for storage
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString('base64');
}

/**
 * Decrypt a value produced by `encrypt`.
 */
export function decrypt(ciphertextBase64: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('AES-256 key must be exactly 32 bytes (64 hex chars)');
  }

  const combined = Buffer.from(ciphertextBase64, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// RSA key-pair generation (for patient/device key pairs)
// ---------------------------------------------------------------------------

export interface KeyPairResult {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate an RSA-2048 key pair in PEM format.
 * Used during patient registration for end-to-end encryption of health data.
 */
export function generateRsaKeyPair(): KeyPairResult {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

// ---------------------------------------------------------------------------
// Random token generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure random hex token (default 32 bytes / 64 chars).
 */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('hex');
}

/**
 * Generate a 6-digit numeric check-in code for appointments.
 */
export function generateCheckInCode(): string {
  const num = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Hash chain helper for blockchain audit
// ---------------------------------------------------------------------------

/**
 * Create a hash chain entry: SHA-256(previousHash + JSON(payload)).
 * Used to build tamper-evident audit logs before submitting to Hyperledger.
 */
export function hashChainEntry(previousHash: string, payload: Record<string, unknown>): string {
  const data = previousHash + JSON.stringify(payload);
  return sha256(data);
}
