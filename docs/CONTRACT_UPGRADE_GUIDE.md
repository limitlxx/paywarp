# PayrollEngine Contract Upgrade Guide

## Overview

This guide explains how to upgrade the PayrollEngine contract to add Chainlink automation support and fix the contract structure issues.

## What's New in v1.1.0

### ✅ Added Features
- **Chainlink Automation**: `checkUpkeep` and `performUpkeep` functions
- **Version Tracking**: Contract version function for better upgrade management
- **Code Cleanup**: Removed duplicate functions and improved structure

### 🔧 Technical Improvements
- Fixed contract compilation issues
- Updated ABI with new automation functions
- Improved error handling and validation
- Enhanced documentation and comments

## Upgrade Methods

### Method 1: Using Foundry (Recommended)

1. **Compile the updated contract**:
   ```bash
   forge build
   ```

2. **Run the upgrade script**:
   ```bash
   # For Sepolia testnet
   forge script script/UpgradePayrollEngine.s.sol --rpc-url $MANTLE_SEPOLIA_RPC --broadcast --verify

   # For Mainnet (when ready)
   forge script script/UpgradePayrollEngine.s.sol --rpc-url $MANTLE_MAINNET_RPC --broadcast --verify
   ```

3. **Verify the upgrade**:
   ```bash
   node scripts/upgrade-payroll-foundry.js
   ```

### Method 2: Using Node.js Script

1. **Run the interactive upgrade script**:
   ```bash
   node scripts/upgrade-payroll-foundry.js
   ```

2. **Follow the prompts** to select network and confirm upgrade

## Pre-Upgrade Checklist

### ✅ Environment Setup
- [ ] Private key configured in `.env`
- [ ] RPC endpoints configured
- [ ] Sufficient ETH for gas fees
- [ ] Contract addresses verified

### ✅ Safety Checks
- [ ] Backup current contract state
- [ ] Verify you're the contract owner
- [ ] Test on Sepolia before mainnet
- [ ] Confirm no active payroll processing

### ✅ Dependencies
- [ ] Foundry installed and updated
- [ ] Node.js and npm/yarn available
- [ ] OpenZeppelin contracts available

## Upgrade Process

### Step 1: Pre-Upgrade Verification

```bash
# Check current contract status
cast call $PAYROLL_ENGINE_ADDRESS "version()" --rpc-url $RPC_URL
cast call $PAYROLL_ENGINE_ADDRESS "owner()" --rpc-url $RPC_URL
cast call $PAYROLL_ENGINE_ADDRESS "paused()" --rpc-url $RPC_URL
```

### Step 2: Deploy New Implementation

The upgrade script will:
1. Compile the new contract
2. Deploy new implementation
3. Upgrade the proxy
4. Verify the upgrade

### Step 3: Post-Upgrade Verification

```bash
# Verify new version
cast call $PAYROLL_ENGINE_ADDRESS "version()" --rpc-url $RPC_URL

# Test Chainlink functions
cast call $PAYROLL_ENGINE_ADDRESS "checkUpkeep(bytes)" "0x" --rpc-url $RPC_URL
```

## Contract Addresses

### Current Deployment (v1.0.0)
- **Sepolia**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
- **Mainnet**: Not deployed yet

### After Upgrade (v1.1.0)
- **Proxy Address**: Remains the same
- **Implementation**: New address (logged during upgrade)

## New Functions Added

### Chainlink Automation

```solidity
/**
 * @dev Chainlink checkUpkeep function
 * @param checkData Encoded data (not used)
 * @return upkeepNeeded True if upkeep is needed
 * @return performData Encoded data for performUpkeep
 */
function checkUpkeep(bytes calldata checkData) 
    external 
    view 
    returns (bool upkeepNeeded, bytes memory performData);

/**
 * @dev Chainlink performUpkeep function
 * @param performData Encoded data from checkUpkeep
 */
function performUpkeep(bytes calldata performData) external;
```

### Version Tracking

```solidity
/**
 * @dev Get contract version
 * @return Version string (e.g., "1.1.0")
 */
function version() external pure returns (string memory);
```

## Frontend Updates

### ABI Update
The ABI has been automatically updated in `lib/abis/PayrollEngine.json` with the new functions.

### Hook Updates
The `useTeamManagement` hook already supports the new functions and will work seamlessly with the upgraded contract.

## Testing the Upgrade

### 1. Basic Functionality Test
```bash
node scripts/test-payroll-system.js
```

### 2. Chainlink Automation Test
```bash
node scripts/setup-chainlink-automation.js
```

### 3. Manual Verification
```javascript
// Test in browser console or Node.js
const contract = new ethers.Contract(address, abi, provider)

// Check version
const version = await contract.version()
console.log('Version:', version)

// Test checkUpkeep
const [upkeepNeeded, performData] = await contract.checkUpkeep('0x')
console.log('Upkeep needed:', upkeepNeeded)
```

## Rollback Plan

If issues occur, you can rollback by:

1. **Deploy previous implementation**:
   ```bash
   # Deploy v1.0.0 implementation
   forge create PayrollEngineV1 --rpc-url $RPC_URL --private-key $PRIVATE_KEY
   ```

2. **Upgrade back to previous version**:
   ```bash
   cast send $PROXY_ADDRESS "upgradeToAndCall(address,bytes)" $OLD_IMPLEMENTATION "0x" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
   ```

## Troubleshooting

### Common Issues

1. **"Not the owner" Error**
   - Verify you're using the correct private key
   - Check the owner address: `cast call $ADDRESS "owner()"`

2. **"Insufficient funds" Error**
   - Add more ETH to the deployer account
   - Check gas prices and adjust accordingly

3. **"Contract not found" Error**
   - Verify the proxy address is correct
   - Ensure you're on the right network

4. **ABI Mismatch**
   - Update the ABI file: `jq '.abi' out/PayrollEngineUpgradeable.sol/PayrollEngineUpgradeable.json > lib/abis/PayrollEngine.json`
   - Restart your frontend application

### Getting Help

1. **Check logs**: Review the upgrade script output
2. **Verify on explorer**: Check transactions on Mantle explorer
3. **Test functions**: Use cast to test individual functions
4. **Contact support**: Reach out if issues persist

## Post-Upgrade Tasks

### ✅ Immediate Tasks
- [ ] Verify upgrade success
- [ ] Test basic payroll functions
- [ ] Update frontend if needed
- [ ] Configure Chainlink automation

### ✅ Follow-up Tasks
- [ ] Monitor contract performance
- [ ] Set up automation monitoring
- [ ] Update documentation
- [ ] Notify team of new features

## Security Notes

- **Proxy Pattern**: The upgrade preserves all existing data
- **Access Control**: Only the owner can upgrade the contract
- **Testing**: Always test on testnet first
- **Monitoring**: Monitor the contract after upgrade

---

**Status**: Ready for upgrade
**Version**: v1.0.0 → v1.1.0
**Impact**: Low risk, additive changes only
**Downtime**: None (seamless upgrade)