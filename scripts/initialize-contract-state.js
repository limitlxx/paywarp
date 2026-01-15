import { ethers } from "ethers";
import { config } from "dotenv";

// Load environment variables
config();

// Contract ABIs
const bucketVaultABI = [
  "function setSplitConfig(tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent)) external",
  "function depositAndSplit(uint256 amount) external",
  "function getBucketBalance(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function getSplitConfig(address user) external view returns (tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent))",
  "function userBuckets(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function version() external pure returns (string)",
  "function owner() external view returns (address)"
];

const erc20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

async function initializeContractState() {
  try {
    console.log("🚀 Initializing contract state with managed wallet...\n");
    
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    const managedWallet = new ethers.Wallet(process.env.MANAGED_WALLET_PRIVATE_KEY, provider);
    
    console.log("Managed Wallet Address:", managedWallet.address);
    console.log("Expected Address:", process.env.MANAGED_WALLET_ADDRESS);
    
    // Verify wallet address matches
    if (managedWallet.address.toLowerCase() !== process.env.MANAGED_WALLET_ADDRESS.toLowerCase()) {
      throw new Error("Managed wallet address mismatch!");
    }
    
    // Check wallet balance
    const balance = await provider.getBalance(managedWallet.address);
    console.log("Wallet Balance:", ethers.formatEther(balance), "MNT\n");
    
    if (balance === 0n) {
      throw new Error("Managed wallet has no MNT for gas fees!");
    }
    
    // Contract addresses
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
    const usdcAddress = process.env.NEXT_PUBLIC_USDC_TOKEN_SEPOLIA;
    
    console.log("BucketVault Address:", bucketVaultAddress);
    console.log("USDC Token Address:", usdcAddress, "\n");
    
    // Create contract instances
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, managedWallet);
    const usdcToken = new ethers.Contract(usdcAddress, erc20ABI, managedWallet);
    
    // Check contract version
    console.log("📋 Checking contract deployment...");
    const version = await bucketVault.version();
    console.log("✅ BucketVault version:", version, "\n");
    
    // Check USDC balance
    const usdcBalance = await usdcToken.balanceOf(managedWallet.address);
    const decimals = await usdcToken.decimals();
    console.log("USDC Balance:", ethers.formatUnits(usdcBalance, decimals), "USDC\n");
    
    // Step 1: Set split configuration
    console.log("📝 Step 1: Setting split configuration...");
    const splitConfig = {
      billingsPercent: 2000,  // 20%
      savingsPercent: 3000,   // 30%
      growthPercent: 2000,    // 20%
      instantPercent: 2000,   // 20%
      spendablePercent: 1000  // 10%
    };
    
    // Check if config already exists
    const existingConfig = await bucketVault.getSplitConfig(managedWallet.address);
    const configSum = existingConfig.billingsPercent + existingConfig.savingsPercent + 
                     existingConfig.growthPercent + existingConfig.instantPercent + 
                     existingConfig.spendablePercent;
    
    if (configSum === 0n) {
      console.log("Setting new split configuration...");
      const tx1 = await bucketVault.setSplitConfig(splitConfig);
      console.log("Transaction hash:", tx1.hash);
      await tx1.wait();
      console.log("✅ Split configuration set successfully!\n");
    } else {
      console.log("✅ Split configuration already exists\n");
      console.log("Existing config:", {
        billings: existingConfig.billingsPercent.toString(),
        savings: existingConfig.savingsPercent.toString(),
        growth: existingConfig.growthPercent.toString(),
        instant: existingConfig.instantPercent.toString(),
        spendable: existingConfig.spendablePercent.toString()
      }, "\n");
    }
    
    // Step 2: Approve USDC spending (if needed)
    console.log("📝 Step 2: Checking USDC approval...");
    const currentAllowance = await usdcToken.allowance(managedWallet.address, bucketVaultAddress);
    const depositAmount = ethers.parseUnits("100", decimals); // 100 USDC
    
    if (currentAllowance < depositAmount) {
      console.log("Approving USDC spending...");
      const approveTx = await usdcToken.approve(bucketVaultAddress, ethers.parseUnits("1000000", decimals));
      console.log("Approval transaction hash:", approveTx.hash);
      await approveTx.wait();
      console.log("✅ USDC approved successfully!\n");
    } else {
      console.log("✅ USDC already approved\n");
    }
    
    // Step 3: Make a deposit to initialize bucket balances
    console.log("📝 Step 3: Making initial deposit to initialize buckets...");
    
    if (usdcBalance >= depositAmount) {
      console.log(`Depositing ${ethers.formatUnits(depositAmount, decimals)} USDC...`);
      const depositTx = await bucketVault.depositAndSplit(depositAmount);
      console.log("Deposit transaction hash:", depositTx.hash);
      await depositTx.wait();
      console.log("✅ Deposit successful! Buckets initialized!\n");
    } else {
      console.log("⚠️  Insufficient USDC balance for deposit");
      console.log("Skipping deposit step...\n");
    }
    
    // Step 4: Verify bucket balances
    console.log("📝 Step 4: Verifying bucket balances...");
    const buckets = ["billings", "savings", "growth", "instant", "spendable"];
    
    for (const bucket of buckets) {
      try {
        const balance = await bucketVault.getBucketBalance(managedWallet.address, bucket);
        console.log(`${bucket.padEnd(12)}: ${ethers.formatUnits(balance.balance, decimals)} USDC`);
      } catch (error) {
        console.log(`${bucket.padEnd(12)}: Error reading balance`);
      }
    }
    
    console.log("\n✅ Contract state initialization completed!");
    console.log("\n📊 Summary:");
    console.log("- Split configuration: SET");
    console.log("- USDC approval: APPROVED");
    console.log("- Bucket balances: INITIALIZED");
    console.log("- Managed wallet ready for Paystack deposits");
    
    return true;
    
  } catch (error) {
    console.error("\n❌ Error initializing contract state:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    return false;
  }
}

// Run the initialization
initializeContractState()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("Initialization failed:", error);
    process.exit(1);
  });
