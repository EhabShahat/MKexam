import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        // Exclude Playwright tests - they should be run with Playwright, not Vitest
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/e2e/**',
      ],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          '.next/',
          'vitest.config.ts',
          'vitest.setup.ts',
          '**/*.d.ts',
          '**/*.config.*',
          '**/dist/**',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/e2e/**',
        ],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});