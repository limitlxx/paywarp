// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/BucketVaultUpgradeable.sol";

/**
 * @title ConfigureBucketVaultRWA
 * @dev Foundry script to configure BucketVault RWA integration with deployed contracts
 * 
 * Usage:
 * forge script script/ConfigureBucketVaultRWA.s.sol:ConfigureBucketVaultRWA --rpc-url $MANTLE_SEPOLIA_RPC --broadcast
 */
contract ConfigureBucketVaultRWA is Script {
    
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Configuring BucketVault RWA Integration ===");
        console.log("Deployer address:", deployer);
        
        // Get contract addresses from environment
        address bucketVault = vm.envAddress("NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA");
        address mockUSDY = vm.envAddress("NEXT_PUBLIC_MOCK_USDY_SEPOLIA");
        address mockMUSD = vm.envAddress("NEXT_PUBLIC_MOCK_MUSD_SEPOLIA");
        address mockUSDe = vm.envAddress("NEXT_PUBLIC_MOCK_USDE_SEPOLIA");
        address mockMETH = vm.envAddress("NEXT_PUBLIC_MOCK_METH_SEPOLIA");
        
        console.log("\nContract addresses:");
        console.log("- BucketVault:", bucketVault);
        console.log("- MockUSDY:", mockUSDY);
        console.log("- MockMUSD:", mockMUSD);
        console.log("- MockUSDe:", mockUSDe);
        console.log("- MockmETH:", mockMETH);
        
        // Validate addresses
        require(bucketVault != address(0), "BucketVault address not set");
        require(mockUSDY != address(0), "MockUSDY address not set");
        require(mockMUSD != address(0), "MockMUSD address not set");
        require(mockUSDe != address(0), "MockUSDe address not set");
        require(mockMETH != address(0), "MockmETH address not set");
        
        BucketVaultUpgradeable vault = BucketVaultUpgradeable(bucketVault);
        
        // Check current owner
        console.log("\n--- Checking Permissions ---");
        address owner = vault.owner();
        console.log("BucketVault owner:", owner);
        console.log("Deployer address:", deployer);
        console.log("Is deployer owner:", owner == deployer);
        
        if (owner != deployer) {
            console.log("Warning: Deployer is not the owner. Configuration may fail.");
        }
        
        // Check current RWA integration status
        console.log("\n--- Current RWA Integration Status ---");
        bool isEnabled = vault.isRWAIntegrationEnabled();
        console.log("RWA Integration currently enabled:", isEnabled);
        
        string[4] memory buckets = ["billings", "savings", "growth", "instant"];
        for (uint i = 0; i < buckets.length; i++) {
            address currentRWA = vault.getRWAContract(buckets[i]);
            console.log("- %s: %s", buckets[i], currentRWA);
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Configure RWA contracts for each bucket
        console.log("\n--- Configuring RWA Contracts ---");
        
        console.log("Setting billings bucket -> MockUSDY...");
        vault.setRWAContract("billings", mockUSDY);
        console.log("Billings bucket configured");
        
        console.log("Setting savings bucket -> MockMUSD...");
        vault.setRWAContract("savings", mockMUSD);
        console.log("Savings bucket configured");
        
        console.log("Setting growth bucket -> MockUSDe...");
        vault.setRWAContract("growth", mockUSDe);
        console.log("Growth bucket configured");
        
        console.log("Setting instant bucket -> MockmETH...");
        vault.setRWAContract("instant", mockMETH);
        console.log("Instant bucket configured");
        
        // Enable RWA integration
        console.log("\n--- Enabling RWA Integration ---");
        vault.setRWAIntegrationEnabled(true);
        console.log("RWA Integration enabled");
        
        vm.stopBroadcast();
        
        // Verify configuration
        console.log("\n--- Verifying Configuration ---");
        bool finalEnabled = vault.isRWAIntegrationEnabled();
        console.log("RWA Integration enabled:", finalEnabled);
        
        address[4] memory expectedRWA = [mockUSDY, mockMUSD, mockUSDe, mockMETH];
        bool allConfigured = true;
        
        for (uint i = 0; i < buckets.length; i++) {
            address configuredRWA = vault.getRWAContract(buckets[i]);
            bool isCorrect = configuredRWA == expectedRWA[i];
            
            console.log("- %s: %s [PASS]", buckets[i], configuredRWA, isCorrect ? "" : "[FAIL]");
            
            if (!isCorrect) {
                allConfigured = false;
            }
        }
        
        console.log("\nConfiguration %s", (allConfigured && finalEnabled) ? "SUCCESSFUL" : "INCOMPLETE");
        
        if (allConfigured && finalEnabled) {
            console.log("\n=== Next Steps ===");
            console.log("1. Test RWA integration:");
            console.log("   forge script script/TestRWAIntegration.s.sol:TestRWAIntegration --rpc-url $MANTLE_SEPOLIA_RPC");
            console.log("2. Run integration tests:");
            console.log("   npm run test test/integration/rwa-deployed-contracts.integration.test.ts");
            console.log("3. Update frontend environment variables");
            console.log("4. Test deposit and withdrawal flows through the UI");
            
            console.log("\n[SUCCESS] BucketVault RWA configuration completed successfully!");
        } else {
            console.log("\n[ERROR] Configuration incomplete. Please check the errors above.");
        }
    }
}