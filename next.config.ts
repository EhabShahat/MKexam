import type { NextConfig } from "next";

// Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  // Turbopack configuration (empty to silence warnings)
  turbopack: {},
  // Experimental features (Turbopack compatible)
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: ['@tanstack/react-query', '@dnd-kit/core', '@dnd-kit/sortable'],
  },
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Webpack configuration for video.js
  webpack: (config, { isServer }) => {
    // Handle video.js
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'video.js': 'video.js/dist/video.cjs.js',
      };
    }
    return config;
  },
  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundles
  async redirects() {
    return [
      {
        source: "/admin/debug",
        destination: "/404",
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
