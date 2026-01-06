export * from './BucketVault';
export * from './PayrollEngine';
export * from './UserRegistry';

// Contract addresses type
export interface ContractAddresses {
  BucketVault: string;
  PayrollEngine: string;
  UserRegistry: string;
  BaseToken: string;
  YieldToken: string;
}

// Function to get contract addresses dynamically
export function getContractAddresses(): Record<number, ContractAddresses> {
  return {
    // Mantle Mainnet
    5000: {
      BucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_MAINNET || '0x0000000000000000000000000000000000000000',
      PayrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET || '0x0000000000000000000000000000000000000000',
      UserRegistry: process.env.NEXT_PUBLIC_USER_REGISTRY_MAINNET || '0x0000000000000000000000000000000000000000',
      BaseToken: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9', // USDC on Mantle
      YieldToken: '0x5bEaBAEBB3146685Dd74176f68a0721F91297D37', // USDY on Mantle
    },
    // Mantle Sepolia Testnet
    5003: {
      BucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA || '0x0000000000000000000000000000000000000000',
      PayrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA || '0x0000000000000000000000000000000000000000',
      UserRegistry: process.env.NEXT_PUBLIC_USER_REGISTRY_SEPOLIA || '0x0000000000000000000000000000000000000000',
      BaseToken: process.env.NEXT_PUBLIC_USDY_TOKEN_SEPOLIA || '0x0000000000000000000000000000000000000001',
      YieldToken: process.env.NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA || '0x0000000000000000000000000000000000000002',
    },
    // Local Hardhat
    31337: {
      BucketVault: '0x0000000000000000000000000000000000000000',
      PayrollEngine: '0x0000000000000000000000000000000000000000',
      UserRegistry: '0x0000000000000000000000000000000000000000',
      BaseToken: '0x0000000000000000000000000000000000000001',
      YieldToken: '0x0000000000000000000000000000000000000002',
    },
  };
}

// Network-specific contract addresses (static for backwards compatibility)
export const CONTRACT_ADDRESSES: Record<number, ContractAddresses> = getContractAddresses();