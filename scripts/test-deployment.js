const { ethers } = require("ethers");
const { config } = require("dotenv");

// Load .env.local file
config({ path: '.env.local' });

async function testDeployment() {
  try {
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    
    console.log("Testing contract deployment on Mantle Sepolia...");
    console.log("RPC:", process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    
    // Test network connection
    const network = await provider.getNetwork();
    console.log("Connected to network:", network.name, "Chain ID:", network.chainId.toString());
    
    // Contract addresses - use hardcoded values to test
    const bucketVaultAddress = "0x742d35Cc6634C0532925a3b8D4C9db96C4b5Da5e".toLowerCase();
    const payrollEngineAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318".toLowerCase();
    
    console.log("\nEnvironment variables:");
    console.log("All env vars:", Object.keys(process.env).filter(k => k.includes('BUCKET') || k.includes('PAYROLL')));
    console.log("NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA:", process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA);
    console.log("NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA:", process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA);
    
    console.log("\nTesting contract addresses:");
    console.log("BucketVault:", bucketVaultAddress);
    console.log("PayrollEngine:", payrollEngineAddress);
    
    // Check if contracts exist by getting code
    const bucketVaultCode = await provider.getCode(bucketVaultAddress);
    const payrollEngineCode = await provider.getCode(payrollEngineAddress);
    
    console.log("\nContract deployment status:");
    console.log("BucketVault deployed:", bucketVaultCode !== "0x" ? "✅ YES" : "❌ NO");
    console.log("PayrollEngine deployed:", payrollEngineCode !== "0x" ? "✅ YES" : "❌ NO");
    
    if (bucketVaultCode === "0x" || payrollEngineCode === "0x") {
      console.log("\n⚠️  Contracts need to be deployed!");
      return false;
    }
    
    console.log("\n✅ All contracts are deployed and ready!");
    return true;
    
  } catch (error) {
    console.error("Error testing deployment:", error.message);
    return false;
  }
}

testDeployment().then(success => {
  process.exit(success ? 0 : 1);
});