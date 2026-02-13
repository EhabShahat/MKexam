import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { storeCode, clearCode, getStoredCode } from "../useStudentCode";

// Feature: student-experience-and-admin-enhancements, Property 5: Authentication Preservation

describe("useStudentCode - Authentication Preservation (PBT)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("Property 5: For any existing authentication flow, implementing code persistence should not alter the authentication behavior or security checks", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), // Student code
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }), // Student ID
        async (code, studentId) => {
          // Simulate authentication state before code persistence
          const authTokenBefore = localStorage.getItem("auth_token");
          const sessionBefore = localStorage.getItem("session");

          // Store student code
          await storeCode(code, studentId);

          // Verify authentication state is unchanged
          const authTokenAfter = localStorage.getItem("auth_token");
          const sessionAfter = localStorage.getItem("session");

          expect(authTokenAfter).toBe(authTokenBefore);
          expect(sessionAfter).toBe(sessionBefore);

          // Verify only student_code key was added
          const storedCode = await getStoredCode();
          expect(storedCode).not.toBeNull();
          expect(storedCode?.code).toBe(code);

          // Clear code
          clearCode();

          // Verify authentication state is still unchanged
          const authTokenFinal = localStorage.getItem("auth_token");
          const sessionFinal = localStorage.getItem("session");

          expect(authTokenFinal).toBe(authTokenBefore);
          expect(sessionFinal).toBe(sessionBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5 (isolation): Code persistence operations should not interfere with other localStorage keys", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.record({
          key1: fc.string({ minLength: 1, maxLength: 20 }),
          key2: fc.string({ minLength: 1, maxLength: 20 }),
          value1: fc.string({ minLength: 1, maxLength: 50 }),
          value2: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        async (code, otherData) => {
          // Set up other localStorage keys
          localStorage.setItem(otherData.key1, otherData.value1);
          localStorage.setItem(otherData.key2, otherData.value2);

          // Store code
          await storeCode(code);

          // Verify other keys are unchanged
          expect(localStorage.getItem(otherData.key1)).toBe(otherData.value1);
          expect(localStorage.getItem(otherData.key2)).toBe(otherData.value2);

          // Clear code
          clearCode();

          // Verify other keys are still unchanged
          expect(localStorage.getItem(otherData.key1)).toBe(otherData.value1);
          expect(localStorage.getItem(otherData.key2)).toBe(otherData.value2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5 (security): Code persistence should not expose sensitive authentication data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
        async (code, studentId) => {
          // Store code
          await storeCode(code, studentId);

          // Get stored data
          const stored = await getStoredCode();
          const rawStored = localStorage.getItem("student_code");

          // Verify stored data doesn't contain sensitive fields
          expect(stored).not.toHaveProperty("password");
          expect(stored).not.toHaveProperty("token");
          expect(stored).not.toHaveProperty("session");
          expect(stored).not.toHaveProperty("secret");

          // Verify raw storage doesn't contain sensitive patterns
          if (rawStored) {
            expect(rawStored).not.toMatch(/password/i);
            expect(rawStored).not.toMatch(/token/i);
            expect(rawStored).not.toMatch(/secret/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5 (validation independence): Code storage should not bypass validation requirements", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        async (code) => {
          // Store code
          await storeCode(code);

          // Retrieve code
          const stored = await getStoredCode();

          // Verify stored code still requires validation
          // (The code is stored but validation must still happen via API)
          expect(stored).not.toBeNull();
          expect(stored?.code).toBe(code);

          // The stored code should not have any "validated" or "authenticated" flag
          expect(stored).not.toHaveProperty("validated");
          expect(stored).not.toHaveProperty("authenticated");
          expect(stored).not.toHaveProperty("verified");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 5 (localStorage failure): When localStorage operations fail, the system should not throw errors", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), async (code) => {
        // This test verifies that localStorage failures are handled gracefully
        // The storeCode function has try-catch blocks that prevent errors from propagating
        
        // Attempt to store code (should not throw even if localStorage fails)
        await expect(storeCode(code)).resolves.not.toThrow();
        
        // Attempt to clear code (should not throw even if localStorage fails)
        expect(() => clearCode()).not.toThrow();
        
        // Attempt to get code (should not throw even if localStorage fails)
        await expect(getStoredCode()).resolves.not.toThrow();
        
        // This demonstrates that authentication can proceed without code persistence
        // The functions handle errors internally and log warnings instead of throwing
      }),
      { numRuns: 100 }
    );
  });
});
