import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for cross-browser consistency
 * Captures screenshots of key pages in both light and dark modes
 * Requirements: 5.2, 5.5
 */

// Key pages to test
const pages = [
  { path: '/', name: 'home' },
  { path: '/admin/login', name: 'admin-login' },
  { path: '/exams', name: 'exams-list' },
  { path: '/results', name: 'results-portal' },
];

test.describe('Visual Regression - Light Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set light mode before each test
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
  });

  for (const { path, name } of pages) {
    test(`${name} page renders consistently in light mode`, async ({ page, browserName }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      // Wait for any animations to complete
      await page.waitForTimeout(500);
      
      // Take screenshot
      await expect(page).toHaveScreenshot(`${name}-light-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

test.describe('Visual Regression - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set dark mode before each test
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    });
  });

  for (const { path, name } of pages) {
    test(`${name} page renders consistently in dark mode`, async ({ page, browserName }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      // Wait for any animations to complete
      await page.waitForTimeout(500);
      
      // Take screenshot
      await expect(page).toHaveScreenshot(`${name}-dark-${browserName}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

test.describe('Visual Regression - Theme Toggle', () => {
  test('theme toggle button renders consistently', async ({ page, browserName }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Find theme toggle button
    const themeToggle = page.locator('button[role="switch"]').first();
    
    if (await themeToggle.count() > 0) {
      // Screenshot in dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(200);
      
      await expect(themeToggle).toHaveScreenshot(`theme-toggle-dark-${browserName}.png`);
      
      // Screenshot in light mode
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });
      await page.waitForTimeout(200);
      
      await expect(themeToggle).toHaveScreenshot(`theme-toggle-light-${browserName}.png`);
    }
  });
});

test.describe('Visual Regression - Components', () => {
  test('buttons render consistently across browsers', async ({ page, browserName }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Find submit button
    const submitButton = page.locator('button[type="submit"]').first();
    
    if (await submitButton.count() > 0) {
      await expect(submitButton).toHaveScreenshot(`button-${browserName}.png`);
    }
  });

  test('form inputs render consistently across browsers', async ({ page, browserName }) => {
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    
    // Find input fields
    const inputs = page.locator('input[type="text"], input[type="password"]');
    const count = await inputs.count();
    
    if (count > 0) {
      const firstInput = inputs.first();
      await expect(firstInput).toHaveScreenshot(`input-${browserName}.png`);
    }
  });
});

test.describe('Visual Regression - Color Consistency', () => {
  test('dark mode background colors are consistent', async ({ page, browserName }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'dark');
      document.documentElement.classList.add('dark');
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Get computed background color
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Store for comparison (in real scenario, would compare against baseline)
    console.log(`${browserName} dark background:`, backgroundColor);
    
    // Verify it's a dark color
    const isDark = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        // Dark colors should have low RGB values
        return r < 100 && g < 100 && b < 100;
      }
      return false;
    });
    
    expect(isDark).toBeTruthy();
  });

  test('light mode background colors are consistent', async ({ page, browserName }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Get computed background color
    const backgroundColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    // Store for comparison
    console.log(`${browserName} light background:`, backgroundColor);
    
    // Verify it's a light color
    const isLight = await page.evaluate(() => {
      const bg = window.getComputedStyle(document.body).backgroundColor;
      const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        // Light colors should have high RGB values
        return r > 200 || g > 200 || b > 200;
      }
      return false;
    });
    
    expect(isLight).toBeTruthy();
  });
});

test.describe('Visual Regression - RTL Support', () => {
  test('RTL layout renders consistently in dark mode', async ({ page, browserName }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('dir', 'rtl');
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot(`rtl-dark-${browserName}.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('RTL layout renders consistently in light mode', async ({ page, browserName }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme-preference', 'light');
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('dir', 'rtl');
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(page).toHaveScreenshot(`rtl-light-${browserName}.png`, {
      fullPage: true,
      animations: 'disabled',
    });
  });
});
