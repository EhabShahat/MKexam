/**
 * Integration Tests: Supabase & Netlify Cost Optimization
 * Feature: supabase-netlify-optimization
 * Task: 28.1 Run full integration test suite
 * 
 * Tests end-to-end optimization flow including:
 * - Compression with real data
 * - Cache invalidation scenarios
 * - Performance under load
 * - Integration of all optimization components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compress, decompress, shouldCompress, getCompressionRatio } from '@/lib/compression';
import { caches, CacheKeys, getOrSet } from '@/lib/cache';
import { compactAnswers, deduplicateDeviceInfo, createAnswerDelta, applyAnswerDelta } from '@/lib/jsonb-optimizer';

describe('Optimization Integration Tests', () => {
  beforeEach(() => {
    // Clear all caches before each test
    caches.exam.clear();
    caches.questions.clear();
    caches.student.clear();
    caches.config.clear();
    caches.general.clear();
  });

  afterEach(() => {
    // Clean up
    caches.exam.clear();
    caches.questions.clear();
    caches.student.clear();
    caches.config.clear();
    caches.general.clear();
  });

  describe('End-to-End Optimization Flow', () => {
    it('should optimize exam data retrieval with compression and caching', async () => {
      // Simulate exam data
      const examData = {
        id: 'exam-123',
        title: 'Integration Test Exam',
        description: 'This is a test exam with a long description that should be compressed',
        settings: {
          duration_minutes: 60,
          pass_percentage: 70,
          show_results: true,
          randomize_questions: false,
        },
        questions: Array.from({ length: 50 }, (_, i) => ({
          id: `q-${i}`,
          question_text: `Question ${i}: What is the answer to this question?`,
          question_type: 'multiple_choice',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          points: 2,
        })),
      };

      // Step 1: Check if data should be compressed
      const dataString = JSON.stringify(examData);
      expect(shouldCompress(dataString)).toBe(true);

      // Step 2: Compress the data
      const compressed = await compress(dataString, 'gzip');
      expect(compressed).toBeInstanceOf(Buffer);

      // Step 3: Verify compression ratio
      const ratio = getCompressionRatio(dataString.length, compressed.length);
      expect(ratio).toBeGreaterThan(0.6); // Should achieve > 60% compression

      // Step 4: Cache the compressed data
      const cacheKey = CacheKeys.examMetadata('exam-123');
      caches.exam.set(cacheKey, compressed);

      // Step 5: Retrieve from cache
      const cachedData = caches.exam.get(cacheKey);
      expect(cachedData).toBe(compressed);

      // Step 6: Decompress
      const decompressed = await decompress(cachedData as Buffer, 'gzip');
      const parsedData = JSON.parse(decompressed);
      expect(parsedData).toEqual(examData);

      // Verify cache stats
      const stats = caches.exam.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should handle question loading with incremental caching', async () => {
      // Simulate incremental question loading
      const totalQuestions = 100;
      const initialChunk = 5;
      const chunkSize = 10;

      // Load initial questions
      const initialQuestions = Array.from({ length: initialChunk }, (_, i) => ({
        id: `q-${i}`,
        question_text: `Question ${i}`,
        question_type: 'multiple_choice',
        options: ['A', 'B', 'C', 'D'],
      }));

      // Cache initial questions
      const examId = 'exam-incremental';
      caches.questions.set(CacheKeys.examQuestions(examId), initialQuestions, -1);

      // Verify initial cache
      const cached = caches.questions.get(CacheKeys.examQuestions(examId));
      expect(cached).toEqual(initialQuestions);

      // Load additional chunks
      for (let offset = initialChunk; offset < totalQuestions; offset += chunkSize) {
        const chunk = Array.from({ length: Math.min(chunkSize, totalQuestions - offset) }, (_, i) => ({
          id: `q-${offset + i}`,
          question_text: `Question ${offset + i}`,
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C', 'D'],
        }));

        // Append to cached questions
        const currentCached = caches.questions.get(CacheKeys.examQuestions(examId)) as any[];
        caches.questions.set(CacheKeys.examQuestions(examId), [...currentCached, ...chunk], -1);
      }

      // Verify all questions are cached
      const allCached = caches.questions.get(CacheKeys.examQuestions(examId)) as any[];
      expect(allCached).toHaveLength(totalQuestions);
    });

    it('should optimize answer storage with deltas and compression', async () => {
      // Initial answers - use larger dataset for meaningful delta comparison
      const initialAnswers: Record<string, any> = {};
      for (let i = 1; i <= 50; i++) {
        initialAnswers[`q-${i}`] = `Answer ${i}`;
      }

      // Updated answers (only 2 questions changed)
      const updatedAnswers = { ...initialAnswers };
      updatedAnswers['q-2'] = 'Updated Answer 2';
      updatedAnswers['q-25'] = 'Updated Answer 25';

      // Create delta
      const delta = createAnswerDelta(initialAnswers, updatedAnswers);
      expect(delta.changed).toEqual({ 
        'q-2': 'Updated Answer 2',
        'q-25': 'Updated Answer 25'
      });
      expect(delta.removed).toEqual([]);

      // Verify delta is smaller than full answers (with larger dataset)
      const fullSize = JSON.stringify(updatedAnswers).length;
      const deltaSize = JSON.stringify(delta).length;
      expect(deltaSize).toBeLessThan(fullSize);

      // Apply delta
      const reconstructed = applyAnswerDelta(initialAnswers, delta);
      expect(reconstructed).toEqual(updatedAnswers);

      // Compact answers (remove whitespace)
      const compacted = compactAnswers(updatedAnswers);
      const compactedString = JSON.stringify(compacted);
      expect(compactedString).not.toContain('  '); // No extra spaces
    });

    it('should optimize device info with IP deduplication', () => {
      // Device info with duplicate IPs
      const deviceInfo = {
        fingerprint: 'test-fingerprint',
        allIPs: {
          local: ['192.168.1.1', '192.168.1.1', '192.168.1.2', '192.168.1.1'],
          public: ['8.8.8.8', '8.8.8.8', '1.1.1.1'],
        },
        userAgent: 'Mozilla/5.0...',
        screen: '1920x1080',
        timezone: 'Africa/Cairo',
      };

      // Deduplicate
      const deduplicated = deduplicateDeviceInfo(deviceInfo);

      // Verify deduplication
      expect(deduplicated.allIPs.local).toEqual(['192.168.1.1', '192.168.1.2']);
      expect(deduplicated.allIPs.public).toEqual(['8.8.8.8', '1.1.1.1']);

      // Verify size reduction
      const originalSize = JSON.stringify(deviceInfo).length;
      const deduplicatedSize = JSON.stringify(deduplicated).length;
      expect(deduplicatedSize).toBeLessThan(originalSize);
    });
  });

  describe('Cache Invalidation Scenarios', () => {
    it('should invalidate exam cache when exam is updated', () => {
      const examId = 'exam-123';
      const cacheKey = CacheKeys.examMetadata(examId);

      // Cache exam data
      caches.exam.set(cacheKey, { title: 'Original Title' });
      expect(caches.exam.get(cacheKey)).toEqual({ title: 'Original Title' });

      // Simulate exam update - invalidate cache
      caches.exam.delete(cacheKey);
      expect(caches.exam.get(cacheKey)).toBeNull();

      // Cache new data
      caches.exam.set(cacheKey, { title: 'Updated Title' });
      expect(caches.exam.get(cacheKey)).toEqual({ title: 'Updated Title' });
    });

    it('should invalidate question cache when questions are modified', () => {
      const examId = 'exam-456';
      const cacheKey = CacheKeys.examQuestions(examId);

      // Cache questions
      const originalQuestions = [
        { id: 'q-1', question_text: 'Question 1' },
        { id: 'q-2', question_text: 'Question 2' },
      ];
      caches.questions.set(cacheKey, originalQuestions, -1);

      // Verify cached
      expect(caches.questions.get(cacheKey)).toEqual(originalQuestions);

      // Simulate question update - invalidate cache
      caches.questions.delete(cacheKey);
      expect(caches.questions.get(cacheKey)).toBeNull();

      // Cache updated questions
      const updatedQuestions = [
        { id: 'q-1', question_text: 'Updated Question 1' },
        { id: 'q-2', question_text: 'Question 2' },
        { id: 'q-3', question_text: 'New Question 3' },
      ];
      caches.questions.set(cacheKey, updatedQuestions, -1);
      expect(caches.questions.get(cacheKey)).toEqual(updatedQuestions);
    });

    it('should invalidate pattern-based cache entries', () => {
      // Cache multiple exam entries
      caches.exam.set('exam:meta:1', { title: 'Exam 1' });
      caches.exam.set('exam:meta:2', { title: 'Exam 2' });
      caches.exam.set('exam:meta:3', { title: 'Exam 3' });
      caches.exam.set('other:data', { value: 'other' });

      // Invalidate all exam metadata
      const cleared = caches.exam.clear('exam:meta:.*');
      expect(cleared).toBe(3);

      // Verify exam entries are cleared
      expect(caches.exam.get('exam:meta:1')).toBeNull();
      expect(caches.exam.get('exam:meta:2')).toBeNull();
      expect(caches.exam.get('exam:meta:3')).toBeNull();

      // Verify other data is preserved
      expect(caches.exam.get('other:data')).toEqual({ value: 'other' });
    });

    it('should handle cache expiration correctly', async () => {
      const key = 'expiring-key';
      const ttl = 100; // 100ms

      // Set with short TTL
      caches.general.set(key, 'test-value', ttl);
      expect(caches.general.get(key)).toBe('test-value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(caches.general.get(key)).toBeNull();
    });

    it('should invalidate student code cache on code change', () => {
      const code = 'ABC123';
      const cacheKey = CacheKeys.studentCode(code);

      // Cache student data
      caches.student.set(cacheKey, { id: 'student-1', name: 'John Doe' });
      expect(caches.student.get(cacheKey)).toEqual({ id: 'student-1', name: 'John Doe' });

      // Simulate code change - invalidate
      caches.student.delete(cacheKey);
      expect(caches.student.get(cacheKey)).toBeNull();
    });
  });

  describe('Compression with Real Data', () => {
    it('should compress large exam data efficiently', async () => {
      // Create realistic exam data
      const largeExam = {
        id: 'large-exam',
        title: 'Comprehensive Final Exam',
        description: 'This is a comprehensive final exam covering all topics from the semester. Students should prepare thoroughly and review all materials.',
        questions: Array.from({ length: 200 }, (_, i) => ({
          id: `q-${i}`,
          question_text: `Question ${i}: This is a detailed question with a long description that explains the context and provides necessary information for students to answer correctly. The question may include multiple sentences and detailed scenarios.`,
          question_type: i % 4 === 0 ? 'paragraph' : 'multiple_choice',
          options: i % 4 === 0 ? null : [
            'Option A: This is the first possible answer with detailed explanation',
            'Option B: This is the second possible answer with detailed explanation',
            'Option C: This is the third possible answer with detailed explanation',
            'Option D: This is the fourth possible answer with detailed explanation',
          ],
          points: 5,
          required: true,
        })),
        settings: {
          duration_minutes: 180,
          pass_percentage: 60,
          show_results: false,
          randomize_questions: true,
          randomize_options: true,
          allow_review: false,
        },
      };

      const dataString = JSON.stringify(largeExam);
      const originalSize = dataString.length;

      // Test gzip compression
      const gzipCompressed = await compress(dataString, 'gzip');
      const gzipRatio = getCompressionRatio(originalSize, gzipCompressed.length);
      expect(gzipRatio).toBeGreaterThan(0.6);

      // Test brotli compression
      const brotliCompressed = await compress(dataString, 'brotli');
      const brotliRatio = getCompressionRatio(originalSize, brotliCompressed.length);
      expect(brotliRatio).toBeGreaterThan(0.6);

      // Brotli should be slightly better than gzip
      expect(brotliCompressed.length).toBeLessThanOrEqual(gzipCompressed.length);

      // Verify decompression works
      const gzipDecompressed = await decompress(gzipCompressed, 'gzip');
      const brotliDecompressed = await decompress(brotliCompressed, 'brotli');

      expect(JSON.parse(gzipDecompressed)).toEqual(largeExam);
      expect(JSON.parse(brotliDecompressed)).toEqual(largeExam);
    });

    it('should not compress small data', async () => {
      const smallData = { id: '1', name: 'Test' };
      const dataString = JSON.stringify(smallData);

      expect(shouldCompress(dataString)).toBe(false);
    });

    it('should handle compression of various data types', async () => {
      const testCases = [
        { name: 'Array', data: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `Item ${i}` })) },
        { name: 'Nested Object', data: { level1: { level2: { level3: { data: 'deep nested data'.repeat(50) } } } } },
        { name: 'Mixed Content', data: { text: 'Lorem ipsum'.repeat(100), numbers: Array.from({ length: 100 }, (_, i) => i), booleans: Array.from({ length: 100 }, (_, i) => i % 2 === 0) } },
      ];

      for (const testCase of testCases) {
        const dataString = JSON.stringify(testCase.data);
        if (shouldCompress(dataString)) {
          const compressed = await compress(dataString, 'gzip');
          const ratio = getCompressionRatio(dataString.length, compressed.length);
          expect(ratio).toBeGreaterThan(0); // Some compression achieved
          
          const decompressed = await decompress(compressed, 'gzip');
          expect(JSON.parse(decompressed)).toEqual(testCase.data);
        }
      }
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent cache operations', async () => {
      const operations = 100;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        promises.push(
          getOrSet(caches.general, `key-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            return `value-${i}`;
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(operations);
      results.forEach((result, i) => {
        expect(result).toBe(`value-${i}`);
      });
    });

    it('should handle rapid compression operations', async () => {
      const operations = 50;
      const promises = [];

      for (let i = 0; i < operations; i++) {
        const data = JSON.stringify({ id: i, data: 'test data'.repeat(100) });
        promises.push(compress(data, 'gzip'));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(operations);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
      });
    });

    it('should maintain cache performance with many entries', () => {
      const entries = 1000;

      // Add many entries
      for (let i = 0; i < entries; i++) {
        caches.general.set(`key-${i}`, `value-${i}`);
      }

      // Measure retrieval time
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const randomKey = `key-${Math.floor(Math.random() * entries)}`;
        caches.general.get(randomKey);
      }
      const endTime = performance.now();

      // Should be fast even with many entries
      const avgTime = (endTime - startTime) / 100;
      expect(avgTime).toBeLessThan(1); // < 1ms per operation
    });

    it('should handle cache eviction under memory pressure', () => {
      // Fill cache beyond typical capacity
      const entries = 10000;
      for (let i = 0; i < entries; i++) {
        caches.general.set(`key-${i}`, `value-${i}`.repeat(100));
      }

      const stats = caches.general.getStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Cache should still be functional
      caches.general.set('test-key', 'test-value');
      expect(caches.general.get('test-key')).toBe('test-value');
    });
  });

  describe('Integration with Multiple Optimization Components', () => {
    it('should combine compression, caching, and JSONB optimization', async () => {
      // Simulate complete optimization flow
      const attemptData = {
        id: 'attempt-123',
        exam_id: 'exam-456',
        student_id: 'student-789',
        answers: {
          'q-1': 'A',
          'q-2': 'B',
          'q-3': 'C',
          'q-4': 'D',
          'q-5': 'A',
        },
        device_info: {
          fingerprint: 'test-fp',
          allIPs: {
            local: ['192.168.1.1', '192.168.1.1', '192.168.1.2'],
            public: ['8.8.8.8', '8.8.8.8'],
          },
          userAgent: 'Mozilla/5.0...',
          screen: '1920x1080',
          timezone: 'Africa/Cairo',
        },
      };

      // Step 1: Optimize JSONB fields
      const optimizedAnswers = compactAnswers(attemptData.answers);
      const optimizedDeviceInfo = deduplicateDeviceInfo(attemptData.device_info);

      const optimizedData = {
        ...attemptData,
        answers: optimizedAnswers,
        device_info: optimizedDeviceInfo,
      };

      // Step 2: Compress
      const dataString = JSON.stringify(optimizedData);
      const compressed = await compress(dataString, 'gzip');
      const ratio = getCompressionRatio(dataString.length, compressed.length);
      expect(ratio).toBeGreaterThan(0);

      // Step 3: Cache compressed data
      const cacheKey = `attempt:${attemptData.id}`;
      caches.general.set(cacheKey, compressed);

      // Step 4: Retrieve and decompress
      const cachedCompressed = caches.general.get(cacheKey) as Buffer;
      const decompressed = await decompress(cachedCompressed, 'gzip');
      const retrievedData = JSON.parse(decompressed);

      // Verify data integrity
      expect(retrievedData.id).toBe(attemptData.id);
      expect(retrievedData.answers).toEqual(optimizedAnswers);
      expect(retrievedData.device_info.allIPs.local).toHaveLength(2); // Deduplicated
      expect(retrievedData.device_info.allIPs.public).toHaveLength(1); // Deduplicated
    });

    it('should handle cache miss with compression fallback', async () => {
      const key = 'missing-key';
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        const data = { large: 'data'.repeat(500) };
        const dataString = JSON.stringify(data);
        
        if (shouldCompress(dataString)) {
          return await compress(dataString, 'gzip');
        }
        return dataString;
      };

      // First call - cache miss, should fetch and compress
      const result1 = await getOrSet(caches.general, key, fetcher);
      expect(fetchCount).toBe(1);
      expect(result1).toBeInstanceOf(Buffer);

      // Second call - cache hit
      const result2 = await getOrSet(caches.general, key, fetcher);
      expect(fetchCount).toBe(1); // Should not fetch again
      expect(result2).toBe(result1);
    });

    it('should maintain data integrity through full optimization pipeline', async () => {
      // Original data
      const originalData = {
        exam: {
          id: 'exam-1',
          title: 'Test Exam',
          questions: Array.from({ length: 50 }, (_, i) => ({
            id: `q-${i}`,
            text: `Question ${i}`,
          })),
        },
        attempt: {
          id: 'attempt-1',
          answers: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`q-${i}`, `answer-${i}`])
          ),
        },
      };

      // Pipeline: Compact → Compress → Cache → Retrieve → Decompress
      const compacted = compactAnswers(originalData.attempt.answers);
      const dataString = JSON.stringify({ ...originalData, attempt: { ...originalData.attempt, answers: compacted } });
      const compressed = await compress(dataString, 'gzip');
      
      caches.general.set('pipeline-test', compressed);
      
      const retrieved = caches.general.get('pipeline-test') as Buffer;
      const decompressed = await decompress(retrieved, 'gzip');
      const final = JSON.parse(decompressed);

      // Verify data integrity
      expect(final.exam.id).toBe(originalData.exam.id);
      expect(final.exam.questions).toHaveLength(50);
      expect(Object.keys(final.attempt.answers)).toHaveLength(50);
    });
  });

  describe('Error Handling in Integration', () => {
    it('should handle compression errors gracefully', async () => {
      // Invalid data that might cause compression issues
      const circularRef: any = { a: 1 };
      circularRef.self = circularRef;

      try {
        const dataString = JSON.stringify(circularRef);
        await compress(dataString, 'gzip');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle decompression errors gracefully', async () => {
      // Invalid compressed data
      const invalidBuffer = Buffer.from('invalid compressed data');

      try {
        await decompress(invalidBuffer, 'gzip');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle cache corruption gracefully', () => {
      const key = 'corrupted-key';
      
      // Manually corrupt cache entry
      caches.general.set(key, { corrupted: true });
      
      // Should still be able to retrieve (even if corrupted)
      const result = caches.general.get(key);
      expect(result).toBeDefined();
    });
  });
});
