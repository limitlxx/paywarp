const { ethers, upgrades } = require("hardhat");
const { writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Deploying upgradeable contracts with the account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Contract addresses based on network
  let baseTokenAddress;
  let yieldTokenAddress;

  if (network.chainId === 5003n) { // Mantle Sepolia
    // Mock token addresses for testnet
    baseTokenAddress = "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE"; // USDC on Mantle Sepolia
    yieldTokenAddress = "0x0000000000000000000000000000000000000002"; // Mock USDY
  } else if (network.chainId === 5000n) { // Mantle Mainnet
    // Real token addresses for mainnet
    baseTokenAddress = "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9"; // USDC on Mantle
    yieldTokenAddress = "0x5bEaBAEBB3146685Dd74176f68a0721F91297D37"; // USDY on Mantle
  } else {
    // Local hardhat network - deploy mock tokens
    console.log("Deploying mock tokens for local network...");
    
    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6);
    await mockUSDC.waitForDeployment();
    baseTokenAddress = await mockUSDC.getAddress();
    console.log("Mock USDC deployed to:", baseTokenAddress);
    
    // Deploy mock USDY
    const mockUSDY = await MockERC20.deploy("Mock USDY", "USDY", 18);
    await mockUSDY.waitForDeployment();
    yieldTokenAddress = await mockUSDY.getAddress();
    console.log("Mock USDY deployed to:", yieldTokenAddress);
  }

  // Deploy BucketVaultUpgradeable
  console.log("Deploying BucketVaultUpgradeable...");
  const BucketVaultUpgradeable = await ethers.getContractFactory("BucketVaultUpgradeable");
  
  const bucketVault = await upgrades.deployProxy(
    BucketVaultUpgradeable,
    [baseTokenAddress, deployer.address],
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );
  await bucketVault.waitForDeployment();
  const bucketVaultAddress = await bucketVault.getAddress();
  console.log("BucketVaultUpgradeable deployed to:", bucketVaultAddress);

  // Set yield token
  if (yieldTokenAddress !== "0x0000000000000000000000000000000000000002") {
    console.log("Setting yield token...");
    await bucketVault.setYieldToken(yieldTokenAddress);
    console.log("Yield token set to:", yieldTokenAddress);
  }

  // Deploy PayrollEngineUpgradeable
  console.log("Deploying PayrollEngineUpgradeable...");
  const PayrollEngineUpgradeable = await ethers.getContractFactory("PayrollEngineUpgradeable");
  
  const payrollEngine = await upgrades.deployProxy(
    PayrollEngineUpgradeable,
    [baseTokenAddress, bucketVaultAddress, deployer.address],
    { 
      initializer: 'initialize',
      kind: 'uups'
    }
  );
  await payrollEngine.waitForDeployment();
  const payrollEngineAddress = await payrollEngine.getAddress();
  console.log("PayrollEngineUpgradeable deployed to:", payrollEngineAddress);

  // Create deployment info
  const deploymentInfo = {
    network: {
      name: network.name,
      chainId: network.chainId.toString(),
    },
    contracts: {
      BucketVaultUpgradeable: {
        proxy: bucketVaultAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(bucketVaultAddress),
        admin: await upgrades.erc1967.getAdminAddress(bucketVaultAddress),
        constructorArgs: [baseTokenAddress, deployer.address],
      },
      PayrollEngineUpgradeable: {
        proxy: payrollEngineAddress,
        implementation: await upgrades.erc1967.getImplementationAddress(payrollEngineAddress),
        admin: await upgrades.erc1967.getAdminAddress(payrollEngineAddress),
        constructorArgs: [baseTokenAddress, bucketVaultAddress, deployer.address],
      },
    },
    tokens: {
      baseToken: baseTokenAddress,
      yieldToken: yieldTokenAddress,
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    upgradeable: true,
  };

  // Ensure deployments directory exists
  const deploymentsDir = join(__dirname, "../deployments");
  try {
    mkdirSync(deploymentsDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }

  // Save deployment info
  const deploymentPath = join(deploymentsDir, `${network.chainId}-upgradeable.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Deployment info saved to:", deploymentPath);

  console.log("Deployment completed!");
  console.log("\nContract Addresses (Proxies):");
  console.log("BucketVaultUpgradeable:", bucketVaultAddress);
  console.log("PayrollEngineUpgradeable:", payrollEngineAddress);
  console.log("\nImplementation Addresses:");
  console.log("BucketVault Implementation:", await upgrades.erc1967.getImplementationAddress(bucketVaultAddress));
  console.log("PayrollEngine Implementation:", await upgrades.erc1967.getImplementationAddress(payrollEngineAddress));
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

  // Security recommendations
  console.log("\n🔒 Security Recommendations:");
  console.log("1. Transfer ownership to a multisig wallet");
  console.log("2. Set up proper access controls for keepers");
  console.log("3. Configure daily withdrawal limits");
  console.log("4. Set up monitoring for large transactions");
  console.log("5. Test upgrade functionality on testnet first");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});