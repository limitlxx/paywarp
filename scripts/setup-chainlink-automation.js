import { ethers } from 'ethers'
import readline from 'readline'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Contract addresses
const ADDRESSES = {
  sepolia: {
    payrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA,
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA,
    automationRegistry: '0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad', // Sepolia registry
    automationRegistrar: '0x9a811502d843E5a03913d5A2cfb646c11463467A', // Sepolia registrar
    linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789' // Sepolia LINK
  },
  mainnet: {
    payrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET,
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_MAINNET,
    automationRegistry: '0x02777053d6764996e594c3E88AF1D58D5363a2e6', // Mainnet registry
    automationRegistrar: '0x4F3AF332A30973106Fe146Af0B4220bBBeA748eC', // Mainnet registrar
    linkToken: '0x514910771AF9Ca656af840dff83E8264EcF986CA' // Mainnet LINK
  }
}

// Chainlink keeper addresses that need authorization
const KEEPER_ADDRESSES = {
  sepolia: [
    '0x02777053d6764996e594c3E88AF1D58D5363a2e6',
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
  ],
  mainnet: [
    '0x02777053d6764996e594c3E88AF1D58D5363a2e6',
    '0x169E633A2D1E6c10dD91238Ba11c4A708dfEF37C'
  ]
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

// PayrollEngine ABI (minimal for our needs)
const PAYROLL_ENGINE_ABI = [
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function protocolFee() view returns (uint256)",
  "function maxGasPerPayment() view returns (uint256)",
  "function automationRegistry() view returns (address)",
  "function authorizedKeepers(address) view returns (bool)",
  "function setAutomationRegistry(address) external",
  "function setAuthorizedKeeper(address, bool) external",
  "function pause() external",
  "function unpause() external",
  "function version() view returns (string)",
  "function checkUpkeep(bytes) view returns (bool, bytes)",
  "function employeeCount(address) view returns (uint256)",
  "function addEmployee(address, uint256, uint256, string, string) external"
]

// ERC20 ABI (minimal)
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function decimals() view returns (uint8)"
]

