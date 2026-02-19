/**
 * Compression middleware for API routes
 * Handles response compression based on client Accept-Encoding and response size
 * 
 * Requirements: 1.1, 14.1, 14.5
 */

import { NextResponse } from 'next/server';
import { CompressionModule, CompressionEncoding } from './compression';

/**
 * Compression options for middleware
 */
export interface CompressionMiddlewareOptions {
  threshold?: number; // Size threshold in bytes (default: 1024)
  level?: number; // Compression level
}

/**
 * Compress a NextResponse if appropriate
 * 
 * @param data - Response data to potentially compress
 * @param acceptEncoding - Accept-Encoding header from request
 * @param options - Compression options
 * @returns NextResponse with compressed data if applicable
 */
export async function compressResponse(
  data: any,
  acceptEncoding?: string | null,
  options: CompressionMiddlewareOptions = {}
): Promise<NextResponse> {
  const threshold = options.threshold ?? 1024;
  
  // Convert data to JSON string
  const jsonString = JSON.stringify(data);
  const originalSize = Buffer.byteLength(jsonString, 'utf-8');
  
  // Check if compression should be applied
  if (originalSize <= threshold) {
    // Response is too small, return uncompressed
    return NextResponse.json(data);
  }
  
  // Detect best encoding based on client support
  const encoding = CompressionModule.detectEncoding(acceptEncoding || undefined);
  
  if (!encoding) {
    // Client doesn't support compression, return uncompressed
    return NextResponse.json(data);
  }
  
  try {
    // Compress the data
    const compressed = await CompressionModule.compress(jsonString, encoding, options.level);
    const compressedSize = compressed.length;
    const compressionRatio = CompressionModule.getCompressionRatio(originalSize, compressedSize);
    
    // Create response with compressed data
    const response = new NextResponse(compressed, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': encoding === 'brotli' ? 'br' : encoding,
        'Content-Length': compressedSize.toString(),
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Ratio': `${compressionRatio}%`,
      },
    });
    
    return response;
  } catch (error) {
    // Compression failed, fallback to uncompressed
    console.error('Compression failed:', error);
    return NextResponse.json(data);
  }
}

/**
 * Helper to check if request accepts compression
 * 
 * @param acceptEncoding - Accept-Encoding header value
 * @returns True if client supports gzip or brotli
 */
export function supportsCompression(acceptEncoding?: string | null): boolean {
  if (!acceptEncoding) return false;
  const encoding = acceptEncoding.toLowerCase();
  return encoding.includes('gzip') || encoding.includes('br');
}

/**
 * Get compression encoding from Accept-Encoding header
 * 
 * @param acceptEncoding - Accept-Encoding header value
 * @returns Compression encoding or null
 */
export function getCompressionEncoding(acceptEncoding?: string | null): CompressionEncoding | null {
  return CompressionModule.detectEncoding(acceptEncoding || undefined);
}
