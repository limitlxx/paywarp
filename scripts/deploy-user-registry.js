const { ethers } = require("hardhat");
const { writeFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deploying UserRegistry contract with the account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy UserRegistry contract
  console.log("\nDeploying UserRegistry...");
  const UserRegistry = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  
  const userRegistryAddress = await userRegistry.getAddress();
  console.log("UserRegistry deployed to:", userRegistryAddress);

  // Verify deployment
  console.log("\nVerifying deployment...");
  const totalUsers = await userRegistry.getTotalUsers();
  console.log("Initial total users:", totalUsers.toString());

  // Test registration functionality (optional)
  if (network.chainId === 31337n || network.chainId === 5003n) { // Local or testnet
    console.log("\nTesting registration functionality...");
    
    try {
      const message = `Register wallet ${deployer.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await deployer.signMessage(ethers.getBytes(messageHash));
      
      const tx = await userRegistry.registerUser(messageHash, signature);
      await tx.wait();
      
      const isRegistered = await userRegistry.isUserRegistered(deployer.address);
      const newTotalUsers = await userRegistry.getTotalUsers();
      
      console.log("Test registration successful:", isRegistered);
      console.log("New total users:", newTotalUsers.toString());
    } catch (error) {
      console.log("Test registration failed:", error.message);
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    contracts: {
      UserRegistry: {
        address: userRegistryAddress,
        deploymentBlock: await ethers.provider.getBlockNumber(),
        deploymentTime: new Date().toISOString(),
      }
    },
    gasUsed: {
      UserRegistry: "Estimated ~500,000 gas"
    }
  };

  const deploymentPath = join(__dirname, `../deployments/user-registry-${network.chainId}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  // Update environment variables suggestion
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("\nAdd these to your .env.local file:");
  
  if (network.chainId === 5000n) {
    console.log(`NEXT_PUBLIC_USER_REGISTRY_MAINNET=${userRegistryAddress}`);
  } else if (network.chainId === 5003n) {
    console.log(`NEXT_PUBLIC_USER_REGISTRY_SEPOLIA=${userRegistryAddress}`);
  } else {
    console.log(`NEXT_PUBLIC_USER_REGISTRY_LOCAL=${userRegistryAddress}`);
  }

  console.log("\nContract verification command:");
  console.log(`npx hardhat verify --network ${network.name} ${userRegistryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });