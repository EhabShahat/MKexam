# RTL (Right-to-Left) Testing Guide

## Overview

This guide provides comprehensive testing procedures for validating all performance optimizations work correctly with RTL (Right-to-Left) layout, specifically for Arabic language support. The application uses the Tajawal font and supports full RTL layout.

## RTL Configuration

### Current Implementation

The application detects RTL based on the `lang` attribute and applies appropriate styling:

```typescript
// In layout.tsx
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

### CSS RTL Support

The application uses Tailwind CSS with RTL support through logical properties:
- `ms-*` (margin-start) instead of `ml-*` (margin-left)
- `me-*` (margin-end) instead of `mr-*` (margin-right)
- `ps-*` (padding-start) instead of `pl-*` (padding-left)
- `pe-*` (padding-end) instead of `pr-*` (padding-right)

## Testing Procedures

### 1. List Virtualization with RTL

#### Test: Virtualized Student List in Arabic
**Location**: `/admin/students` (with Arabic locale)

**Setup**:
1. Switch application to Arabic language
2. Verify `dir="rtl"` is set on `<html>` element
3. Open student list with 500+ students

**Test Steps**:
1. Verify list renders correctly in RTL
2. Check scroll direction (right-to-left for horizontal scroll)
3. Verify scrollbar appears on left side
4. Test scroll performance (should maintain 60 FPS)
5. Verify item alignment (text aligned to right)
6. Test scroll position restoration
7. Verify buffer zones work correctly in RTL

**Expected Results**:
- ✅ List renders with correct RTL alignment
- ✅ Scrollbar on left side (browser default)
- ✅ Smooth scrolling performance maintained
- ✅ Text properly aligned to right
- ✅ Scroll position restoration works
- ✅ No layout shifts during scroll

**Validation Code**:
```javascript
// Check RTL configuration
const html = document.documentElement;
console.assert(html.dir === 'rtl', 'HTML dir should be rtl');
console.assert(html.lang === 'ar', 'HTML lang should be ar');

