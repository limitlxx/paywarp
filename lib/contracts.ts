import { getContract } from 'viem'
import { usePublicClient, useWalletClient } from 'wagmi'
import { getContractAddress, type NetworkType } from './networks'
import { useNetwork } from '../hooks/use-network'
import BucketVaultABI from './abis/BucketVault.json'
import PayrollEngineABI from './abis/PayrollEngine.json'

// Contract ABI definitions
export const BUCKET_VAULT_ABI = BucketVaultABI as const
export const PAYROLL_ENGINE_ABI = PayrollEngineABI as const

// Standard ERC20 ABI for token contracts
export const ERC20_ABI = [
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {"name": "from", "type": "address"},
      {"name": "to", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  }
] as const

// Use ERC20 ABI for token contracts
export const USDY_TOKEN_ABI = ERC20_ABI
export const MUSD_TOKEN_ABI = ERC20_ABI

// Contract names type
export type ContractName = 'bucketVault' | 'payrollEngine' | 'usdyToken' | 'musdToken'

// Contract configuration mapping
const CONTRACT_CONFIG = {
  bucketVault: BUCKET_VAULT_ABI,
  payrollEngine: PAYROLL_ENGINE_ABI,
  usdyToken: USDY_TOKEN_ABI,
  musdToken: MUSD_TOKEN_ABI,
} as const

/**
 * Hook to get a contract instance for reading
 */
export function useContract(contractName: ContractName, network: NetworkType) {
  const publicClient = usePublicClient()
  
  if (!publicClient) return null
  
  const address = getContractAddress(network, contractName)
  const abi = CONTRACT_CONFIG[contractName]
  
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return null
  }
  
  return getContract({
    address,
    abi,
    client: publicClient,
  })
}

/**
 * Hook to get a contract instance for writing
 */
export function useContractWrite(contractName: ContractName, network: NetworkType) {
  const { data: walletClient } = useWalletClient()
  
  if (!walletClient) return null
  
  const address = getContractAddress(network, contractName)
  const abi = CONTRACT_CONFIG[contractName]
  
  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return null
  }
  
  return getContract({
    address,
    abi,
    client: walletClient,
  })
}

/**
 * Get contract address for a specific network and contract
 */
export function getContractInfo(contractName: ContractName, network: NetworkType) {
  return getContractAddress(network, contractName)
}

// Re-export getContractAddress for backward compatibility
export { getContractAddress } from './networks'

/**
 * Check if all contracts are deployed for a network
 */
export function areContractsDeployed(network: NetworkType): boolean {
  const contracts: ContractName[] = ['bucketVault', 'payrollEngine', 'usdyToken', 'musdToken']
  
  return contracts.every(contract => {
    const address = getContractAddress(network, contract)
    return address && address !== '0x0000000000000000000000000000000000000000'
  })
}

/**
 * Hook to get contract addresses for the current network
 */
export function useContracts() {
  const { currentNetwork } = useNetwork()
  
  return {
    bucketVaultAddress: getContractAddress(currentNetwork, 'bucketVault'),
    payrollEngineAddress: getContractAddress(currentNetwork, 'payrollEngine'),
    usdyTokenAddress: getContractAddress(currentNetwork, 'usdyToken'),
    musdTokenAddress: getContractAddress(currentNetwork, 'musdToken'),
  }
}