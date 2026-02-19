/**
 * Security utilities for client-side encryption and key management
 * Provides secure storage for sensitive student code data
 */

/**
 * Generate a cryptographic key from a password using PBKDF2
 * @param password - The password to derive key from
 * @param salt - Salt for key derivation
 * @param iterations - Number of PBKDF2 iterations (default: 100000)
 * @returns Promise<CryptoKey> - The derived key
 */
async function deriveKey(password: string, salt: BufferSource, iterations: number = 100000): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a device-specific encryption key based on browser fingerprint
 * @returns Promise<string> - Base64 encoded device key
 */
async function generateDeviceKey(): Promise<string> {
  // Create a device fingerprint from available browser characteristics
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.platform,
    navigator.hardwareConcurrency?.toString() || '0'
  ].join('|');

  // Hash the fingerprint to create a consistent key
  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...hashArray));
}

/**
 * Encrypt data using AES-GCM with device-specific key
 * @param data - The data to encrypt
 * @returns Promise<string> - Base64 encoded encrypted data with salt and IV
 */
export async function encryptData(data: string): Promise<string> {
  try {
    // Check if Web Crypto API is available
    if (!crypto.subtle) {
      console.warn('Web Crypto API not available, encryption disabled');
      return data; // Fallback to unencrypted storage
    }

    const deviceKey = await generateDeviceKey();
    const encoder = new TextEncoder();
    
    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive encryption key
    const key = await deriveKey(deviceKey, salt);
    
    // Encrypt the data
    const encodedData = encoder.encode(data);
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );
    
    // Combine salt, IV, and encrypted data
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedArray, salt.length + iv.length);
    
    // Return base64 encoded result
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return data; // Fallback to unencrypted storage
  }
}

/**
 * Decrypt data using AES-GCM with device-specific key
 * @param encryptedData - Base64 encoded encrypted data
 * @returns Promise<string> - The decrypted data
 */
export async function decryptData(encryptedData: string): Promise<string> {
  try {
    // Check if Web Crypto API is available
    if (!crypto.subtle) {
      console.warn('Web Crypto API not available, assuming unencrypted data');
      return encryptedData; // Assume unencrypted data
    }

    // Check if data looks like base64 encrypted data
    if (!isEncryptedData(encryptedData)) {
      // Assume this is unencrypted legacy data
      return encryptedData;
    }

    const deviceKey = await generateDeviceKey();
    
    // Decode base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract salt, IV, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);
    
    // Derive decryption key
    const key = await deriveKey(deviceKey, salt);
    
    // Decrypt the data
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return original data as fallback (might be unencrypted legacy data)
    return encryptedData;
  }
}

/**
 * Check if data appears to be encrypted (base64 with expected length)
 * @param data - The data to check
 * @returns boolean - True if data appears encrypted
 */
function isEncryptedData(data: string): boolean {
  // Check if it's valid base64
  try {
    const decoded = atob(data);
    // Encrypted data should be at least 28 bytes (16 salt + 12 IV + some data)
    return decoded.length >= 28;
  } catch {
    return false;
  }
}

/**
 * Securely clear sensitive data from memory (best effort)
 * @param data - The data to clear
 */
export function secureClear(data: string): void {
  // In JavaScript, we can't truly clear memory, but we can overwrite the string
  // This is a best-effort approach
  try {
    // Create a new string of the same length filled with zeros
    const cleared = '0'.repeat(data.length);
    // Attempt to overwrite (limited effectiveness in JS)
    data = cleared;
  } catch {
    // Ignore errors in secure clear
  }
}

/**
 * Generate a secure random token for rate limiting keys
 * @param length - Length of the token (default: 32)
 * @returns string - Base64 encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Hash a value using SHA-256 for secure comparisons
 * @param value - The value to hash
 * @returns Promise<string> - Base64 encoded hash
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return btoa(String.fromCharCode(...hashArray));
}