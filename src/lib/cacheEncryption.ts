/**
 * Cache Encryption Module
 * 
 * Provides AES-256-GCM encryption for sensitive cached data (student answers).
 * Ensures cached answer data is encrypted at rest for security compliance.
 * 
 * Requirements: 11.1
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  authTag: string; // Base64 encoded authentication tag
  salt: string; // Base64 encoded salt for key derivation
}

/**
 * Get encryption key from environment or generate a default one
 * In production, this should come from a secure environment variable
 */
function getEncryptionKey(): string {
  // Use environment variable if available
  if (process.env.CACHE_ENCRYPTION_KEY) {
    return process.env.CACHE_ENCRYPTION_KEY;
  }

  // Fallback to a default key (should be replaced in production)
  // This is a placeholder - in production, use a secure key management system
  return 'default-cache-encryption-key-replace-in-production';
}

/**
 * Derive encryption key from password using scrypt
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

/**
 * Encrypt sensitive data for cache storage
 * Uses AES-256-GCM for authenticated encryption
 * 
 * @param data - Data to encrypt (will be JSON stringified)
 * @returns Encrypted data with IV, auth tag, and salt
 */
export function encryptCacheData<T>(data: T): EncryptedData {
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from password
    const key = deriveKey(getEncryptionKey(), salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const jsonData = JSON.stringify(data);
    let encrypted = cipher.update(jsonData, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
    };
  } catch (error) {
    throw new Error(`Cache encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt cached sensitive data
 * 
 * @param encryptedData - Encrypted data structure
 * @returns Decrypted data
 */
export function decryptCacheData<T>(encryptedData: EncryptedData): T {
  try {
    // Decode base64 values
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const salt = Buffer.from(encryptedData.salt, 'base64');

    // Derive key from password
    const key = deriveKey(getEncryptionKey(), salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    // Parse JSON
    return JSON.parse(decrypted) as T;
  } catch (error) {
    throw new Error(`Cache decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if data should be encrypted
 * Sensitive data includes student answers and personal information
 * 
 * @param key - Cache key to check
 * @returns True if data should be encrypted
 */
export function shouldEncryptCacheData(key: string): boolean {
  // Encrypt student answers and attempt state
  const sensitivePatterns = [
    /^attempt:state:/,
    /^student:answers:/,
    /^attempt:answers:/,
  ];

  return sensitivePatterns.some(pattern => pattern.test(key));
}

/**
 * Wrapper for encrypting data if needed based on cache key
 * 
 * @param key - Cache key
 * @param data - Data to potentially encrypt
 * @returns Original data or encrypted data structure
 */
export function encryptIfNeeded<T>(key: string, data: T): T | EncryptedData {
  if (shouldEncryptCacheData(key)) {
    return encryptCacheData(data);
  }
  return data;
}

/**
 * Wrapper for decrypting data if it's encrypted
 * 
 * @param data - Data that might be encrypted
 * @returns Decrypted data or original data
 */
export function decryptIfNeeded<T>(data: T | EncryptedData): T {
  // Check if data is encrypted (has the EncryptedData structure)
  if (
    data &&
    typeof data === 'object' &&
    'encrypted' in data &&
    'iv' in data &&
    'authTag' in data &&
    'salt' in data
  ) {
    return decryptCacheData(data as EncryptedData);
  }
  return data as T;
}
