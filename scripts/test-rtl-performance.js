#!/usr/bin/env node

/**
 * RTL Performance Testing Script
 * 
 * This script tests all performance optimizations with RTL (Right-to-Left) layout
 * to ensure Arabic language support works correctly with virtualization,
 * lazy loading, and other optimizations.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Test URLs
const TEST_URLS = [
  { name: 'Admin Dashboard', url: '/admin' },
  { name: 'Student List', url: '/admin/students' },
  { name: 'Exam List', url: '/admin/exams' },
  { name: 'Results Page', url: '/admin/results' },
];

/**
 * Switch page to RTL mode
 */
async function switchToRTL(page) {
  await page.evaluate(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    
    // Trigger re-render if needed
    window.dispatchEvent(new Event('languagechange'));
  });
  
  // Wait for re-render
  await page.waitForTimeout(500);
}

/**
 * Verify RTL configuration
 */
async function verifyRTLConfig(page) {
  return await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    
    return {
      htmlDir: html.dir,
      htmlLang: html.lang,
      bodyDirection: window.getComputedStyle(body).direction,
      isRTL: html.dir === 'rtl' && window.getComputedStyle(body).direction === 'rtl',
    };
  });
}

/**
 * Test virtualization in RTL
 */
async function testVirtualizationRTL(page) {
  const result = await page.evaluate(() => {
    // Find virtualized list
    const list = document.querySelector('[data-virtualized="true"]') 
      || document.querySelector('[role="list"]')
      || document.querySelector('table tbody');
    
    if (!list) {
      return { error: 'No virtualized list found' };
    }
    
    const style = window.getComputedStyle(list);
    const parent = list.parentElement;
    const parentStyle = window.getComputedStyle(parent);
    
    return {
      listDirection: style.direction,
      parentDirection: parentStyle.direction,
      textAlign: style.textAlign,
      renderedItems: list.children.length,
      isRTL: style.direction === 'rtl',
    };
  });
  
  return result;
}

/**
 * Test scroll performance in RTL
 */
async function testScrollPerformanceRTL(page) {
  // Start performance measurement
  await page.evaluate(() => {
    window.scrollFrames = [];
    window.scrollStartTime = performance.now();
    
    const measureFrame = () => {
      window.scrollFrames.push(performance.now());
      if (performance.now() - window.scrollStartTime < 2000) {
        requestAnimationFrame(measureFrame);
      }
    };
    
    requestAnimationFrame(measureFrame);
  });
  
  // Perform scroll
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let scrollTop = 0;
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;
      const scrollStep = viewportHeight / 4;
      
      const scroll = () => {
        scrollTop += scrollStep;
        window.scrollTo(0, scrollTop);
        
        if (scrollTop < scrollHeight - viewportHeight && scrollTop < 2000) {
          requestAnimationFrame(scroll);
        } else {
          setTimeout(resolve, 100);
        }
      };
      
      requestAnimationFrame(scroll);
    });
  });
  
  // Calculate FPS
  const fps = await page.evaluate(() => {
    if (!window.scrollFrames || window.scrollFrames.length < 2) {
      return 0;
    }
    
    const duration = window.scrollFrames[window.scrollFrames.length - 1] - window.scrollFrames[0];
    const frames = window.scrollFrames.length;
    return Math.round((frames / duration) * 1000);
  });
  
  return { fps };
}

/**
 * Test image lazy loading in RTL
 */
async function testImageLoadingRTL(page) {
  const result = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const lazyImages = images.filter(img => 
      img.loading === 'lazy' || 
      img.hasAttribute('data-lazy') ||
      img.closest('[data-lazy-image]')
    );
    
    return {
      totalImages: images.length,
      lazyImages: lazyImages.length,
      imagesWithAlt: images.filter(img => img.alt).length,
      imagesLoaded: images.filter(img => img.complete).length,
    };
  });
  
  return result;
}

/**
 * Test Arabic text rendering
 */
async function testArabicTextRendering(page) {
  const result = await page.evaluate(() => {
    // Check for Arabic text
    const body = document.body;
    const textContent = body.textContent || '';
    const hasArabic = /[\u0600-\u06FF]/.test(textContent);
    
    // Check font
    const computedStyle = window.getComputedStyle(body);
    const fontFamily = computedStyle.fontFamily;
    
    // Check text alignment
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const textAlignments = headings.map(h => window.getComputedStyle(h).textAlign);
    
    return {
      hasArabic,
      fontFamily,
      hasTajawal: fontFamily.includes('Tajawal'),
      textAlignments,
      rightAlignedCount: textAlignments.filter(a => a === 'right' || a === 'start').length,
    };
  });
  
  return result;
}

/**
 * Measure Web Vitals in RTL
 */
async function measureWebVitalsRTL(page) {
  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle').catch(() => {});
  
  const metrics = await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics = {
        fcp: 0,
        lcp: 0,
        cls: 0,
        fid: 0,
      };
      
      // Get FCP
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        metrics.fcp = fcpEntry.startTime;
      }
      
      // Get LCP
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.lcp = lastEntry.startTime;
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      
      // Get CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        }
        metrics.cls = clsValue;
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
      
      // Wait a bit for metrics to settle
      setTimeout(() => {
        observer.disconnect();
        clsObserver.disconnect();
        resolve(metrics);
      }, 2000);
    });
  });
  
  return metrics;
}

/**
 * Run all RTL tests for a page
 */
