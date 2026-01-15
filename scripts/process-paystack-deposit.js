import { ethers } from "ethers";
import { config } from "dotenv";

// Load environment variables
config();

// Contract ABIs
const bucketVaultABI = [
  "function depositAndSplit(uint256 amount) external",
  "function getBucketBalance(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function getSplitConfig(address user) external view returns (tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent))",
  "function setSplitConfig(tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent)) external"
];

const erc20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

/**
 * Process a Paystack deposit by depositing USDC into the BucketVault
 * This function is called after a successful Paystack payment
 * 
 * @param {string} userAddress - The user's wallet address
 * @param {string} usdcAmount - Amount of USDC to deposit (in human-readable format, e.g., "100.50")
 * @param {string} paystackReference - Paystack transaction reference for logging
 */
async function processPaystackDeposit(userAddress, usdcAmount, paystackReference) {
  try {
    console.log("🔄 Processing Paystack deposit...");
    console.log("User:", userAddress);
    console.log("Amount:", usdcAmount, "USDC");
    console.log("Reference:", paystackReference);
    console.log("");
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    const managedWallet = new ethers.Wallet(process.env.MANAGED_WALLET_PRIVATE_KEY, provider);
    
    // Contract addresses
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA;
    
    // Create contract instances
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, managedWallet);
    const usdcToken = new ethers.Contract(usdcAddress, erc20ABI, managedWallet);
    const decimals = await usdcToken.decimals();
    
    // Convert amount to proper decimals
    const depositAmount = ethers.parseUnits(usdcAmount, decimals);
    
    // Check managed wallet USDC balance
    const managedBalance = await usdcToken.balanceOf(managedWallet.address);
    if (managedBalance < depositAmount) {
      throw new Error(`Insufficient USDC in managed wallet. Have: ${ethers.formatUnits(managedBalance, decimals)}, Need: ${usdcAmount}`);
    }
    
    // Check if user has a split configuration
    const userConfig = await bucketVault.getSplitConfig(userAddress);
    const configSum = userConfig.billingsPercent + userConfig.savingsPercent + 
                     userConfig.growthPercent + userConfig.instantPercent + 
                     userConfig.spendablePercent;
    
    // If user doesn't have a config, set a default one
    if (configSum === 0n) {
      console.log("⚙️  User has no split config, setting default...");
      const defaultConfig = {
        billingsPercent: 2000,  // 20%
        savingsPercent: 3000,   // 30%
        growthPercent: 2000,    // 20%
        instantPercent: 2000,   // 20%
        spendablePercent: 1000  // 10%
      };
      
      // Note: This would need to be called by the user themselves
      // For now, we'll just log a warning
      console.log("⚠️  Warning: User needs to set their split configuration");
      console.log("   Default config would be: 20/30/20/20/10");
    }
    
    // Check allowance
    const allowance = await usdcToken.allowance(managedWallet.address, bucketVaultAddress);
    if (allowance < depositAmount) {
      console.log("📝 Approving USDC...");
      const approveTx = await usdcToken.approve(bucketVaultAddress, ethers.parseUnits("1000000", decimals));
      await approveTx.wait();
      console.log("✅ Approved");
    }
    
    // First, transfer USDC from managed wallet to user's address
    // This ensures the user owns the USDC before depositing
    console.log("📤 Transferring USDC to user...");
    const transferTx = await usdcToken.transfer(userAddress, depositAmount);
    console.log("Transfer TX:", transferTx.hash);
    await transferTx.wait();
    console.log("✅ USDC transferred to user");
    
    // Now the user needs to approve and deposit themselves
    // OR we can deposit on their behalf if they've given us permission
    
    console.log("\n✅ Paystack deposit processed successfully!");
    console.log("📊 Summary:");
    console.log("  - USDC transferred to user:", userAddress);
    console.log("  - Amount:", usdcAmount, "USDC");
    console.log("  - Paystack Reference:", paystackReference);
    console.log("  - User can now deposit into buckets from their wallet");
    
    return {
      success: true,
      txHash: transferTx.hash,
      amount: usdcAmount,
      userAddress: userAddress,
      reference: paystackReference
    };
    
  } catch (error) {
    console.error("\n❌ Error processing Paystack deposit:", error.message);
    return {
      success: false,
      error: error.message,
      userAddress: userAddress,
      reference: paystackReference
    };
  }
}

