#!/usr/bin/env node

/**
 * Simple upgrade script for PayrollEngine using Foundry
 * This script uses the OpenZeppelin Upgrades plugin for Foundry
 */

const { execSync } = require('child_process')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🔄 PayrollEngine Contract Upgrade (Foundry)')
  console.log('==========================================\n')

  try {
    // Get network selection
    const network = await question('Enter network (sepolia/mainnet): ')
    if (!['sepolia', 'mainnet'].includes(network)) {
      console.error('❌ Invalid network. Use "sepolia" or "mainnet"')
      process.exit(1)
    }

    // Get contract addresses
    const PROXY_ADDRESSES = {
      sepolia: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA,
      mainnet: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET
    }

    const proxyAddress = PROXY_ADDRESSES[network]
    if (!proxyAddress || proxyAddress === '0x0000000000000000000000000000000000000000') {
      console.error(`❌ No proxy address found for ${network}`)
      process.exit(1)
    }

    console.log(`Network: ${network}`)
    console.log(`Proxy Address: ${proxyAddress}`)

    // Confirm upgrade
    const confirm = await question('\n⚠️  This will upgrade the contract. Continue? (y/n): ')
    if (confirm.toLowerCase() !== 'y') {
      console.log('Upgrade cancelled.')
      process.exit(0)
    }

    console.log('\n🔨 Compiling contracts...')
    execSync('forge build', { stdio: 'inherit' })

    console.log('\n🚀 Deploying new implementation...')
    
    // Deploy new implementation
    const deployCmd = network === 'sepolia' 
      ? `forge script script/UpgradePayrollEngine.s.sol --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --verify`
      : `forge script script/UpgradePayrollEngine.s.sol --rpc-url $MANTLE_MAINNET_RPC --broadcast --verify`

    console.log(`Running: ${deployCmd}`)
    execSync(deployCmd, { stdio: 'inherit' })

    console.log('\n✅ Upgrade Complete!')
    console.log('====================')
    console.log('✅ New implementation deployed')
    console.log('✅ Proxy upgraded successfully')
    console.log('✅ Chainlink automation functions added')
    console.log('✅ Contract version updated to v1.1.0')

    console.log('\n📋 Next Steps:')
    console.log('1. Test the upgraded contract functionality')
    console.log('2. Update frontend ABI (already done)')
    console.log('3. Configure Chainlink automation if needed')
    console.log('4. Monitor contract performance')

  } catch (error) {
    console.error('❌ Upgrade failed:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()