async function testPageRTL(browser, baseUrl, pageInfo) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${pageInfo.name}`);
  console.log(`URL: ${baseUrl}${pageInfo.url}`);
  console.log('='.repeat(60));
  
  const page = await browser.newPage();
  
  try {
    // Navigate to page
    await page.goto(`${baseUrl}${pageInfo.url}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    // Switch to RTL
    await switchToRTL(page);
    
    // Verify RTL configuration
    console.log('\n1. RTL Configuration:');
    const rtlConfig = await verifyRTLConfig(page);
    console.log(JSON.stringify(rtlConfig, null, 2));
    
    if (!rtlConfig.isRTL) {
      console.log('❌ RTL not properly configured');
      return { success: false, error: 'RTL not configured' };
    }
    console.log('✅ RTL properly configured');
    
    // Test virtualization
    console.log('\n2. Virtualization in RTL:');
    const virtualization = await testVirtualizationRTL(page);
    console.log(JSON.stringify(virtualization, null, 2));
    
    if (virtualization.error) {
      console.log('⚠️  No virtualized list found (may not be applicable)');
    } else if (virtualization.isRTL) {
      console.log('✅ Virtualization works in RTL');
    } else {
      console.log('❌ Virtualization not properly configured for RTL');
    }
    
    // Test scroll performance
    console.log('\n3. Scroll Performance:');
    const scrollPerf = await testScrollPerformanceRTL(page);
    console.log(JSON.stringify(scrollPerf, null, 2));
    
    if (scrollPerf.fps >= 55) {
      console.log(`✅ Scroll performance good: ${scrollPerf.fps} FPS`);
    } else if (scrollPerf.fps > 0) {
      console.log(`⚠️  Scroll performance below target: ${scrollPerf.fps} FPS (target: 60 FPS)`);
    } else {
      console.log('⚠️  Could not measure scroll performance');
    }
    
    // Test image loading
    console.log('\n4. Image Lazy Loading:');
    const imageLoading = await testImageLoadingRTL(page);
    console.log(JSON.stringify(imageLoading, null, 2));
    
    if (imageLoading.lazyImages > 0) {
      console.log(`✅ Lazy loading enabled for ${imageLoading.lazyImages} images`);
    } else if (imageLoading.totalImages > 0) {
      console.log('⚠️  No lazy-loaded images found');
    } else {
      console.log('ℹ️  No images on this page');
    }
    
    // Test Arabic text rendering
    console.log('\n5. Arabic Text Rendering:');
    const textRendering = await testArabicTextRendering(page);
    console.log(JSON.stringify(textRendering, null, 2));
    
    if (textRendering.hasTajawal) {
      console.log('✅ Tajawal font loaded');
    } else {
      console.log('⚠️  Tajawal font not detected');
    }
    
    if (textRendering.rightAlignedCount > 0) {
      console.log('✅ Text properly aligned for RTL');
    }
    
    // Measure Web Vitals
    console.log('\n6. Web Vitals in RTL:');
    const vitals = await measureWebVitalsRTL(page);
    console.log(JSON.stringify(vitals, null, 2));
    
    const vitalsPass = {
      fcp: vitals.fcp < 1800,
      lcp: vitals.lcp < 2500,
      cls: vitals.cls < 0.1,
    };
    
    console.log(`FCP: ${vitals.fcp.toFixed(0)}ms ${vitalsPass.fcp ? '✅' : '❌'} (target: < 1800ms)`);
    console.log(`LCP: ${vitals.lcp.toFixed(0)}ms ${vitalsPass.lcp ? '✅' : '❌'} (target: < 2500ms)`);
    console.log(`CLS: ${vitals.cls.toFixed(3)} ${vitalsPass.cls ? '✅' : '❌'} (target: < 0.1)`);
    
    return {
      success: true,
      rtlConfig,
      virtualization,
      scrollPerf,
      imageLoading,
      textRendering,
      vitals,
      vitalsPass,
    };
    
  } catch (error) {
    console.error('❌ Error testing page:', error.message);
    return { success: false, error: error.message };
  } finally {
    await page.close();
  }
}

/**
 * Main test runner
 */
async function runRTLTests() {
  console.log('RTL Performance Testing');
  console.log('='.repeat(60));
  console.log('Testing all performance optimizations with RTL layout\n');
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
  console.log(`Base URL: ${baseUrl}\n`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const results = [];
  
  for (const pageInfo of TEST_URLS) {
    const result = await testPageRTL(browser, baseUrl, pageInfo);
    results.push({
      page: pageInfo.name,
      ...result,
    });
  }
  
  await browser.close();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\nPages tested: ${results.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${results.length - successCount}`);
  
  // Check if all critical metrics pass
  const allVitalsPass = results.every(r => 
    r.vitalsPass && 
    r.vitalsPass.fcp && 
    r.vitalsPass.lcp && 
    r.vitalsPass.cls
  );
  
  if (allVitalsPass) {
    console.log('\n✅ All Web Vitals targets met in RTL mode');
  } else {
    console.log('\n⚠️  Some Web Vitals targets not met in RTL mode');
  }
  
  // Save results
  const resultsPath = path.join(__dirname, '..', '.kiro', 'specs', 'performance-optimization-and-backend-fixes', 'rtl-test-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);
  
  process.exit(allVitalsPass ? 0 : 1);
}

// Run tests
if (require.main === module) {
  runRTLTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  switchToRTL,
  verifyRTLConfig,
  testVirtualizationRTL,
  testScrollPerformanceRTL,
  testImageLoadingRTL,
  testArabicTextRendering,
  measureWebVitalsRTL,
  testPageRTL,
  runRTLTests,
};