import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { storeCode, clearCode, getStoredCode } from "../useStudentCode";

// Feature: student-experience-and-admin-enhancements, Property 4: Code Clearing Completeness

describe("useStudentCode - Code Clearing Completeness (PBT)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Property 4: For any stored student code, triggering the clear action should remove the code from localStorage, and subsequent localStorage reads should return null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), // Arbitrary student code
        fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }), // Optional student ID
        async (code, studentId) => {
          // Store the code
          await storeCode(code, studentId);

          // Verify it was stored
          const storedBefore = await getStoredCode();
          expect(storedBefore).not.toBeNull();
          expect(storedBefore?.code).toBe(code);

          // Clear the code
          clearCode();

          // Verify it was cleared
          const storedAfter = await getStoredCode();
          expect(storedAfter).toBeNull();

          // Verify direct localStorage access also returns null
          const directAccess = localStorage.getItem("student_code");
          expect(directAccess).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 4 (edge case): Clearing code when no code is stored should not throw errors", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        // Ensure no code is stored
        expect(await getStoredCode()).toBeNull();

        // Clear should not throw
        expect(() => clearCode()).not.toThrow();

        // Should still be null
        expect(await getStoredCode()).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("Property 4 (idempotence): Clearing code multiple times should have the same effect as clearing once", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.integer({ min: 1, max: 10 }), // Number of times to clear
        async (code, clearCount) => {
          // Store the code
          await storeCode(code);

          // Clear multiple times
          for (let i = 0; i < clearCount; i++) {
            clearCode();
          }

          // Should still be null after multiple clears
          expect(await getStoredCode()).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("Property 4 (completeness): After clearing, storing a new code should work correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        async (firstCode, secondCode) => {
          // Store first code
          await storeCode(firstCode);
          expect((await getStoredCode())?.code).toBe(firstCode);

          // Clear
          clearCode();
          expect(await getStoredCode()).toBeNull();

          // Store second code
          await storeCode(secondCode);
          const stored = await getStoredCode();
          expect(stored).not.toBeNull();
          expect(stored?.code).toBe(secondCode);
        }
      ),
      { numRuns: 100 }
    );
  });
});
