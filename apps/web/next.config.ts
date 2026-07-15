import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@flow/db',
    '@flow/tokens',
    '@flow/ui',
    '@flow/types',
    '@flow/auth',
    '@flow/agents',
  ],
};

export default nextConfig;