// Check virtualized list
const listContainer = document.querySelector('[data-virtualized="true"]');
const computedStyle = window.getComputedStyle(listContainer);
console.assert(computedStyle.direction === 'rtl', 'List direction should be rtl');
```

#### Test: Exam Results Table in Arabic
**Location**: `/admin/results`

**Test Steps**:
1. Open results page in Arabic
2. Verify table columns render right-to-left
3. Test horizontal scroll (if applicable)
4. Verify virtualization works with RTL
5. Test column alignment
6. Verify action buttons positioned correctly

**Expected Results**:
- ✅ Table columns in correct RTL order
- ✅ Horizontal scroll works naturally
- ✅ Virtualization maintains performance
- ✅ Action buttons on correct side

#### Test: Question List with Drag-and-Drop
**Location**: `/admin/exams/[examId]` (edit mode)

**Test Steps**:
1. Open exam editor in Arabic
2. Verify question list renders RTL
3. Test drag-and-drop reordering
4. Verify drop indicators appear correctly
5. Test virtualization with reordering

**Expected Results**:
- ✅ Questions render RTL
- ✅ Drag-and-drop works naturally
- ✅ Drop indicators positioned correctly
- ✅ Reordering updates correctly

### 2. Image Lazy Loading with RTL

#### Test: Student Photos in RTL Layout
**Location**: `/admin/results`

**Test Steps**:
1. Open results page in Arabic
2. Verify student photos align correctly
3. Test lazy loading as user scrolls
4. Verify skeleton placeholders render RTL
5. Check image captions/labels alignment
6. Test error fallback alignment

**Expected Results**:
- ✅ Images aligned correctly in RTL
- ✅ Lazy loading works regardless of direction
- ✅ Skeletons render with correct alignment
- ✅ Captions aligned to right
- ✅ Error fallbacks positioned correctly

**Validation Code**:
```javascript
// Check LazyImage component in RTL
const images = document.querySelectorAll('[data-lazy-image]');
images.forEach(img => {
  const container = img.closest('.image-container');
  const style = window.getComputedStyle(container);
  console.assert(style.direction === 'rtl', 'Image container should inherit RTL');
});
```

#### Test: Exam Question Images
**Location**: `/attempt/[attemptId]` (Arabic exam)

**Test Steps**:
1. Start exam in Arabic
2. Navigate to questions with images
3. Verify images load correctly
4. Check image positioning relative to text
5. Test layout shift prevention
6. Verify aspect ratio preservation

**Expected Results**:
- ✅ Images load progressively
- ✅ Images positioned correctly with RTL text
- ✅ No layout shifts
- ✅ Aspect ratios maintained

### 3. Arabic Text Rendering

#### Test: Tajawal Font Loading
**Location**: All pages

**Test Steps**:
1. Open any page in Arabic
2. Check font loading in DevTools
3. Verify Tajawal font is applied
4. Test font-display: swap behavior
5. Verify no FOUT (Flash of Unstyled Text)

**Expected Results**:
- ✅ Tajawal font loads correctly
- ✅ Font-display: swap prevents blocking
- ✅ Minimal or no FOUT
- ✅ Text readable during font load

**Validation Code**:
```javascript
// Check font loading
document.fonts.ready.then(() => {
  const element = document.querySelector('body');
  const font = window.getComputedStyle(element).fontFamily;
  console.assert(font.includes('Tajawal'), 'Tajawal font should be applied');
});
```

#### Test: Arabic Text in Virtualized Lists
**Location**: `/admin/students`, `/admin/exams`

**Test Steps**:
1. Ensure data contains Arabic text
2. Open virtualized list
3. Verify Arabic text renders correctly
4. Test text wrapping behavior
5. Verify text doesn't overflow containers
6. Test with long Arabic names

**Expected Results**:
- ✅ Arabic text renders clearly
- ✅ Text wraps correctly
- ✅ No overflow issues
- ✅ Proper line height for Arabic

### 4. Optimistic UI Updates with RTL

#### Test: Exam Save with Arabic Content
**Location**: `/admin/exams/[examId]`

**Test Steps**:
1. Edit exam with Arabic title and description
2. Save changes
3. Verify optimistic update displays correctly
4. Check toast notifications in RTL
5. Verify loading indicators positioned correctly
6. Test rollback with Arabic content

**Expected Results**:
- ✅ Optimistic update shows Arabic correctly
- ✅ Toast notifications aligned to right
- ✅ Loading indicators positioned correctly
- ✅ Rollback preserves Arabic text

#### Test: Student Edit Modal in Arabic
**Location**: `/admin/students`

**Test Steps**:
1. Open student edit modal in Arabic
2. Modify student name (Arabic text)
3. Save changes
4. Verify modal closes with correct animation
5. Check list updates optimistically
6. Verify Arabic text displays correctly

**Expected Results**:
- ✅ Modal animates correctly in RTL
- ✅ Form fields aligned to right
- ✅ Optimistic update preserves Arabic
- ✅ List updates smoothly

### 5. Code Splitting with RTL

#### Test: Dynamic Import of RTL Components
**Location**: Various admin pages

**Test Steps**:
1. Clear browser cache
2. Navigate to admin dashboard in Arabic
3. Verify initial bundle loads
4. Open modals/dialogs
5. Check dynamic imports work
6. Verify RTL styling loads correctly

**Expected Results**:
- ✅ Initial bundle includes RTL styles
- ✅ Dynamic imports work in RTL
- ✅ No style flashing
- ✅ Components render correctly

#### Test: Lazy-Loaded Charts in Arabic
**Location**: `/admin/results/analysis`

**Test Steps**:
1. Navigate to analytics page in Arabic
2. Verify charts load dynamically
3. Check chart labels in Arabic
4. Verify chart legend alignment
5. Test chart tooltips in RTL

**Expected Results**:
- ✅ Charts load correctly
- ✅ Arabic labels render properly
- ✅ Legend aligned to right
- ✅ Tooltips positioned correctly

### 6. Navigation and Layout

#### Test: Sidebar Navigation in RTL
**Location**: All admin pages

**Test Steps**:
1. Open admin panel in Arabic
2. Verify sidebar on correct side (right)
3. Test navigation menu items
4. Check icon positioning
5. Verify active state indicators
6. Test collapse/expand behavior

**Expected Results**:
- ✅ Sidebar on right side
- ✅ Menu items aligned correctly
- ✅ Icons positioned to right of text
- ✅ Active indicators on correct side
- ✅ Animations work naturally

#### Test: Breadcrumbs in RTL
**Location**: Pages with breadcrumbs

**Test Steps**:
1. Navigate to nested pages in Arabic
2. Verify breadcrumb direction (right-to-left)
3. Check separator icons
4. Test breadcrumb navigation
5. Verify truncation behavior

**Expected Results**:
- ✅ Breadcrumbs flow right-to-left
- ✅ Separators point correctly
- ✅ Navigation works correctly
- ✅ Truncation preserves readability

### 7. Forms and Inputs

#### Test: Form Fields in RTL
**Location**: All forms in Arabic

**Test Steps**:
1. Open any form in Arabic
2. Verify input fields aligned to right
3. Test text input direction
4. Check placeholder text alignment
5. Verify validation messages
6. Test select dropdowns

**Expected Results**:
- ✅ Fields aligned to right
- ✅ Text input flows right-to-left
- ✅ Placeholders aligned correctly
- ✅ Validation messages positioned correctly
- ✅ Dropdowns open correctly

#### Test: Rich Text Editor (React Quill) in Arabic
**Location**: Question editor

**Test Steps**:
1. Open question editor in Arabic
2. Type Arabic text
3. Verify text direction
4. Test formatting buttons
5. Check toolbar positioning
6. Test copy/paste Arabic text

**Expected Results**:
- ✅ Text flows right-to-left
- ✅ Cursor positioned correctly
- ✅ Formatting works correctly
- ✅ Toolbar aligned appropriately
- ✅ Copy/paste preserves direction

### 8. Performance with RTL

#### Test: Performance Metrics in Arabic
**Location**: All pages

**Test Steps**:
1. Run Lighthouse audit in Arabic
2. Measure FCP, TTI, CLS
3. Compare with LTR metrics
4. Test scroll FPS in RTL
5. Measure bundle size difference

**Expected Results**:
- ✅ FCP < 1.5s (same as LTR)
- ✅ TTI < 2.5s (same as LTR)
- ✅ CLS < 0.1 (same as LTR)
- ✅ Scroll FPS ≥ 60 (same as LTR)
- ✅ Bundle size similar to LTR

**Validation Script**:
```javascript
// Measure RTL performance
async function measureRTLPerformance() {
  const metrics = {};
  
  // Set to Arabic
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  
  // Measure FCP
  const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
  metrics.fcp = fcpEntry?.startTime;
  
  // Measure CLS
  let cls = 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        cls += entry.value;
      }
    }
  });
  observer.observe({ type: 'layout-shift', buffered: true });
  
  setTimeout(() => {
    metrics.cls = cls;
    observer.disconnect();
    console.log('RTL Performance Metrics:', metrics);
  }, 3000);
}
```

## Common RTL Issues and Solutions

### Issue: Scrollbar on Wrong Side
**Symptoms**: Scrollbar appears on right in RTL
**Solution**: This is browser default behavior and is correct for RTL

### Issue: Icons Not Flipping
**Symptoms**: Directional icons (arrows) don't flip in RTL
**Solution**: Use CSS `transform: scaleX(-1)` for directional icons in RTL

```css
[dir="rtl"] .icon-arrow-right {
  transform: scaleX(-1);
}
```

### Issue: Animations Going Wrong Direction
**Symptoms**: Slide animations go wrong way in RTL
**Solution**: Use logical properties or RTL-aware animation libraries

```css
/* Instead of */
.slide-in {
  animation: slideFromLeft 0.3s;
}

