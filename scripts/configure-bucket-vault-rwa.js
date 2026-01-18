const { ethers } = require("hardhat");

async function main() {
  console.log("Configuring BucketVault RWA Integration...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Configuring with account:", deployer.address);

  // Contract addresses from environment
  const bucketVaultAddress = process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA;
  const rwaAddresses = {
    billings: process.env.NEXT_PUBLIC_MOCK_USDY_SEPOLIA,
    savings: process.env.NEXT_PUBLIC_MOCK_MUSD_SEPOLIA,
    growth: process.env.NEXT_PUBLIC_MOCK_USDE_SEPOLIA,
    instant: process.env.NEXT_PUBLIC_MOCK_METH_SEPOLIA
  };

  console.log("BucketVault address:", bucketVaultAddress);
  console.log("RWA contract addresses:");
  Object.entries(rwaAddresses).forEach(([bucket, address]) => {
    console.log(`- ${bucket}: ${address || 'NOT SET'}`);
  });

  if (!bucketVaultAddress) {
    throw new Error("NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA not set in environment");
  }

  // Validate all RWA addresses are set
  const missingAddresses = Object.entries(rwaAddresses)
    .filter(([bucket, address]) => !address || address === '0x0000000000000000000000000000000000000000')
    .map(([bucket]) => bucket);

  if (missingAddresses.length > 0) {
    console.log(`Warning: Missing RWA addresses for buckets: ${missingAddresses.join(', ')}`);
    console.log("Proceeding with available addresses...");
  }

  // BucketVault ABI for RWA configuration
  const bucketVaultABI = [
    'function setRWAContract(string,address) external',
    'function setRWAIntegrationEnabled(bool) external',
    'function getRWAContract(string) external view returns (address)',
    'function isRWAIntegrationEnabled() external view returns (bool)',
    'function owner() external view returns (address)',
    'event RWAContractSet(string indexed bucket, address indexed rwaContract)',
    'event RWAIntegrationToggled(bool enabled)'
  ];

  try {
    const bucketVault = new ethers.Contract(bucketVaultAddress, bucketVaultABI, deployer);

    // Check current owner
    console.log("\n=== Checking Permissions ===");
    try {
      const owner = await bucketVault.owner();
      console.log("BucketVault owner:", owner);
      console.log("Deployer address:", deployer.address);
      console.log("Is deployer owner:", owner.toLowerCase() === deployer.address.toLowerCase());
    } catch (error) {
      console.log("Could not check owner (contract may not be ownable)");
    }

    // Check current RWA integration status
    console.log("\n=== Current RWA Integration Status ===");
    try {
      const isEnabled = await bucketVault.isRWAIntegrationEnabled();
      console.log("RWA Integration currently enabled:", isEnabled);

      const buckets = ['billings', 'savings', 'growth', 'instant'];
      for (const bucket of buckets) {
        try {
          const currentRWA = await bucketVault.getRWAContract(bucket);
          console.log(`- ${bucket}: ${currentRWA}`);
        } catch (error) {
          console.log(`- ${bucket}: Error reading - ${error.message}`);
        }
      }
    } catch (error) {
      console.log("Could not read current RWA status:", error.message);
    }

    // Configure RWA contracts for each bucket
    console.log("\n=== Configuring RWA Contracts ===");
    
    const configurationResults = {};
    
    for (const [bucket, rwaAddress] of Object.entries(rwaAddresses)) {
      if (rwaAddress && rwaAddress !== '0x0000000000000000000000000000000000000000') {
        try {
          console.log(`Setting ${bucket} bucket -> ${rwaAddress}...`);
          
          const tx = await bucketVault.setRWAContract(bucket, rwaAddress);
          console.log(`Transaction hash: ${tx.hash}`);
          
          const receipt = await tx.wait();
          console.log(`✓ ${bucket} bucket configured (Gas used: ${receipt.gasUsed})`);
          
          configurationResults[bucket] = {
            success: true,
            address: rwaAddress,
            txHash: tx.hash,
            gasUsed: receipt.gasUsed.toString()
          };
          
        } catch (error) {
          console.log(`✗ Failed to configure ${bucket} bucket: ${error.message}`);
          configurationResults[bucket] = {
            success: false,
            error: error.message
          };
        }
      } else {
        console.log(`Skipping ${bucket} bucket (address not set)`);
        configurationResults[bucket] = {
          success: false,
          error: 'Address not set'
        };
      }
    }

    // Enable RWA integration
    console.log("\n=== Enabling RWA Integration ===");
    try {
      const tx = await bucketVault.setRWAIntegrationEnabled(true);
      console.log(`Transaction hash: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✓ RWA Integration enabled (Gas used: ${receipt.gasUsed})`);
      
      configurationResults.integrationEnabled = {
        success: true,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error) {
      console.log(`✗ Failed to enable RWA integration: ${error.message}`);
      configurationResults.integrationEnabled = {
        success: false,
        error: error.message
      };
    }

    // Verify configuration
    console.log("\n=== Verifying Configuration ===");
    try {
      const isEnabled = await bucketVault.isRWAIntegrationEnabled();
      console.log("RWA Integration enabled:", isEnabled);

      const buckets = ['billings', 'savings', 'growth', 'instant'];
      let allConfigured = true;
      
      for (const bucket of buckets) {
        try {
          const configuredRWA = await bucketVault.getRWAContract(bucket);
          const expectedRWA = rwaAddresses[bucket];
          const isCorrect = configuredRWA.toLowerCase() === (expectedRWA || '').toLowerCase();
          
          console.log(`- ${bucket}: ${configuredRWA} ${isCorrect ? '✓' : '✗'}`);
          
          if (!isCorrect) {
            allConfigured = false;
          }
        } catch (error) {
          console.log(`- ${bucket}: Error - ${error.message}`);
          allConfigured = false;
        }
      }

      console.log(`\nConfiguration ${allConfigured && isEnabled ? 'SUCCESSFUL' : 'INCOMPLETE'}`);

    } catch (error) {
      console.log("Verification failed:", error.message);
    }

    // Output configuration summary
    console.log("\n=== Configuration Summary ===");
    console.log("Results:");
    Object.entries(configurationResults).forEach(([item, result]) => {
      if (result.success) {
        console.log(`✓ ${item}: Success (Gas: ${result.gasUsed || 'N/A'})`);
      } else {
        console.log(`✗ ${item}: Failed - ${result.error}`);
      }
    });

    // Calculate total gas used
    const totalGasUsed = Object.values(configurationResults)
      .filter(result => result.success && result.gasUsed)
      .reduce((total, result) => total + BigInt(result.gasUsed), 0n);
    
    console.log(`\nTotal gas used: ${totalGasUsed.toString()}`);

    // Save configuration info
    const configInfo = {
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      bucketVault: bucketVaultAddress,
      rwaAddresses,
      configurationResults,
      totalGasUsed: totalGasUsed.toString()
    };

    const fs = require('fs');
    const path = require('path');
    
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `bucket-vault-rwa-config-${Date.now()}.json`;
    fs.writeFileSync(
      path.join(deploymentsDir, filename),
      JSON.stringify(configInfo, null, 2)
    );

    console.log(`\nConfiguration info saved to deployments/${filename}`);

    // Output next steps
    console.log("\n=== Next Steps ===");
    console.log("1. Test RWA integration: node scripts/test-rwa-integration.js");
    console.log("2. Run integration tests: npm run test test/integration/rwa-deployed-contracts.integration.test.ts");
    console.log("3. Update frontend environment variables with RWA contract addresses");
    console.log("4. Test deposit and withdrawal flows through the UI");

    console.log("\nBucketVault RWA configuration completed!");

  } catch (error) {
    console.error("Configuration failed:", error);
    
    // Provide troubleshooting guidance
    console.log("\n=== Troubleshooting ===");
    console.log("Common issues:");
    console.log("1. Not contract owner - ensure deployer account owns BucketVault");
    console.log("2. Invalid RWA addresses - verify all RWA contracts are deployed");
    console.log("3. Insufficient gas - increase gas limit in hardhat config");
    console.log("4. Network issues - check Mantle Sepolia RPC connection");
    
    throw error;
  }
}

// Execute configuration
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Configuration script failed:", error);
      process.exit(1);
    });
}

module.exports = { main };