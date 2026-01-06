// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/BucketVaultUpgradeable.sol";
import "../contracts/PayrollEngineUpgradeable.sol";
import "../contracts/UserRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployMainnetScript is Script {
    // Mainnet USDC address (you'll need to update this with actual Mantle mainnet USDC)
    address constant MAINNET_USDC = 0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9; // Mantle USDC
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts to MAINNET with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy BucketVault implementation
        BucketVaultUpgradeable bucketVaultImpl = new BucketVaultUpgradeable();
        console.log("BucketVault implementation deployed at:", address(bucketVaultImpl));

        // Deploy BucketVault proxy
        bytes memory bucketVaultInitData = abi.encodeWithSelector(
            BucketVaultUpgradeable.initialize.selector,
            MAINNET_USDC,
            deployer
        );
        
        ERC1967Proxy bucketVaultProxy = new ERC1967Proxy(
            address(bucketVaultImpl),
            bucketVaultInitData
        );
        console.log("BucketVault proxy deployed at:", address(bucketVaultProxy));

        // Deploy PayrollEngine implementation
        PayrollEngineUpgradeable payrollEngineImpl = new PayrollEngineUpgradeable();
        console.log("PayrollEngine implementation deployed at:", address(payrollEngineImpl));

        // Deploy PayrollEngine proxy
        bytes memory payrollEngineInitData = abi.encodeWithSelector(
            PayrollEngineUpgradeable.initialize.selector,
            MAINNET_USDC,
            address(bucketVaultProxy),
            deployer
        );
        
        ERC1967Proxy payrollEngineProxy = new ERC1967Proxy(
            address(payrollEngineImpl),
            payrollEngineInitData
        );
        console.log("PayrollEngine proxy deployed at:", address(payrollEngineProxy));

        // Deploy UserRegistry
        UserRegistry userRegistry = new UserRegistry();
        console.log("UserRegistry deployed at:", address(userRegistry));

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== MAINNET DEPLOYMENT SUMMARY ===");
        console.log("Network: Mantle Mainnet");
        console.log("Deployer:", deployer);
        console.log("USDC Token:", MAINNET_USDC);
        console.log("BucketVault Proxy:", address(bucketVaultProxy));
        console.log("PayrollEngine Proxy:", address(payrollEngineProxy));
        console.log("UserRegistry:", address(userRegistry));
        console.log("==================================");
    }
}