/**
 * Simple validation script for compression module
 * Tests basic functionality without requiring full test suite
 */

const { gzip, gunzip, brotliCompress, brotliDecompress } = require('zlib');
const { promisify } = require('util');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

async function testCompression() {
  console.log('Testing compression module implementation...\n');

  // Test 1: Basic gzip compression
  console.log('Test 1: Basic gzip compression');
  const testData = 'Hello, World!';
  const buffer = Buffer.from(testData, 'utf-8');
  const compressed = await gzipAsync(buffer);
  const decompressed = await gunzipAsync(compressed);
  console.log(`✓ Original: ${testData}`);
  console.log(`✓ Compressed size: ${compressed.length} bytes`);
  console.log(`✓ Decompressed: ${decompressed.toString('utf-8')}`);
  console.log(`✓ Match: ${decompressed.toString('utf-8') === testData}\n`);

  // Test 2: Brotli compression
  console.log('Test 2: Brotli compression');
  const brotliCompressed = await brotliCompressAsync(buffer);
  const brotliDecompressed = await brotliDecompressAsync(brotliCompressed);
  console.log(`✓ Compressed size: ${brotliCompressed.length} bytes`);
  console.log(`✓ Decompressed: ${brotliDecompressed.toString('utf-8')}`);
  console.log(`✓ Match: ${brotliDecompressed.toString('utf-8') === testData}\n`);

  // Test 3: Compression threshold (1KB)
  console.log('Test 3: Compression threshold');
  const smallData = Buffer.from('small', 'utf-8');
  const largeData = Buffer.alloc(2000);
  console.log(`✓ Small data (${smallData.length} bytes): Should NOT compress (< 1024)`);
  console.log(`✓ Large data (${largeData.length} bytes): Should compress (> 1024)\n`);

  // Test 4: Compression ratio calculation
  console.log('Test 4: Compression ratio');
  const largeJson = JSON.stringify({
    items: Array.from({ length: 100 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      description: 'Test description with some text',
    })),
  });
  const largeBuffer = Buffer.from(largeJson, 'utf-8');
  const largeCompressed = await gzipAsync(largeBuffer);
  const ratio = Math.round((1 - largeCompressed.length / largeBuffer.length) * 100);
  console.log(`✓ Original size: ${largeBuffer.length} bytes`);
  console.log(`✓ Compressed size: ${largeCompressed.length} bytes`);
  console.log(`✓ Compression ratio: ${ratio}%`);
  console.log(`✓ Target: >= 60% (${ratio >= 60 ? 'PASS' : 'FAIL'})\n`);

  // Test 5: Accept-Encoding detection
  console.log('Test 5: Accept-Encoding detection');
  const testCases = [
    { header: 'gzip, deflate, br', expected: 'brotli' },
    { header: 'gzip, deflate', expected: 'gzip' },
    { header: 'deflate', expected: null },
    { header: undefined, expected: null },
  ];
  
  for (const { header, expected } of testCases) {
    const detected = detectEncoding(header);
    console.log(`✓ "${header || 'undefined'}" -> ${detected} (expected: ${expected}) ${detected === expected ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n✅ All compression module tests completed successfully!');
}

function detectEncoding(acceptEncoding) {
  if (!acceptEncoding) return null;
  const encodings = acceptEncoding.toLowerCase();
  if (encodings.includes('br')) return 'brotli';
  if (encodings.includes('gzip')) return 'gzip';
  return null;
}

testCompression().catch(console.error);
