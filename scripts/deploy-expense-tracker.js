const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ExpenseTrackerUpgradeable...");

  // Get the contract factory
  const ExpenseTracker = await ethers.getContractFactory("ExpenseTrackerUpgradeable");

  // Deploy the upgradeable contract
  console.log("📦 Deploying proxy and implementation...");
  const expenseTracker = await upgrades.deployProxy(
    ExpenseTracker,
    [], // No constructor args needed for initialize()
    {
      initializer: "initialize",
      kind: "uups"
    }
  );

  await expenseTracker.waitForDeployment();

  const proxyAddress = await expenseTracker.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("✅ ExpenseTracker deployed successfully!");
  console.log("📍 Proxy Address:", proxyAddress);
  console.log("🔧 Implementation Address:", implementationAddress);

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);

  // Get deployer info
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployed by:", deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Test basic functionality
  console.log("\n🧪 Testing basic functionality...");
  
  try {
    // Check version
    const version = await expenseTracker.version();
    console.log("📋 Contract version:", version);

    // Check owner
    const owner = await expenseTracker.owner();
    console.log("👑 Contract owner:", owner);

    // Add a test expense
    console.log("📝 Adding test expense...");
    const tx = await expenseTracker.addExpense(
      "Test Vendor",
      ethers.parseEther("25.99"), // $25.99 in wei
      "USD",
      Math.floor(Date.now() / 1000), // Current timestamp
      "restaurant",
      "test-receipt-hash",
      85 // 85% confidence
    );
    
    await tx.wait();
    console.log("✅ Test expense added successfully!");

    // Get expense count
    const expenseCount = await expenseTracker.getUserExpenseCount(deployer.address);
    console.log("📊 Total expenses for deployer:", expenseCount.toString());

    // Get total expenses
    const totalExpenses = await expenseTracker.getUserTotalExpenses(deployer.address);
    console.log("💵 Total expense amount:", ethers.formatEther(totalExpenses), "ETH equivalent");

  } catch (error) {
    console.error("❌ Error testing functionality:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    proxyAddress: proxyAddress,
    implementationAddress: implementationAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    version: "1.0.0"
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Instructions for verification
  console.log("\n🔍 To verify the contract on Mantlescan:");
  console.log(`npx hardhat verify --network ${network.name === 'unknown' ? 'mantleTestnet' : network.name} ${implementationAddress}`);
  
  console.log("\n📝 Add these addresses to your .env file:");
  console.log(`NEXT_PUBLIC_EXPENSE_TRACKER_${network.chainId === 5000n ? 'MAINNET' : 'SEPOLIA'}=${proxyAddress}`);

  return {
    proxyAddress,
    implementationAddress,
    network: network.name,
    chainId: network.chainId
  };
}

// Handle errors
main()
  .then((result) => {
    console.log("\n🎉 Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Deployment failed:");
    console.error(error);
    process.exit(1);
  });

module.exports = main;