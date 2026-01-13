const { ethers, upgrades } = require("hardhat");
const { readFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Upgrading contracts with the account:", deployer.address);
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Load existing deployment
  const deploymentPath = join(__dirname, `../deployments/${network.chainId}-upgradeable.json`);
  let deploymentInfo;
  
  try {
    deploymentInfo = JSON.parse(readFileSync(deploymentPath, 'utf8'));
  } catch (error) {
    console.error("Could not load deployment info:", error.message);
    console.log("Please deploy the contracts first using deploy-upgradeable.js");
    process.exit(1);
  }

  const bucketVaultAddress = deploymentInfo.contracts.BucketVaultUpgradeable.proxy;
  const payrollEngineAddress = deploymentInfo.contracts.PayrollEngineUpgradeable.proxy;

  console.log("Existing BucketVault proxy:", bucketVaultAddress);
  console.log("Existing PayrollEngine proxy:", payrollEngineAddress);

  // Upgrade BucketVaultUpgradeable
  console.log("Upgrading BucketVaultUpgradeable...");
  const BucketVaultUpgradeableV2 = await ethers.getContractFactory("BucketVaultUpgradeable");
  
  const upgradedBucketVault = await upgrades.upgradeProxy(
    bucketVaultAddress,
    BucketVaultUpgradeableV2
  );
  await upgradedBucketVault.waitForDeployment();
  
  console.log("BucketVaultUpgradeable upgraded successfully");
  console.log("New implementation:", await upgrades.erc1967.getImplementationAddress(bucketVaultAddress));

  // Upgrade PayrollEngineUpgradeable
  console.log("Upgrading PayrollEngineUpgradeable...");
  const PayrollEngineUpgradeableV2 = await ethers.getContractFactory("PayrollEngineUpgradeable");
  
  const upgradedPayrollEngine = await upgrades.upgradeProxy(
    payrollEngineAddress,
    PayrollEngineUpgradeableV2
  );
  await upgradedPayrollEngine.waitForDeployment();
  
  console.log("PayrollEngineUpgradeable upgraded successfully");
  console.log("New implementation:", await upgrades.erc1967.getImplementationAddress(payrollEngineAddress));

  // Verify the upgrades worked
  console.log("Verifying upgrades...");
  
  const bucketVaultVersion = await upgradedBucketVault.version();
  const payrollEngineVersion = await upgradedPayrollEngine.version();
  
  console.log("BucketVault version:", bucketVaultVersion);
  console.log("PayrollEngine version:", payrollEngineVersion);

  console.log("Upgrade completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});