# Chainlink Automation Manual Setup Guide

## ✅ Contract Setup Complete

Your PayrollEngine contract is now fully configured for Chainlink automation:

- **Contract Address**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
- **Version**: 1.1.0
- **Automation Registry**: ✅ Configured
- **Keepers**: ✅ Authorized
- **Status**: ✅ Ready for automation

## Step-by-Step Manual Setup

### Step 1: Visit Chainlink Automation Dashboard

1. Go to [https://automation.chain.link/](https://automation.chain.link/)
2. Connect your wallet (use the same wallet that owns the contract)
3. Select **Mantle Sepolia** network

### Step 2: Create Automation Subscription

1. Click **"Create new subscription"**
2. Choose a subscription name: `PayWarp Payroll Automation`
3. Fund your subscription with LINK tokens:
   - Minimum: **5 LINK** (recommended: 10-20 LINK for testing)
   - You can get Sepolia LINK from [Chainlink Faucet](https://faucets.chain.link/)

### Step 3: Register New Upkeep

1. Click **"Register new Upkeep"**
2. Select **"Custom logic"** as trigger type
3. Fill in the details:

**Basic Information:**
- **Target contract address**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
- **Upkeep name**: `PayWarp Payroll Processor`
- **Gas limit**: `500000`
- **Starting balance**: `5 LINK`

**Trigger Configuration:**
- **Trigger type**: Custom logic
- **Check data**: `0x` (leave empty)

**Advanced Settings:**
- **Admin address**: Your wallet address
- **Check gas limit**: `200000`
- **Call gas limit**: `500000`

4. Click **"Register Upkeep"**

### Step 4: Verify Registration

After registration, you should see:
- ✅ Upkeep created successfully
- ✅ LINK balance showing in upkeep
- ✅ Status: Active

## Testing the Setup

### Add Test Employees

You can add employees through the PayWarp UI or using the test script:

```bash
node scripts/test-payroll-system.js
```

### Schedule Test Payroll

1. Go to PayWarp app → Instant Bucket → Actions → Payroll Manager
2. Add a test employee
3. Schedule a payroll for a few minutes in the future
4. Watch the Chainlink dashboard for automation triggers

### Monitor Automation

1. **Chainlink Dashboard**: Monitor upkeep performance
2. **Contract Events**: Watch for `PayrollProcessed` events
3. **Employee Balances**: Verify payments are executed

## Troubleshooting

### Common Issues

1. **Upkeep not triggering**
   - Check LINK balance in subscription
   - Verify contract has scheduled payrolls
   - Ensure sufficient USDC balance in contract

2. **Registration fails**
   - Verify you're on Mantle Sepolia network
   - Check wallet connection
   - Ensure sufficient LINK for registration

3. **Payments fail**
   - Fund contract with USDC
   - Check employee addresses are valid
   - Verify gas limits are sufficient

### Getting LINK Tokens (Sepolia)

1. **Chainlink Faucet**: [https://faucets.chain.link/](https://faucets.chain.link/)
2. **Bridge from Ethereum**: Use official bridges
3. **DEX**: Swap other tokens for LINK

### Getting USDC (Sepolia)

The contract needs USDC to pay employees:

```bash
# Check current balance
cast call 0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8 "balanceOf(address)" 0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4 --rpc-url https://rpc.sepolia.mantle.xyz

# Fund contract (if you have USDC)
cast send 0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8 "transfer(address,uint256)" 0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4 1000000000 --rpc-url https://rpc.sepolia.mantle.xyz --private-key $PRIVATE_KEY
```

## Expected Automation Flow

1. **Employee Added**: Via PayWarp UI
2. **Payroll Scheduled**: Set future date/time
3. **Chainlink Monitors**: `checkUpkeep` called regularly
4. **Automation Triggers**: When payroll date arrives
5. **Payment Executed**: `performUpkeep` processes payments
6. **Confirmation**: Events emitted, balances updated

## Monitoring & Maintenance

### Key Metrics to Watch

- **LINK Balance**: Keep subscription funded
- **USDC Balance**: Ensure sufficient for payrolls
- **Gas Usage**: Monitor costs per execution
- **Success Rate**: Track payment success

### Regular Tasks

- **Weekly**: Check LINK balance
- **Monthly**: Review automation performance
- **Before Payroll**: Verify USDC balance
- **After Payroll**: Confirm all payments processed

## Support Resources

- **Chainlink Docs**: [https://docs.chain.link/chainlink-automation](https://docs.chain.link/chainlink-automation)
- **Discord**: [https://discord.gg/chainlink](https://discord.gg/chainlink)
- **PayWarp Docs**: `docs/CHAINLINK_AUTOMATION_SETUP.md`

---

## 🎯 Quick Checklist

- [ ] Visit automation.chain.link
- [ ] Create subscription with LINK
- [ ] Register upkeep with contract address
- [ ] Add test employee
- [ ] Schedule test payroll
- [ ] Monitor dashboard for execution
- [ ] Fund contract with USDC for real payrolls

**Contract Ready**: ✅ `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`
**Network**: Mantle Sepolia
**Status**: Automation Ready 🚀