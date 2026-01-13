const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Mock RWA contracts to testnet...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy MockUSDY
  console.log("\nDeploying MockUSDY...");
  const MockUSDY = await ethers.getContractFactory("MockUSDY");
  const mockUSDY = await MockUSDY.deploy(
    "Mock Ondo US Dollar Yield", // name
    "USDY", // symbol
    450 // 4.5% APY in basis points
  );
  await mockUSDY.waitForDeployment();
  const usdyAddress = await mockUSDY.getAddress();
  console.log("MockUSDY deployed to:", usdyAddress);

  // Deploy MockMUSD
  console.log("\nDeploying MockMUSD...");
  const MockMUSD = await ethers.getContractFactory("MockMUSD");
  const mockMUSD = await MockMUSD.deploy(
    "Mock Ondo Money Market USD", // name
    "mUSD", // symbol
    320 // 3.2% APY in basis points
  );
  await mockMUSD.waitForDeployment();
  const musdAddress = await mockMUSD.getAddress();
  console.log("MockMUSD deployed to:", musdAddress);

  // Initialize with some test deposits for demonstration
  console.log("\nInitializing contracts with test data...");
  
  // Mint some tokens for testing
  const testAmount = ethers.parseEther("1000"); // 1000 USDC equivalent
  
  await mockUSDY.emergencyMint(deployer.address, testAmount);
  console.log("Minted 1000 USDY tokens for testing");
  
  await mockMUSD.emergencyMint(deployer.address, testAmount);
  console.log("Minted 1000 mUSD tokens for testing");

  // Simulate some time passage and yield accrual
  console.log("\nSimulating yield accrual...");
  const oneDay = 24 * 60 * 60; // 1 day in seconds
  await mockUSDY.simulateTimePassage(oneDay * 30); // 30 days
  await mockMUSD.simulateTimePassage(oneDay * 30); // 30 days

  // Get updated redemption values
  const usdyRedemptionValue = await mockUSDY.redemptionValue();
  const musdRedemptionValue = await mockMUSD.redemptionValue();
  
  console.log("USDY redemption value after 30 days:", ethers.formatEther(usdyRedemptionValue));
  console.log("mUSD redemption value after 30 days:", ethers.formatEther(musdRedemptionValue));

  // Output deployment summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", await ethers.provider.getNetwork().then(n => n.name));
  console.log("Deployer:", deployer.address);
  console.log("MockUSDY Address:", usdyAddress);
  console.log("MockMUSD Address:", musdAddress);
  
  console.log("\n=== ENVIRONMENT VARIABLES ===");
  console.log("Add these to your .env.local file:");
  console.log(`NEXT_PUBLIC_USDY_TOKEN_SEPOLIA=${usdyAddress}`);
  console.log(`NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA=${musdAddress}`);

  console.log("\n=== CONTRACT VERIFICATION ===");
  console.log("To verify contracts on Mantlescan, run:");
  console.log(`npx hardhat verify --network mantleSepolia ${usdyAddress} "Mock Ondo US Dollar Yield" "USDY" 450`);
  console.log(`npx hardhat verify --network mantleSepolia ${musdAddress} "Mock Ondo Money Market USD" "mUSD" 320`);

  // Save deployment info to file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork().then(n => n.name),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MockUSDY: {
        address: usdyAddress,
        name: "Mock Ondo US Dollar Yield",
        symbol: "USDY",
        initialAPY: "4.5%",
        redemptionValue: ethers.formatEther(usdyRedemptionValue)
      },
      MockMUSD: {
        address: musdAddress,
        name: "Mock Ondo Money Market USD", 
        symbol: "mUSD",
        initialAPY: "3.2%",
        redemptionValue: ethers.formatEther(musdRedemptionValue)
      }
    }
  };

  const fs = require('fs');
  const path = require('path');
  
  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Write deployment info
  fs.writeFileSync(
    path.join(deploymentsDir, 'mock-rwa-deployment.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\nDeployment info saved to deployments/mock-rwa-deployment.json");
  console.log("Mock RWA contracts deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });