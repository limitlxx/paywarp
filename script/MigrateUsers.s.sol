// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../contracts/UserRegistry.sol";
import "../contracts/UserRegistryUpgradeable.sol";

/**
 * @title MigrateUsers
 * @dev Script to migrate users from old UserRegistry to new upgradeable version
 */
contract MigrateUsers is Script {
    
    struct UserData {
        address user;
        uint256 registrationDate;
        bytes32 messageHash;
        bytes signature;
    }
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Get contract addresses from environment
        address oldRegistryAddress = vm.envAddress("OLD_USER_REGISTRY");
        address newRegistryAddress = vm.envAddress("NEW_USER_REGISTRY");
        
        console.log("Migrating users from:", oldRegistryAddress);
        console.log("To new registry at:", newRegistryAddress);
        
        UserRegistry oldRegistry = UserRegistry(oldRegistryAddress);
        UserRegistryUpgradeable newRegistry = UserRegistryUpgradeable(newRegistryAddress);
        
        // Get total users from old contract
        uint256 totalUsers = oldRegistry.getTotalUsers();
        console.log("Total users to migrate:", totalUsers);
        
        if (totalUsers == 0) {
            console.log("No users to migrate");
            return;
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Note: This is a simplified migration script
        // In a real scenario, you would need to:
        // 1. Get a list of all registered users (requires events or off-chain indexing)
        // 2. Batch migrate users in chunks to avoid gas limits
        // 3. Verify migration success
        
        console.log("Migration would require off-chain indexing of UserRegistered events");
        console.log("Use the batchRegisterUsers function on the new contract");
        
        vm.stopBroadcast();
        
        console.log("Migration script completed");
        console.log("Manual steps required:");
        console.log("1. Index UserRegistered events from old contract");
        console.log("2. Call batchRegisterUsers on new contract with user data");
    }
    
    /**
     * @dev Helper function to migrate a batch of users
     * This would be called with actual user data from events
     */
    function migrateBatch(
        address newRegistryAddress,
        UserData[] memory users
    ) public {
        UserRegistryUpgradeable newRegistry = UserRegistryUpgradeable(newRegistryAddress);
        
        address[] memory addresses = new address[](users.length);
        uint256[] memory dates = new uint256[](users.length);
        bytes32[] memory hashes = new bytes32[](users.length);
        bytes[] memory signatures = new bytes[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            addresses[i] = users[i].user;
            dates[i] = users[i].registrationDate;
            hashes[i] = users[i].messageHash;
            signatures[i] = users[i].signature;
        }
        
        newRegistry.batchRegisterUsers(addresses, dates, hashes, signatures);
    }
}