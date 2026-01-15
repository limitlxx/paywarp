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
  "function transferBetweenBuckets(string fromBucket, string toBucket, uint256 amount) external",
  "function withdrawFromBucket(string bucket, uint256 amount) external",
  "function version() external pure returns (string)"
];

const erc20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

async function main() {
  const args = process.argv.slice(2);
  const operation = args[0];
  
  if (!operation) {
    console.log("Usage: node scripts/managed-wallet-operations.js <operation> [args]");
    console.log("\nAvailable operations:");
    console.log("  status                           - Check wallet and contract status");
    console.log("  deposit <amount>                 - Deposit USDC and split into buckets");
    console.log("  update-config <b> <s> <g> <i> <sp> - Update split config (percentages must sum to 100)");
    console.log("  view-buckets                     - View all bucket balances");
    console.log("  transfer <from> <to> <amount>    - Transfer between buckets");
    console.log("\nExamples:");
    console.log("  node scripts/managed-wallet-operations.js status");
    console.log("  node scripts/managed-wallet-operations.js deposit 50");
    console.log("  node scripts/managed-wallet-operations.js update-config 20 30 20 20 10");
    console.log("  node scripts/managed-wallet-operations.js view-buckets");
    console.log("  node scripts/managed-wallet-operations.js transfer savings growth 10");
    process.exit(0);
  }
  
  try {
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
    
    switch (operation) {
      case "status": {
        console.log("📊 Wallet and Contract Status\n");
        console.log("Managed Wallet:", managedWallet.address);
        
        const mntBalance = await provider.getBalance(managedWallet.address);
        console.log("MNT Balance:", ethers.formatEther(mntBalance), "MNT");
        
        const usdcBalance = await usdcToken.balanceOf(managedWallet.address);
        console.log("USDC Balance:", ethers.formatUnits(usdcBalance, decimals), "USDC");
        
        const version = await bucketVault.version();
        console.log("\nBucketVault Version:", version);
        console.log("BucketVault Address:", bucketVaultAddress);
        
        const config = await bucketVault.getSplitConfig(managedWallet.address);
        console.log("\nCurrent Split Config:");
        console.log("  Billings:", (Number(config.billingsPercent) / 100).toFixed(2) + "%");
        console.log("  Savings:", (Number(config.savingsPercent) / 100).toFixed(2) + "%");
        console.log("  Growth:", (Number(config.growthPercent) / 100).toFixed(2) + "%");
        console.log("  Instant:", (Number(config.instantPercent) / 100).toFixed(2) + "%");
        console.log("  Spendable:", (Number(config.spendablePercent) / 100).toFixed(2) + "%");
        
        const allowance = await usdcToken.allowance(managedWallet.address, bucketVaultAddress);
        console.log("\nUSDC Allowance:", ethers.formatUnits(allowance, decimals), "USDC");
        break;
      }
      
      case "deposit": {
        const amount = args[1];
        if (!amount) {
          console.error("Error: Amount required");
          console.log("Usage: node scripts/managed-wallet-operations.js deposit <amount>");
          process.exit(1);
        }
        
        const depositAmount = ethers.parseUnits(amount, decimals);
        console.log(`💰 Depositing ${amount} USDC...\n`);
        
        // Check balance
        const usdcBalance = await usdcToken.balanceOf(managedWallet.address);
        if (usdcBalance < depositAmount) {
          throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(usdcBalance, decimals)}, Need: ${amount}`);
        }
        
        // Check allowance
        const allowance = await usdcToken.allowance(managedWallet.address, bucketVaultAddress);
        if (allowance < depositAmount) {
          console.log("Approving USDC...");
          const approveTx = await usdcToken.approve(bucketVaultAddress, ethers.parseUnits("1000000", decimals));
          await approveTx.wait();
          console.log("✅ Approved\n");
        }
        
        // Make deposit
        console.log("Processing deposit...");
        const tx = await bucketVault.depositAndSplit(depositAmount);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Deposit successful!");
        
        // Show updated balances
        console.log("\nUpdated Bucket Balances:");
        const buckets = ["billings", "savings", "growth", "instant", "spendable"];
        for (const bucket of buckets) {
          const balance = await bucketVault.getBucketBalance(managedWallet.address, bucket);
          console.log(`  ${bucket.padEnd(12)}: ${ethers.formatUnits(balance.balance, decimals)} USDC`);
        }
        break;
      }
      
      case "update-config": {
        const [b, s, g, i, sp] = args.slice(1).map(Number);
        if (!b || !s || !g || !i || !sp) {
          console.error("Error: All 5 percentages required");
          console.log("Usage: node scripts/managed-wallet-operations.js update-config <billings> <savings> <growth> <instant> <spendable>");
          console.log("Example: node scripts/managed-wallet-operations.js update-config 20 30 20 20 10");
          process.exit(1);
        }
        
        if (b + s + g + i + sp !== 100) {
          console.error("Error: Percentages must sum to 100");
          process.exit(1);
        }
        
        console.log(`🔧 Updating split configuration...\n`);
        console.log("New config:");
        console.log(`  Billings: ${b}%`);
        console.log(`  Savings: ${s}%`);
        console.log(`  Growth: ${g}%`);
        console.log(`  Instant: ${i}%`);
        console.log(`  Spendable: ${sp}%\n`);
        
        const newConfig = {
          billingsPercent: b * 100,
          savingsPercent: s * 100,
          growthPercent: g * 100,
          instantPercent: i * 100,
          spendablePercent: sp * 100
        };
        
        const tx = await bucketVault.setSplitConfig(newConfig);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Configuration updated successfully!");
        break;
      }
      
      case "view-buckets": {
        console.log("📊 Bucket Balances\n");
        const buckets = ["billings", "savings", "growth", "instant", "spendable"];
        let total = 0n;
        
        for (const bucket of buckets) {
          const balance = await bucketVault.getBucketBalance(managedWallet.address, bucket);
          const amount = ethers.formatUnits(balance.balance, decimals);
          console.log(`${bucket.padEnd(12)}: ${amount.padStart(15)} USDC`);
          total += balance.balance;
        }
        
        console.log("-".repeat(30));
        console.log(`${"Total".padEnd(12)}: ${ethers.formatUnits(total, decimals).padStart(15)} USDC`);
        break;
      }
      
      case "transfer": {
        const [from, to, amount] = args.slice(1);
        if (!from || !to || !amount) {
          console.error("Error: Missing arguments");
          console.log("Usage: node scripts/managed-wallet-operations.js transfer <from> <to> <amount>");
          console.log("Example: node scripts/managed-wallet-operations.js transfer savings growth 10");
          process.exit(1);
        }
        
        const transferAmount = ethers.parseUnits(amount, decimals);
        console.log(`🔄 Transferring ${amount} USDC from ${from} to ${to}...\n`);
        
        const tx = await bucketVault.transferBetweenBuckets(from, to, transferAmount);
        console.log("Transaction hash:", tx.hash);
        await tx.wait();
        console.log("✅ Transfer successful!");
        
        // Show updated balances
        console.log("\nUpdated Balances:");
        const fromBalance = await bucketVault.getBucketBalance(managedWallet.address, from);
        const toBalance = await bucketVault.getBucketBalance(managedWallet.address, to);
        console.log(`  ${from}: ${ethers.formatUnits(fromBalance.balance, decimals)} USDC`);
        console.log(`  ${to}: ${ethers.formatUnits(toBalance.balance, decimals)} USDC`);
        break;
      }
      
      default:
        console.error(`Unknown operation: ${operation}`);
        console.log("Run without arguments to see available operations");
        process.exit(1);
    }
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

main();
