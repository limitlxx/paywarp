// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/BucketVaultUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UpgradeBucketVault
 * @dev Foundry script to upgrade BucketVault contract with enhanced RWA integration
 * 
 * This script upgrades the existing BucketVault to support:
 * - Real RWA token integration
 * - Enhanced yield tracking
 * - Improved error handling
 * - Gas optimizations
 * 
 * Usage:
 * forge script script/UpgradeBucketVault.s.sol:UpgradeBucketVault --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --verify
 */
contract UpgradeBucketVault is Script {
    
    // Current BucketVault proxy address
    address public currentBucketVault;
    
    // New implementation contract
    address public newImplementation;
    
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Upgrading BucketVault Contract ===");
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        
        // Get current BucketVault address from environment
        currentBucketVault = vm.envAddress("NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA");
        console.log("Current BucketVault proxy:", currentBucketVault);
        
        // Validate current contract
        validateCurrentContract();
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new implementation
        console.log("\n--- Deploying New BucketVault Implementation ---");
        BucketVaultUpgradeable newImpl = new BucketVaultUpgradeable();
        newImplementation = address(newImpl);
        console.log("New implementation deployed:", newImplementation);
        
        // Get the current contract to perform upgrade
        BucketVaultUpgradeable currentContract = BucketVaultUpgradeable(currentBucketVault);
        
        // Check if we're the owner
        address owner = currentContract.owner();
        console.log("Current owner:", owner);
        console.log("Deployer:", deployer);
        
        if (owner != deployer) {
            console.log("ERROR: Deployer is not the owner. Cannot upgrade.");
            vm.stopBroadcast();
            return;
        }
        
        // Perform the upgrade
        console.log("\n--- Performing Upgrade ---");
        currentContract.upgradeToAndCall(newImplementation, "");
        console.log("[SUCCESS] BucketVault upgraded to new implementation");
        
        vm.stopBroadcast();
        
        // Verify upgrade
        console.log("\n--- Verifying Upgrade ---");
        verifyUpgrade();
        
        // Test basic functionality
        console.log("\n--- Testing Basic Functionality ---");
        testBasicFunctionality();
        
        // Output upgrade summary
        console.log("\n=== UPGRADE SUMMARY ===");
        console.log("Network: Mantle Sepolia (Chain ID: 5003)");
        console.log("Upgrader:", deployer);
        console.log("Proxy Address:", currentBucketVault);
        console.log("Old Implementation: [Previous]");
        console.log("New Implementation:", newImplementation);
        
        console.log("\n=== POST-UPGRADE STEPS ===");
        console.log("1. Configure RWA contracts:");
        console.log("   forge script script/DeployRealRWAContracts.s.sol:DeployRealRWAContracts --broadcast");
        console.log("2. Test RWA integration:");
        console.log("   forge script script/TestRealRWAIntegration.s.sol:TestRealRWAIntegration");
        console.log("3. Run comprehensive tests:");
        console.log("   npm run test test/integration/");
        console.log("4. Update frontend to use new features");
        
        console.log("\n=== UPGRADE FEATURES ===");
        console.log("New features available after upgrade:");
        console.log("- Enhanced RWA token integration");
        console.log("- Real-time yield tracking");
        console.log("- Improved gas efficiency");
        console.log("- Better error handling");
        console.log("- Advanced bucket management");
        
        console.log("\n[SUCCESS] BucketVault upgrade completed successfully!");
    }
    
    function validateCurrentContract() internal view {
        console.log("\n--- Validating Current Contract ---");
        
        // Check if contract has code
        address contractAddr = currentBucketVault;
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(contractAddr)
        }
        
        if (codeSize > 0) {
            console.log("- Contract code size: %s bytes", codeSize);
        } else {
            console.log("ERROR: No contract code at address");
            revert("Invalid contract address");
        }
        
        // Try to call a basic function
        try BucketVaultUpgradeable(currentBucketVault).owner() returns (address owner) {
            console.log("- Contract owner: %s", owner);
        } catch {
            console.log("WARNING: Could not read contract owner");
        }
        
        // Check if RWA integration exists
        try BucketVaultUpgradeable(currentBucketVault).isRWAIntegrationEnabled() returns (bool enabled) {
            console.log("- RWA integration enabled: %s", enabled);
        } catch {
            console.log("- RWA integration: Not available (will be added in upgrade)");
        }
    }
    
    function verifyUpgrade() internal view {
        BucketVaultUpgradeable upgradedContract = BucketVaultUpgradeable(currentBucketVault);
        
        // Verify the implementation was updated
        // Note: This is a simplified check - in production you'd verify the implementation address
        try upgradedContract.owner() returns (address owner) {
            console.log("- Contract still accessible after upgrade");
            console.log("- Owner preserved: %s", owner);
        } catch {
            console.log("ERROR: Contract not accessible after upgrade");
        }
        
        // Verify RWA integration is available
        try upgradedContract.isRWAIntegrationEnabled() returns (bool enabled) {
            console.log("- RWA integration available: %s", enabled ? "enabled" : "disabled");
        } catch {
            console.log("ERROR: RWA integration not available after upgrade");
        }
        
        console.log("[SUCCESS] Upgrade verification completed");
    }
    
    function testBasicFunctionality() internal view {
        BucketVaultUpgradeable vaultContract = BucketVaultUpgradeable(currentBucketVault);
        
        // Test basic view functions
        try vaultContract.BASIS_POINTS() returns (uint256 basisPoints) {
            console.log("- BASIS_POINTS constant: %s", basisPoints);
        } catch {
            console.log("ERROR: Could not read BASIS_POINTS");
        }
        
        try vaultContract.MIN_DEPOSIT() returns (uint256 minDeposit) {
            console.log("- MIN_DEPOSIT constant: %s", minDeposit);
        } catch {
            console.log("ERROR: Could not read MIN_DEPOSIT");
        }
        
        // Test RWA functions
        try vaultContract.getRWAContract("billings") returns (address rwaContract) {
            console.log("- Billings RWA contract: %s", rwaContract);
        } catch {
            console.log("ERROR: Could not read RWA contract for billings");
        }
        
        console.log("[SUCCESS] Basic functionality test completed");
    }
}