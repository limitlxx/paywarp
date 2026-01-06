// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/BucketVaultUpgradeable.sol";
import "../contracts/PayrollEngineUpgradeable.sol";
import "../contracts/MockERC20.sol";
import "../contracts/MockUSDY.sol";
import "../contracts/MockMUSD.sol";
import "../contracts/UserRegistry.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC (6 decimals)
        MockERC20 mockUSDC = new MockERC20("Mock USDC", "USDC", 6);
        console.log("Mock USDC deployed at:", address(mockUSDC));

        // Deploy Mock USDY (18 decimals, 4.5% APY)
        MockUSDY mockUSDY = new MockUSDY("Mock USDY", "USDY", 450);
        console.log("Mock USDY deployed at:", address(mockUSDY));

        // Deploy Mock mUSD (18 decimals, 3.2% APY)
        MockMUSD mockMUSD = new MockMUSD("Mock mUSD", "mUSD", 320);
        console.log("Mock mUSD deployed at:", address(mockMUSD));

        // Deploy BucketVault implementation
        BucketVaultUpgradeable bucketVaultImpl = new BucketVaultUpgradeable();
        console.log("BucketVault implementation deployed at:", address(bucketVaultImpl));

        // Deploy BucketVault proxy
        bytes memory bucketVaultInitData = abi.encodeWithSelector(
            BucketVaultUpgradeable.initialize.selector,
            address(mockUSDC),
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
            address(mockUSDC),
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

        // Configure BucketVault
        BucketVaultUpgradeable bucketVault = BucketVaultUpgradeable(address(bucketVaultProxy));
        bucketVault.setYieldToken(address(mockUSDY));
        console.log("BucketVault configured with USDY token");

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Mantle Sepolia");
        console.log("Deployer:", deployer);
        console.log("Mock USDC:", address(mockUSDC));
        console.log("Mock USDY:", address(mockUSDY));
        console.log("Mock mUSD:", address(mockMUSD));
        console.log("BucketVault Proxy:", address(bucketVaultProxy));
        console.log("PayrollEngine Proxy:", address(payrollEngineProxy));
        console.log("UserRegistry:", address(userRegistry));
        console.log("========================");
    }
}