# Managed Wallet Operations Guide

This guide explains how to use the managed wallet to interact with the BucketVault contract and process Paystack deposits.

## Overview

The managed wallet is a server-side wallet that can:
- Initialize contract state for new users
- Process Paystack deposits by depositing USDC into buckets
- Manage bucket configurations
- Transfer funds between buckets
- View bucket balances and status

## Prerequisites

- Node.js 18+ installed
- `.env` file configured with:
  - `MANAGED_WALLET_PRIVATE_KEY` - Private key of the managed wallet
  - `MANAGED_WALLET_ADDRESS` - Address of the managed wallet
  - `NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA` - BucketVault contract address
  - `NEXT_PUBLIC_USDC_TOKEN_SEPOLIA` - USDC token address
  - `NEXT_PUBLIC_MANTLE_SEPOLIA_RPC` - Mantle Sepolia RPC URL

## Available Scripts

### 1. Initialize Contract State

**Purpose**: Set up initial state for the managed wallet (split config, approve USDC, make first deposit)

```bash
node scripts/initialize-contract-state.js
```

**What it does**:
- Checks wallet balance and USDC balance
- Sets default split configuration (20/30/20/20/10)
- Approves USDC spending for the BucketVault
- Makes an initial 100 USDC deposit to initialize buckets
- Verifies all bucket balances

**When to use**: Run this once when first setting up the managed wallet.

### 2. Managed Wallet Operations

**Purpose**: Perform various operations with the managed wallet

```bash
node scripts/managed-wallet-operations.js <operation> [args]
```

#### Available Operations:

##### Check Status
```bash
node scripts/managed-wallet-operations.js status
```
Shows:
- Wallet address
- MNT balance (for gas)
- USDC balance
- Contract version
- Current split configuration
- USDC allowance

##### Make a Deposit
```bash
node scripts/managed-wallet-operations.js deposit <amount>
```
Example:
```bash
node scripts/managed-wallet-operations.js deposit 100
```
- Deposits specified amount of USDC
- Automatically splits into buckets based on current config
- Shows updated bucket balances

##### Update Split Configuration
```bash
node scripts/managed-wallet-operations.js update-config <billings> <savings> <growth> <instant> <spendable>
```
Example:
```bash
node scripts/managed-wallet-operations.js update-config 25 25 25 15 10
```
- All percentages must sum to 100
- Updates the split configuration for future deposits

##### View Bucket Balances
```bash
node scripts/managed-wallet-operations.js view-buckets
```
- Shows balance in each bucket
- Shows total balance across all buckets

##### Transfer Between Buckets
```bash
node scripts/managed-wallet-operations.js transfer <from> <to> <amount>
```
Example:
```bash
node scripts/managed-wallet-operations.js transfer savings growth 50
```
- Transfers specified amount from one bucket to another
- Shows updated balances for both buckets

### 3. Process Paystack Deposits

**Purpose**: Handle deposits from Paystack payments

```bash
node scripts/process-paystack-deposit.js <mode> <userAddress> <amount> [reference]
```

#### Modes:

##### Transfer Mode (Recommended)
```bash
node scripts/process-paystack-deposit.js transfer 0x123... 100 PAYSTACK-REF-123
```
- Transfers USDC from managed wallet to user's address
- User then deposits into their own buckets using their config
- More secure and gives user control

##### Deposit Mode
```bash
node scripts/process-paystack-deposit.js deposit 0x123... 50.5 PAYSTACK-REF-456
```
- Deposits directly into managed wallet's buckets
- Uses managed wallet's split configuration
- Faster but less flexible

**Parameters**:
- `mode`: Either "transfer" or "deposit"
- `userAddress`: User's Ethereum address (must be valid)
- `amount`: Amount of USDC to process (e.g., "100" or "50.5")
- `reference`: Optional Paystack reference for tracking

## Integration with Backend

### Paystack Webhook Handler

When a Paystack payment is successful, your webhook handler should:

1. Verify the payment with Paystack
2. Calculate the USDC amount (convert NGN to USD, then to USDC)
3. Call the process-paystack-deposit script

