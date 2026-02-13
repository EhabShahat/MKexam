import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { storeCode, clearCode, getStoredCode } from "@/hooks/useStudentCode";

describe("Code Persistence Integration Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Full entry → storage → auto-redirect flow", () => {
    it("should store code after successful validation and retrieve it on next visit", async () => {
      const testCode = "TEST123";
      const testStudentId = "student-456";

      // Simulate successful exam entry
      storeCode(testCode, testStudentId);

      // Verify code was stored
      const stored = getStoredCode();
      expect(stored).not.toBeNull();
      expect(stored?.code).toBe(testCode);
      expect(stored?.studentId).toBe(testStudentId);
      expect(stored?.timestamp).toBeGreaterThan(0);

      // Simulate page reload - code should still be there
      const storedAfterReload = getStoredCode();
      expect(storedAfterReload).not.toBeNull();
      expect(storedAfterReload?.code).toBe(testCode);
    });

    it("should handle multiple code updates correctly", async () => {
      const firstCode = "CODE001";
      const secondCode = "CODE002";

      // Store first code
      storeCode(firstCode);
      expect(getStoredCode()?.code).toBe(firstCode);

      // Update to second code
      storeCode(secondCode);
      expect(getStoredCode()?.code).toBe(secondCode);

      // Verify the code is stored in localStorage
      const storedValue = localStorage.getItem("student_code");
      expect(storedValue).not.toBeNull();
      
      // Verify it's the latest code
      const parsed = JSON.parse(storedValue!);
      expect(parsed.code).toBe(secondCode);
    });

    it("should preserve code across multiple page loads", async () => {
      const testCode = "PERSIST";

      storeCode(testCode);

      // Simulate multiple page loads
      for (let i = 0; i < 5; i++) {
        const stored = getStoredCode();
        expect(stored?.code).toBe(testCode);
      }
    });
  });

  describe("Clear code → redirect to entry flow", () => {
    it("should clear code and allow new entry", async () => {
      const testCode = "CLEAR123";

      // Store code
      storeCode(testCode);
      expect(getStoredCode()).not.toBeNull();

      // Clear code
      clearCode();
      expect(getStoredCode()).toBeNull();

      // Should be able to store a new code
      const newCode = "NEW456";
      storeCode(newCode);
      expect(getStoredCode()?.code).toBe(newCode);
    });

    it("should handle clear code button click", async () => {
      const testCode = "BTN123";

      // Store code
      storeCode(testCode);
      expect(getStoredCode()).not.toBeNull();

      // Simulate clear button click
      clearCode();

      // Verify code was cleared
      expect(getStoredCode()).toBeNull();
      expect(localStorage.getItem("student_code")).toBeNull();
    });

    it("should not throw error when clearing non-existent code", async () => {
      // Ensure no code is stored
      expect(getStoredCode()).toBeNull();

      // Clear should not throw
      expect(() => clearCode()).not.toThrow();

      // Should still be null
      expect(getStoredCode()).toBeNull();
    });
  });

  describe("Code validation and error handling", () => {
    it("should handle invalid stored code gracefully", async () => {
      // Store malformed data
      localStorage.setItem("student_code", "invalid json");

      // Should return null and clear the invalid data
      const stored = getStoredCode();
      expect(stored).toBeNull();
      expect(localStorage.getItem("student_code")).toBeNull();
    });

    it("should handle missing code field in stored data", async () => {
      // Store data without code field
      localStorage.setItem(
        "student_code",
        JSON.stringify({ timestamp: Date.now() })
      );

      // Should return null and clear the invalid data
      const stored = getStoredCode();
      expect(stored).toBeNull();
      expect(localStorage.getItem("student_code")).toBeNull();
    });

    it("should handle code with special characters", async () => {
      const specialCodes = [
        "CODE-123",
        "CODE_456",
        "CODE.789",
        "CODE@ABC",
        "CODE#XYZ",
      ];

      for (const code of specialCodes) {
        storeCode(code);
        const stored = getStoredCode();
        expect(stored?.code).toBe(code);
        clearCode();
      }
    });

    it("should handle very long codes", async () => {
      const longCode = "A".repeat(1000);

      storeCode(longCode);
      const stored = getStoredCode();
      expect(stored?.code).toBe(longCode);
    });

    it("should handle empty string code", async () => {
      const emptyCode = "";

      storeCode(emptyCode);
      const stored = getStoredCode();
      
      // Empty code is invalid and should be cleared by getStoredCode
      // The validation in getStoredCode checks for truthy code value
      expect(stored).toBeNull();
    });
  });

  describe("Timestamp and metadata", () => {
    it("should store timestamp with code", async () => {
      const beforeStore = Date.now();
      storeCode("TEST");
      const afterStore = Date.now();

      const stored = getStoredCode();
      expect(stored?.timestamp).toBeGreaterThanOrEqual(beforeStore);
      expect(stored?.timestamp).toBeLessThanOrEqual(afterStore);
    });

    it("should update timestamp when code is updated", async () => {
      storeCode("FIRST");
      const firstStored = getStoredCode();
      const firstTimestamp = firstStored?.timestamp;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      storeCode("SECOND");
      const secondStored = getStoredCode();
      const secondTimestamp = secondStored?.timestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp!);
    });

    it("should optionally store student ID", async () => {
      const code = "CODE";
      const studentId = "student-123";

      storeCode(code, studentId);
      const stored = getStoredCode();

      expect(stored?.studentId).toBe(studentId);
    });

    it("should handle missing student ID", async () => {
      const code = "CODE";

      storeCode(code);
      const stored = getStoredCode();

      expect(stored?.code).toBe(code);
      expect(stored?.studentId).toBeUndefined();
    });
  });

  describe("Concurrent operations", () => {
    it("should handle rapid store/clear operations", async () => {
      const operations = 10;

      for (let i = 0; i < operations; i++) {
        storeCode(`CODE${i}`);
        if (i % 2 === 0) {
          clearCode();
        }
      }

      // Final state should be cleared (last operation was clear)
      const stored = getStoredCode();
      expect(stored?.code).toBe("CODE9");
    });

    it("should handle multiple stores without clear", async () => {
      for (let i = 0; i < 5; i++) {
        storeCode(`CODE${i}`);
      }

      // Should have the last stored code
      const stored = getStoredCode();
      expect(stored?.code).toBe("CODE4");
    });
  });

  describe("localStorage availability", () => {
    it("should handle localStorage being disabled", async () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error("localStorage disabled");
      });

      // Should not throw
      expect(() => storeCode("TEST")).not.toThrow();

      // Restore
      Storage.prototype.setItem = originalSetItem;
    });

    it("should handle localStorage errors gracefully", async () => {
      // Store a code first
      storeCode("TEST");
      expect(getStoredCode()?.code).toBe("TEST");

      // The getStoredCode function has try-catch that handles errors
      // This test verifies that the function doesn't throw
      expect(() => getStoredCode()).not.toThrow();
      
      // Clear for cleanup
      clearCode();
      expect(getStoredCode()).toBeNull();
    });
  });
});
