// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/ExpenseTrackerUpgradeable.sol";

contract DeployExpenseTracker is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying ExpenseTrackerUpgradeable...");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance / 1e18, "ETH");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the implementation contract
        console.log("Deploying implementation contract...");
        ExpenseTrackerUpgradeable implementation = new ExpenseTrackerUpgradeable();
        
        // Encode the initializer function call
        bytes memory initData = abi.encodeWithSelector(
            ExpenseTrackerUpgradeable.initialize.selector
        );
        
        // Deploy the proxy contract
        console.log("Deploying proxy contract...");
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        
        vm.stopBroadcast();
        
        console.log("ExpenseTracker deployed successfully!");
        console.log("Proxy Address:", address(proxy));
        console.log("Implementation Address:", address(implementation));
        console.log("Chain ID:", block.chainid);
        
        // Deployment info (manual save required)
        console.log("Save these addresses:");
        console.log("EXPENSE_TRACKER_PROXY=", address(proxy));
        console.log("EXPENSE_TRACKER_IMPL=", address(implementation));
        
        // Instructions
        console.log("To verify the contracts:");
        console.log("forge verify-contract", address(implementation), "contracts/ExpenseTrackerUpgradeable.sol:ExpenseTrackerUpgradeable --chain mantle_sepolia");
        
        console.log("Add to your .env file:");
        if (block.chainid == 5000) {
            console.log("NEXT_PUBLIC_EXPENSE_TRACKER_MAINNET=", address(proxy));
        } else {
            console.log("NEXT_PUBLIC_EXPENSE_TRACKER_SEPOLIA=", address(proxy));
        }
    }
}