Example Node.js integration:

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function handlePaystackWebhook(event) {
  if (event.event === 'charge.success') {
    const { reference, amount, customer } = event.data;
    const userAddress = customer.metadata.walletAddress;
    
    // Convert NGN to USDC (example: 1 USD = 1500 NGN, 1 USDC = 1 USD)
    const ngnAmount = amount / 100; // Paystack amount is in kobo
    const usdcAmount = ngnAmount / 1500; // Adjust exchange rate
    
    // Process the deposit
    const { stdout, stderr } = await execAsync(
      `node scripts/process-paystack-deposit.js transfer ${userAddress} ${usdcAmount} ${reference}`
    );
    
    console.log('Deposit processed:', stdout);
    
    // Parse the result
    const result = JSON.parse(stdout.split('Result:')[1]);
    
    if (result.success) {
      // Update your database
      await saveTransaction({
        userAddress,
        amount: usdcAmount,
        txHash: result.txHash,
        paystackReference: reference,
        status: 'completed'
      });
    }
  }
}
```

## Troubleshooting

### "Insufficient USDC balance"
- Check managed wallet USDC balance: `node scripts/managed-wallet-operations.js status`
- Top up the managed wallet with USDC from your faucet or exchange

### "Insufficient MNT for gas"
- Check MNT balance: `node scripts/managed-wallet-operations.js status`
- Send MNT to the managed wallet for gas fees

### "Split configuration not set"
- Run: `node scripts/initialize-contract-state.js`
- Or manually set config: `node scripts/managed-wallet-operations.js update-config 20 30 20 20 10`

### "Transaction failed"
- Check Mantle Sepolia network status
- Verify contract addresses in `.env`
- Check transaction on Mantlescan: https://sepolia.mantlescan.xyz/

### "Invalid Ethereum address"
- Ensure user address is a valid Ethereum address (starts with 0x, 42 characters)
- Check for typos or extra spaces

## Security Best Practices

1. **Never commit the private key**: Keep `MANAGED_WALLET_PRIVATE_KEY` in `.env` only
2. **Use environment variables**: Never hardcode sensitive data
3. **Monitor the wallet**: Set up alerts for low balances
4. **Limit permissions**: Only give necessary permissions to the managed wallet
5. **Regular audits**: Review transactions regularly
6. **Backup**: Keep secure backups of the private key
7. **Rate limiting**: Implement rate limiting on deposit endpoints
8. **Validation**: Always validate user addresses and amounts

## Monitoring

### Daily Checks
```bash
# Check wallet status
node scripts/managed-wallet-operations.js status

# View bucket balances
node scripts/managed-wallet-operations.js view-buckets
```

### Set Up Alerts
- Low MNT balance (< 10 MNT)
- Low USDC balance (< 1000 USDC)
- Failed transactions
- Unusual deposit patterns

## Example Workflow

### Initial Setup
```bash
# 1. Initialize the managed wallet
node scripts/initialize-contract-state.js

# 2. Verify status
node scripts/managed-wallet-operations.js status

# 3. View initial buckets
node scripts/managed-wallet-operations.js view-buckets
```

### Processing a Paystack Deposit
```bash
# User pays 150,000 NGN via Paystack
# Exchange rate: 1 USD = 1500 NGN
# USDC amount: 150,000 / 1500 = 100 USDC

# Process the deposit
node scripts/process-paystack-deposit.js transfer 0xUserAddress 100 PAYSTACK-REF-12345

# Verify the transaction
node scripts/managed-wallet-operations.js view-buckets
```

### Regular Maintenance
```bash
# Check status daily
node scripts/managed-wallet-operations.js status

# Rebalance if needed
node scripts/managed-wallet-operations.js transfer billings growth 50

# Update config if needed
node scripts/managed-wallet-operations.js update-config 25 25 25 15 10
```

## Contract State Memory

The BucketVault contract stores the following state for each user:

### Split Configuration
- `billingsPercent`: Percentage for billings bucket (in basis points, 100 = 1%)
- `savingsPercent`: Percentage for savings bucket
- `growthPercent`: Percentage for growth bucket
- `instantPercent`: Percentage for instant bucket
- `spendablePercent`: Percentage for spendable bucket

### Bucket Balances
For each bucket (billings, savings, growth, instant, spendable):
- `balance`: Current balance in USDC
- `yieldBalance`: Accumulated yield (if yielding)
- `isYielding`: Whether the bucket is earning yield
- `lastYieldUpdate`: Timestamp of last yield update

### Other State
- `userNonces`: Transaction nonce for each user
- `userGoalCount`: Number of savings goals created
- `userSavingsGoals`: Mapping of goal ID to goal details

## API Reference

### BucketVault Contract Functions

#### Read Functions
- `getSplitConfig(address user)`: Get user's split configuration
- `getBucketBalance(address user, string bucket)`: Get bucket balance
- `version()`: Get contract version

#### Write Functions
- `setSplitConfig(SplitConfig config)`: Set split configuration
- `depositAndSplit(uint256 amount)`: Deposit and split into buckets
- `transferBetweenBuckets(string from, string to, uint256 amount)`: Transfer between buckets
- `withdrawFromBucket(string bucket, uint256 amount)`: Withdraw from bucket

## Support

For issues or questions:
- Check the troubleshooting section above
- Review contract events on Mantlescan
- Check logs in the console output
- Contact the development team

## Version History

- **v1.0.0** (2025-01-15): Initial release
  - Initialize contract state
  - Managed wallet operations
  - Paystack deposit processing
