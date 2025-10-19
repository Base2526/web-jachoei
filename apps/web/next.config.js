// module.exports = { experimental: { appDir: true } };

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true, optimizePackageImports: ['antd'] },
  transpilePackages: ['antd']
};

export default nextConfig;
