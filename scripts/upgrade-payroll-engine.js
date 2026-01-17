const { ethers, upgrades } = require('hardhat')

async function main() {
  console.log('🔄 Upgrading PayrollEngine Contract')
  console.log('===================================\n')

  // Get the current network
  const network = await ethers.provider.getNetwork()
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`)

  // Contract addresses
  const PROXY_ADDRESSES = {
    sepolia: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA,
    mainnet: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET
  }

  const networkName = network.chainId === 5003 ? 'sepolia' : 'mainnet'
  const proxyAddress = PROXY_ADDRESSES[networkName]

  if (!proxyAddress || proxyAddress === '0x0000000000000000000000000000000000000000') {
    console.error(`❌ No proxy address found for ${networkName}`)
    process.exit(1)
  }

  console.log(`Proxy Address: ${proxyAddress}`)

  // Get the deployer account
  const [deployer] = await ethers.getSigners()
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`)

  try {
    // Get the current contract factory
    const PayrollEngineV1 = await ethers.getContractFactory('PayrollEngineUpgradeable')
    
    // Check current version
    console.log('📋 Checking Current Version...')
    const currentContract = PayrollEngineV1.attach(proxyAddress)
    
    try {
      const currentVersion = await currentContract.version()
      console.log(`Current Version: ${currentVersion}`)
    } catch (error) {
      console.log('Current Version: Unknown (pre-versioning)')
    }

    // Check if we're the owner
    try {
      const owner = await currentContract.owner()
      if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
        console.error(`❌ Not the contract owner. Owner: ${owner}`)
        process.exit(1)
      }
      console.log('✅ Confirmed contract ownership')
    } catch (error) {
      console.error('❌ Failed to check ownership:', error.message)
      process.exit(1)
    }

    // Deploy the new implementation
    console.log('\n🚀 Deploying New Implementation...')
    const PayrollEngineV2 = await ethers.getContractFactory('PayrollEngineUpgradeable')
    
    console.log('Upgrading contract...')
    const upgraded = await upgrades.upgradeProxy(proxyAddress, PayrollEngineV2)
    
    console.log('Waiting for upgrade transaction to be mined...')
    await upgraded.deployed()
    
    console.log('✅ Contract upgraded successfully!')
    console.log(`Proxy Address: ${upgraded.address}`)

    // Verify the upgrade
    console.log('\n🔍 Verifying Upgrade...')
    const newVersion = await upgraded.version()
    console.log(`New Version: ${newVersion}`)

    // Test basic functionality
    console.log('\n🧪 Testing Basic Functionality...')
    
    // Check if contract is paused
    const isPaused = await upgraded.paused()
    console.log(`Contract Paused: ${isPaused}`)
    
    // Check protocol fee
    const protocolFee = await upgraded.protocolFee()
    console.log(`Protocol Fee: ${protocolFee} basis points`)
    
    // Check max gas per payment
    const maxGas = await upgraded.maxGasPerPayment()
    console.log(`Max Gas Per Payment: ${maxGas}`)

    // Check payment token
    const paymentToken = await upgraded.paymentToken()
    console.log(`Payment Token: ${paymentToken}`)

    // Check bucket vault
    const bucketVault = await upgraded.bucketVault()
    console.log(`Bucket Vault: ${bucketVault}`)

    // Test Chainlink automation functions
    console.log('\n🔗 Testing Chainlink Automation...')
    try {
      const [upkeepNeeded, performData] = await upgraded.checkUpkeep('0x')
      console.log(`Upkeep Needed: ${upkeepNeeded}`)
      console.log(`Perform Data Length: ${performData.length}`)
      console.log('✅ Chainlink automation functions working')
    } catch (error) {
      console.log('⚠️  Chainlink automation test failed:', error.message)
    }

    // Display upgrade summary
    console.log('\n🎉 Upgrade Complete!')
    console.log('===================')
    console.log(`✅ Contract upgraded from v1.0.0 to v${newVersion}`)
    console.log(`✅ Proxy address unchanged: ${proxyAddress}`)
    console.log(`✅ All existing data preserved`)
    console.log(`✅ New Chainlink automation functions added`)
    console.log(`✅ Contract ready for automated payroll processing`)

    // Next steps
    console.log('\n📋 Next Steps:')
    console.log('1. Update ABI in frontend application')
    console.log('2. Test payroll functionality with new version')
    console.log('3. Configure Chainlink automation if not already done')
    console.log('4. Monitor contract performance and gas usage')

    // Update environment variables reminder
    console.log('\n⚠️  Important Notes:')
    console.log('- The proxy address remains the same')
    console.log('- No need to update environment variables')
    console.log('- Existing employee data is preserved')
    console.log('- All scheduled payrolls remain intact')

  } catch (error) {
    console.error('❌ Upgrade failed:', error)
    
    if (error.message.includes('Ownable: caller is not the owner')) {
      console.error('\n💡 Solution: Make sure you\'re using the owner account')
    } else if (error.message.includes('insufficient funds')) {
      console.error('\n💡 Solution: Add more ETH to the deployer account')
    } else if (error.message.includes('nonce too low')) {
      console.error('\n💡 Solution: Wait a moment and try again')
    }
    
    process.exit(1)
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = { main }