import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      {
        source: "/results",
        destination: "/",
        permanent: false,
      },
      {
        source: "/exam/:examId",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
