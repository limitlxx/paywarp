'use client';

import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { useMemo, useEffect, useState, useCallback } from 'react';
import { formatUnits } from 'viem';
import { mantleSepolia } from '@/lib/networks';
import { yieldPollingService, type BucketYields, type BucketYieldInfo } from '@/lib/yield-polling-service';
import { rwaIntegration, type RWABalance } from '@/lib/rwa-integration';
import { rwaErrorHandler } from '@/lib/rwa-error-handler';
import type { BucketType } from '@/lib/types';

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
  // RWA-specific fields
  rwaTokenBalance?: number;
  pendingYield?: number;
  apy?: number;
  totalYieldEarned?: number;
  usdyBalance?: RWABalance;
  musdBalance?: RWABalance;
  usdeBalance?: RWABalance;
  methBalance?: RWABalance;
  rwaLastUpdated?: Date;
  rwaError?: string;
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
  // RWA-specific fields
  yieldData: BucketYields | null;
  totalRWAValue: number;
  totalPendingYield: number;
  isYieldPollingActive: boolean;
  rwaErrors: Record<string, string>;
  refreshRWAData: () => Promise<void>;
}

const BUCKET_NAMES = ['billings', 'savings', 'growth', 'instant', 'spendable'] as const;

export function useBucketBalances(): BucketBalancesReturn {
  const { address } = useAccount();
  
  // RWA-specific state
  const [yieldData, setYieldData] = useState<BucketYields | null>(null);
  const [rwaBalances, setRwaBalances] = useState<Record<string, { usdy?: RWABalance; musd?: RWABalance; usde?: RWABalance; meth?: RWABalance }>>({});
  const [rwaErrors, setRwaErrors] = useState<Record<string, string>>({});
  const [isRWALoading, setIsRWALoading] = useState(false);
  
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

  // Initialize yield polling when address changes
  useEffect(() => {
    if (!address) {
      yieldPollingService.stopPolling();
      setYieldData(null);
      return;
    }

    // Start yield polling
    yieldPollingService.startPolling(address);

    // Subscribe to yield updates
    const unsubscribe = yieldPollingService.onYieldUpdate((newYields) => {
      setYieldData(newYields);
    });

    // Get initial yield data
    yieldPollingService.refreshYields().then((yields) => {
      setYieldData(yields);
    });

    return () => {
      unsubscribe();
      yieldPollingService.stopPolling();
    };
  }, [address]);

  // Fetch RWA balances for RWA-enabled buckets
  const fetchRWABalances = useCallback(async () => {
    if (!address || !yieldData) return;

    setIsRWALoading(true);
    const newRwaBalances: Record<string, { usdy?: RWABalance; musd?: RWABalance; usde?: RWABalance; meth?: RWABalance }> = {};
    const newRwaErrors: Record<string, string> = {};

    // Fetch RWA balances for each bucket type
    const rwaBuckets: BucketType[] = ['billings', 'savings', 'growth', 'instant'];

    for (const bucketType of rwaBuckets) {
      try {
        // Fetch all RWA token balances in parallel
        const [usdyResult, musdResult, usdeResult, methResult] = await Promise.allSettled([
          rwaIntegration.getUSDYBalance(bucketType),
          rwaIntegration.getMUSDBalance(bucketType),
          rwaIntegration.getUSDEBalance(bucketType),
          rwaIntegration.getMETHBalance(bucketType)
        ]);

        const bucketBalances: { usdy?: RWABalance; musd?: RWABalance; usde?: RWABalance; meth?: RWABalance } = {};

        if (usdyResult.status === 'fulfilled') {
          bucketBalances.usdy = usdyResult.value;
        } else {
          console.warn(`Failed to fetch USDY balance for ${bucketType}:`, usdyResult.reason);
        }

        if (musdResult.status === 'fulfilled') {
          bucketBalances.musd = musdResult.value;
        } else {
          console.warn(`Failed to fetch mUSD balance for ${bucketType}:`, musdResult.reason);
        }

        if (usdeResult.status === 'fulfilled') {
          bucketBalances.usde = usdeResult.value;
        } else {
          console.warn(`Failed to fetch USDe balance for ${bucketType}:`, usdeResult.reason);
        }

        if (methResult.status === 'fulfilled') {
          bucketBalances.meth = methResult.value;
        } else {
          console.warn(`Failed to fetch mETH balance for ${bucketType}:`, methResult.reason);
        }

        newRwaBalances[bucketType] = bucketBalances;

        // Clear any previous errors for this bucket
        delete newRwaErrors[bucketType];

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown RWA error';
        newRwaErrors[bucketType] = errorMessage;
        console.error(`Error fetching RWA balances for ${bucketType}:`, error);
        
        // Preserve error state using RWA error handler
        rwaErrorHandler.preserveErrorState(`rwa-balance-${bucketType}`, {
          bucketType,
          error: errorMessage,
          timestamp: new Date()
        });
      }
    }

    setRwaBalances(newRwaBalances);
    setRwaErrors(newRwaErrors);
    setIsRWALoading(false);
  }, [address, yieldData]);

  // Fetch RWA balances when yield data updates
  useEffect(() => {
    if (yieldData && address) {
      fetchRWABalances();
    }
  }, [yieldData, address, fetchRWABalances]);

  // Refresh RWA data function
  const refreshRWAData = useCallback(async () => {
    if (!address) return;
    
    try {
      // Refresh yield data first
      await yieldPollingService.refreshYields();
      
      // Then refresh RWA balances
      await fetchRWABalances();
    } catch (error) {
      console.error('Error refreshing RWA data:', error);
    }
  }, [address, fetchRWABalances]);

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
          rwaTokenBalance: 0,
          pendingYield: 0,
          apy: 0,
          totalYieldEarned: 0,
          rwaError: rwaErrors[name],
        };
      }

      // Cast through unknown to avoid TypeScript error
      const bucketData = result.result as unknown as {
        balance: bigint;
        yieldBalance: bigint;
        isYielding: boolean;
        lastYieldUpdate: bigint;
      };

      // Get RWA-specific data for this bucket
      const bucketYieldInfo = yieldData?.[name as keyof BucketYields];
      const bucketRwaBalances = rwaBalances[name];
      
      // Calculate total RWA token balance from all RWA tokens
      const usdyTokenBalance = bucketRwaBalances?.usdy?.tokenAmount || 0;
      const musdTokenBalance = bucketRwaBalances?.musd?.tokenAmount || 0;
      const usdeTokenBalance = bucketRwaBalances?.usde?.tokenAmount || 0;
      const methTokenBalance = bucketRwaBalances?.meth?.tokenAmount || 0;
      const totalRwaTokenBalance = usdyTokenBalance + musdTokenBalance + usdeTokenBalance + methTokenBalance;

      // Calculate total yield earned from all RWA tokens
      const usdyYieldEarned = bucketRwaBalances?.usdy?.yieldEarned || 0;
      const musdYieldEarned = bucketRwaBalances?.musd?.yieldEarned || 0;
      const usdeYieldEarned = bucketRwaBalances?.usde?.yieldEarned || 0;
      const methYieldEarned = bucketRwaBalances?.meth?.yieldEarned || 0;
      const totalRwaYieldEarned = usdyYieldEarned + musdYieldEarned + usdeYieldEarned + methYieldEarned;

      // Calculate total current value from all RWA tokens
      const usdyCurrentValue = bucketRwaBalances?.usdy?.currentValue || 0;
      const musdCurrentValue = bucketRwaBalances?.musd?.currentValue || 0;
      const usdeCurrentValue = bucketRwaBalances?.usde?.currentValue || 0;
      const methCurrentValue = bucketRwaBalances?.meth?.currentValue || 0;
      const totalRwaCurrentValue = usdyCurrentValue + musdCurrentValue + usdeCurrentValue + methCurrentValue;

      return {
        name,
        balance: bucketData.balance,
        yieldBalance: bucketData.yieldBalance,
        isYielding: bucketData.isYielding || (bucketYieldInfo?.isYielding ?? false),
        lastYieldUpdate: bucketData.lastYieldUpdate,
        formattedBalance: formatUnits(bucketData.balance, USDC_DECIMALS),
        formattedYield: formatUnits(bucketData.yieldBalance, USDC_DECIMALS),
        // RWA-specific fields
        rwaTokenBalance: totalRwaTokenBalance,
        pendingYield: bucketYieldInfo?.pending || 0,
        apy: bucketYieldInfo?.apy || 0,
        totalYieldEarned: totalRwaYieldEarned,
        usdyBalance: bucketRwaBalances?.usdy,
        musdBalance: bucketRwaBalances?.musd,
        usdeBalance: bucketRwaBalances?.usde,
        methBalance: bucketRwaBalances?.meth,
        rwaLastUpdated: bucketYieldInfo?.lastUpdated,
        rwaError: rwaErrors[name],
      };
    });
  }, [data, address, yieldData, rwaBalances, rwaErrors]);

  const totalBalance = useMemo(() => {
    return buckets.reduce((sum, bucket) => sum + bucket.balance, 0n);
  }, [buckets]);

  const formattedTotalBalance = useMemo(() => {
    return formatUnits(totalBalance, USDC_DECIMALS);
  }, [totalBalance]);

  // Calculate total RWA value across all buckets
  const totalRWAValue = useMemo(() => {
    return buckets.reduce((sum, bucket) => {
      const usdyValue = bucket.usdyBalance?.currentValue || 0;
      const musdValue = bucket.musdBalance?.currentValue || 0;
      // Add other RWA token values from rwaBalances
      const bucketRwaBalances = rwaBalances[bucket.name];
      const usdeValue = bucketRwaBalances?.usde?.currentValue || 0;
      const methValue = bucketRwaBalances?.meth?.currentValue || 0;
      return sum + usdyValue + musdValue + usdeValue + methValue;
    }, 0);
  }, [buckets, rwaBalances]);

  // Calculate total pending yield across all buckets
  const totalPendingYield = useMemo(() => {
    return buckets.reduce((sum, bucket) => sum + (bucket.pendingYield || 0), 0);
  }, [buckets]);

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
    return totalBalance > 0n || totalRWAValue > 0 || (splitConfig !== null && 
      (splitConfig.billingsPercent + splitConfig.savingsPercent + 
       splitConfig.growthPercent + splitConfig.instantPercent + 
       splitConfig.spendablePercent) > 0);
  }, [totalBalance, totalRWAValue, splitConfig]);

  return {
    buckets,
    totalBalance,
    formattedTotalBalance,
    splitConfig,
    nonce,
    isLoading: isLoading || isRWALoading,
    isError,
    hasData,
    refetch,
    // RWA-specific fields
    yieldData,
    totalRWAValue,
    totalPendingYield,
    isYieldPollingActive: yieldPollingService.isActive(),
    rwaErrors,
    refreshRWAData,
  };
}
