# Chainlink Automation Setup for PayWarp Payroll System

This guide explains how to configure Chainlink Automation to automatically process payroll payments for the PayWarp system.

## Overview

The PayWarp payroll system uses Chainlink Automation to automatically execute scheduled payroll batches. This ensures timely and reliable salary payments without manual intervention.

## Prerequisites

1. **Deployed PayrollEngine Contract**: Ensure your PayrollEngine contract is deployed and initialized
2. **USDC Funding**: The contract must have sufficient USDC balance to cover payroll payments
3. **Chainlink Subscription**: You need a Chainlink Automation subscription with LINK tokens

## Contract Addresses

### Sepolia Testnet
- **PayrollEngine**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
- **USDC Token**: `0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8`

### Mainnet (To be deployed)
- **PayrollEngine**: `TBD`
- **USDC Token**: `TBD`

## Step 1: Create Chainlink Automation Subscription

1. Visit [Chainlink Automation](https://automation.chain.link/)
2. Connect your wallet
3. Select the appropriate network (Sepolia for testing)
4. Click "Create new subscription"
5. Fund your subscription with LINK tokens

## Step 2: Register Upkeep for Payroll Processing

### Method 1: Using Chainlink UI (Recommended)

1. Go to your Chainlink Automation dashboard
2. Click "Register new Upkeep"
3. Select "Custom logic" as the trigger type
4. Fill in the following details:

**Basic Information:**
- **Target contract address**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
- **Upkeep name**: `PayWarp Payroll Processor`
- **Gas limit**: `500000` (adjust based on batch size)
- **Starting balance**: `5 LINK` (minimum)

**Trigger Configuration:**
- **Check data**: `0x` (empty bytes)
- **Trigger type**: Custom logic

### Method 2: Programmatic Registration

```javascript
// Register upkeep programmatically
const registrationParams = {
  name: "PayWarp Payroll Processor",
  encryptedEmail: "0x", // Optional
  upkeepContract: "0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4",
  gasLimit: 500000,
  adminAddress: "YOUR_ADMIN_ADDRESS",
  triggerType: 0, // Conditional trigger
  checkData: "0x",
  triggerConfig: "0x",
  offchainConfig: "0x",
  amount: ethers.utils.parseEther("5") // 5 LINK
}

// Call registerUpkeep on the AutomationRegistrar contract
```

## Step 3: Configure Contract Permissions

The PayrollEngine contract needs to authorize Chainlink keepers to process payrolls:

```solidity
// Call this function on your deployed contract
function setAuthorizedKeeper(address keeper, bool authorized) external onlyOwner
```

**Chainlink Keeper Addresses:**

### Sepolia Testnet
- Keeper 1: `0x02777053d6764996e594c3E88AF1D58D5363a2e6`
- Keeper 2: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

### Mainnet
- Check [Chainlink Documentation](https://docs.chain.link/chainlink-automation/overview/supported-networks) for current keeper addresses

## Step 4: Implement Automation Logic

The PayrollEngine contract already includes the necessary automation logic:

### checkUpkeep Function
```solidity
function checkUpkeep(bytes calldata checkData) 
    external 
    view 
    returns (bool upkeepNeeded, bytes memory performData) 
{
    // Check if any payroll batches are ready for processing
    // Returns true if automation should trigger
}
```

### performUpkeep Function
```solidity
function performUpkeep(bytes calldata performData) external {
    // Process the payroll batch
    // Called by Chainlink keepers when checkUpkeep returns true
}
```

## Step 5: Fund the Contract

Ensure your PayrollEngine contract has sufficient USDC to cover payroll payments:

```javascript
// Transfer USDC to the PayrollEngine contract
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer)
await usdcContract.transfer(PAYROLL_ENGINE_ADDRESS, amount)
```

## Step 6: Monitor and Maintain

### Monitoring Dashboard

1. **Chainlink Automation Dashboard**: Monitor upkeep performance and LINK balance
2. **Contract Events**: Listen for `PayrollProcessed` events
3. **Balance Monitoring**: Ensure sufficient USDC and LINK balances

### Key Metrics to Monitor

- **Upkeep Performance**: Success rate and gas usage
- **LINK Balance**: Ensure subscription has sufficient LINK
- **USDC Balance**: Monitor contract USDC balance
- **Failed Payments**: Track and resolve failed payroll executions

## Troubleshooting

### Common Issues

1. **Upkeep Not Triggering**
   - Check LINK balance in subscription
   - Verify keeper authorization
   - Ensure checkUpkeep logic is correct

2. **Payroll Processing Fails**
   - Insufficient USDC balance
   - Gas limit too low
   - Employee address issues

3. **High Gas Costs**
   - Reduce batch size
   - Optimize contract logic
   - Adjust gas limit

### Emergency Procedures

1. **Pause Automation**
   ```solidity
   // Call pause function to stop all payroll processing
   payrollEngine.pause()
   ```

2. **Manual Processing**
   ```solidity
   // Process payroll manually if automation fails
   payrollEngine.processPayroll(employer, batchId)
   ```

3. **Emergency Withdrawal**
   ```solidity
   // Withdraw funds in emergency
   payrollEngine.emergencyWithdraw(amount)
   ```

## Security Considerations

1. **Access Control**: Only authorized keepers can process payrolls
2. **Reentrancy Protection**: Contract includes reentrancy guards
3. **Pause Mechanism**: Emergency pause functionality
4. **Rate Limiting**: Maximum batch sizes and processing limits

## Cost Estimation

### LINK Costs (Sepolia)
- **Registration**: ~0.1 LINK
- **Per Execution**: ~0.01-0.05 LINK (depending on gas usage)
- **Monthly Estimate**: ~1-5 LINK (for weekly payrolls)

### Gas Costs
- **Single Payment**: ~50,000 gas
- **Batch of 10**: ~300,000 gas
- **Batch of 50**: ~1,200,000 gas

## Testing

### Test Scenarios

1. **Schedule Test Payroll**
   ```javascript
   // Schedule a small test payroll
   const testDate = Math.floor(Date.now() / 1000) + 300 // 5 minutes from now
   await payrollEngine.schedulePayroll(testDate)
   ```

2. **Monitor Execution**
   - Watch for `PayrollScheduled` event
   - Verify automation triggers
   - Check `PayrollProcessed` event

3. **Verify Payments**
   - Check employee wallet balances
   - Verify transaction hashes
   - Confirm payment records

## Support and Resources

- **Chainlink Documentation**: https://docs.chain.link/chainlink-automation
- **Discord Support**: https://discord.gg/chainlink
- **GitHub Issues**: Report bugs and feature requests

## Next Steps

1. Deploy and test on Sepolia testnet
2. Configure automation with small test batches
3. Monitor performance and optimize
4. Deploy to mainnet with production settings
5. Set up comprehensive monitoring and alerting

---

**Note**: Always test thoroughly on testnet before deploying to mainnet. Keep sufficient LINK and USDC balances to ensure uninterrupted service.