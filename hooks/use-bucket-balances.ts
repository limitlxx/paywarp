'use client';

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { mantleSepolia } from '@/lib/networks';

const BUCKET_VAULT_ABI = [
  {
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'bucket', type: 'string' }
    ],
    name: 'getBucketBalance',
    outputs: [
      {
        components: [
          { name: 'balance', type: 'uint256' },
          { name: 'yieldBalance', type: 'uint256' },
          { name: 'isYielding', type: 'bool' },
          { name: 'lastYieldUpdate', type: 'uint256' }
        ],
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getSplitConfig',
    outputs: [
      {
        components: [
          { name: 'billingsPercent', type: 'uint256' },
          { name: 'savingsPercent', type: 'uint256' },
          { name: 'growthPercent', type: 'uint256' },
          { name: 'instantPercent', type: 'uint256' },
          { name: 'spendablePercent', type: 'uint256' }
        ],
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'userNonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const USDC_DECIMALS = 6; // Contract stores balances in 6 decimals (USDC standard)

export interface BucketBalance {
  name: string;
  balance: bigint;
  yieldBalance: bigint;
  isYielding: boolean;
  lastYieldUpdate: bigint;
  formattedBalance: string;
  formattedYield: string;
}

export interface SplitConfig {
  billingsPercent: number;
  savingsPercent: number;
  growthPercent: number;
  instantPercent: number;
  spendablePercent: number;
}

export interface BucketBalancesReturn {
  buckets: BucketBalance[];
  totalBalance: bigint;
  formattedTotalBalance: string;
  splitConfig: SplitConfig | null;
  nonce: bigint;
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  refetch: () => void;
}

const BUCKET_NAMES = ['billings', 'savings', 'growth', 'instant', 'spendable'] as const;

export function useBucketBalances(): BucketBalancesReturn {
  const { address } = useAccount();
  
  const bucketVaultAddress = (process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA || 
                              process.env.NEXT_PUBLIC_BUCKET_VAULT_MAINNET) as `0x${string}`;

  // Read all bucket balances, split config, and nonce
  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      // Bucket balances
      ...BUCKET_NAMES.map(bucket => ({
        address: bucketVaultAddress,
        abi: BUCKET_VAULT_ABI,
        functionName: 'getBucketBalance',
        args: [address as `0x${string}`, bucket],
        chainId: mantleSepolia.id,
      })),
      // Split config
      {
        address: bucketVaultAddress,
        abi: BUCKET_VAULT_ABI,
        functionName: 'getSplitConfig',
        args: [address as `0x${string}`],
        chainId: mantleSepolia.id,
      },
      // Nonce
      {
        address: bucketVaultAddress,
        abi: BUCKET_VAULT_ABI,
        functionName: 'userNonces',
        args: [address as `0x${string}`],
        chainId: mantleSepolia.id,
      },
    ],
    query: {
      enabled: !!address && !!bucketVaultAddress,
      refetchInterval: 30000, // Refetch every 30 seconds (reduced from 10s to avoid rate limits)
      staleTime: 20000, // Consider data stale after 20 seconds
    },
  });

  const buckets = useMemo<BucketBalance[]>(() => {
    if (!data || !address) return [];

    return BUCKET_NAMES.map((name, index) => {
      const result = data[index];
      
      if (result.status !== 'success' || !result.result) {
        return {
          name,
          balance: 0n,
          yieldBalance: 0n,
          isYielding: false,
          lastYieldUpdate: 0n,
          formattedBalance: '0.00',
          formattedYield: '0.00',
        };
      }

      // Cast through unknown to avoid TypeScript error
      const bucketData = result.result as unknown as {
        balance: bigint;
        yieldBalance: bigint;
        isYielding: boolean;
        lastYieldUpdate: bigint;
      };

      return {
        name,
        balance: bucketData.balance,
        yieldBalance: bucketData.yieldBalance,
        isYielding: bucketData.isYielding,
        lastYieldUpdate: bucketData.lastYieldUpdate,
        formattedBalance: formatUnits(bucketData.balance, USDC_DECIMALS),
        formattedYield: formatUnits(bucketData.yieldBalance, USDC_DECIMALS),
      };
    });
  }, [data, address]);

  const totalBalance = useMemo(() => {
    return buckets.reduce((sum, bucket) => sum + bucket.balance, 0n);
  }, [buckets]);

  const formattedTotalBalance = useMemo(() => {
    return formatUnits(totalBalance, USDC_DECIMALS);
  }, [totalBalance]);

  const splitConfig = useMemo<SplitConfig | null>(() => {
    if (!data || !address) return null;

    const configResult = data[BUCKET_NAMES.length];
    if (configResult.status !== 'success' || !configResult.result) return null;

    const config = configResult.result as unknown as {
      billingsPercent: bigint;
      savingsPercent: bigint;
      growthPercent: bigint;
      instantPercent: bigint;
      spendablePercent: bigint;
    };

    return {
      billingsPercent: Number(config.billingsPercent) / 100,
      savingsPercent: Number(config.savingsPercent) / 100,
      growthPercent: Number(config.growthPercent) / 100,
      instantPercent: Number(config.instantPercent) / 100,
      spendablePercent: Number(config.spendablePercent) / 100,
    };
  }, [data, address]);

  const nonce = useMemo(() => {
    if (!data || !address) return 0n;

    const nonceResult = data[BUCKET_NAMES.length + 1];
    if (nonceResult.status !== 'success' || !nonceResult.result) return 0n;

    return nonceResult.result as bigint;
  }, [data, address]);

  const hasData = useMemo(() => {
    return totalBalance > 0n || (splitConfig !== null && 
      (splitConfig.billingsPercent + splitConfig.savingsPercent + 
       splitConfig.growthPercent + splitConfig.instantPercent + 
       splitConfig.spendablePercent) > 0);
  }, [totalBalance, splitConfig]);

  return {
    buckets,
    totalBalance,
    formattedTotalBalance,
    splitConfig,
    nonce,
    isLoading,
    isError,
    hasData,
    refetch,
  };
}
