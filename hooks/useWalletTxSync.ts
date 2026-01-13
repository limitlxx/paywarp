'use client';

import { usePublicClient, useAccount } from 'wagmi';
import { useEffect, useState, useCallback, useRef } from 'react';
import { isAddress, type Address, type Block, type Transaction } from 'viem';
import { mantleMainnet, mantleSepolia } from '@/lib/networks';
import { transactionCache } from '@/lib/transaction-cache';
import type { BlockchainTransaction } from '@/lib/transaction-sync';

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
  
  // Control methods
  startSync: (options?: WalletTxSyncOptions) => Promise<void>;
  pauseSync: () => void;
  resumeSync: () => void;
  stopSync: () => void;
  
  // Manual sync
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
  
  // Refs for managing sync state
  const syncControlRef = useRef<{ shouldStop: boolean; isPaused: boolean }>({ shouldStop: false, isPaused: false });
  const watchUnsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Sync wallet transactions for the connected user
   */
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
      maxBlocks = 5000, // Increased default to 5000 blocks for better discovery
      includeERC20 = true
    } = { ...options, ...syncOptions };

    try {
      console.log(`🔄 Starting wallet transaction sync for ${address}`);
      
      // Try to load from cache first
      const chainId = publicClient.chain?.id || mantleSepolia.id;
      console.log(`🔗 Using chain ID: ${chainId}`);
      
      const cached = await transactionCache.getTransactions(address, chainId);
      
      if (cached.length > 0) {
        console.log(`📱 Loaded ${cached.length} cached transactions`);
        const mappedTxs = cached.map(cached => transactionCache.fromCached(cached) as BlockchainTransaction);
        setTransactions(mappedTxs);
      }

      // Get current block
      const currentBlock = await publicClient.getBlockNumber();
      console.log(`📊 Current block: ${currentBlock}`);
      
      // Use a more aggressive search strategy for historical transactions
      let startBlock: bigint;
      if (fromBlock) {
        startBlock = fromBlock;
      } else {
        // If no cached transactions, search further back (up to 50k blocks for Sepolia)
        const searchDepth = cached.length === 0 ? BigInt(50000) : BigInt(maxBlocks);
        startBlock = currentBlock - searchDepth;
        startBlock = startBlock > 0n ? startBlock : 0n;
      }
      
      console.log(`📊 Syncing blocks ${startBlock} to ${currentBlock} (${currentBlock - startBlock + 1n} blocks)`);
      
      // Sync in chunks to avoid RPC limits
      const chunkSize = 100;
      const totalBlocks = Number(currentBlock - startBlock + 1n);
      const chunks = Math.ceil(totalBlocks / chunkSize);
      
      console.log(`📦 Processing ${chunks} chunks of ${chunkSize} blocks each`);
      
      const newTxs: BlockchainTransaction[] = [];
      let processedBlocks = 0;
      
      for (let i = 0; i < chunks; i++) {
        // Check if sync should stop or is paused
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
        
        // Update progress
        setSyncProgress({
          current: i + 1,
          total: chunks,
          percentage: Math.round(((i + 1) / chunks) * 100)
        });
        
        try {
          console.log(`📦 Processing chunk ${i + 1}/${chunks}: blocks ${chunkStart} to ${chunkEnd}`);
          
          // Fetch blocks in smaller batches to avoid RPC timeouts
          const batchSize = 20; // Smaller batches for more reliable fetching
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
            
            // Fetch blocks with transactions
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
            
            // Process successful block fetches
            for (const blockResult of blocks) {
              if (blockResult.status === 'fulfilled' && blockResult.value) {
                const block = blockResult.value;
                if (!block.transactions) continue;
                
                for (const tx of block.transactions) {
                  // Check if transaction involves the user's address
                  const isUserTx = tx.from.toLowerCase() === address.toLowerCase() || 
                                  (tx.to && tx.to.toLowerCase() === address.toLowerCase());
                  
                  if (!isUserTx) continue;
                  
                  try {
                    // Get transaction receipt for status and gas info
                    const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                    
                    // Determine transaction type
                    const txType = inferTransactionType(tx, address, receipt);
                    
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
                      description: generateTxDescription(tx, address, txType),
                      metadata: {},
                      contractAddress: tx.to || '0x0',
                      eventName: 'wallet_transaction'
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
            
            // Add delay between batches to avoid rate limiting
            if (batchIndex < batches - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          // Add delay between chunks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`Failed to process chunk ${i + 1}:`, error);
          // Continue with next chunk
        }
      }
      
      console.log(`🔍 Processed ${processedBlocks} blocks, found ${newTxs.length} transactions`);
      
      // Merge with existing transactions and dedupe
      const allTxs = [...transactions, ...newTxs].filter((tx, index, self) => 
        index === self.findIndex(t => t.hash === tx.hash)
      ).sort((a, b) => Number(b.blockNumber - a.blockNumber));
      
      setTransactions(allTxs);
      
      // Cache the results
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

  /**
   * Start continuous sync with live watching
   */
  const startSync = useCallback(async (syncOptions?: WalletTxSyncOptions) => {
    if (!address || !publicClient) return;
    
    syncControlRef.current.shouldStop = false;
    syncControlRef.current.isPaused = false;
    setIsPaused(false);
    
    // Do initial sync
    await syncWalletTxs(syncOptions);
    
    // Start watching for new blocks
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
            
            const userTxs = blockWithTxs.transactions?.filter(tx => 
              tx.from.toLowerCase() === address.toLowerCase() || 
              (tx.to && tx.to.toLowerCase() === address.toLowerCase())
            ) || [];
            
            if (userTxs.length > 0) {
              console.log(`🔔 Found ${userTxs.length} new transactions in block ${block.number}`);
              
              // Process new transactions
              const newTxs: BlockchainTransaction[] = [];
              
              for (const tx of userTxs) {
                try {
                  const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
                  const txType = inferTransactionType(tx, address, receipt);
                  
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
                    description: generateTxDescription(tx, address, txType),
                    metadata: {},
                    contractAddress: tx.to || '0x0',
                    eventName: 'wallet_transaction'
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
                  
                  // Update cache
                  const chainId = publicClient.chain?.id || mantleSepolia.id;
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

  /**
   * Pause sync (stops live watching but keeps state)
   */
  const pauseSync = useCallback(() => {
    syncControlRef.current.isPaused = true;
    setIsPaused(true);
    console.log('⏸️ Wallet sync paused');
  }, []);

  /**
   * Resume sync
   */
  const resumeSync = useCallback(() => {
    syncControlRef.current.isPaused = false;
    setIsPaused(false);
    console.log('▶️ Wallet sync resumed');
  }, []);

  /**
   * Stop sync completely
   */
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

  // Auto-start sync if enabled
  useEffect(() => {
    if (options.autoStart && address && publicClient) {
      startSync();
    }
    
    return () => {
      stopSync();
    };
  }, [address, publicClient, options.autoStart, startSync, stopSync]);

  // Cleanup on unmount
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

/**
 * Helper function to infer transaction type
 */
function inferTransactionType(
  tx: Transaction, 
  userAddress: string, 
  receipt: any
): BlockchainTransaction['type'] {
  const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase();
  const isIncoming = tx.to?.toLowerCase() === userAddress.toLowerCase();
  
  // Contract interaction
  if (tx.to && tx.input && tx.input !== '0x') {
    return isOutgoing ? 'transfer' : 'deposit';
  }
  
  // ETH transfer
  if (tx.value > 0n) {
    return isOutgoing ? 'withdrawal' : 'deposit';
  }
  
  // Default
  return 'transfer';
}

/**
 * Helper function to generate transaction description
 */
function generateTxDescription(
  tx: Transaction, 
  userAddress: string, 
  type: BlockchainTransaction['type']
): string {
  const isOutgoing = tx.from.toLowerCase() === userAddress.toLowerCase();
  const amount = Number(tx.value) / 1e18; // Convert to ETH
  
  if (type === 'deposit') {
    return `Received ${amount.toFixed(4)} ETH`;
  } else if (type === 'withdrawal') {
    return `Sent ${amount.toFixed(4)} ETH`;
  } else {
    return `${isOutgoing ? 'Sent' : 'Received'} transaction`;
  }
}