async function main() {
  console.log('🔗 PayWarp Chainlink Automation Setup')
  console.log('=====================================\n')

  // Get network
  const network = await question('Enter network (sepolia/mainnet): ')
  if (!ADDRESSES[network]) {
    console.error('❌ Invalid network. Use "sepolia" or "mainnet"')
    process.exit(1)
  }

  const addresses = ADDRESSES[network]
  const keepers = KEEPER_ADDRESSES[network]

  console.log(`\n📍 Using ${network} network`)
  console.log(`PayrollEngine: ${addresses.payrollEngine}`)
  console.log(`USDC: ${addresses.usdc}`)

  if (!addresses.payrollEngine || addresses.payrollEngine === '0x0000000000000000000000000000000000000000') {
    console.error('❌ PayrollEngine contract address not found')
    process.exit(1)
  }

  // Setup provider and signer
  const rpcUrl = network === 'sepolia' 
    ? process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || 'https://rpc.sepolia.mantle.xyz'
    : process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC || 'https://rpc.mantle.xyz'

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in environment variables')
    process.exit(1)
  }

  const signer = new ethers.Wallet(privateKey, provider)
  console.log(`\n👤 Using account: ${signer.address}`)

  // Load contract
  const payrollEngine = new ethers.Contract(addresses.payrollEngine, PAYROLL_ENGINE_ABI, signer)

  try {
    // Check if user is owner
    const owner = await payrollEngine.owner()
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error(`❌ You are not the contract owner. Owner: ${owner}`)
      process.exit(1)
    }

    console.log('✅ Confirmed contract ownership')

    // Check current version
    try {
      const version = await payrollEngine.version()
      console.log(`✅ Contract version: ${version}`)
    } catch (error) {
      console.log('⚠️  Could not get version (older contract)')
    }

    // Step 1: Set automation registry
    console.log('\n📋 Step 1: Setting Automation Registry')
    const currentRegistry = await payrollEngine.automationRegistry()
    
    if (currentRegistry === ethers.ZeroAddress) {
      console.log('Setting automation registry...')
      const tx1 = await payrollEngine.setAutomationRegistry(addresses.automationRegistry)
      await tx1.wait()
      console.log('✅ Automation registry set')
    } else {
      console.log(`✅ Automation registry already set: ${currentRegistry}`)
    }

    // Step 2: Authorize keepers
    console.log('\n🔑 Step 2: Authorizing Chainlink Keepers')
    for (const keeper of keepers) {
      const isAuthorized = await payrollEngine.authorizedKeepers(keeper)
      if (!isAuthorized) {
        console.log(`Authorizing keeper: ${keeper}`)
        const tx = await payrollEngine.setAuthorizedKeeper(keeper, true)
        await tx.wait()
        console.log('✅ Keeper authorized')
      } else {
        console.log(`✅ Keeper already authorized: ${keeper}`)
      }
    }

    // Step 3: Check contract configuration
    console.log('\n⚙️  Step 3: Contract Configuration')
    const protocolFee = await payrollEngine.protocolFee()
    const maxGas = await payrollEngine.maxGasPerPayment()
    const paused = await payrollEngine.paused()

    console.log(`Protocol Fee: ${protocolFee} basis points (${Number(protocolFee) / 100}%)`)
    console.log(`Max Gas Per Payment: ${maxGas}`)
    console.log(`Contract Paused: ${paused}`)

    if (paused) {
      const unpause = await question('\n⚠️  Contract is paused. Unpause? (y/n): ')
      if (unpause.toLowerCase() === 'y') {
        const tx = await payrollEngine.unpause()
        await tx.wait()
        console.log('✅ Contract unpaused')
      }
    }

    // Step 4: Check USDC balance
    console.log('\n💰 Step 4: Checking Contract Balance')
    const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider)
    const balance = await usdc.balanceOf(addresses.payrollEngine)
    const decimals = await usdc.decimals()
    const formattedBalance = ethers.formatUnits(balance, decimals)

    console.log(`USDC Balance: ${formattedBalance} USDC`)

    if (parseFloat(formattedBalance) < 100) {
      console.log('⚠️  Low USDC balance. Consider funding the contract.')
      
      const fund = await question('Fund contract with USDC? (y/n): ')
      if (fund.toLowerCase() === 'y') {
        const amount = await question('Enter amount to fund (USDC): ')
        const amountWei = ethers.parseUnits(amount, decimals)
        
        // Check user balance
        const userBalance = await usdc.balanceOf(signer.address)
        if (userBalance < amountWei) {
          console.error('❌ Insufficient USDC balance')
        } else {
          console.log('Transferring USDC to contract...')
          const usdcWithSigner = usdc.connect(signer)
          const tx = await usdcWithSigner.transfer(addresses.payrollEngine, amountWei)
          await tx.wait()
          console.log('✅ Contract funded')
        }
      }
    }

    // Step 5: Test payroll scheduling
    console.log('\n🧪 Step 5: Test Payroll (Optional)')
    const testPayroll = await question('Schedule a test payroll? (y/n): ')
    
    if (testPayroll.toLowerCase() === 'y') {
      // Check if there are employees
      const employeeCount = await payrollEngine.employeeCount(signer.address)
      
      if (employeeCount === 0n) {
        console.log('⚠️  No employees found. Add employees first.')
        
        const addEmployee = await question('Add a test employee? (y/n): ')
        if (addEmployee.toLowerCase() === 'y') {
          const employeeAddress = await question('Employee wallet address: ')
          const salary = await question('Monthly salary (USDC): ')
          const paymentDate = await question('Payment date (1-31): ')
          const name = await question('Employee name: ')
          const email = await question('Employee email (optional): ')

          const salaryWei = ethers.parseUnits(salary, 6) // USDC has 6 decimals
          
          console.log('Adding employee...')
          const tx = await payrollEngine.addEmployee(
            employeeAddress,
            salaryWei,
            paymentDate,
            name,
            email || ""
          )
          await tx.wait()
          console.log('✅ Employee added')
        }
      }

      // Test checkUpkeep function
      console.log('\n🔍 Testing Chainlink Functions...')
      try {
        const [upkeepNeeded, performData] = await payrollEngine.checkUpkeep('0x')
        console.log(`✅ checkUpkeep working - Upkeep needed: ${upkeepNeeded}`)
        console.log(`Perform data length: ${performData.length}`)
      } catch (error) {
        console.log(`❌ checkUpkeep test failed: ${error.message}`)
      }
    }

    // Step 6: Display next steps
    console.log('\n🎉 Setup Complete!')
    console.log('================')
    console.log('\nNext Steps:')
    console.log('1. Visit https://automation.chain.link/')
    console.log('2. Create a new subscription and fund with LINK')
    console.log('3. Register a new upkeep with these details:')
    console.log(`   - Target Contract: ${addresses.payrollEngine}`)
    console.log('   - Upkeep Name: PayWarp Payroll Processor')
    console.log('   - Gas Limit: 500000')
    console.log('   - Trigger Type: Custom logic')
    console.log('   - Check Data: 0x (empty)')
    console.log('\n4. Monitor the automation dashboard for execution')
    console.log('5. Ensure sufficient LINK balance for ongoing operations')

    console.log('\n📚 Documentation:')
    console.log('- Setup Guide: docs/CHAINLINK_AUTOMATION_SETUP.md')
    console.log('- Chainlink Docs: https://docs.chain.link/chainlink-automation')

    console.log('\n🔗 Important Addresses:')
    console.log(`PayrollEngine: ${addresses.payrollEngine}`)
    console.log(`Automation Registry: ${addresses.automationRegistry}`)
    console.log(`LINK Token: ${addresses.linkToken}`)

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

// Handle script execution
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })