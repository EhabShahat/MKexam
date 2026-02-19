/**
 * Compression utility module for response data optimization
 * Supports both gzip and brotli compression for bandwidth reduction
 * 
 * Requirements: 1.1, 14.1, 14.2, 14.3
 */

import { gzip, gunzip, brotliCompress, brotliDecompress } from 'zlib';
import { promisify } from 'util';

// Promisify zlib functions for async/await usage
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Compression encoding types
 */
export type CompressionEncoding = 'gzip' | 'brotli';

/**
 * Compression options
 */
export interface CompressionOptions {
  encoding?: CompressionEncoding;
  level?: number; // 0-9 for gzip, 0-11 for brotli
}

/**
 * Compression result with metadata
 */
export interface CompressionResult {
  data: Buffer;
  encoding: CompressionEncoding;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compression threshold in bytes (1KB)
 */
const COMPRESSION_THRESHOLD = 1024;

/**
 * Compression module for data optimization
 */
export class CompressionModule {
  /**
   * Compress data using specified encoding
   * 
   * @param data - Data to compress (string, object, or Buffer)
   * @param encoding - Compression encoding ('gzip' or 'brotli')
   * @param level - Compression level (optional)
   * @returns Compressed buffer
   */
  static async compress(
    data: string | object | Buffer,
    encoding: CompressionEncoding = 'gzip',
    level?: number
  ): Promise<Buffer> {
    // Convert data to buffer if needed
    const buffer = this.toBuffer(data);

    // Apply compression based on encoding
    if (encoding === 'brotli') {
      const options = level !== undefined ? { params: { [0]: level } } : undefined;
      return await brotliCompressAsync(buffer, options);
    } else {
      const options = level !== undefined ? { level } : undefined;
      return await gzipAsync(buffer, options);
    }
  }

  /**
   * Decompress data using specified encoding
   * 
   * @param buffer - Compressed data buffer
   * @param encoding - Compression encoding used
   * @returns Decompressed buffer
   */
  static async decompress(
    buffer: Buffer,
    encoding: CompressionEncoding = 'gzip'
  ): Promise<Buffer> {
    if (encoding === 'brotli') {
      return await brotliDecompressAsync(buffer);
    } else {
      return await gunzipAsync(buffer);
    }
  }

  /**
   * Check if data should be compressed based on size threshold
   * 
   * @param data - Data to check (string, object, or Buffer)
   * @returns True if data size exceeds 1KB threshold
   */
  static shouldCompress(data: string | object | Buffer): boolean {
    const buffer = this.toBuffer(data);
    return buffer.length > COMPRESSION_THRESHOLD;
  }

  /**
   * Calculate compression ratio as percentage
   * 
   * @param originalSize - Original data size in bytes
   * @param compressedSize - Compressed data size in bytes
   * @returns Compression ratio as percentage (0-100)
   */
  static getCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return Math.round((1 - compressedSize / originalSize) * 100);
  }

  /**
   * Compress data with full metadata result
   * 
   * @param data - Data to compress
   * @param options - Compression options
   * @returns Compression result with metadata
   */
  static async compressWithMetadata(
    data: string | object | Buffer,
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const encoding = options.encoding || 'gzip';
    const buffer = this.toBuffer(data);
    const originalSize = buffer.length;

    const compressedData = await this.compress(data, encoding, options.level);
    const compressedSize = compressedData.length;
    const compressionRatio = this.getCompressionRatio(originalSize, compressedSize);

    return {
      data: compressedData,
      encoding,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  }

  /**
   * Decompress data and parse as JSON
   * 
   * @param buffer - Compressed data buffer
   * @param encoding - Compression encoding used
   * @returns Parsed JSON object
   */
  static async decompressJSON<T = any>(
    buffer: Buffer,
    encoding: CompressionEncoding = 'gzip'
  ): Promise<T> {
    const decompressed = await this.decompress(buffer, encoding);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  /**
   * Compress JSON data
   * 
   * @param data - Object to compress
   * @param encoding - Compression encoding
   * @param level - Compression level
   * @returns Compressed buffer
   */
  static async compressJSON(
    data: object,
    encoding: CompressionEncoding = 'gzip',
    level?: number
  ): Promise<Buffer> {
    const json = JSON.stringify(data);
    return await this.compress(json, encoding, level);
  }

  /**
   * Convert various data types to Buffer
   * 
   * @param data - Data to convert
   * @returns Buffer representation
   */
  private static toBuffer(data: string | object | Buffer): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    
    if (typeof data === 'string') {
      return Buffer.from(data, 'utf-8');
    }
    
    // Convert object to JSON string then to buffer
    return Buffer.from(JSON.stringify(data), 'utf-8');
  }

  /**
   * Detect best compression encoding based on client support
   * 
   * @param acceptEncoding - Accept-Encoding header value
   * @returns Best supported encoding or null if none supported
   */
  static detectEncoding(acceptEncoding?: string): CompressionEncoding | null {
    if (!acceptEncoding) return null;

    const encodings = acceptEncoding.toLowerCase();
    
    // Prefer brotli for better compression
    if (encodings.includes('br')) {
      return 'brotli';
    }
    
    if (encodings.includes('gzip')) {
      return 'gzip';
    }
    
    return null;
  }
}

/**
 * Convenience function to compress data
 */
export async function compress(
  data: string | object | Buffer,
  encoding: CompressionEncoding = 'gzip'
): Promise<Buffer> {
  return CompressionModule.compress(data, encoding);
}

/**
 * Convenience function to decompress data
 */
export async function decompress(
  buffer: Buffer,
  encoding: CompressionEncoding = 'gzip'
): Promise<Buffer> {
  return CompressionModule.decompress(buffer, encoding);
}

/**
 * Convenience function to check if data should be compressed
 */
export function shouldCompress(data: string | object | Buffer): boolean {
  return CompressionModule.shouldCompress(data);
}

/**
 * Convenience function to get compression ratio
 */
export function getCompressionRatio(originalSize: number, compressedSize: number): number {
  return CompressionModule.getCompressionRatio(originalSize, compressedSize);
}
