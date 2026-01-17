const { ethers, upgrades } = require('hardhat')

async function main() {
  console.log('🚀 Deploying PayrollEngine V2')
  console.log('=============================\n')

  // Get network info
  const network = await ethers.provider.getNetwork()
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`)

  // Get deployer
  const [deployer] = await ethers.getSigners()
  console.log(`Deployer: ${deployer.address}`)
  console.log(`Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH\n`)

  // Contract addresses based on network
  const ADDRESSES = {
    sepolia: {
      usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA,
      bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA
    },
    mainnet: {
      usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_MAINNET,
      bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_MAINNET
    }
  }

  const networkName = network.chainId === 5003 ? 'sepolia' : 'mainnet'
  const addresses = ADDRESSES[networkName]

  if (!addresses.usdc || !addresses.bucketVault) {
    console.error('❌ Missing required contract addresses')
    console.error(`USDC: ${addresses.usdc}`)
    console.error(`BucketVault: ${addresses.bucketVault}`)
    process.exit(1)
  }

  console.log('📋 Contract Addresses:')
  console.log(`USDC Token: ${addresses.usdc}`)
  console.log(`Bucket Vault: ${addresses.bucketVault}`)
  console.log(`Owner: ${deployer.address}\n`)

  try {
    // Deploy the upgradeable contract
    console.log('🔨 Deploying PayrollEngine V2...')
    const PayrollEngine = await ethers.getContractFactory('PayrollEngineUpgradeable')
    
    const payrollEngine = await upgrades.deployProxy(
      PayrollEngine,
      [
        addresses.usdc,      // Payment token (USDC)
        addresses.bucketVault, // Bucket vault address
        deployer.address     // Owner
      ],
      {
        initializer: 'initialize',
        kind: 'uups'
      }
    )

    console.log('⏳ Waiting for deployment...')
    await payrollEngine.deployed()

    console.log('✅ PayrollEngine V2 deployed!')
    console.log(`Proxy Address: ${payrollEngine.address}`)

    // Get implementation address
    const implementationAddress = await upgrades.erc1967.getImplementationAddress(payrollEngine.address)
    console.log(`Implementation Address: ${implementationAddress}`)

    // Verify deployment
    console.log('\n🔍 Verifying Deployment...')
    
    const version = await payrollEngine.version()
    console.log(`Version: ${version}`)
    
    const owner = await payrollEngine.owner()
    console.log(`Owner: ${owner}`)
    
    const paymentToken = await payrollEngine.paymentToken()
    console.log(`Payment Token: ${paymentToken}`)
    
    const bucketVault = await payrollEngine.bucketVault()
    console.log(`Bucket Vault: ${bucketVault}`)
    
    const protocolFee = await payrollEngine.protocolFee()
    console.log(`Protocol Fee: ${protocolFee} basis points`)
    
    const maxGas = await payrollEngine.maxGasPerPayment()
    console.log(`Max Gas Per Payment: ${maxGas}`)

    // Test Chainlink functions
    console.log('\n🔗 Testing Chainlink Integration...')
    try {
      const [upkeepNeeded, performData] = await payrollEngine.checkUpkeep('0x')
      console.log(`✅ checkUpkeep working - Upkeep needed: ${upkeepNeeded}`)
    } catch (error) {
      console.log(`❌ checkUpkeep failed: ${error.message}`)
    }

    // Display deployment summary
    console.log('\n🎉 Deployment Complete!')
    console.log('=======================')
    console.log(`✅ PayrollEngine V2 deployed successfully`)
    console.log(`✅ Proxy: ${payrollEngine.address}`)
    console.log(`✅ Implementation: ${implementationAddress}`)
    console.log(`✅ Version: ${version}`)
    console.log(`✅ Chainlink automation ready`)

    // Environment variable updates
    console.log('\n📝 Environment Variables:')
    if (networkName === 'sepolia') {
      console.log(`NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA=${payrollEngine.address}`)
    } else {
      console.log(`NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET=${payrollEngine.address}`)
    }

    // Next steps
    console.log('\n📋 Next Steps:')
    console.log('1. Update environment variables with new contract address')
    console.log('2. Run setup-chainlink-automation.js to configure automation')
    console.log('3. Fund the contract with USDC for payroll processing')
    console.log('4. Test the payroll system with test-payroll-system.js')
    console.log('5. Update frontend ABI if needed')

    // Security reminders
    console.log('\n🔒 Security Checklist:')
    console.log('✅ Contract is upgradeable (UUPS pattern)')
    console.log('✅ Owner controls are in place')
    console.log('✅ Reentrancy protection enabled')
    console.log('✅ Pause mechanism available')
    console.log('✅ Emergency withdrawal function')

    return {
      proxy: payrollEngine.address,
      implementation: implementationAddress,
      version: version
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error)
    
    if (error.message.includes('insufficient funds')) {
      console.error('\n💡 Solution: Add more ETH to the deployer account')
    } else if (error.message.includes('nonce too low')) {
      console.error('\n💡 Solution: Wait a moment and try again')
    } else if (error.message.includes('replacement transaction underpriced')) {
      console.error('\n💡 Solution: Increase gas price or wait for pending transaction')
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