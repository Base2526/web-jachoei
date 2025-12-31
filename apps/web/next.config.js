// apps/web/next.config.js  (ESM syntax)
import path from 'path';
import { fileURLToPath } from 'url';

/** recreate __dirname in ESM */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // appDir: true,
    optimizePackageImports: ['antd'],
    externalDir: true,
  },
   // ✅ Remove console.* in production (via SWC)
  // - by default removes: console.log/info/debug
  // - keeps: console.error/warn (recommended)
  compiler: isProd
    ? {
        removeConsole: {
          exclude: [ /*"error", "warn"*/ ],
        },
      }
    : undefined,
  webpack: (config) => {
    // alias ไปที่แพ็กเกจ core (src) เพื่อ dev-hot-reload
    config.resolve.alias['@core'] = path.resolve(__dirname, '../../packages/graphql-core/src');
    return config;
  },
  transpilePackages: ['antd'],

  productionBrowserSourceMaps: false,
  swcMinify: true,
};

export default nextConfig;
