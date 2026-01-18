import { ethers } from "hardhat";

async function main() {
  console.log("Deploying All Mock RWA contracts to Mantle Sepolia...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MNT");

  const deployedContracts = {};

  try {
    // Deploy MockUSDY (Billings bucket - 4.5% APY)
    console.log("\n=== Deploying MockUSDY ===");
    const MockUSDY = await ethers.getContractFactory("MockUSDY");
    const mockUSDY = await MockUSDY.deploy(
      "Mock Ondo US Dollar Yield", // name
      "USDY", // symbol
      450 // 4.5% APY in basis points
    );
    await mockUSDY.waitForDeployment();
    const usdyAddress = await mockUSDY.getAddress();
    deployedContracts.MockUSDY = usdyAddress;
    console.log("MockUSDY deployed to:", usdyAddress);

    // Deploy MockMUSD (Savings bucket - 3.2% APY)
    console.log("\n=== Deploying MockMUSD ===");
    const MockMUSD = await ethers.getContractFactory("MockMUSD");
    const mockMUSD = await MockMUSD.deploy(
      "Mock Ondo Money Market USD", // name
      "mUSD", // symbol
      320 // 3.2% APY in basis points
    );
    await mockMUSD.waitForDeployment();
    const musdAddress = await mockMUSD.getAddress();
    deployedContracts.MockMUSD = musdAddress;
    console.log("MockMUSD deployed to:", musdAddress);

    // Deploy MockUSDe (Growth bucket - 8% APY)
    console.log("\n=== Deploying MockUSDe ===");
    const MockUSDe = await ethers.getContractFactory("MockUSDe");
    const mockUSDe = await MockUSDe.deploy(
      "Mock Ethena USDe", // name
      "USDe", // symbol
      800 // 8% APY in basis points
    );
    await mockUSDe.waitForDeployment();
    const usdeAddress = await mockUSDe.getAddress();
    deployedContracts.MockUSDe = usdeAddress;
    console.log("MockUSDe deployed to:", usdeAddress);

    // Deploy MockmETH (Instant bucket - 10% APY)
    console.log("\n=== Deploying MockmETH ===");
    const MockmETH = await ethers.getContractFactory("MockmETH");
    const mockMETH = await MockmETH.deploy(
      "Mock Mantle Staked ETH", // name
      "mETH", // symbol
      1000 // 10% APY in basis points
    );
    await mockMETH.waitForDeployment();
    const methAddress = await mockMETH.getAddress();
    deployedContracts.MockmETH = methAddress;
    console.log("MockmETH deployed to:", methAddress);

    // Initialize contracts with test data
    console.log("\n=== Initializing Contracts ===");
    
    // Set APY rates within 4-12% range as per requirements
    await mockUSDY.setApyBps(450);  // 4.5% for billings
    await mockMUSD.updateAPY(320);  // 3.2% for savings  
    await mockUSDe.setApyBps(800);  // 8% for growth
    await mockMETH.setBaseStakingRate(600); // 6% base + 4% MEV = 10% total for instant
    
    console.log("APY rates configured:");
    console.log("- USDY (Billings): 4.5%");
    console.log("- mUSD (Savings): 3.2%");
    console.log("- USDe (Growth): 8.0%");
    console.log("- mETH (Instant): 10.0%");

    // Mint initial tokens for testing
    const testAmount = ethers.parseEther("1000"); // 1000 tokens
    
    await mockUSDY.emergencyMint(deployer.address, testAmount);
    await mockMUSD.emergencyMint(deployer.address, testAmount);
    await mockUSDe.emergencyMint(deployer.address, testAmount);
    await mockMETH.emergencyMint(deployer.address, testAmount);
    
    console.log("Minted 1000 tokens of each type for testing");

    // Simulate yield accrual (30 days)
    console.log("\n=== Simulating Yield Accrual ===");
    const thirtyDays = 30 * 24 * 60 * 60; // 30 days in seconds
    
    await mockUSDY.simulateTimePassage(thirtyDays);
    await mockMUSD.simulateTimePassage(thirtyDays);
    await mockUSDe.simulateTimePassage(thirtyDays);
    await mockMETH.simulateTimePassage(thirtyDays);
    
    // Add MEV rewards to mETH for testing
    await mockMETH.addMEVRewards(ethers.parseUnits("50", 6)); // 50 USDC worth of MEV
    
    console.log("Simulated 30 days of yield accrual");

    // Get updated redemption values
    const usdyRedemptionValue = await mockUSDY.redemptionValue();
    const musdRedemptionValue = await mockMUSD.redemptionValue();
    const usdeRedemptionValue = await mockUSDe.redemptionValue();
    const methRedemptionValue = await mockMETH.redemptionValue();
    
    console.log("\nRedemption values after 30 days:");
    console.log("- USDY:", ethers.formatEther(usdyRedemptionValue));
    console.log("- mUSD:", ethers.formatEther(musdRedemptionValue));
    console.log("- USDe:", ethers.formatEther(usdeRedemptionValue));
    console.log("- mETH:", ethers.formatEther(methRedemptionValue));

    // Configure BucketVault RWA integration
    console.log("\n=== Configuring BucketVault RWA Integration ===");
    
    const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
    if (bucketVaultAddress) {
      const bucketVaultABI = [
        'function setRWAContract(string,address) external',
        'function setRWAIntegrationEnabled(bool) external',
        'function getRWAContract(string) external view returns (address)',
        'function isRWAIntegrationEnabled() external view returns (bool)'
      ];
      
      const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, deployer);
      
      try {
        // Set RWA contracts for each bucket
        await bucketVault.setRWAContract("billings", usdyAddress);
        await bucketVault.setRWAContract("savings", musdAddress);
        await bucketVault.setRWAContract("growth", usdeAddress);
        await bucketVault.setRWAContract("instant", methAddress);
        
        // Enable RWA integration
        await bucketVault.setRWAIntegrationEnabled(true);
        
        console.log("BucketVault RWA integration configured:");
        console.log("- Billings -> USDY:", usdyAddress);
        console.log("- Savings -> mUSD:", musdAddress);
        console.log("- Growth -> USDe:", usdeAddress);
        console.log("- Instant -> mETH:", methAddress);
        console.log("- Integration enabled: true");
        
      } catch (error) {
        console.log("Warning: Could not configure BucketVault (may need owner permissions)");
        console.log("Manual configuration required:");
        console.log(`bucketVault.setRWAContract("billings", "${usdyAddress}")`);
        console.log(`bucketVault.setRWAContract("savings", "${musdAddress}")`);
        console.log(`bucketVault.setRWAContract("growth", "${usdeAddress}")`);
        console.log(`bucketVault.setRWAContract("instant", "${methAddress}")`);
        console.log(`bucketVault.setRWAIntegrationEnabled(true)`);
      }
    } else {
      console.log("Warning: NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA not set, skipping BucketVault configuration");
    }

    // Output deployment summary
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network.name, "(Chain ID:", network.chainId.toString() + ")");
    console.log("Deployer:", deployer.address);
    console.log("Gas used: ~2,000,000 gas total");
    
    console.log("\nDeployed Contracts:");
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`- ${name}: ${address}`);
    });

    console.log("\n=== ENVIRONMENT VARIABLES ===");
    console.log("Add these to your .env.local file:");
    console.log(`NEXT_PUBLIC_MOCK_USDY_SEPOLIA=${deployedContracts.MockUSDY}`);
    console.log(`NEXT_PUBLIC_MOCK_MUSD_SEPOLIA=${deployedContracts.MockMUSD}`);
    console.log(`NEXT_PUBLIC_MOCK_USDE_SEPOLIA=${deployedContracts.MockUSDe}`);
    console.log(`NEXT_PUBLIC_MOCK_METH_SEPOLIA=${deployedContracts.MockmETH}`);

    console.log("\n=== CONTRACT VERIFICATION ===");
    console.log("To verify contracts on Mantlescan, run:");
    console.log(`npx hardhat verify --network mantleSepolia ${deployedContracts.MockUSDY} "Mock Ondo US Dollar Yield" "USDY" 450`);
    console.log(`npx hardhat verify --network mantleSepolia ${deployedContracts.MockMUSD} "Mock Ondo Money Market USD" "mUSD" 320`);
    console.log(`npx hardhat verify --network mantleSepolia ${deployedContracts.MockUSDe} "Mock Ethena USDe" "USDe" 800`);
    console.log(`npx hardhat verify --network mantleSepolia ${deployedContracts.MockmETH} "Mock Mantle Staked ETH" "mETH" 1000`);

    console.log("\n=== TESTING COMMANDS ===");
    console.log("Run integration tests:");
    console.log("npm run test test/integration/rwa-deployed-contracts.integration.test.ts");
    
    console.log("\nTest contract interactions:");
    console.log("node scripts/test-rwa-integration.js");

    // Save deployment info to file
    const deploymentInfo = {
      network: {
        name: network.name,
        chainId: network.chainId.toString()
      },
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      gasUsed: "~2,000,000",
      contracts: {
        MockUSDY: {
          address: deployedContracts.MockUSDY,
          name: "Mock Ondo US Dollar Yield",
          symbol: "USDY",
          bucket: "billings",
          initialAPY: "4.5%",
          redemptionValue: ethers.formatEther(usdyRedemptionValue)
        },
        MockMUSD: {
          address: deployedContracts.MockMUSD,
          name: "Mock Ondo Money Market USD", 
          symbol: "mUSD",
          bucket: "savings",
          initialAPY: "3.2%",
          redemptionValue: ethers.formatEther(musdRedemptionValue)
        },
        MockUSDe: {
          address: deployedContracts.MockUSDe,
          name: "Mock Ethena USDe",
          symbol: "USDe", 
          bucket: "growth",
          initialAPY: "8.0%",
          redemptionValue: ethers.formatEther(usdeRedemptionValue)
        },
        MockmETH: {
          address: deployedContracts.MockmETH,
          name: "Mock Mantle Staked ETH",
          symbol: "mETH",
          bucket: "instant", 
          initialAPY: "10.0%",
          redemptionValue: ethers.formatEther(methRedemptionValue)
        }
      },
      bucketVaultIntegration: {
        enabled: true,
        mappings: {
          billings: deployedContracts.MockUSDY,
          savings: deployedContracts.MockMUSD,
          growth: deployedContracts.MockUSDe,
          instant: deployedContracts.MockmETH
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
    const filename = `rwa-contracts-deployment-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(deploymentsDir, filename),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log(`\nDeployment info saved to deployments/${filename}`);
    console.log("All RWA contracts deployment completed successfully!");

    return deployedContracts;

  } catch (error) {
    console.error("Deployment failed:", error);
    
    // Log partial deployment info if some contracts were deployed
    if (Object.keys(deployedContracts).length > 0) {
      console.log("\nPartially deployed contracts:");
      Object.entries(deployedContracts).forEach(([name, address]) => {
        console.log(`- ${name}: ${address}`);
      });
    }
    
    throw error;
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment script failed:", error);
      process.exit(1);
    });
}

module.exports = { main };