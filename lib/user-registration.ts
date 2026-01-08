import { ethers } from 'ethers';
import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../types/contracts';
import UserRegistryABI from './abis/UserRegistryUpgradeable.json';

export interface UserRegistrationManager {
  // Registration methods
  checkRegistrationStatus: (address: string) => Promise<boolean>;
  registerUser: (address: string) => Promise<{ hash: string; success: boolean }>;
  generateRegistrationMessage: (address: string) => string;
  
  // Community tracking
  getTotalUsers: () => Promise<number>;
  getUserRegistrationDate: (address: string) => Promise<Date | null>;
  
  // Event monitoring
  subscribeToRegistrations: (callback: (event: RegistrationEvent) => void) => void;
  getRegistrationHistory: () => Promise<RegistrationEvent[]>;
}

export interface RegistrationEvent {
  user: string;
  timestamp: Date;
  totalUsers: number;
  transactionHash: string;
  blockNumber: number;
}

export interface UserRegistration {
  address: string;
  isRegistered: boolean;
  registrationDate: Date;
  transactionHash: string;
  messageHash: string;
  signature: string;
}

export interface CommunityStats {
  totalUsers: number;
  recentRegistrations: UserRegistration[];
  lastUpdated: Date;
  dailyGrowthRate: number;
}

/**
 * Generate a registration message for wallet signing
 */
export function generateRegistrationMessage(address: string): string {
  const timestamp = Date.now();
  return `Register wallet ${address} with PayWarp at ${timestamp}`;
}

/**
 * Create message hash for registration
 * This creates the hash that will be signed and verified by the contract
 */
export function createMessageHash(message: string): string {
  const bytes = ethers.toUtf8Bytes(message);
  const hash = ethers.keccak256(bytes);
  return hash;
}

/**
 * Sign registration message with wallet
 */
export async function signRegistrationMessage(
  signer: ethers.Signer,
  message: string
): Promise<{ messageHash: string; signature: string }> {
  const messageHash = createMessageHash(message);
  const signature = await signer.signMessage(ethers.getBytes(messageHash));
  
  return {
    messageHash,
    signature
  };
}

/**
 * Verify signature matches the expected signer
 */
