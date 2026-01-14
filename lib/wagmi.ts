import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mantleMainnet, mantleSepolia } from './networks'

// Get WalletConnect project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set')
}

// Configure wagmi with RainbowKit - Default to Sepolia
export const wagmiConfig = getDefaultConfig({
  appName: 'PayWarp',
  projectId,
  chains: [mantleSepolia, mantleMainnet], // Sepolia first as default
  ssr: true, // Enable server-side rendering support
})

// Export chain configurations for easy access
export { mantleMainnet, mantleSepolia }