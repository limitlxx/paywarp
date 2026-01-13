/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Add empty turbopack config to silence the error
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Completely ignore thread-stream test directory and problematic files
    config.module.rules.push({
      test: /node_modules\/thread-stream\/(test|bench\.js|README\.md|LICENSE)/,
      loader: 'ignore-loader',
    });

    // Ignore all test files in node_modules except viem
    config.module.rules.push({
      test: /node_modules\/(?!viem).*\/(test|tests|spec|specs)\/.*\.(js|mjs|ts|tsx)$/,
      loader: 'ignore-loader',
    });

    // Ignore all viem test files completely
    config.module.rules.push({
      test: /node_modules\/viem\/_esm\/actions\/test\/.*\.js$/,
      loader: 'ignore-loader',
    });

    // Handle viem actions index to remove test imports
    config.module.rules.push({
      test: /node_modules\/viem\/_esm\/actions\/index\.js$/,
      use: {
        loader: 'string-replace-loader',
        options: {
          multiple: [
            {
              search: /export \* from ['"]\.\/test\/.*?['"]/g,
              replace: '// Test exports removed',
            },
            {
              search: /export \{ .* \} from ['"]\.\/test\/.*?['"]/g,
              replace: '// Test exports removed',
            }
          ]
        }
      }
    });

    // Handle viem test decorators
    config.module.rules.push({
      test: /node_modules\/viem\/_esm\/clients\/decorators\/test\.js$/,
      use: {
        loader: 'string-replace-loader',
        options: {
          search: /[\s\S]*/,
          replace: 'export const testActions = () => ({});'
        }
      }
    });

    // Add resolve alias to completely ignore problematic paths
    config.resolve.alias = {
      ...config.resolve.alias,
      'thread-stream/test': false,
      'thread-stream/bench.js': false,
    };

    // Ignore specific file extensions that cause issues
    config.module.rules.push({
      test: /\.(zip|sh)$/,
      loader: 'ignore-loader',
    });

    return config;
  },
}

export default nextConfig