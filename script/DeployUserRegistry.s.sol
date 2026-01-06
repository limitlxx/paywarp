// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/UserRegistryUpgradeable.sol";

/**
 * @title DeployUserRegistry
 * @dev Script to deploy upgradeable UserRegistry contract
 */
contract DeployUserRegistry is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying UserRegistry with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the implementation contract
        UserRegistryUpgradeable implementation = new UserRegistryUpgradeable();
        console.log("UserRegistry implementation deployed at:", address(implementation));

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            UserRegistryUpgradeable.initialize.selector,
            deployer // initialOwner
        );

        // Deploy the proxy contract
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            initData
        );
        
        console.log("UserRegistry proxy deployed at:", address(proxy));
        
        // Verify the deployment
        UserRegistryUpgradeable userRegistry = UserRegistryUpgradeable(address(proxy));
        console.log("Contract owner:", userRegistry.owner());
        console.log("Contract version:", userRegistry.getVersion());
        console.log("Total users:", userRegistry.getTotalUsers());

        vm.stopBroadcast();

        // Save deployment info
        string memory deploymentInfo = string.concat(
            "UserRegistry Deployment Info:\n",
            "Implementation: ", vm.toString(address(implementation)), "\n",
            "Proxy: ", vm.toString(address(proxy)), "\n",
            "Owner: ", vm.toString(deployer), "\n",
            "Network: ", vm.toString(block.chainid), "\n"
        );
        
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log(deploymentInfo);
    }
}