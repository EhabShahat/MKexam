import type { NextConfig } from "next";

// Bundle analyzer configuration
// Run with: ANALYZE=true npm run build
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
});

const nextConfig: NextConfig = {
  // Turbopack configuration (empty to silence warnings)
  turbopack: {},
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  // Experimental features (Turbopack compatible)
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      '@tanstack/react-query',
      '@tanstack/react-virtual',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'react-chartjs-2',
      'chart.js',
      'papaparse',
      'xlsx',
      'jspdf',
    ],
  },
  // Compiler optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Performance budgets and optimizations
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
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
  // Cache headers for CDN (Requirement 3.6)
  async headers() {
    return [
      {
        // Cache exam entry pages with ISR
        source: "/exam/:examId",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=120",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
