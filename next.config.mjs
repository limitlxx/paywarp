/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Exclude problematic test files and other non-essential files
    config.module.rules.push({
      test: /node_modules\/thread-stream\/test\/.*\.(js|mjs|ts)$/,
      use: 'ignore-loader',
    });
    
    config.module.rules.push({
      test: /node_modules\/thread-stream\/(bench\.js|README\.md|LICENSE)$/,
      use: 'ignore-loader',
    });

    return config;
  },
  // Disable turbopack to use webpack
  experimental: {
    turbo: false,
  },
}

export default nextConfig
