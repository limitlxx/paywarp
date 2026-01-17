import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const PAYROLL_ENGINE_ADDRESS = process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA
const RPC_URL = process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz'

const PAYROLL_ENGINE_ABI = [
  "function owner() view returns (address)",
  "function version() view returns (string)",
  "function automationRegistry() view returns (address)",
  "function authorizedKeepers(address) view returns (bool)",
  "function protocolFee() view returns (uint256)",
  "function maxGasPerPayment() view returns (uint256)",
  "function paused() view returns (bool)",
  "function checkUpkeep(bytes) view returns (bool, bytes)"
]

const KEEPER_ADDRESSES = [
  '0x02777053d6764996e594c3E88AF1D58D5363a2e6',
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
]

async function main() {
  console.log('🔍 PayWarp Chainlink Automation Status')
  console.log('======================================\n')

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const contract = new ethers.Contract(PAYROLL_ENGINE_ADDRESS, PAYROLL_ENGINE_ABI, provider)

  try {
    // Basic contract info
    console.log('📋 Contract Information:')
    console.log(`Address: ${PAYROLL_ENGINE_ADDRESS}`)
    
    const version = await contract.version()
    console.log(`Version: ${version}`)
    
    const owner = await contract.owner()
    console.log(`Owner: ${owner}`)
    
    const paused = await contract.paused()
    console.log(`Paused: ${paused}`)
    
    // Automation setup
    console.log('\n🔗 Chainlink Automation Setup:')
    const automationRegistry = await contract.automationRegistry()
    console.log(`Registry: ${automationRegistry}`)
    
    if (automationRegistry === ethers.ZeroAddress) {
      console.log('❌ Automation registry not set')
    } else {
      console.log('✅ Automation registry configured')
    }
    
    // Check authorized keepers
    console.log('\n🔑 Authorized Keepers:')
    for (const keeper of KEEPER_ADDRESSES) {
      const isAuthorized = await contract.authorizedKeepers(keeper)
      console.log(`${keeper}: ${isAuthorized ? '✅ Authorized' : '❌ Not authorized'}`)
    }
    
    // Contract configuration
    console.log('\n⚙️  Configuration:')
    const protocolFee = await contract.protocolFee()
    console.log(`Protocol Fee: ${protocolFee} basis points (${Number(protocolFee) / 100}%)`)
    
    const maxGas = await contract.maxGasPerPayment()
    console.log(`Max Gas Per Payment: ${maxGas}`)
    
    // Test automation functions
    console.log('\n🧪 Testing Automation Functions:')
    try {
      const [upkeepNeeded, performData] = await contract.checkUpkeep('0x')
      console.log(`✅ checkUpkeep working`)
      console.log(`  - Upkeep needed: ${upkeepNeeded}`)
      console.log(`  - Perform data length: ${performData.length}`)
    } catch (error) {
      console.log(`❌ checkUpkeep failed: ${error.message}`)
    }
    
    // Summary
    console.log('\n📊 Setup Status:')
    const registrySet = automationRegistry !== ethers.ZeroAddress
    const keepersAuthorized = await Promise.all(
      KEEPER_ADDRESSES.map(keeper => contract.authorizedKeepers(keeper))
    )
    const allKeepersAuthorized = keepersAuthorized.every(Boolean)
    
    console.log(`✅ Contract upgraded: v${version}`)
    console.log(`${registrySet ? '✅' : '❌'} Automation registry: ${registrySet ? 'Set' : 'Not set'}`)
    console.log(`${allKeepersAuthorized ? '✅' : '❌'} Keepers authorized: ${allKeepersAuthorized ? 'All authorized' : 'Some missing'}`)
    console.log(`${!paused ? '✅' : '❌'} Contract status: ${paused ? 'Paused' : 'Active'}`)
    
    if (registrySet && allKeepersAuthorized && !paused) {
      console.log('\n🎉 Chainlink Automation Setup Complete!')
      console.log('Ready for automated payroll processing.')
      
      console.log('\n📋 Next Steps:')
      console.log('1. Visit https://automation.chain.link/')
      console.log('2. Create subscription and fund with LINK')
      console.log('3. Register upkeep with contract address')
      console.log('4. Add employees and schedule payrolls')
      console.log('5. Monitor automation dashboard')
    } else {
      console.log('\n⚠️  Setup incomplete. Please run setup script.')
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message)
  }
}

main().catch(console.error)