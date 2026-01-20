// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/MockUSDY.sol";
import "../contracts/MockMUSD.sol";
import "../contracts/MockUSDe.sol";
import "../contracts/MockmETH.sol";
import "../contracts/BucketVaultUpgradeable.sol";

/**
 * @title DeployAllRWAContracts
 * @dev Foundry script to deploy all Mock RWA contracts and configure BucketVault integration
 * 
 * Usage:
 * forge script script/DeployAllRWAContracts.s.sol:DeployAllRWAContracts --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --verify
 */
contract DeployAllRWAContracts is Script {
    // APY rates in basis points (4-12% range as per requirements)
    uint256 constant USDY_APY = 450;  // 4.5% for billings bucket
    uint256 constant MUSD_APY = 320;  // 3.2% for savings bucket  
    uint256 constant USDE_APY = 800;  // 8.0% for growth bucket
    uint256 constant METH_APY = 1000; // 10.0% for instant bucket

    // Test amounts for initialization
    uint256 constant TEST_MINT_AMOUNT = 1000e18; // 1000 tokens
    uint256 constant THIRTY_DAYS = 30 * 24 * 60 * 60; // 30 days in seconds
    uint256 constant MEV_REWARD_AMOUNT = 50e6; // 50 USDC worth of MEV rewards

    // Deployed contract addresses
    address public mockUSDY;
    address public mockMUSD;
    address public mockUSDe;
    address public mockMETH;
    address public bucketVault;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Deploying All Mock RWA Contracts ===");
        console.log("Deployer address:", deployer);
        console.log("Chain ID:", block.chainid);
        
        // Get BucketVault address from environment
        bucketVault = vm.envAddress("NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA");
        console.log("BucketVault address:", bucketVault);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDY (Billings bucket) with proxy
        console.log("\n--- Deploying MockUSDYUpgradeable ---");
        MockUSDYUpgradeable usdyImpl = new MockUSDYUpgradeable();
        bytes memory usdyInitData = abi.encodeWithSelector(
            MockUSDYUpgradeable.initialize.selector,
            "Mock Ondo US Dollar Yield",
            "USDY",
            USDY_APY,
            deployer
        );
        ERC1967Proxy usdyProxy = new ERC1967Proxy(address(usdyImpl), usdyInitData);
        mockUSDY = address(usdyProxy);
        console.log("MockUSDY deployed to:", mockUSDY);

        // Deploy MockMUSD (Savings bucket) with proxy
        console.log("\n--- Deploying MockMUSDUpgradeable ---");
        MockMUSDUpgradeable musdImpl = new MockMUSDUpgradeable();
        bytes memory musdInitData = abi.encodeWithSelector(
            MockMUSDUpgradeable.initialize.selector,
            "Mock Ondo Money Market USD",
            "mUSD",
            MUSD_APY,
            deployer
        );
        ERC1967Proxy musdProxy = new ERC1967Proxy(address(musdImpl), musdInitData);
        mockMUSD = address(musdProxy);
        console.log("MockMUSD deployed to:", mockMUSD);

        // Deploy MockUSDe (Growth bucket) with proxy
        console.log("\n--- Deploying MockUSDeUpgradeable ---");
        MockUSDeUpgradeable usdeImpl = new MockUSDeUpgradeable();
        bytes memory usdeInitData = abi.encodeWithSelector(
            MockUSDeUpgradeable.initialize.selector,
            "Mock Ethena USDe",
            "USDe",
            USDE_APY,
            deployer
        );
        ERC1967Proxy usdeProxy = new ERC1967Proxy(address(usdeImpl), usdeInitData);
        mockUSDe = address(usdeProxy);
        console.log("MockUSDe deployed to:", mockUSDe);

        // Deploy MockmETH (Instant bucket) with proxy
        console.log("\n--- Deploying MockmETHUpgradeable ---");
        MockmETHUpgradeable methImpl = new MockmETHUpgradeable();
        bytes memory methInitData = abi.encodeWithSelector(
            MockmETHUpgradeable.initialize.selector,
            "Mock Mantle Staked ETH",
            "mETH",
            METH_APY,
            deployer
        );
        ERC1967Proxy methProxy = new ERC1967Proxy(address(methImpl), methInitData);
        mockMETH = address(methProxy);
        console.log("MockmETH deployed to:", mockMETH);

        // Initialize contracts with test data
        console.log("\n--- Initializing Contracts ---");
        
        // Set APY rates (verify they're set correctly)
        MockUSDYUpgradeable(mockUSDY).updateAPY(USDY_APY);
        MockMUSDUpgradeable(mockMUSD).updateAPY(MUSD_APY);
        MockUSDeUpgradeable(mockUSDe).setApyBps(USDE_APY);
        MockmETHUpgradeable(mockMETH).setBaseStakingRate(600); // 6% base + 4% MEV = 10% total
        
        console.log("APY rates configured:");
        console.log("- USDY (Billings): 4.5%");
        console.log("- mUSD (Savings): 3.2%");
        console.log("- USDe (Growth): 8.0%");
        console.log("- mETH (Instant): 10.0%");

        // Mint initial tokens for testing
        MockUSDYUpgradeable(mockUSDY).emergencyMint(deployer, TEST_MINT_AMOUNT);
        MockMUSDUpgradeable(mockMUSD).emergencyMint(deployer, TEST_MINT_AMOUNT);
        MockUSDeUpgradeable(mockUSDe).emergencyMint(deployer, TEST_MINT_AMOUNT);
        MockmETHUpgradeable(mockMETH).emergencyMint(deployer, TEST_MINT_AMOUNT);
        
        console.log("Minted 1000 tokens of each type for testing");

        // Skip time simulation to avoid overflow issues
        console.log("\n--- Skipping Time Simulation ---");
        console.log("Time simulation skipped to avoid overflow issues");
        console.log("Contracts deployed with initial redemption values");

        // Get updated redemption values
        uint256 usdyRedemptionValue = MockUSDYUpgradeable(mockUSDY).redemptionValue();
        uint256 musdRedemptionValue = MockMUSDUpgradeable(mockMUSD).redemptionValue();
        uint256 usdeRedemptionValue = MockUSDeUpgradeable(mockUSDe).redemptionValue();
        uint256 methRedemptionValue = MockmETHUpgradeable(mockMETH).redemptionValue();
        
        console.log("\nRedemption values after deployment:");
        console.log("- USDY:", usdyRedemptionValue);
        console.log("- mUSD:", musdRedemptionValue);
        console.log("- USDe:", usdeRedemptionValue);
        console.log("- mETH:", methRedemptionValue);

        // Configure BucketVault RWA integration
        console.log("\n--- Configuring BucketVault RWA Integration ---");
        
        // Note: BucketVault configuration will be done in a separate script
        // to handle potential permission issues gracefully
        console.log("BucketVault configuration will be done separately");
        console.log("Run: forge script script/ConfigureBucketVaultRWA.s.sol:ConfigureBucketVaultRWA --rpc-url $MANTLE_SEPOLIA_RPC --broadcast");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: Mantle Sepolia (Chain ID: 5003)");
        
        console.log("\nDeployed Contracts:");
        console.log("- MockUSDY:", mockUSDY);
        console.log("- MockMUSD:", mockMUSD);
        console.log("- MockUSDe:", mockUSDe);
        console.log("- MockmETH:", mockMETH);

        console.log("\n=== ENVIRONMENT VARIABLES ===");
        console.log("Add these to your .env file:");
        console.log("NEXT_PUBLIC_MOCK_USDY_SEPOLIA=", mockUSDY);
        console.log("NEXT_PUBLIC_MOCK_MUSD_SEPOLIA=", mockMUSD);
        console.log("NEXT_PUBLIC_MOCK_USDE_SEPOLIA=", mockUSDe);
        console.log("NEXT_PUBLIC_MOCK_METH_SEPOLIA=", mockMETH);

        console.log("\n=== MANUAL BUCKET VAULT CONFIGURATION ===");
        console.log("If automatic configuration failed, run these commands:");
        console.log("cast send", bucketVault, '"setRWAContract(string,address)"');
        console.log("  billings:", mockUSDY);
        console.log("cast send", bucketVault, '"setRWAContract(string,address)"');
        console.log("  savings:", mockMUSD);
        console.log("cast send", bucketVault, '"setRWAContract(string,address)"');
        console.log("  growth:", mockUSDe);
        console.log("cast send", bucketVault, '"setRWAContract(string,address)"');
        console.log("  instant:", mockMETH);
        console.log("cast send", bucketVault, '"setRWAIntegrationEnabled(bool)" true');

        console.log("\n=== VERIFICATION COMMANDS ===");
        console.log("forge verify-contract", mockUSDY, "contracts/MockUSDY.sol:MockUSDYUpgradeable");
        console.log("forge verify-contract", mockMUSD, "contracts/MockMUSD.sol:MockMUSDUpgradeable");
        console.log("forge verify-contract", mockUSDe, "contracts/MockUSDe.sol:MockUSDeUpgradeable");
        console.log("forge verify-contract", mockMETH, "contracts/MockmETH.sol:MockmETHUpgradeable");

        console.log("\n=== TESTING COMMANDS ===");
        console.log("Test RWA integration:");
        console.log("forge script script/TestRWAIntegration.s.sol:TestRWAIntegration");
        console.log("Run integration tests:");
        console.log("npm run test test/integration/rwa-deployed-contracts.integration.test.ts");

        console.log("\n[SUCCESS] All RWA contracts deployment completed successfully!");
    }

    // Helper function to get deployment addresses (for use in other scripts)
    function getDeployedAddresses() external view returns (
        address _mockUSDY,
        address _mockMUSD, 
        address _mockUSDe,
        address _mockMETH
    ) {
        return (mockUSDY, mockMUSD, mockUSDe, mockMETH);
    }
}