/* Use */
.slide-in {
  animation: slideFromStart 0.3s;
}

@keyframes slideFromStart {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

[dir="rtl"] @keyframes slideFromStart {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

### Issue: Text Overflow in RTL
**Symptoms**: Arabic text overflows containers
**Solution**: Ensure proper word-break and overflow handling

```css
.text-container {
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}
```

### Issue: Mixed LTR/RTL Content
**Symptoms**: English text in Arabic context renders incorrectly
**Solution**: Use Unicode bidirectional algorithm markers

```html
<!-- For mixed content -->
<span dir="auto">Mixed content here</span>
```

## Automated RTL Testing

### Test Script

```javascript
// scripts/test-rtl.js
const puppeteer = require('puppeteer');

async function testRTL() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Navigate to page
  await page.goto('http://localhost:3000/admin/students');
  
  // Switch to Arabic
  await page.evaluate(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  });
  
  // Wait for re-render
  await page.waitForTimeout(1000);
  
  // Check RTL configuration
  const isRTL = await page.evaluate(() => {
    return {
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      direction: window.getComputedStyle(document.body).direction,
    };
  });
  
  console.log('RTL Configuration:', isRTL);
  
  // Test virtualization
  const virtualization = await page.evaluate(() => {
    const list = document.querySelector('[data-virtualized="true"]');
    return {
      exists: !!list,
      direction: list ? window.getComputedStyle(list).direction : null,
    };
  });
  
  console.log('Virtualization RTL:', virtualization);
  
  // Test scroll performance
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let frames = 0;
      const startTime = performance.now();
      
      const scroll = () => {
        window.scrollBy(0, 10);
        frames++;
        
        if (performance.now() - startTime < 1000) {
          requestAnimationFrame(scroll);
        } else {
          resolve(frames);
        }
      };
      
      requestAnimationFrame(scroll);
    });
  });
  
  await browser.close();
}

testRTL().catch(console.error);
```

## Testing Checklist

### Pre-Testing Setup
- [ ] Verify Tajawal font is loaded
- [ ] Check RTL CSS is included
- [ ] Prepare Arabic test data
- [ ] Clear browser cache

### Virtualization Testing
- [ ] Test student list in RTL
- [ ] Test exam list in RTL
- [ ] Test results table in RTL
- [ ] Verify scroll performance
- [ ] Test scroll position restoration

### Image Loading Testing
- [ ] Test lazy loading in RTL
- [ ] Verify skeleton placeholders
- [ ] Test error fallbacks
- [ ] Check image alignment

### Text Rendering Testing
- [ ] Verify Tajawal font loads
- [ ] Test Arabic text in lists
- [ ] Test text wrapping
- [ ] Check text overflow handling

### UI Updates Testing
- [ ] Test optimistic updates with Arabic
- [ ] Verify toast notifications in RTL
- [ ] Test modal animations
- [ ] Check loading indicators

### Navigation Testing
- [ ] Test sidebar in RTL
- [ ] Verify breadcrumbs
- [ ] Test menu items
- [ ] Check active states

### Forms Testing
- [ ] Test input fields in RTL
- [ ] Verify placeholders
- [ ] Test validation messages
- [ ] Check select dropdowns

### Performance Testing
- [ ] Run Lighthouse in Arabic
- [ ] Measure FCP, TTI, CLS
- [ ] Test scroll FPS
- [ ] Compare with LTR metrics

## Conclusion

Thorough RTL testing ensures that all performance optimizations work correctly with Arabic language and right-to-left layout. The application should provide the same excellent performance and user experience regardless of text direction.
