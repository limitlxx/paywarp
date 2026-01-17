// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PayrollEngineUpgradeable} from "../contracts/PayrollEngineUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract UpgradePayrollEngine is Script {
    // Contract addresses by network
    address constant SEPOLIA_PROXY = 0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4;
    address constant MAINNET_PROXY = address(0); // To be set when deployed

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        // Determine proxy address based on chain ID
        address proxyAddress;
        if (block.chainid == 5003) { // Mantle Sepolia
            proxyAddress = SEPOLIA_PROXY;
            console.log("Using Sepolia proxy:", proxyAddress);
        } else if (block.chainid == 5000) { // Mantle Mainnet
            proxyAddress = MAINNET_PROXY;
            console.log("Using Mainnet proxy:", proxyAddress);
            require(proxyAddress != address(0), "Mainnet proxy not set");
        } else {
            revert("Unsupported network");
        }

        vm.startBroadcast(deployerPrivateKey);

        // Get the current proxy contract
        PayrollEngineUpgradeable proxy = PayrollEngineUpgradeable(proxyAddress);
        
        // Check current version
        try proxy.version() returns (string memory currentVersion) {
            console.log("Current version:", currentVersion);
        } catch {
            console.log("Current version: Unknown (pre-versioning)");
        }

        // Deploy new implementation
        console.log("Deploying new PayrollEngine implementation...");
        PayrollEngineUpgradeable newImplementation = new PayrollEngineUpgradeable();
        console.log("New implementation deployed at:", address(newImplementation));

        // Upgrade the proxy
        console.log("Upgrading proxy to new implementation...");
        proxy.upgradeToAndCall(address(newImplementation), "");
        
        // Verify upgrade
        string memory newVersion = proxy.version();
        console.log("Upgraded to version:", newVersion);
        
        // Test new Chainlink functions
        console.log("Testing Chainlink automation functions...");
        try proxy.checkUpkeep("") returns (bool upkeepNeeded, bytes memory performData) {
            console.log("checkUpkeep working - Upkeep needed:", upkeepNeeded);
            console.log("Perform data length:", performData.length);
        } catch Error(string memory reason) {
            console.log("checkUpkeep test failed:", reason);
        }

        vm.stopBroadcast();

        console.log("\n=== Upgrade Summary ===");
        console.log("Proxy Address:", proxyAddress);
        console.log("New Implementation:", address(newImplementation));
        console.log("New Version:", newVersion);
        console.log("Chainlink Functions: Added");
        console.log("Status: SUCCESS");
    }
}