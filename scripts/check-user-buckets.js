import { ethers } from "ethers";
import { config } from "dotenv";

config();

const bucketVaultABI = [
  "function getBucketBalance(address user, string bucket) external view returns (tuple(uint256 balance, uint256 yieldBalance, bool isYielding, uint256 lastYieldUpdate))",
  "function getSplitConfig(address user) external view returns (tuple(uint256 billingsPercent, uint256 savingsPercent, uint256 growthPercent, uint256 instantPercent, uint256 spendablePercent))",
  "function userNonces(address user) external view returns (uint256)"
];

async function checkUserBuckets() {
  const userAddress = "0x36D940f43862f17E759266932F13f2f03471f55B";
  
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
  const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
  const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, provider);
  
  console.log("📊 User Bucket Status");
  console.log("=".repeat(60));
  console.log("User:", userAddress);
  console.log("Contract:", bucketVaultAddress);
  console.log("=".repeat(60), "\n");
  
  // Get split config
  const config = await bucketVault.getSplitConfig(userAddress);
  console.log("Split Configuration:");
  console.log(`  Billings:  ${(Number(config.billingsPercent) / 100).toFixed(2)}%`);
  console.log(`  Savings:   ${(Number(config.savingsPercent) / 100).toFixed(2)}%`);
  console.log(`  Growth:    ${(Number(config.growthPercent) / 100).toFixed(2)}%`);
  console.log(`  Instant:   ${(Number(config.instantPercent) / 100).toFixed(2)}%`);
  console.log(`  Spendable: ${(Number(config.spendablePercent) / 100).toFixed(2)}%\n`);
  
  // Get nonce
  const nonce = await bucketVault.userNonces(userAddress);
  console.log("User Nonce (deposits made):", nonce.toString(), "\n");
  
  // Get bucket balances
  console.log("Bucket Balances:");
  const buckets = ["billings", "savings", "growth", "instant", "spendable"];
  let total = 0n;
  
  for (const bucket of buckets) {
    try {
      const balance = await bucketVault.getBucketBalance(userAddress, bucket);
      const amount = ethers.formatUnits(balance.balance, 6); // USDC has 6 decimals
      console.log(`  ${bucket.padEnd(12)}: ${amount.padStart(15)} USDC`);
      total += balance.balance;
    } catch (error) {
      console.log(`  ${bucket.padEnd(12)}: Error - ${error.message}`);
    }
  }
  
  console.log("-".repeat(32));
  console.log(`  ${"Total".padEnd(12)}: ${ethers.formatUnits(total, 6).padStart(15)} USDC\n`);
  
  if (total === 0n) {
    console.log("⚠️  No bucket balances found!");
    console.log("This means the user hasn't made any deposits yet.\n");
    console.log("To fix this:");
    console.log("1. User needs to connect wallet to dapp");
    console.log("2. User needs to deposit USDC");
    console.log("3. The depositAndSplit() function will populate buckets");
  } else {
    console.log("✅ User has bucket balances!");
    console.log("The dashboard should display these balances.\n");
  }
}

checkUserBuckets().catch(console.error);
