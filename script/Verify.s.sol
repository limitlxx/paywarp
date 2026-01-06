// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

contract VerifyScript is Script {
    function run() external {
        // Contract addresses from deployment
        address mockUSDC = 0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8;
        address mockUSDY = 0xCE6C8F97241f455A3498711C28D468A50559673f;
        address mockMUSD = 0xA61F1287B3aC96D7B6ab75e6190DEcaad68Ad641;
        address bucketVaultImpl = 0x89c70d73C6F02DFf40Ee0c3b2Ccf5e9D4ED62871;
        address bucketVaultProxy = 0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825;
        address payrollEngineImpl = 0x0bF6e5d289151E7Ac34f8c746df65e38aA9BC0De;
        address payrollEngineProxy = 0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4;
        address userRegistry = 0x88ffe6b6D0eD0C45278d65b83eB3CaeBbfcff0b5;

        console.log("=== CONTRACT VERIFICATION COMMANDS ===");
        console.log("");
        
        console.log("# Mock USDC");
        console.log("forge verify-contract", mockUSDC, "contracts/MockERC20.sol:MockERC20");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("--constructor-args $(cast abi-encode \"constructor(string,string,uint8)\" \"Mock USDC\" \"USDC\" 6)");
        console.log("");
        
        console.log("# Mock USDY");
        console.log("forge verify-contract", mockUSDY, "contracts/MockUSDY.sol:MockUSDY");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("--constructor-args $(cast abi-encode \"constructor(string,string,uint256)\" \"Mock USDY\" \"USDY\" 450)");
        console.log("");
        
        console.log("# Mock mUSD");
        console.log("forge verify-contract", mockMUSD, "contracts/MockMUSD.sol:MockMUSD");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("--constructor-args $(cast abi-encode \"constructor(string,string,uint256)\" \"Mock mUSD\" \"mUSD\" 320)");
        console.log("");
        
        console.log("# BucketVault Implementation");
        console.log("forge verify-contract", bucketVaultImpl, "contracts/BucketVaultUpgradeable.sol:BucketVaultUpgradeable");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("");
        
        console.log("# PayrollEngine Implementation");
        console.log("forge verify-contract", payrollEngineImpl, "contracts/PayrollEngineUpgradeable.sol:PayrollEngineUpgradeable");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("");
        
        console.log("# UserRegistry");
        console.log("forge verify-contract", userRegistry, "contracts/UserRegistry.sol:UserRegistry");
        console.log("--chain-id 5003 --etherscan-api-key $MANTLESCAN_API_KEY");
        console.log("--verifier-url https://explorer.sepolia.mantle.xyz/api");
        console.log("");
        
        console.log("=== PROXY VERIFICATION (Manual) ===");
        console.log("BucketVault Proxy:", bucketVaultProxy);
        console.log("PayrollEngine Proxy:", payrollEngineProxy);
        console.log("Note: Proxy contracts need to be verified manually on the explorer");
    }
}