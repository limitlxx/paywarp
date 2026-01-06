const { ethers } = require("hardhat");
const { writeFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Contract addresses based on network
  let baseTokenAddress;
  let yieldTokenAddress;

  if (network.chainId === 5003n) { // Mantle Sepolia
    // Mock token addresses for testnet
    baseTokenAddress = "0x0000000000000000000000000000000000000001"; // Mock USDC
    yieldTokenAddress = "0x0000000000000000000000000000000000000002"; // Mock USDY
  } else if (network.chainId === 5000n) { // Mantle Mainnet
    // Real token addresses for mainnet (these would be actual Ondo Finance addresses)
    baseTokenAddress = "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9"; // USDC on Mantle
    yieldTokenAddress = "0x5bEaBAEBB3146685Dd74176f68a0721F91297D37"; // USDY on Mantle
  } else {
    // Local hardhat network
    baseTokenAddress = "0x0000000000000000000000000000000000000001";
    yieldTokenAddress = "0x0000000000000000000000000000000000000002";
  }

  // Deploy BucketVault
  console.log("Deploying BucketVault...");
  const BucketVault = await ethers.getContractFactory("BucketVault");
  const bucketVault = await BucketVault.deploy(baseTokenAddress, deployer.address);
  await bucketVault.waitForDeployment();
  const bucketVaultAddress = await bucketVault.getAddress();
  console.log("BucketVault deployed to:", bucketVaultAddress);

  // Set yield token
  if (yieldTokenAddress !== "0x0000000000000000000000000000000000000002") {
    console.log("Setting yield token...");
    await bucketVault.setYieldToken(yieldTokenAddress);
    console.log("Yield token set to:", yieldTokenAddress);
  }

  // Deploy PayrollEngine
  console.log("Deploying PayrollEngine...");
  const PayrollEngine = await ethers.getContractFactory("PayrollEngine");
  const payrollEngine = await PayrollEngine.deploy(
    baseTokenAddress,
    bucketVaultAddress,
    deployer.address
  );
  await payrollEngine.waitForDeployment();
  const payrollEngineAddress = await payrollEngine.getAddress();
  console.log("PayrollEngine deployed to:", payrollEngineAddress);

  // Create deployment info
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    contracts: {
      BucketVault: {
        address: bucketVaultAddress,
        constructorArgs: [baseTokenAddress, deployer.address],
      },
      PayrollEngine: {
        address: payrollEngineAddress,
        constructorArgs: [baseTokenAddress, bucketVaultAddress, deployer.address],
      },
    },
    tokens: {
      baseToken: baseTokenAddress,
      yieldToken: yieldTokenAddress,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  // Save deployment info
  const deploymentPath = join(__dirname, `../deployments/${network.chainId}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", deploymentPath);

  console.log("Deployment completed!");
  console.log("\nContract Addresses:");
  console.log("BucketVault:", bucketVaultAddress);
  console.log("PayrollEngine:", payrollEngineAddress);
  console.log("\nAdd these to your .env.local file:");
  
  if (network.chainId === 5003n) {
    console.log(`NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA=${bucketVaultAddress}`);
    console.log(`NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA=${payrollEngineAddress}`);
    console.log(`NEXT_PUBLIC_USDY_TOKEN_SEPOLIA=${baseTokenAddress}`);
    console.log(`NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA=${yieldTokenAddress}`);
  } else if (network.chainId === 5000n) {
    console.log(`NEXT_PUBLIC_BUCKET_VAULT_MAINNET=${bucketVaultAddress}`);
    console.log(`NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET=${payrollEngineAddress}`);
    console.log(`NEXT_PUBLIC_USDY_TOKEN_MAINNET=${baseTokenAddress}`);
    console.log(`NEXT_PUBLIC_MUSD_TOKEN_MAINNET=${yieldTokenAddress}`);
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});