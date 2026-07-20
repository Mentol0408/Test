import type { NextConfig } from "next";

const createNextConfig = (): NextConfig => ({
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
});

export default createNextConfig;
