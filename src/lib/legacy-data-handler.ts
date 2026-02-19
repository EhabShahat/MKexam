/**
 * Legacy Data Handler
 * 
 * Detects and handles both compressed and uncompressed legacy data
 * Provides backward compatibility during compression rollout
 * 
 * Requirements: 10.5
 */

import { CompressionModule, CompressionEncoding } from './compression';

/**
 * Data format detection result
 */
export interface DataFormatInfo {
  isCompressed: boolean;
  encoding?: CompressionEncoding;
  format: 'compressed' | 'uncompressed' | 'unknown';
  confidence: number; // 0-1 confidence score
}

/**
 * Detect if data is compressed
 * 
 * Checks for compression magic bytes:
 * - gzip: 0x1f 0x8b
 * - brotli: No standard magic bytes, but we can check for typical patterns
 * 
 * @param data - Data buffer to check
 * @returns Format detection result
 */
export function detectDataFormat(data: Buffer | string): DataFormatInfo {
  // Convert string to buffer if needed
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  
  // Check for gzip magic bytes (0x1f 0x8b)
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return {
      isCompressed: true,
      encoding: 'gzip',
      format: 'compressed',
      confidence: 1.0,
    };
  }
  
  // Brotli doesn't have standard magic bytes, but we can check for typical patterns
  // Brotli streams typically start with specific bit patterns
  // This is a heuristic check and may not be 100% accurate
  if (buffer.length >= 1) {
    const firstByte = buffer[0];
    // Brotli window size bits (first 4 bits) are typically in range 10-24
    const windowBits = (firstByte & 0x0f);
    if (windowBits >= 10 && windowBits <= 24) {
      // Additional check: brotli data is typically not valid UTF-8
      try {
        buffer.toString('utf-8');
        // If it's valid UTF-8, probably not brotli
      } catch {
        return {
          isCompressed: true,
          encoding: 'brotli',
          format: 'compressed',
          confidence: 0.7, // Lower confidence for brotli detection
        };
      }
    }
  }
  
  // Check if data looks like JSON (uncompressed)
  try {
    const str = buffer.toString('utf-8');
    // Try to parse as JSON
    JSON.parse(str);
    return {
      isCompressed: false,
      format: 'uncompressed',
      confidence: 1.0,
    };
  } catch {
    // Not valid JSON, might be compressed or corrupted
  }
  
  // Unknown format
  return {
    isCompressed: false,
    format: 'unknown',
    confidence: 0.0,
  };
}

/**
 * Safely decompress data, handling both compressed and uncompressed formats
 * 
 * @param data - Data to decompress (may be compressed or uncompressed)
 * @param expectedEncoding - Expected compression encoding (optional)
 * @returns Decompressed data as string
 */
export async function safeDecompress(
  data: Buffer | string,
  expectedEncoding?: CompressionEncoding
): Promise<string> {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  
  // Detect data format
  const formatInfo = detectDataFormat(buffer);
  
  // If data is uncompressed, return as-is
  if (!formatInfo.isCompressed) {
    return buffer.toString('utf-8');
  }
  
  // Data is compressed, decompress it
  const encoding = expectedEncoding || formatInfo.encoding || 'gzip';
  
  try {
    const decompressed = await CompressionModule.decompress(buffer, encoding);
    return decompressed.toString('utf-8');
  } catch (error) {
    // Decompression failed, try alternative encoding
    if (encoding === 'gzip') {
      try {
        const decompressed = await CompressionModule.decompress(buffer, 'brotli');
        return decompressed.toString('utf-8');
      } catch {
        // Both failed, return original data as string
        console.error('Failed to decompress data with both gzip and brotli');
        return buffer.toString('utf-8');
      }
    } else {
      try {
        const decompressed = await CompressionModule.decompress(buffer, 'gzip');
        return decompressed.toString('utf-8');
      } catch {
        // Both failed, return original data as string
        console.error('Failed to decompress data with both brotli and gzip');
        return buffer.toString('utf-8');
      }
    }
  }
}

/**
 * Safely parse JSON data that may be compressed or uncompressed
 * 
 * @param data - Data to parse (may be compressed or uncompressed)
 * @param expectedEncoding - Expected compression encoding (optional)
 * @returns Parsed JSON object
 */
export async function safeParseJSON<T = any>(
  data: Buffer | string,
  expectedEncoding?: CompressionEncoding
): Promise<T> {
  const decompressed = await safeDecompress(data, expectedEncoding);
  return JSON.parse(decompressed);
}

