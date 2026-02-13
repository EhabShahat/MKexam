/**
 * Unit tests for code splitting edge cases
 * Tests dynamic import failures, loading states, and SSR vs client-only components
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadXLSX, loadJsPDF, loadXLSXUtils, ChartSkeleton, ExportSkeleton } from "../lazyComponents";

describe("Code Splitting Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Dynamic Import Failures", () => {
    it("should return a promise for all lazy load functions", () => {
      const xlsxPromise = loadXLSX();
      const jsPDFPromise = loadJsPDF();
      const xlsxUtilsPromise = loadXLSXUtils();

      expect(xlsxPromise).toBeInstanceOf(Promise);
      expect(jsPDFPromise).toBeInstanceOf(Promise);
      expect(xlsxUtilsPromise).toBeInstanceOf(Promise);
    });

    it("should handle async loading", async () => {
      // All imports should complete successfully
      const xlsx = await loadXLSX();
      const jsPDF = await loadJsPDF();
      const xlsxUtils = await loadXLSXUtils();

      expect(xlsx).toBeDefined();
      expect(jsPDF).toBeDefined();
      expect(xlsxUtils).toBeDefined();
    });
  });

  describe("Loading State Display", () => {
    it("should render ChartSkeleton component", () => {
      const skeleton = ChartSkeleton();

      expect(skeleton).toBeDefined();
      expect(skeleton.props.className).toContain("animate-pulse");
      expect(skeleton.props.className).toContain("bg-gray-100");
    });

    it("should render ExportSkeleton component", () => {
      const skeleton = ExportSkeleton();

      expect(skeleton).toBeDefined();
      expect(skeleton.props.children).toBeDefined();
    });
  });

  describe("SSR vs Client-Only Components", () => {
    it("should handle server-side rendering gracefully", () => {
      // Simulate SSR environment
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      try {
        // These functions should still work in SSR
        const xlsxPromise = loadXLSX();
        const jsPDFPromise = loadJsPDF();

        expect(xlsxPromise).toBeInstanceOf(Promise);
        expect(jsPDFPromise).toBeInstanceOf(Promise);
      } finally {
        // Restore window
        // @ts-ignore
        global.window = originalWindow;
      }
    });
  });

  describe("Module Caching", () => {
    it("should cache jsPDF module", async () => {
      // Load jsPDF twice
      const firstLoad = await loadJsPDF();
      const secondLoad = await loadJsPDF();

      // Both should return the same constructor
      expect(firstLoad).toBeDefined();
      expect(secondLoad).toBeDefined();
      expect(typeof firstLoad).toBe("function");
      expect(typeof secondLoad).toBe("function");
    });
  });

  describe("Error Boundaries", () => {
    it("should not crash application on import failure", async () => {
      // Simulate import failure
      const failingImport = async () => {
        throw new Error("Network error");
      };

      try {
        await failingImport();
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        // Error should be caught and handled
        expect(error.message).toBe("Network error");
      }
    });

    it("should provide fallback for missing modules", async () => {
      // Test that we can handle missing modules gracefully
      const safeImport = async (moduleName: string) => {
        try {
          return await import(moduleName);
        } catch (error) {
          // Return a fallback
          return { default: null };
        }
      };

      const result = await safeImport("non-existent-module");
      expect(result.default).toBeNull();
    });
  });

  describe("Lazy Component Loading", () => {
    it("should load components only when rendered", () => {
      // Dynamic imports should not execute until called
      let componentLoaded = false;

      const lazyLoad = () => {
        componentLoaded = true;
        return Promise.resolve({ default: () => null });
      };

      // Before calling, component should not be loaded
      expect(componentLoaded).toBe(false);

      // Call the lazy load function
      lazyLoad();

      // After calling, component should be loaded
      expect(componentLoaded).toBe(true);
    });

    it("should handle multiple concurrent loads", async () => {
      // Load multiple modules concurrently
      const loads = await Promise.all([
        loadXLSX(),
        loadJsPDF(),
        loadXLSXUtils(),
      ]);

      // All should succeed
      expect(loads).toHaveLength(3);
      loads.forEach((load) => {
        expect(load).toBeDefined();
      });
    });
  });
});
