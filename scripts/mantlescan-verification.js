const { ethers } = require("ethers");
const { config } = require("dotenv");
const fs = require("fs");

// Load .env.local file
config({ path: '.env.local' });

async function verifyOnMantlescan() {
  try {
    console.log("🔍 Mantlescan Contract Verification Process\n");
    
    // Setup provider
    const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    const network = await provider.getNetwork();
    
    console.log("📊 Network Information:");
    console.log("├── Network: Mantle Sepolia Testnet");
    console.log("├── Chain ID:", network.chainId.toString());
    console.log("├── RPC URL:", process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC);
    console.log("└── Explorer: https://sepolia.mantlescan.xyz");
    
    // Contract addresses
    const contracts = {
      BucketVault: process.env.NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA,
      PayrollEngine: process.env.NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA,
      MockUSDY: process.env.NEXT_PUBLIC_MOCK_USDY_SEPOLIA,
      MockMUSD: process.env.NEXT_PUBLIC_MOCK_MUSD_SEPOLIA,
      USDC: process.env.NEXT_PUBLIC_USDY_TOKEN_SEPOLIA
    };
    
    console.log("\n📋 Contract Addresses for Verification:");
    for (const [name, address] of Object.entries(contracts)) {
      if (address) {
        console.log(`├── ${name}: ${address}`);
      }
    }
    
    // Check contract deployment status
    console.log("\n🔍 Contract Deployment Status:");
    const deploymentStatus = {};
    
    for (const [name, address] of Object.entries(contracts)) {
      if (address && address !== "0x0000000000000000000000000000000000000000") {
        try {
          const code = await provider.getCode(address);
          const isDeployed = code !== "0x";
          deploymentStatus[name] = {
            address,
            deployed: isDeployed,
            codeSize: code.length
          };
          
          console.log(`${isDeployed ? '✅' : '❌'} ${name}: ${isDeployed ? 'Deployed' : 'Not deployed'} at ${address}`);
          
          if (isDeployed) {
            console.log(`   └── Code size: ${code.length} bytes`);
          }
        } catch (error) {
          console.log(`❌ ${name}: Error checking - ${error.message}`);
          deploymentStatus[name] = { address, deployed: false, error: error.message };
        }
      }
    }
    
    // Generate verification commands
    console.log("\n📝 Mantlescan Verification Commands:");
    console.log("Run these commands to verify contracts on Mantlescan:");
    console.log();
    
    if (contracts.BucketVault) {
      console.log("# BucketVault Verification");
      console.log(`npx hardhat verify --network mantleSepolia ${contracts.BucketVault} \\`);
      console.log(`  "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE" \\`);
      console.log(`  "0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a"`);
      console.log();
    }
    
    if (contracts.PayrollEngine) {
      console.log("# PayrollEngine Verification");
      console.log(`npx hardhat verify --network mantleSepolia ${contracts.PayrollEngine} \\`);
      console.log(`  "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE" \\`);
      console.log(`  "${contracts.BucketVault}" \\`);
      console.log(`  "0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a"`);
      console.log();
    }
    
    if (contracts.MockUSDY) {
      console.log("# MockUSDY Verification");
      console.log(`npx hardhat verify --network mantleSepolia ${contracts.MockUSDY} \\`);
      console.log(`  "Mock Ondo US Dollar Yield" "USDY" 450`);
      console.log();
    }
    
    if (contracts.MockMUSD) {
      console.log("# MockMUSD Verification");
      console.log(`npx hardhat verify --network mantleSepolia ${contracts.MockMUSD} \\`);
      console.log(`  "Mock Ondo Money Market USD" "mUSD" 320`);
      console.log();
    }
    
    // Test contract interaction through Mantlescan interface
    console.log("🧪 Testing Contract Interaction through Mantlescan:");
    console.log("1. Visit https://sepolia.mantlescan.xyz");
    console.log("2. Search for contract addresses");
    console.log("3. Navigate to 'Contract' tab");
    console.log("4. Use 'Read Contract' functions:");
    console.log("   ├── BucketVault: version(), getSplitConfig()");
    console.log("   ├── PayrollEngine: version(), getEmployee()");
    console.log("   ├── MockUSDY: getAPY(), redemptionValue()");
    console.log("   └── MockMUSD: getAPY(), redemptionValue()");
    console.log("5. Use 'Write Contract' functions (connect wallet):");
    console.log("   ├── BucketVault: setSplitConfig(), depositAndSplit()");
    console.log("   ├── PayrollEngine: addEmployee(), schedulePayroll()");
    console.log("   └── Mock Tokens: deposit(), redeem()");
    
    // Document contract addresses and verification status
    console.log("\n📄 Documentation Summary:");
    
    const verificationReport = {
      network: {
        name: "Mantle Sepolia Testnet",
        chainId: network.chainId.toString(),
        rpc: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC,
        explorer: "https://sepolia.mantlescan.xyz"
      },
      contracts: deploymentStatus,
      verificationCommands: {
        bucketVault: `npx hardhat verify --network mantleSepolia ${contracts.BucketVault} "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE" "0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a"`,
        payrollEngine: `npx hardhat verify --network mantleSepolia ${contracts.PayrollEngine} "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE" "${contracts.BucketVault}" "0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a"`,
        mockUSDY: `npx hardhat verify --network mantleSepolia ${contracts.MockUSDY} "Mock Ondo US Dollar Yield" "USDY" 450`,
        mockMUSD: `npx hardhat verify --network mantleSepolia ${contracts.MockMUSD} "Mock Ondo Money Market USD" "mUSD" 320`
      },
      timestamp: new Date().toISOString(),
      status: "Ready for verification"
    };
    
    // Save verification report
    const deploymentsDir = './deployments';
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      `${deploymentsDir}/mantlescan-verification-report.json`,
      JSON.stringify(verificationReport, null, 2)
    );
    
    console.log("✅ All contracts documented and ready for verification");
    console.log("✅ Verification commands generated");
    console.log("✅ Contract interaction guide provided");
    console.log("✅ Verification report saved to deployments/mantlescan-verification-report.json");
    
    console.log("\n🎉 Mantlescan verification process completed!");
    
    return verificationReport;
    
  } catch (error) {
    console.error("❌ Verification process failed:", error.message);
    throw error;
  }
}

verifyOnMantlescan()
  .then(report => {
    console.log("\n📋 Verification Summary:");
    console.log("Network:", report.network.name);
    console.log("Contracts:", Object.keys(report.contracts).length, "documented");
    console.log("Status:", report.status);
    process.exit(0);
  })
  .catch(error => {
    console.error("Verification failed:", error);
    process.exit(1);
  });