/**
 * Check if JSONB field in database is compressed
 * 
 * Database JSONB fields may contain:
 * 1. Plain JSON objects (legacy uncompressed)
 * 2. Base64-encoded compressed data (new format)
 * 
 * @param jsonbData - JSONB data from database
 * @returns True if data appears to be compressed
 */
export function isJSONBCompressed(jsonbData: any): boolean {
  // If it's a plain object, it's uncompressed
  if (typeof jsonbData === 'object' && jsonbData !== null && !Buffer.isBuffer(jsonbData)) {
    return false;
  }
  
  // If it's a string, check if it's base64-encoded compressed data
  if (typeof jsonbData === 'string') {
    try {
      // Try to decode as base64
      const buffer = Buffer.from(jsonbData, 'base64');
      const formatInfo = detectDataFormat(buffer);
      return formatInfo.isCompressed;
    } catch {
      return false;
    }
  }
  
  // If it's a buffer, check format
  if (Buffer.isBuffer(jsonbData)) {
    const formatInfo = detectDataFormat(jsonbData);
    return formatInfo.isCompressed;
  }
  
  return false;
}

/**
 * Read JSONB field from database, handling both compressed and uncompressed formats
 * 
 * @param jsonbData - JSONB data from database
 * @param expectedEncoding - Expected compression encoding (optional)
 * @returns Parsed object
 */
export async function readJSONBField<T = any>(
  jsonbData: any,
  expectedEncoding?: CompressionEncoding
): Promise<T> {
  // If it's already a plain object, return as-is (legacy uncompressed)
  if (typeof jsonbData === 'object' && jsonbData !== null && !Buffer.isBuffer(jsonbData)) {
    return jsonbData as T;
  }
  
  // If it's a string, it might be base64-encoded compressed data
  if (typeof jsonbData === 'string') {
    try {
      // Try to decode as base64
      const buffer = Buffer.from(jsonbData, 'base64');
      return await safeParseJSON<T>(buffer, expectedEncoding);
    } catch {
      // Not base64, try to parse as JSON
      try {
        return JSON.parse(jsonbData) as T;
      } catch {
        // Can't parse, return as-is
        return jsonbData as T;
      }
    }
  }
  
  // If it's a buffer, decompress and parse
  if (Buffer.isBuffer(jsonbData)) {
    return await safeParseJSON<T>(jsonbData, expectedEncoding);
  }
  
  // Unknown format, return as-is
  return jsonbData as T;
}

/**
 * Write JSONB field to database with optional compression
 * 
 * @param data - Data to write
 * @param compress - Whether to compress the data
 * @param encoding - Compression encoding to use
 * @returns Data ready for database storage
 */
export async function writeJSONBField(
  data: any,
  compress: boolean = true,
  encoding: CompressionEncoding = 'gzip'
): Promise<any> {
  // If compression is disabled, return as-is
  if (!compress) {
    return data;
  }
  
  // Check if data should be compressed (size > 1KB)
  if (!CompressionModule.shouldCompress(data)) {
    return data;
  }
  
  // Compress and encode as base64 for storage
  const compressed = await CompressionModule.compressJSON(data, encoding);
  return compressed.toString('base64');
}

/**
 * Log legacy data detection for monitoring
 * 
 * @param field - Field name
 * @param isCompressed - Whether data was compressed
 * @param tableName - Table name (optional)
 */
export function logLegacyDataDetection(
  field: string,
  isCompressed: boolean,
  tableName?: string
): void {
  if (!isCompressed) {
    // eslint-disable-next-line no-console
    console.log('[LEGACY DATA]', {
      timestamp: new Date().toISOString(),
      table: tableName,
      field,
      format: 'uncompressed',
      message: 'Detected legacy uncompressed data',
    });
  }
}

/**
 * Migrate legacy uncompressed data to compressed format
 * 
 * This function can be used in a migration script to compress existing data
 * 
 * @param data - Legacy uncompressed data
 * @param encoding - Compression encoding to use
 * @returns Compressed data ready for storage
 */
export async function migrateLegacyData(
  data: any,
  encoding: CompressionEncoding = 'gzip'
): Promise<string> {
  // Check if already compressed
  if (isJSONBCompressed(data)) {
    return data;
  }
  
  // Compress the data
  return await writeJSONBField(data, true, encoding);
}
