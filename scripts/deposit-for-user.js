import { ethers } from "ethers";
import { config } from "dotenv";

// Load environment variables
config();

const bucketVaultABI = [
  "function setSplitConfig(tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent)) external",
  "function depositAndSplit(uint256 amount) external",
  "function getBucketBalance(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function getSplitConfig(address user) external view returns (tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent))"
];

const erc20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

async function depositForUser() {
  try {
    const userAddress = "0x36D940f43862f17E759266932F13f2f03471f55B";
    const depositAmount = "100"; // 100 USDC
    
    console.log("🚀 Setting up deposit for user wallet\n");
    console.log("User Address:", userAddress);
    console.log("Deposit Amount:", depositAmount, "USDC\n");
    
    // Setup provider and managed wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    const managedWallet = new ethers.Wallet(process.env.MANAGED_WALLET_PRIVATE_KEY, provider);
    
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA;
    
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, provider);
    const usdcToken = new ethers.Contract(usdcAddress, erc20ABI, managedWallet);
    const decimals = await usdcToken.decimals();
    
    const amount = ethers.parseUnits(depositAmount, decimals);
    
    // Step 1: Check if user has split config
    console.log("📋 Step 1: Checking user's split configuration...");
    const userConfig = await bucketVault.getSplitConfig(userAddress);
    const configSum = userConfig.billingsPercent + userConfig.savingsPercent + 
                     userConfig.growthPercent + userConfig.instantPercent + 
                     userConfig.spendablePercent;
    
    if (configSum === 0n) {
      console.log("⚠️  User has no split configuration set");
      console.log("❌ User must set their split config first by calling setSplitConfig()");
      console.log("\nThe user needs to:");
      console.log("1. Connect their wallet to the dapp");
      console.log("2. Go to Settings");
      console.log("3. Set their bucket allocation percentages");
      console.log("4. Save the configuration (this calls setSplitConfig on-chain)");
      console.log("\nOr we can set a default config for them...\n");
      
      // Ask if we should set default config
      console.log("Setting default configuration for user...");
      
      // We need the user's private key to set their config
      // Since we don't have it, we'll transfer USDC to them instead
      console.log("⚠️  Cannot set config without user's private key");
      console.log("📤 Will transfer USDC to user instead\n");
    } else {
      console.log("✅ User has split configuration:");
      console.log(`  Billings: ${(Number(userConfig.billingsPercent) / 100).toFixed(2)}%`);
      console.log(`  Savings: ${(Number(userConfig.savingsPercent) / 100).toFixed(2)}%`);
      console.log(`  Growth: ${(Number(userConfig.growthPercent) / 100).toFixed(2)}%`);
      console.log(`  Instant: ${(Number(userConfig.instantPercent) / 100).toFixed(2)}%`);
      console.log(`  Spendable: ${(Number(userConfig.spendablePercent) / 100).toFixed(2)}%\n`);
    }
    
    // Step 2: Transfer USDC from managed wallet to user
    console.log("📋 Step 2: Transferring USDC to user...");
    const managedBalance = await usdcToken.balanceOf(managedWallet.address);
    console.log("Managed wallet USDC balance:", ethers.formatUnits(managedBalance, decimals), "USDC");
    
    if (managedBalance < amount) {
      throw new Error("Insufficient USDC in managed wallet");
    }
    
    console.log(`Transferring ${depositAmount} USDC to ${userAddress}...`);
    const transferTx = await usdcToken.transfer(userAddress, amount);
    console.log("Transfer TX:", transferTx.hash);
    await transferTx.wait();
    console.log("✅ USDC transferred successfully!\n");
    
    // Step 3: Check user's new USDC balance
    console.log("📋 Step 3: Verifying user's USDC balance...");
    const userBalance = await usdcToken.balanceOf(userAddress);
    console.log("User USDC balance:", ethers.formatUnits(userBalance, decimals), "USDC\n");
    
    // Step 4: Check user's bucket balances
    console.log("📋 Step 4: Checking user's bucket balances...");
    const buckets = ["billings", "savings", "growth", "instant", "spendable"];
    
    for (const bucket of buckets) {
      const balance = await bucketVault.getBucketBalance(userAddress, bucket);
      console.log(`  ${bucket.padEnd(12)}: ${ethers.formatUnits(balance.balance, decimals)} USDC`);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ Setup Complete!");
    console.log("=".repeat(60));
    
    console.log("\n📝 Next Steps:");
    console.log("1. User now has", depositAmount, "USDC in their wallet");
    console.log("2. User needs to:");
    console.log("   a. Connect wallet to dapp");
    console.log("   b. Set split configuration (if not set)");
    console.log("   c. Approve USDC spending for BucketVault");
    console.log("   d. Click 'Deposit' and deposit the USDC");
    console.log("3. After deposit, buckets will be populated");
    console.log("4. Dashboard will show bucket balances");
    console.log("5. Transaction history will show the deposit\n");
    
    return {
      success: true,
      userAddress,
      usdcTransferred: depositAmount,
      txHash: transferTx.hash
    };
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

depositForUser()
  .then(result => {
    console.log("\nResult:", JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  });
