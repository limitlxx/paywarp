const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verifying ExpenseTrackerUpgradeable...");

  // Get addresses from command line or environment
  const proxyAddress = process.env.EXPENSE_TRACKER_PROXY || process.argv[2];
  const implementationAddress = process.env.EXPENSE_TRACKER_IMPL || process.argv[3];
  
  if (!proxyAddress) {
    console.error("❌ Please provide proxy address as first argument or set EXPENSE_TRACKER_PROXY env var");
    process.exit(1);
  }

  console.log("📍 Proxy Address:", proxyAddress);
  console.log("🔧 Implementation Address:", implementationAddress || "Will auto-detect");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkName = network.chainId === 5000n ? 'mantleMainnet' : 'mantleTestnet';
  
  console.log("🌐 Network:", networkName, `(Chain ID: ${network.chainId})`);

  try {
    // If implementation address not provided, get it from proxy
    let implAddress = implementationAddress;
    if (!implAddress) {
      const { upgrades } = require("hardhat");
      implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
      console.log("🔧 Auto-detected Implementation Address:", implAddress);
    }

    // Verify the implementation contract
    console.log("📋 Verifying implementation contract...");
    
    await hre.run("verify:verify", {
      address: implAddress,
      constructorArguments: [], // No constructor args for upgradeable contracts
      contract: "contracts/ExpenseTrackerUpgradeable.sol:ExpenseTrackerUpgradeable"
    });

    console.log("✅ Implementation contract verified successfully!");

    // Test contract interaction
    console.log("\n🧪 Testing contract interaction...");
    
    const ExpenseTracker = await ethers.getContractFactory("ExpenseTrackerUpgradeable");
    const contract = ExpenseTracker.attach(proxyAddress);

    // Test read functions
    const version = await contract.version();
    console.log("📋 Contract version:", version);

    const owner = await contract.owner();
    console.log("👑 Contract owner:", owner);

    // Get deployer info
    const [deployer] = await ethers.getSigners();
    const expenseCount = await contract.getUserExpenseCount(deployer.address);
    console.log("📊 Deployer expense count:", expenseCount.toString());

    const totalExpenses = await contract.getUserTotalExpenses(deployer.address);
    console.log("💵 Deployer total expenses:", ethers.formatEther(totalExpenses), "ETH equivalent");

    console.log("✅ Contract interaction successful!");

    // Display useful information
    console.log("\n📄 Contract Information:");
    console.log("- Proxy Address:", proxyAddress);
    console.log("- Implementation Address:", implAddress);
    console.log("- Network:", networkName);
    console.log("- Chain ID:", network.chainId.toString());
    console.log("- Owner:", owner);
    console.log("- Version:", version);

    // Display Mantlescan links
    const explorerBase = network.chainId === 5000n 
      ? "https://explorer.mantle.xyz" 
      : "https://explorer.sepolia.mantle.xyz";
    
    console.log("\n🔗 Explorer Links:");
    console.log("- Proxy:", `${explorerBase}/address/${proxyAddress}`);
    console.log("- Implementation:", `${explorerBase}/address/${implAddress}`);

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Contract already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
      
      // Provide manual verification instructions
      console.log("\n📝 Manual verification instructions:");
      console.log("1. Go to Mantlescan explorer");
      console.log("2. Navigate to the implementation address");
      console.log("3. Click 'Contract' tab");
      console.log("4. Click 'Verify and Publish'");
      console.log("5. Select 'Solidity (Single file)'");
      console.log("6. Upload the flattened contract source");
      console.log("7. Set compiler version to 0.8.20");
      console.log("8. Enable optimization with 200 runs");
    }
  }

  return {
    proxyAddress,
    implementationAddress: implAddress,
    network: networkName,
    chainId: network.chainId
  };
}

// Handle errors
main()
  .then((result) => {
    console.log("\n🎉 Verification completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Verification process failed:");
    console.error(error);
    process.exit(1);
  });

module.exports = main;