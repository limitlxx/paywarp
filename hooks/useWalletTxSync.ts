'use client';

import { usePublicClient, useAccount } from 'wagmi';
import { useEffect, useState, useCallback, useRef } from 'react';
import { isAddress, type Address, type Block, type Transaction, type Log, parseAbiItem, formatUnits } from 'viem';
import { mantleMainnet, mantleSepolia } from '@/lib/networks';
import { transactionCache } from '@/lib/transaction-cache';
import type { BlockchainTransaction } from '@/lib/transaction-sync';

interface TokenConfig {
  address: Address;
  symbol: string;
  decimals: number;
}

interface ChainTokens {
  usdc: TokenConfig;
  wmnt: TokenConfig;
}

const tokensByChain: Record<number, ChainTokens> = {
  [mantleMainnet.id]: {
    usdc: { address: '0x09Bc4E0D864854c6aFB6eB9A9cdF58ac190D0dF9', symbol: 'USDC', decimals: 6 },
    wmnt: { address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', symbol: 'wMNT', decimals: 18 },
  },
  [mantleSepolia.id]: {
    usdc: { address: '0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8', symbol: 'USDC', decimals: 6 },
    wmnt: { address: '0x35578E7e8949B5a59d40704dCF6D6faEC2Fb1D17', symbol: 'wMNT', decimals: 18 },
  },
};

// Known method selectors for classification
const methodSelectors: Record<string, BlockchainTransaction['type']> = {
  '0xa9059cbb': 'erc20_transfer',
  '0x095ea7b3': 'erc20_approve',
  '0x23b872dd': 'erc20_transferFrom',
};

interface WalletTxSyncOptions {
  fromBlock?: bigint;
  maxBlocks?: number;
  includeERC20?: boolean;
  autoStart?: boolean;
}

interface WalletTxSyncReturn {
  transactions: BlockchainTransaction[];
  isSyncing: boolean;
  isPaused: boolean;
  error: string | null;
  syncProgress: { current: number; total: number; percentage: number } | null;
  
  startSync: (options?: WalletTxSyncOptions) => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
  stopSync: () => void;
  syncWalletTxs: (options?: WalletTxSyncOptions) => Promise<void>;
}

export function useWalletTxSync(options: WalletTxSyncOptions = {}): WalletTxSyncReturn {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  
  const [transactions, setTransactions] = useState<BlockchainTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; percentage: number } | null>(null);
  
  const syncControlRef = useRef<{ shouldStop: boolean; isPaused: boolean }>({ shouldStop: false, isPaused: false });
  const watchUnsubscribeRef = useRef<(() => void) | null>(null);

  const syncWalletTxs = useCallback(async (syncOptions: WalletTxSyncOptions = {}) => {
    if (!address || !isAddress(address) || !publicClient) {
      setError('Wallet not connected or invalid address');
      return;
    }

    setIsSyncing(true);
    setError(null);
    setSyncProgress(null);
    
    const {
      fromBlock,
      maxBlocks = 5000,
      includeERC20 = true
    } = { ...options, ...syncOptions };

    try {
      console.log(`🔄 Starting wallet transaction sync for ${address}`);
      
      const chainId = publicClient.chain?.id || mantleSepolia.id;
      console.log(`🔗 Using chain ID: ${chainId}`);
      
      const cached = await transactionCache.getTransactions(address, chainId);
      
      if (cached.length > 0) {
        console.log(`📱 Loaded ${cached.length} cached transactions`);
        const mappedTxs = cached.map(cached => transactionCache.constructor.prototype.fromCached ? transactionCache.constructor.prototype.fromCached(cached) : cached) as BlockchainTransaction[];
        setTransactions(mappedTxs);
      }

      const currentBlock = await publicClient.getBlockNumber();
      console.log(`📊 Current block: ${currentBlock}`);
      
      let startBlock: bigint;
      if (fromBlock) {
        startBlock = fromBlock;
      } else {
        const searchDepth = cached.length === 0 ? BigInt(50000) : BigInt(maxBlocks);
        startBlock = currentBlock - searchDepth;
        startBlock = startBlock > 0n ? startBlock : 0n;
      }
      
      console.log(`📊 Syncing blocks ${startBlock} to ${currentBlock} (${currentBlock - startBlock + 1n} blocks)`);
      
      const chunkSize = 100;
      const totalBlocks = Number(currentBlock - startBlock + 1n);
      const chunks = Math.ceil(totalBlocks / chunkSize);
      
      console.log(`📦 Processing ${chunks} chunks of ${chunkSize} blocks each`);
      
      const newTxs: BlockchainTransaction[] = [];
      let processedBlocks = 0;
      
      const blockTimestamps = new Map<bigint, number>();
      
      for (let i = 0; i < chunks; i++) {
        if (syncControlRef.current.shouldStop) {
          console.log('🛑 Sync stopped by user');
          break;
        }
        
        while (syncControlRef.current.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (syncControlRef.current.shouldStop) break;
        }
        
        const chunkStart = startBlock + BigInt(i * chunkSize);
        const chunkEnd = chunkStart + BigInt(chunkSize - 1) > currentBlock 
          ? currentBlock 
          : chunkStart + BigInt(chunkSize - 1);
        
        setSyncProgress({
          current: i + 1,
          total: chunks,
          percentage: Math.round(((i + 1) / chunks) * 100)
        });
        
        try {
          console.log(`📦 Processing chunk ${i + 1}/${chunks}: blocks ${chunkStart} to ${chunkEnd}`);
          
          const batchSize = 20;
          const blocksInChunk = Number(chunkEnd - chunkStart + 1n);
          const batches = Math.ceil(blocksInChunk / batchSize);
          
          for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const batchStart = chunkStart + BigInt(batchIndex * batchSize);
            const batchEnd = batchStart + BigInt(batchSize - 1) > chunkEnd 
              ? chunkEnd 
              : batchStart + BigInt(batchSize - 1);
            
            const blockNumbers: bigint[] = [];
            for (let blockNum = batchStart; blockNum <= batchEnd; blockNum++) {
              blockNumbers.push(blockNum);
            }
            
            const blocks = await Promise.allSettled(
              blockNumbers.map(async (blockNumber) => {
                try {
                  return await publicClient.getBlock({ 
                    blockNumber, 
                    includeTransactions: true 
                  });
                } catch (error) {
                  console.warn(`Failed to fetch block ${blockNumber}:`, error);
                  return null;
                }
              })
            );
            
            for (const blockResult of blocks) {
              if (blockResult.status === 'fulfilled' && blockResult.value) {
                const block = blockResult.value;
                blockTimestamps.set(block.number, Number(block.timestamp) * 1000);
                
                if (!block.transactions) continue;
                
                for (const tx of block.transactions as Transaction[]) {
                  const isUserTx = tx.from.toLowerCase() === address.toLowerCase() || 
                                  (tx.to && tx.to.toLowerCase() === address.toLowerCase());
                  
                  if (!isUserTx) continue;
                  
                  try {
                    const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                    
                    const txType = inferTransactionType(tx, address, receipt, chainId);
                    
                    const walletTx: BlockchainTransaction = {
                      id: tx.hash,
                      hash: tx.hash,
                      type: txType,
                      amount: tx.value,
                      fromBucket: undefined,
                      toBucket: undefined,
                      recipient: tx.to || undefined,
                      timestamp: new Date(Number(block.timestamp) * 1000),
                      blockNumber: block.number,
                      status: receipt.status === 'success' ? 'completed' : 'failed',
                      gasUsed: receipt.gasUsed,
                      gasCost: receipt.gasUsed * (receipt.effectiveGasPrice || 0n),
                      description: generateTxDescription(tx, address, txType, chainId),
                      metadata: {},
                      contractAddress: tx.to || '0x0',
                      eventName: 'wallet_transaction',
                      tokenSymbol: txType.startsWith('erc20_') ? getTokenSymbol(tx.to || '0x0', chainId) : undefined,
                      decimals: txType.startsWith('erc20_') ? getTokenDecimals(tx.to || '0x0', chainId) : 18,
                    };
                    
                    newTxs.push(walletTx);
                    console.log(`✅ Found transaction: ${tx.hash} (${txType})`);
                  } catch (error) {
                    console.warn(`Failed to process transaction ${tx.hash}:`, error);
                  }
                }
              }
            }
            
            processedBlocks += blockNumbers.length;
            
            if (batchIndex < batches - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          // Fetch ERC20 Transfer logs
          if (includeERC20) {
            const tokenConfigs = tokensByChain[chainId];
            if (tokenConfigs) {
              const tokenAddresses = Object.values(tokenConfigs).map(t => t.address);
              
              try {
                const logs = await publicClient.getLogs({
                  address: tokenAddresses,
                  event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
                  fromBlock: chunkStart,
                  toBlock: chunkEnd,
                });
                
                const uniqueBlockNums = new Set<bigint>(logs.map(log => log.blockNumber!));
                for (const blockNum of uniqueBlockNums) {
                  if (!blockTimestamps.has(blockNum)) {
                    try {
                      const block = await publicClient.getBlock({ blockNumber: blockNum });
                      blockTimestamps.set(blockNum, Number(block.timestamp) * 1000);
                    } catch (error) {
                      console.warn(`Failed to fetch block ${blockNum} for timestamp:`, error);
                    }
                  }
                }
                
                for (const log of logs) {
                  const logArgs = log.args as { from?: Address; to?: Address; value?: bigint };
                  
                  if (
                    logArgs.from?.toLowerCase() === address.toLowerCase() || 
                    logArgs.to?.toLowerCase() === address.toLowerCase()
                  ) {
                    const isOutgoing = logArgs.from?.toLowerCase() === address.toLowerCase();
                    const txType = isOutgoing ? 'erc20_out' : 'erc20_in';
                    const tokenSymbol = getTokenSymbol(log.address, chainId);
                    const decimals = getTokenDecimals(log.address, chainId);
                    
                    const walletTx: BlockchainTransaction = {
                      id: `${log.transactionHash}-${log.logIndex}`,
                      hash: log.transactionHash!,
                      type: txType,
                      amount: logArgs.value || 0n,
                      fromBucket: logArgs.from,
                      toBucket: logArgs.to,
                      recipient: logArgs.to || undefined,
                      timestamp: new Date(blockTimestamps.get(log.blockNumber!)!),
                      blockNumber: log.blockNumber!,
                      status: 'completed',
                      gasUsed: 0n,
                      gasCost: 0n,
                      description: generateTxDescriptionFromLog(logArgs, address, txType, tokenSymbol, decimals),
                      metadata: {},
                      contractAddress: log.address,
                      eventName: 'Transfer',
                      tokenSymbol,
                      decimals,
                    };
                    
                    newTxs.push(walletTx);
                    console.log(`✅ Found ERC20 transfer: ${log.transactionHash} (${tokenSymbol} ${txType})`);
                  }
                }
              } catch (error) {
                console.warn(`Failed to fetch ERC20 logs for chunk ${i + 1}:`, error);
              }
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Failed to process chunk ${i + 1}:`, error);
        }
      }
      
      console.log(`🔍 Processed ${processedBlocks} blocks, found ${newTxs.length} transactions`);
      
      const allTxs = [...transactions, ...newTxs].filter((tx, index, self) => 
        index === self.findIndex(t => t.id === tx.id)
      ).sort((a, b) => Number(b.blockNumber - a.blockNumber));
      
      setTransactions(allTxs);
      
      await transactionCache.storeTransactions(allTxs, address, chainId);
      
      console.log(`✅ Wallet sync completed: ${newTxs.length} new transactions, ${allTxs.length} total`);
      
      if (newTxs.length === 0 && cached.length === 0) {
        console.log(`ℹ️ No transactions found. This could mean:
          - The wallet hasn't made any transactions yet
          - Transactions are older than the search range (${processedBlocks} blocks)
          - RPC provider limitations prevented full scanning`);
      }
      
    } catch (error) {
      console.error('Wallet transaction sync failed:', error);
      setError(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
      syncControlRef.current.shouldStop = false;
      syncControlRef.current.isPaused = false;
    }
  }, [address, publicClient, transactions, options]);

  const startSync = useCallback(async (syncOptions?: WalletTxSyncOptions) => {
    if (!address || !publicClient) return;
    
    syncControlRef.current.shouldStop = false;
    syncControlRef.current.isPaused = false;
    setIsPaused(false);
    
    await syncWalletTxs(syncOptions);
    
    if (!watchUnsubscribeRef.current) {
      console.log('👀 Starting live transaction watching');
      
      watchUnsubscribeRef.current = publicClient.watchBlocks({
        onBlock: async (block) => {
          if (syncControlRef.current.shouldStop || syncControlRef.current.isPaused) return;
          
          try {
            const blockWithTxs = await publicClient.getBlock({ 
              blockNumber: block.number, 
              includeTransactions: true 
            });
            
            const userTxs = blockWithTxs.transactions?.filter((tx: Transaction) => 
              tx.from.toLowerCase() === address.toLowerCase() || 
              (tx.to && tx.to.toLowerCase() === address.toLowerCase())
            ) || [];
            
            if (userTxs.length > 0) {
              console.log(`🔔 Found ${userTxs.length} new transactions in block ${block.number}`);
              
              const newTxs: BlockchainTransaction[] = [];
              const chainId = publicClient.chain?.id || mantleSepolia.id;
              
              for (const tx of userTxs) {
                try {
                  const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                  const txType = inferTransactionType(tx, address, receipt, chainId);
                  
                  const walletTx: BlockchainTransaction = {
                    id: tx.hash,
                    hash: tx.hash,
                    type: txType,
                    amount: tx.value,
                    timestamp: new Date(Number(block.timestamp) * 1000),
                    blockNumber: block.number,
                    status: receipt.status === 'success' ? 'completed' : 'failed',
                    gasUsed: receipt.gasUsed,
                    gasCost: receipt.gasUsed * (receipt.effectiveGasPrice || 0n),
                    description: generateTxDescription(tx, address, txType, chainId),
                    metadata: {},
                    contractAddress: tx.to || '0x0',
                    eventName: 'wallet_transaction',
                    tokenSymbol: txType.startsWith('erc20_') ? getTokenSymbol(tx.to || '0x0', chainId) : undefined,
                    decimals: txType.startsWith('erc20_') ? getTokenDecimals(tx.to || '0x0', chainId) : 18,
                  };
                  
                  newTxs.push(walletTx);
                } catch (error) {
                  console.warn(`Failed to process live transaction ${tx.hash}:`, error);
                }
              }
              
              if (newTxs.length > 0) {
                setTransactions(prev => {
                  const updated = [...newTxs, ...prev].filter((tx, index, self) => 
                    index === self.findIndex(t => t.hash === tx.hash)
                  );
                  
                  transactionCache.storeTransactions(updated, address, chainId).catch(console.error);
                  
                  return updated;
                });
              }
            }
          } catch (error) {
            console.error('Error processing live block:', error);
          }
        }
      });
    }
  }, [address, publicClient, syncWalletTxs]);

  const pauseSync = useCallback(() => {
    syncControlRef.current.isPaused = true;
    setIsPaused(true);
    console.log('⏸️ Wallet sync paused');
  }, []);

  const resumeSync = useCallback(() => {
    syncControlRef.current.isPaused = false;
    setIsPaused(false);
    console.log('▶️ Wallet sync resumed');
  }, []);

  const stopSync = useCallback(() => {
    syncControlRef.current.shouldStop = true;
    syncControlRef.current.isPaused = false;
    setIsPaused(false);
    setIsSyncing(false);
    
    if (watchUnsubscribeRef.current) {
      watchUnsubscribeRef.current();
      watchUnsubscribeRef.current = null;
    }
    
    console.log('🛑 Wallet sync stopped');
  }, []);

  useEffect(() => {
    if (options.autoStart && address && publicClient) {
      startSync();
    }
    
    return () => {
      stopSync();
    };
  }, [address, publicClient, options.autoStart, startSync, stopSync]);

  useEffect(() => {
    return () => {
      if (watchUnsubscribeRef.current) {
        watchUnsubscribeRef.current();
      }
    };
  }, []);

  return {
    transactions,
    isSyncing,
    isPaused,
    error,
    syncProgress,
    startSync,
    pauseSync,
    resumeSync,
    stopSync,
    syncWalletTxs
  };
}

function inferTransactionType(
  tx: Transaction, 
  userAddress: string, 
  receipt: any,
  chainId: number
): BlockchainTransaction['type'] {
  const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase();
  
  if (tx.input && tx.input.length >= 10) {
    const selector = tx.input.slice(0, 10);
    if (methodSelectors[selector]) {
      return methodSelectors[selector];
    }
  }
  
  if (tx.to && tx.input && tx.input !== '0x') {
    const tokenSymbol = getTokenSymbol(tx.to, chainId);
    if (tokenSymbol) {
      return 'erc20_interaction';
    }
    return isOutgoing ? 'transfer' : 'deposit';
  }
  
  if (tx.value > 0n) {
    return isOutgoing ? 'withdrawal' : 'deposit';
  }
  
  return 'transfer';
}

function generateTxDescription(
  tx: Transaction, 
  userAddress: string, 
  type: BlockchainTransaction['type'],
  chainId: number
): string {
  const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase();
  const amount = Number(tx.value) / 1e18;
  const tokenSymbol = getTokenSymbol(tx.to || '0x0', chainId) || 'MNT';
  
  if (type === 'deposit') {
    return `Received ${amount.toFixed(4)} ${tokenSymbol}`;
  } else if (type === 'withdrawal') {
    return `Sent ${amount.toFixed(4)} ${tokenSymbol}`;
  } else if (type.startsWith('erc20_')) {
    return `${isOutgoing ? 'Sent' : 'Received'} ${tokenSymbol}`;
  } else {
    return `${isOutgoing ? 'Sent' : 'Received'} transaction`;
  }
}

function generateTxDescriptionFromLog(
  logArgs: { from?: Address; to?: Address; value?: bigint }, 
  userAddress: string, 
  type: BlockchainTransaction['type'],
  tokenSymbol: string,
  decimals: number
): string {
  const amount = Number(logArgs.value || 0n) / 10 ** decimals;
  const isOutgoing = logArgs.from?.toLowerCase() === userAddress.toLowerCase();
  return `${isOutgoing ? 'Sent' : 'Received'} ${amount.toFixed(4)} ${tokenSymbol}`;
}

function getTokenSymbol(tokenAddress: Address, chainId: number): string {
  const chainTokens = tokensByChain[chainId];
  if (!chainTokens) return '';
  if (tokenAddress.toLowerCase() === chainTokens.usdc.address.toLowerCase()) return chainTokens.usdc.symbol;
  if (tokenAddress.toLowerCase() === chainTokens.wmnt.address.toLowerCase()) return chainTokens.wmnt.symbol;
  return '';
}

function getTokenDecimals(tokenAddress: Address, chainId: number): number {
  const chainTokens = tokensByChain[chainId];
  if (!chainTokens) return 18;
  if (tokenAddress.toLowerCase() === chainTokens.usdc.address.toLowerCase()) return chainTokens.usdc.decimals;
  if (tokenAddress.toLowerCase() === chainTokens.wmnt.address.toLowerCase()) return chainTokens.wmnt.decimals;
  return 18;
}
