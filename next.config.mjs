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

    // Handle viem test actions by replacing with empty exports
    config.module.rules.push({
      test: /node_modules\/viem\/_esm\/actions\/test\/.*\.js$/,
      use: {
        loader: 'string-replace-loader',
        options: {
          search: /[\s\S]*/,
          replace: 'export const dropTransaction = () => {}; export const dumpState = () => {}; export const getAutomine = () => {}; export const getTxpoolContent = () => {}; export const getTxpoolStatus = () => {}; export const impersonateAccount = () => {}; export const increaseTime = () => {}; export const inspectTxpool = () => {}; export const loadState = () => {}; export const mine = () => {}; export const removeBlockTimestampInterval = () => {}; export const reset = () => {}; export const revert = () => {}; export const setAutomine = () => {}; export const setBalance = () => {}; export const setBlockGasLimit = () => {}; export const setBlockTimestampInterval = () => {}; export const setCoinbase = () => {}; export const setCode = () => {}; export const setIntervalMining = () => {}; export const setLoggingEnabled = () => {}; export const setMinGasPrice = () => {}; export const setNextBlockBaseFeePerGas = () => {}; export const setNextBlockTimestamp = () => {}; export const setNonce = () => {}; export const setRpcUrl = () => {}; export const setStorageAt = () => {}; export const snapshot = () => {}; export const stopImpersonatingAccount = () => {};'
        }
      }
    });

    // Handle specific missing viem test files
    config.module.rules.push({
      test: /node_modules\/viem\/_esm\/actions\/test\/(dropTransaction|dumpState|getAutomine|getTxpoolContent|getTxpoolStatus)\.js$/,
      use: {
        loader: 'string-replace-loader',
        options: {
          search: /[\s\S]*/,
          replace: (match, p1, offset, string, groups) => {
            const filename = string.match(/\/(dropTransaction|dumpState|getAutomine|getTxpoolContent|getTxpoolStatus)\.js$/)?.[1];
            return `export const ${filename} = () => {};`;
          }
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