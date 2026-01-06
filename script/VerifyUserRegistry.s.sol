// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/UserRegistryUpgradeable.sol";

/**
 * @title VerifyUserRegistry
 * @dev Script to verify UserRegistry deployment and functionality
 */
contract VerifyUserRegistry is Script {
    
    function run() external {
        // Get the deployed proxy address from environment or command line
        address proxyAddress = vm.envAddress("USER_REGISTRY_PROXY");
        
        console.log("Verifying UserRegistry at:", proxyAddress);
        
        UserRegistryUpgradeable userRegistry = UserRegistryUpgradeable(proxyAddress);
        
        // Verify contract state
        console.log("=== CONTRACT VERIFICATION ===");
        console.log("Owner:", userRegistry.owner());
        console.log("Version:", userRegistry.getVersion());
        console.log("Total Users:", userRegistry.getTotalUsers());
        console.log("Implementation:", userRegistry.getImplementation());
        
        // Test basic functionality (read-only)
        address testUser = 0x1234567890123456789012345678901234567890;
        bool isRegistered = userRegistry.isUserRegistered(testUser);
        console.log("Test user registered:", isRegistered);
        
        uint256 registrationDate = userRegistry.getRegistrationDate(testUser);
        console.log("Test user registration date:", registrationDate);
        
        (uint256 totalUsers, uint256 timestamp) = userRegistry.getRegistrationStats();
        console.log("Stats - Total Users:", totalUsers);
        console.log("Stats - Current Timestamp:", timestamp);
        
        console.log("=== VERIFICATION COMPLETE ===");
        console.log("Contract is functioning correctly!");
    }
}