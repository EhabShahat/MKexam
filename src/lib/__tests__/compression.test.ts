/**
 * Tests for compression utility module
 */

import { describe, it, expect } from 'vitest';
import {
  CompressionModule,
  compress,
  decompress,
  shouldCompress,
  getCompressionRatio,
  type CompressionEncoding,
} from '../compression';

describe('CompressionModule', () => {
  const testData = {
    message: 'Hello, World!',
    numbers: [1, 2, 3, 4, 5],
    nested: {
      key: 'value',
      array: ['a', 'b', 'c'],
    },
  };

  const largeData = {
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: 'This is a test item with some description text to make it larger',
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['tag1', 'tag2', 'tag3'],
      },
    })),
  };

  describe('compress', () => {
    it('should compress string data with gzip', async () => {
      const input = 'Hello, World!';
      const compressed = await CompressionModule.compress(input, 'gzip');
      
      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should compress string data with brotli', async () => {
      const input = 'Hello, World!';
      const compressed = await CompressionModule.compress(input, 'brotli');
      
      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should compress object data', async () => {
      const compressed = await CompressionModule.compress(testData, 'gzip');
      
      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should compress buffer data', async () => {
      const buffer = Buffer.from('Test data');
      const compressed = await CompressionModule.compress(buffer, 'gzip');
      
      expect(Buffer.isBuffer(compressed)).toBe(true);
      expect(compressed.length).toBeGreaterThan(0);
    });

    it('should support compression level parameter', async () => {
      const input = JSON.stringify(largeData);
      const compressed1 = await CompressionModule.compress(input, 'gzip', 1);
      const compressed9 = await CompressionModule.compress(input, 'gzip', 9);
      
      // Higher compression level should produce smaller output
      expect(compressed9.length).toBeLessThanOrEqual(compressed1.length);
    });
  });

  describe('decompress', () => {
    it('should decompress gzip data', async () => {
      const input = 'Hello, World!';
      const compressed = await CompressionModule.compress(input, 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      
      expect(decompressed.toString('utf-8')).toBe(input);
    });

    it('should decompress brotli data', async () => {
      const input = 'Hello, World!';
      const compressed = await CompressionModule.compress(input, 'brotli');
      const decompressed = await CompressionModule.decompress(compressed, 'brotli');
      
      expect(decompressed.toString('utf-8')).toBe(input);
    });

    it('should decompress object data', async () => {
      const compressed = await CompressionModule.compress(testData, 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      const parsed = JSON.parse(decompressed.toString('utf-8'));
      
      expect(parsed).toEqual(testData);
    });
  });

  describe('shouldCompress', () => {
    it('should return false for data smaller than 1KB', () => {
      const smallData = 'Hello, World!';
      expect(CompressionModule.shouldCompress(smallData)).toBe(false);
    });

    it('should return true for data larger than 1KB', () => {
      const largeString = 'x'.repeat(2000);
      expect(CompressionModule.shouldCompress(largeString)).toBe(true);
    });

    it('should return true for large objects', () => {
      expect(CompressionModule.shouldCompress(largeData)).toBe(true);
    });

    it('should handle buffer input', () => {
      const smallBuffer = Buffer.from('small');
      const largeBuffer = Buffer.alloc(2000);
      
      expect(CompressionModule.shouldCompress(smallBuffer)).toBe(false);
      expect(CompressionModule.shouldCompress(largeBuffer)).toBe(true);
    });

    it('should use exactly 1KB threshold', () => {
      const exactly1KB = 'x'.repeat(1024);
      const just1Byte = 'x'.repeat(1025);
      
      expect(CompressionModule.shouldCompress(exactly1KB)).toBe(false);
      expect(CompressionModule.shouldCompress(just1Byte)).toBe(true);
    });
  });

  describe('getCompressionRatio', () => {
    it('should calculate compression ratio correctly', () => {
      const ratio = CompressionModule.getCompressionRatio(1000, 400);
      expect(ratio).toBe(60); // 60% compression
    });

    it('should return 0 for equal sizes', () => {
      const ratio = CompressionModule.getCompressionRatio(1000, 1000);
      expect(ratio).toBe(0);
    });

    it('should handle zero original size', () => {
      const ratio = CompressionModule.getCompressionRatio(0, 0);
      expect(ratio).toBe(0);
    });

    it('should round to nearest integer', () => {
      const ratio = CompressionModule.getCompressionRatio(1000, 334);
      expect(ratio).toBe(67); // 66.6% rounds to 67
    });

    it('should handle larger compressed size (negative compression)', () => {
      const ratio = CompressionModule.getCompressionRatio(100, 150);
      expect(ratio).toBe(-50); // Negative ratio indicates expansion
    });
  });

  describe('compressWithMetadata', () => {
    it('should return compression result with metadata', async () => {
      const result = await CompressionModule.compressWithMetadata(largeData, {
        encoding: 'gzip',
      });
      
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('encoding');
      expect(result).toHaveProperty('originalSize');
      expect(result).toHaveProperty('compressedSize');
      expect(result).toHaveProperty('compressionRatio');
      
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.encoding).toBe('gzip');
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should use default gzip encoding', async () => {
      const result = await CompressionModule.compressWithMetadata(testData);
      expect(result.encoding).toBe('gzip');
    });

    it('should support brotli encoding', async () => {
      const result = await CompressionModule.compressWithMetadata(testData, {
        encoding: 'brotli',
      });
      expect(result.encoding).toBe('brotli');
    });
  });

  describe('compressJSON and decompressJSON', () => {
    it('should compress and decompress JSON data', async () => {
      const compressed = await CompressionModule.compressJSON(testData, 'gzip');
      const decompressed = await CompressionModule.decompressJSON(compressed, 'gzip');
      
      expect(decompressed).toEqual(testData);
    });

    it('should work with brotli encoding', async () => {
      const compressed = await CompressionModule.compressJSON(largeData, 'brotli');
      const decompressed = await CompressionModule.decompressJSON(compressed, 'brotli');
      
      expect(decompressed).toEqual(largeData);
    });
  });

  describe('detectEncoding', () => {
    it('should detect brotli encoding', () => {
      const encoding = CompressionModule.detectEncoding('gzip, deflate, br');
      expect(encoding).toBe('brotli');
    });

    it('should detect gzip encoding', () => {
      const encoding = CompressionModule.detectEncoding('gzip, deflate');
      expect(encoding).toBe('gzip');
    });

    it('should prefer brotli over gzip', () => {
      const encoding = CompressionModule.detectEncoding('gzip, br');
      expect(encoding).toBe('brotli');
    });

    it('should return null for unsupported encodings', () => {
      const encoding = CompressionModule.detectEncoding('deflate');
      expect(encoding).toBe(null);
    });

    it('should return null for undefined input', () => {
      const encoding = CompressionModule.detectEncoding(undefined);
      expect(encoding).toBe(null);
    });

    it('should be case insensitive', () => {
      const encoding1 = CompressionModule.detectEncoding('GZIP, BR');
      const encoding2 = CompressionModule.detectEncoding('Gzip, Br');
      
      expect(encoding1).toBe('brotli');
      expect(encoding2).toBe('brotli');
    });
  });

  describe('convenience functions', () => {
    it('should export compress function', async () => {
      const result = await compress('test data', 'gzip');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should export decompress function', async () => {
      const compressed = await compress('test data', 'gzip');
      const decompressed = await decompress(compressed, 'gzip');
      expect(decompressed.toString('utf-8')).toBe('test data');
    });

    it('should export shouldCompress function', () => {
      expect(shouldCompress('small')).toBe(false);
      expect(shouldCompress('x'.repeat(2000))).toBe(true);
    });

    it('should export getCompressionRatio function', () => {
      expect(getCompressionRatio(1000, 400)).toBe(60);
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const compressed = await CompressionModule.compress('', 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      expect(decompressed.toString('utf-8')).toBe('');
    });

    it('should handle empty object', async () => {
      const compressed = await CompressionModule.compress({}, 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      expect(JSON.parse(decompressed.toString('utf-8'))).toEqual({});
    });

    it('should handle special characters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const compressed = await CompressionModule.compress(specialChars, 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      expect(decompressed.toString('utf-8')).toBe(specialChars);
    });

    it('should handle unicode characters', async () => {
      const unicode = '你好世界 مرحبا بالعالم 🌍🚀';
      const compressed = await CompressionModule.compress(unicode, 'gzip');
      const decompressed = await CompressionModule.decompress(compressed, 'gzip');
      expect(decompressed.toString('utf-8')).toBe(unicode);
    });
  });

  describe('compression effectiveness', () => {
    it('should achieve at least 60% compression for large JSON', async () => {
      const result = await CompressionModule.compressWithMetadata(largeData, {
        encoding: 'gzip',
      });
      
      // Large JSON data should compress well
      expect(result.compressionRatio).toBeGreaterThanOrEqual(60);
    });

    it('should compress better with brotli than gzip for text data', async () => {
      const textData = 'Lorem ipsum dolor sit amet, '.repeat(100);
      
      const gzipResult = await CompressionModule.compressWithMetadata(textData, {
        encoding: 'gzip',
      });
      
      const brotliResult = await CompressionModule.compressWithMetadata(textData, {
        encoding: 'brotli',
      });
      
      // Brotli should produce smaller or equal size
      expect(brotliResult.compressedSize).toBeLessThanOrEqual(gzipResult.compressedSize);
    });
  });
});