/**
 * Alternative: Deposit directly on behalf of user (requires user authorization)
 * This assumes the user has pre-approved the managed wallet as an operator
 */
async function depositOnBehalfOfUser(userAddress, usdcAmount, paystackReference) {
  try {
    console.log("🔄 Depositing on behalf of user...");
    console.log("User:", userAddress);
    console.log("Amount:", usdcAmount, "USDC");
    console.log("Reference:", paystackReference);
    console.log("");
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    const managedWallet = new ethers.Wallet(process.env.MANAGED_WALLET_PRIVATE_KEY, provider);
    
    // Contract addresses
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA;
    
    // Create contract instances
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, managedWallet);
    const usdcToken = new ethers.Contract(usdcAddress, erc20ABI, managedWallet);
    const decimals = await usdcToken.decimals();
    
    // Convert amount to proper decimals
    const depositAmount = ethers.parseUnits(usdcAmount, decimals);
    
    // Check managed wallet USDC balance
    const managedBalance = await usdcToken.balanceOf(managedWallet.address);
    if (managedBalance < depositAmount) {
      throw new Error(`Insufficient USDC in managed wallet. Have: ${ethers.formatUnits(managedBalance, decimals)}, Need: ${usdcAmount}`);
    }
    
    // Check allowance
    const allowance = await usdcToken.allowance(managedWallet.address, bucketVaultAddress);
    if (allowance < depositAmount) {
      console.log("📝 Approving USDC...");
      const approveTx = await usdcToken.approve(bucketVaultAddress, ethers.parseUnits("1000000", decimals));
      await approveTx.wait();
      console.log("✅ Approved");
    }
    
    // Make deposit directly (this will use managed wallet's config)
    console.log("💰 Making deposit...");
    const depositTx = await bucketVault.depositAndSplit(depositAmount);
    console.log("Deposit TX:", depositTx.hash);
    await depositTx.wait();
    console.log("✅ Deposit successful!");
    
    // Show bucket balances
    console.log("\n📊 Updated Bucket Balances:");
    const buckets = ["billings", "savings", "growth", "instant", "spendable"];
    for (const bucket of buckets) {
      const balance = await bucketVault.getBucketBalance(managedWallet.address, bucket);
      console.log(`  ${bucket.padEnd(12)}: ${ethers.formatUnits(balance.balance, decimals)} USDC`);
    }
    
    console.log("\n✅ Paystack deposit processed and split into buckets!");
    
    return {
      success: true,
      txHash: depositTx.hash,
      amount: usdcAmount,
      userAddress: userAddress,
      reference: paystackReference
    };
    
  } catch (error) {
    console.error("\n❌ Error depositing on behalf of user:", error.message);
    return {
      success: false,
      error: error.message,
      userAddress: userAddress,
      reference: paystackReference
    };
  }
}

// CLI interface
const args = process.argv.slice(2);
const mode = args[0];
const userAddress = args[1];
const amount = args[2];
const reference = args[3] || `PAYSTACK-${Date.now()}`;

if (!mode || !userAddress || !amount) {
  console.log("Usage: node scripts/process-paystack-deposit.js <mode> <userAddress> <amount> [reference]");
  console.log("\nModes:");
  console.log("  transfer  - Transfer USDC to user (user deposits themselves)");
  console.log("  deposit   - Deposit directly on behalf of user (uses managed wallet config)");
  console.log("\nExamples:");
  console.log("  node scripts/process-paystack-deposit.js transfer 0x123... 100 PAYSTACK-REF-123");
  console.log("  node scripts/process-paystack-deposit.js deposit 0x123... 50.5 PAYSTACK-REF-456");
  process.exit(0);
}

// Validate Ethereum address
if (!ethers.isAddress(userAddress)) {
  console.error("Error: Invalid Ethereum address");
  process.exit(1);
}

// Run the appropriate function
if (mode === "transfer") {
  processPaystackDeposit(userAddress, amount, reference)
    .then(result => {
      console.log("\nResult:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    });
} else if (mode === "deposit") {
  depositOnBehalfOfUser(userAddress, amount, reference)
    .then(result => {
      console.log("\nResult:", JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    });
} else {
  console.error("Error: Invalid mode. Use 'transfer' or 'deposit'");
  process.exit(1);
}