export function verifyRegistrationSignature(
  messageHash: string,  // Changed: Verify against hash, not original message
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const recoveredSigner = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
    return recoveredSigner.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Hook for user registration functionality
 */
export function useUserRegistration() {
  const { address, chainId } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Store signature for registration
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [pendingMessageHash, setPendingMessageHash] = useState<string | null>(null);
  const [registrationFailureReason, setRegistrationFailureReason] = useState<string | null>(null);

  // Get contract address for current network
  const getContractAddress = () => {
    if (!chainId || !CONTRACT_ADDRESSES[chainId]) {
      return undefined;
    }
    const address = CONTRACT_ADDRESSES[chainId].UserRegistry;
    // Check if address is a zero address (not deployed)
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return undefined;
    }
    return address as `0x${string}`;
  };

  const contractAddress = getContractAddress();

  // Listen for registration events
  useWatchContractEvent({
    address: contractAddress,
    abi: UserRegistryABI as any,
    eventName: 'UserRegistered',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (log.args?.user?.toLowerCase() === address?.toLowerCase()) {
          console.log('User registration successful:', log);
          // Clear any previous failure reason
          setRegistrationFailureReason(null);
        }
      });
    },
    enabled: !!address && !!contractAddress,
  });

  // Listen for registration failure events (removed duplicate)
  useWatchContractEvent({
    address: contractAddress,
    abi: UserRegistryABI as any,
    eventName: 'RegistrationFailed',
    onLogs(logs) {
      logs.forEach((log: any) => {
        if (log.args?.user?.toLowerCase() === address?.toLowerCase()) {
          const reason = log.args?.reason as string;
          console.log('User registration failed:', reason);
          setRegistrationFailureReason(reason || 'Registration failed');
        }
      });
    },
    enabled: !!address && !!contractAddress,
  });

  // Clear registration failure reason when address changes
  useEffect(() => {
    setRegistrationFailureReason(null);
  }, [address]);

  // Check if user is registered (with fallback for undeployed contracts)
  const { data: isRegistered, refetch: refetchRegistrationStatus } = useReadContract({
    address: contractAddress,
    abi: UserRegistryABI as any,
    functionName: 'isUserRegistered',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddress,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  // Fallback: if contract is not deployed, treat as not registered
  const effectiveIsRegistered = contractAddress ? isRegistered : false;

  // Get total users
  const { data: totalUsers, refetch: refetchTotalUsers } = useReadContract({
    address: contractAddress,
    abi: UserRegistryABI as any,
    functionName: 'getTotalUsers',
    query: {
      enabled: !!contractAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  // Get user registration date
  const { data: registrationDate } = useReadContract({
    address: contractAddress,
    abi: UserRegistryABI as any,
    functionName: 'getRegistrationDate',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddress,
    },
  });

  // Set signature for registration
  const setRegistrationSignature = (signature: string, messageHash: string) => {
    setPendingSignature(signature);
    setPendingMessageHash(messageHash);
  };

  // Clear signature state
  const clearRegistrationSignature = () => {
    setPendingSignature(null);
    setPendingMessageHash(null);
  };

  // Clear registration failure reason
  const clearRegistrationFailureReason = () => {
    setRegistrationFailureReason(null);
  };

  // Register user function - UPDATED: Accept params directly, no state dependency
  const registerUser = async (
    signature: string,
    messageHash: string
  ): Promise<{ success: boolean; hash?: string; error?: string }> => {
    if (!address) {
      return { success: false, error: 'No wallet connected' };
    }

    if (!contractAddress) {
      return { success: false, error: 'UserRegistry contract not deployed on this network' };
    }

    if (!signature || !messageHash) {
      return { success: false, error: 'No signature available' };
    }

    // Clear any previous registration failure reason
    setRegistrationFailureReason(null);

    try {
      writeContract({
        address: contractAddress,
        abi: UserRegistryABI as any,
        functionName: 'registerUser',
        args: [messageHash as `0x${string}`, signature as `0x${string}`],
      });

      // Don't return hash here - it's async. Just signal success to trigger effects.
      // The isConfirmed effect will handle final success.
      return { success: true };
    } catch (err) {
      console.error('Registration failed:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }; 

  return {
    // State
    isRegistered: effectiveIsRegistered, // Use fallback value
    totalUsers: totalUsers ? Number(totalUsers) : 0,
    registrationDate: registrationDate ? new Date(Number(registrationDate) * 1000) : null,
    registrationFailureReason,
    
    // Actions
    registerUser,
    setRegistrationSignature,
    clearRegistrationSignature,
    clearRegistrationFailureReason,
    refetchRegistrationStatus,
    refetchTotalUsers,
    
    // Transaction state
    isPending,
    isConfirming,
    isConfirmed,
    error,
    hash,
  };
}

/**
 * Hook for community statistics
 */
export function useCommunityStats() {
  const { chainId } = useAccount();

  // Get contract address for current network
  const getContractAddress = () => {
    if (!chainId || !CONTRACT_ADDRESSES[chainId]) {
      return undefined;
    }
    const address = CONTRACT_ADDRESSES[chainId].UserRegistry;
    // Check if address is a zero address (not deployed)
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return undefined;
    }
    return address as `0x${string}`;
  };

  const contractAddress = getContractAddress();

  // Get total users
  const { data: totalUsers, isLoading } = useReadContract({
    address: contractAddress,
    abi: UserRegistryABI as any,
    functionName: 'getTotalUsers',
    query: {
      enabled: !!contractAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  return {
    totalUsers: totalUsers ? Number(totalUsers) : 0,
    isLoading,
    isContractDeployed: !!contractAddress,
  };
}