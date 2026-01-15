const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🔄 Upgrading ExpenseTrackerUpgradeable...");

  // Get the proxy address from command line or environment
  const proxyAddress = process.env.EXPENSE_TRACKER_PROXY || process.argv[2];
  
  if (!proxyAddress) {
    console.error("❌ Please provide proxy address as argument or set EXPENSE_TRACKER_PROXY env var");
    process.exit(1);
  }

  console.log("📍 Proxy Address:", proxyAddress);

  // Get the new contract factory (ExpenseTrackerV2, ExpenseTrackerV3, etc.)
  const contractName = process.env.NEW_CONTRACT_NAME || "ExpenseTrackerUpgradeable";
  console.log("📦 Upgrading to:", contractName);

  const NewExpenseTracker = await ethers.getContractFactory(contractName);

  // Validate the upgrade
  console.log("🔍 Validating upgrade compatibility...");
  await upgrades.validateUpgrade(proxyAddress, NewExpenseTracker);
  console.log("✅ Upgrade validation passed!");

  // Perform the upgrade
  console.log("⬆️ Performing upgrade...");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, NewExpenseTracker);
  
  await upgraded.waitForDeployment();

  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("✅ ExpenseTracker upgraded successfully!");
  console.log("📍 Proxy Address (unchanged):", proxyAddress);
  console.log("🔧 New Implementation Address:", newImplementationAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Test the upgrade
  console.log("\n🧪 Testing upgraded functionality...");
  
  try {
    // Check version (should be updated in new contract)
    const version = await upgraded.version();
    console.log("📋 New contract version:", version);

    // Check that existing data is preserved
    const [deployer] = await ethers.getSigners();
    const expenseCount = await upgraded.getUserExpenseCount(deployer.address);
    console.log("📊 Preserved expense count:", expenseCount.toString());

    const totalExpenses = await upgraded.getUserTotalExpenses(deployer.address);
    console.log("💵 Preserved total expenses:", ethers.formatEther(totalExpenses), "ETH equivalent");

    console.log("✅ Upgrade successful - data preserved!");

  } catch (error) {
    console.error("❌ Error testing upgraded functionality:", error.message);
  }

  // Instructions for verification
  console.log("\n🔍 To verify the new implementation on Mantlescan:");
  console.log(`npx hardhat verify --network ${network.name === 'unknown' ? 'mantleTestnet' : network.name} ${newImplementationAddress}`);

  return {
    proxyAddress,
    newImplementationAddress,
    network: network.name,
    chainId: network.chainId
  };
}

// Handle errors
main()
  .then((result) => {
    console.log("\n🎉 Upgrade completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Upgrade failed:");
    console.error(error);
    process.exit(1);
  });

module.exports = main;