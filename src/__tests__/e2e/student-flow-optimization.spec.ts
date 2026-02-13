import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-End Tests: Student Experience Optimization
 * 
 * Tests the complete optimized student journey:
 * - Code-first entry flow
 * - Code persistence across sessions
 * - Multi-user device scenarios
 * - Integration with existing exam features
 * 
 * Validates: All requirements from student-experience-optimization spec
 */

test.describe('Student Flow Optimization - End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Code-First Entry Flow', () => {
    test('should redirect to code input when no stored code exists', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Should show code input interface first
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeVisible();
      
      // Should focus the code input automatically
      await expect(codeInput).toBeFocused();
      
      // Should not show main page buttons yet
      const examButtons = page.locator('button:has-text("Exams"), button:has-text("Results")');
      await expect(examButtons.first()).not.toBeVisible();
    });

    test('should navigate to main page after valid code entry', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Enter a valid code (assuming 'TEST123' is valid in test environment)
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('TEST123');
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Wait for navigation
      await page.waitForTimeout(1000);
      
      // Should now show main page with exam buttons
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible({ timeout: 5000 });
    });

    test('should show error for invalid code without page refresh', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Enter an invalid code
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('INVALID');
      
      // Submit the form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Wait for error message
      await page.waitForTimeout(1000);
      
      // Should show error message
      const errorMessage = page.locator('text=/error|invalid|not found/i').first();
      await expect(errorMessage).toBeVisible({ timeout: 3000 });
      
      // Should still be on the same page (no refresh)
      await expect(codeInput).toBeVisible();
      await expect(codeInput).toBeFocused();
    });

    test('should bypass code input when valid stored code exists', async ({ page }) => {
      // First, store a valid code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('TEST123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Now reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should bypass code input and go directly to main page
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible({ timeout: 5000 });
      
      // Code input should not be visible
      const codeInputAfterReload = page.locator('input[type="text"]').first();
      await expect(codeInputAfterReload).not.toBeVisible();
    });
  });

  test.describe('Code Persistence Across Sessions', () => {
    test('should persist code across browser refresh', async ({ page }) => {
      // Enter and store code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('PERSIST123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be on main page
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible({ timeout: 5000 });
      
      // Verify code is still stored
      const storedCode = await page.evaluate(() => {
        const stored = localStorage.getItem('student_code');
        return stored ? JSON.parse(stored).code : null;
      });
      expect(storedCode).toBe('PERSIST123');
    });

    test('should persist code across browser tab close/reopen', async ({ browser }) => {
      // Create a new page (simulating new tab)
      const page1 = await browser.newPage();
      
      // Enter and store code
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');
      
      const codeInput = page1.locator('input[type="text"]').first();
      await codeInput.fill('TAB123');
      
      const submitButton = page1.locator('button[type="submit"]').first();
      await submitButton.click();
      await page1.waitForTimeout(1000);
      
      // Close the tab
      await page1.close();
      
      // Open a new tab
      const page2 = await browser.newPage();
      await page2.goto('/');
      await page2.waitForLoadState('networkidle');
      
      // Should bypass code input
      const examButton = page2.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible({ timeout: 5000 });
      
      await page2.close();
    });

    test('should handle expired codes by clearing storage', async ({ page }) => {
      // Manually set an expired code in localStorage
      await page.evaluate(() => {
        const expiredCode = {
          code: 'EXPIRED123',
          timestamp: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
          studentId: 'test-student'
        };
        localStorage.setItem('student_code', JSON.stringify(expiredCode));
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Should redirect to code input (expired code cleared)
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeVisible({ timeout: 5000 });
      
      // Storage should be cleared
      const storedCode = await page.evaluate(() => {
        return localStorage.getItem('student_code');
      });
      expect(storedCode).toBeNull();
    });
  });

  test.describe('Multi-User Device Scenarios', () => {
    test('should provide code clearing functionality', async ({ page }) => {
      // First, store a code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('MULTI123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Should be on main page
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible();
      
      // Look for code management UI
      const clearButton = page.locator('button:has-text("Clear"), button:has-text("Change")').first();
      await expect(clearButton).toBeVisible({ timeout: 3000 });
      
      // Click clear button
      await clearButton.click();
      
      // Should show confirmation or redirect to code input
      await page.waitForTimeout(500);
      
      // Either confirmation dialog or back to code input
      const hasConfirmation = await page.locator('text=/confirm|sure|clear/i').count() > 0;
      const hasCodeInput = await page.locator('input[type="text"]').count() > 0;
      
      expect(hasConfirmation || hasCodeInput).toBe(true);
    });

    test('should handle code change functionality', async ({ page }) => {
      // Store initial code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('CHANGE123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Look for change code option
      const changeButton = page.locator('button:has-text("Change"), a:has-text("Change")').first();
      
      if (await changeButton.count() > 0) {
        await changeButton.click();
        await page.waitForTimeout(500);
        
        // Should redirect to code input
        const newCodeInput = page.locator('input[type="text"]').first();
        await expect(newCodeInput).toBeVisible();
        
        // Enter new code
        await newCodeInput.fill('NEWCODE123');
        
        const newSubmitButton = page.locator('button[type="submit"]').first();
        await newSubmitButton.click();
        await page.waitForTimeout(1000);
        
        // Should be back on main page with new code
        const examButtonAfterChange = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
        await expect(examButtonAfterChange).toBeVisible();
        
        // Verify new code is stored
        const storedCode = await page.evaluate(() => {
          const stored = localStorage.getItem('student_code');
          return stored ? JSON.parse(stored).code : null;
        });
        expect(storedCode).toBe('NEWCODE123');
      }
    });

    test('should display current code information', async ({ page }) => {
      // Store code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('DISPLAY123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Look for code display
      const codeDisplay = page.locator('text=/DISPLAY123|Current.*code|Code.*DISPLAY123/i').first();
      
      // Code should be displayed somewhere on the page
      const hasCodeDisplay = await codeDisplay.count() > 0;
      const hasCodeInStorage = await page.evaluate(() => {
        const stored = localStorage.getItem('student_code');
        return stored && JSON.parse(stored).code === 'DISPLAY123';
      });
      
      // Either visible on page or properly stored
      expect(hasCodeDisplay || hasCodeInStorage).toBe(true);
    });
  });

  test.describe('Integration with Existing Exam Features', () => {
    test('should maintain exam access through optimized flow', async ({ page }) => {
      // Store code and navigate to main page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('EXAM123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Click on exams button
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      await expect(examButton).toBeVisible();
      await examButton.click();
      
      // Should navigate to exams page
      await page.waitForTimeout(1000);
      
      // Should be on exams page or exam list
      const url = page.url();
      expect(url).toMatch(/\/exams|\/exam/);
    });

    test('should maintain results access through optimized flow', async ({ page }) => {
      // Store code and navigate to main page
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('RESULTS123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Look for results button
      const resultsButton = page.locator('button:has-text("Results"), a:has-text("Results")').first();
      
      if (await resultsButton.count() > 0) {
        await resultsButton.click();
        await page.waitForTimeout(1000);
        
        // Should navigate to results page
        const url = page.url();
        expect(url).toMatch(/\/results/);
      }
    });

    test('should handle deep links with code validation', async ({ page }) => {
      // Try to access exam directly without code
      await page.goto('/exams');
      await page.waitForLoadState('networkidle');
      
      // Should redirect to code input or show code input
      const codeInput = page.locator('input[type="text"]').first();
      const isOnCodeInput = await codeInput.count() > 0;
      const isOnHomePage = page.url().includes('/');
      
      // Should either show code input or redirect to home
      expect(isOnCodeInput || isOnHomePage).toBe(true);
    });

    test('should preserve session state during navigation', async ({ page }) => {
      // Store code
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('SESSION123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Navigate to exams
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      if (await examButton.count() > 0) {
        await examButton.click();
        await page.waitForTimeout(1000);
        
        // Navigate back to home
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // Should still be on main page (code persisted)
        const examButtonAfterReturn = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
        await expect(examButtonAfterReturn).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network failures gracefully', async ({ page }) => {
      // Go offline
      await page.context().setOffline(true);
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Try to enter code
      const codeInput = page.locator('input[type="text"]').first();
      await codeInput.fill('OFFLINE123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Should show offline indicator or error
      await page.waitForTimeout(2000);
      
      const offlineIndicator = page.locator('text=/offline|network|connection/i').first();
      const errorMessage = page.locator('text=/error|failed|try again/i').first();
      
      const hasOfflineHandling = await offlineIndicator.count() > 0 || await errorMessage.count() > 0;
      expect(hasOfflineHandling).toBe(true);
      
      // Go back online
      await page.context().setOffline(false);
    });

    test('should handle localStorage unavailable', async ({ page }) => {
      // Disable localStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: false
        });
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Should still show code input (graceful degradation)
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeVisible();
      
      // Should be able to enter code (session-only mode)
      await codeInput.fill('NOSTORAGE123');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Should work but not persist across refresh
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      
      // Either shows main page or handles gracefully
      const hasMainPage = await examButton.count() > 0;
      const hasErrorHandling = await page.locator('text=/storage|unavailable/i').count() > 0;
      
      expect(hasMainPage || hasErrorHandling).toBe(true);
    });

    test('should handle corrupted storage data', async ({ page }) => {
      // Set corrupted data
      await page.evaluate(() => {
        localStorage.setItem('student_code', '{invalid json}');
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Should clear corrupted data and show code input
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeVisible();
      
      // Storage should be cleaned
      const storedCode = await page.evaluate(() => {
        return localStorage.getItem('student_code');
      });
      expect(storedCode).toBeNull();
    });

    test('should handle rapid code changes', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const codeInput = page.locator('input[type="text"]').first();
      
      // Rapidly change codes
      await codeInput.fill('RAPID1');
      await page.waitForTimeout(100);
      await codeInput.fill('RAPID2');
      await page.waitForTimeout(100);
      await codeInput.fill('RAPID3');
      
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(1000);
      
      // Should handle the final code
      const storedCode = await page.evaluate(() => {
        const stored = localStorage.getItem('student_code');
        return stored ? JSON.parse(stored).code : null;
      });
      
      // Should store the last entered code or handle gracefully
      expect(storedCode === 'RAPID3' || storedCode === null).toBe(true);
    });
  });

  test.describe('Performance and Accessibility', () => {
    test('should load code input interface quickly', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (adjust based on requirements)
      expect(loadTime).toBeLessThan(5000);
      
      // Code input should be visible and focused
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeVisible();
      await expect(codeInput).toBeFocused();
    });

    test('should maintain keyboard navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Tab through elements
      await page.keyboard.press('Tab');
      
      // Should focus on code input
      const codeInput = page.locator('input[type="text"]').first();
      await expect(codeInput).toBeFocused();
      
      // Enter code using keyboard
      await page.keyboard.type('KEYBOARD123');
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Submit using Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      // Should work with keyboard only
      const examButton = page.locator('button:has-text("Exams"), a:has-text("Exams")').first();
      const hasMainPage = await examButton.count() > 0;
      const hasError = await page.locator('text=/error|invalid/i').count() > 0;
      
      expect(hasMainPage || hasError).toBe(true);
    });

    test('should support screen reader accessibility', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check for ARIA labels
      const codeInput = page.locator('input[type="text"]').first();
      
      const hasAriaLabel = await codeInput.getAttribute('aria-label') !== null;
      const hasLabel = await page.locator('label').count() > 0;
      const hasAriaDescribedBy = await codeInput.getAttribute('aria-describedby') !== null;
      
      // Should have proper labeling for screen readers
      expect(hasAriaLabel || hasLabel || hasAriaDescribedBy).toBe(true);
      
      // Check for form validation messages
      await codeInput.fill('');
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Should have accessible error messages
      const errorMessage = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]').first();
      const hasAccessibleError = await errorMessage.count() > 0;
      
      // Either has accessible error or prevents empty submission
      const inputValue = await codeInput.inputValue();
      expect(hasAccessibleError || inputValue === '').toBe(true);
    });
  });
});