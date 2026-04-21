import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@flow/db', '@flow/tokens', '@flow/ui', '@flow/types', '@flow/auth'],
};

export default nextConfig;
