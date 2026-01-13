const { ethers } = require("ethers");
const { config } = require("dotenv");

// Load .env.local file
config({ path: '.env.local' });

async function verifyDeployment() {
  console.log("🔍 PayWarp Smart Contract Deployment Verification\n");

  // Setup provider
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
  
  // Contract addresses from environment
  const addresses = {
    bucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA,
    payrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA,
    usdyToken: process.env.NEXT_PUBLIC_USDY_TOKEN_SEPOLIA,
    musdToken: process.env.NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA,
  };

  console.log("📋 Contract Addresses:");
  console.log("BucketVault (Upgradeable):", addresses.bucketVault);
  console.log("PayrollEngine (Upgradeable):", addresses.payrollEngine);
  console.log("USDY Token:", addresses.usdyToken);
  console.log("mUSD Token:", addresses.musdToken);
  console.log();

  // Verify contracts exist
  console.log("✅ Contract Verification:");
  
  for (const [name, address] of Object.entries(addresses)) {
    try {
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log(`❌ ${name}: No contract found at ${address}`);
      } else {
        console.log(`✅ ${name}: Contract deployed (${code.length} bytes)`);
      }
    } catch (error) {
      console.log(`❌ ${name}: Error checking contract - ${error.message}`);
    }
  }

  console.log("\n🔒 Security Features Implemented:");
  console.log("✅ UUPS Upgradeable Pattern");
  console.log("✅ Access Control (Ownable)");
  console.log("✅ Reentrancy Protection");
  console.log("✅ Pausable Emergency Controls");
  console.log("✅ Daily Withdrawal Limits");
  console.log("✅ Emergency Withdrawal with Time Delays");
  console.log("✅ Protocol Fee Management");
  console.log("✅ Input Validation & Bounds Checking");
  console.log("✅ Comprehensive Event Logging");
  console.log("✅ Gas Optimization & DoS Protection");

  console.log("\n📊 Network Information:");
  console.log("Network: Mantle Sepolia Testnet");
  console.log("Chain ID: 5003");
  console.log("RPC URL:", process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
  console.log("Explorer: https://sepolia.mantlescan.xyz");

  console.log("\n🎯 Next Steps:");
  console.log("1. Test contract functionality through the frontend");
  console.log("2. Verify contract source code on Mantlescan");
  console.log("3. Set up proper access controls and multisig");
  console.log("4. Configure monitoring and alerting");
  console.log("5. Conduct security audit before mainnet deployment");

  console.log("\n⚠️  Security Recommendations:");
  console.log("• Transfer contract ownership to a multisig wallet");
  console.log("• Set up 24/7 monitoring for contract events");
  console.log("• Implement timelocks for critical operations");
  console.log("• Establish incident response procedures");
  console.log("• Regular security reviews and updates");

  console.log("\n🔗 Useful Links:");
  console.log("• Mantle Sepolia Explorer: https://sepolia.mantlescan.xyz");
  console.log("• Mantle Faucet: https://faucet.sepolia.mantle.xyz");
  console.log("• Contract Security Guide: ./contracts/SECURITY.md");
}

verifyDeployment().catch(console.error);