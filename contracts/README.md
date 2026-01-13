# PayWarp Smart Contracts

This directory contains the smart contracts for the PayWarp Web3 integration.

## Contracts

### BucketVault.sol
Core contract managing automated fund splitting across budget buckets with savings goals.

**Features:**
- Automated percentage-based fund allocation across 5 buckets (Billings, Savings, Growth, Instant, Spendable)
- Savings goals with fund locking and bonus APY rewards
- Bucket transfer functionality with rule enforcement
- Integration with RWA yield-bearing tokens (USDY/mUSD)
- Automatic overflow handling from Billings to Growth bucket

**Key Functions:**
- `setSplitConfig()` - Configure percentage allocation for buckets
- `depositAndSplit()` - Deposit funds and automatically split across buckets
- `transferBetweenBuckets()` - Transfer funds between buckets with rule validation
- `createSavingsGoal()` - Create locked savings goals with target amounts and dates
- `withdrawFromBucket()` - Withdraw funds from buckets (with restrictions)

### PayrollEngine.sol
Automated payroll processing contract with Chainlink automation integration.

**Features:**
- Employee management with wallet addresses and payment schedules
- Automated batch payroll processing
- Atomic transaction handling (all payments succeed or all fail)
- Integration with BucketVault for fund deduction
- Comprehensive payment history and tracking

**Key Functions:**
- `addEmployee()` - Add employees to payroll system
- `schedulePayroll()` - Schedule payroll batches for future processing
- `processPayroll()` - Execute payroll batch (called by automation)
- `getUpcomingPayrolls()` - View scheduled payroll batches
- `getPayrollHistory()` - View completed payroll history

## Deployment

### Prerequisites
1. Set up environment variables in `.env.local`:
   ```
   PRIVATE_KEY=your_private_key_here
   NEXT_PUBLIC_MANTLE_MAINNET_RPC=https://rpc.mantle.xyz
   NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
   ```

### Deploy to Mantle Sepolia (Testnet)
```bash
npm run deploy:sepolia
```

### Deploy to Mantle Mainnet
```bash
npm run deploy:mainnet
```

### Manual Deployment
```bash
npx hardhat run scripts/deploy.js --network mantleTestnet
npx hardhat run scripts/deploy.js --network mantleMainnet
```

## Testing

### Property-Based Tests
The contracts include comprehensive property-based tests using fast-check:

```bash
# Run auto-split mathematical correctness tests
npm test -- test/contracts/BucketVault.property.test.ts

# Run payroll execution integrity tests
npm test -- test/contracts/PayrollEngine.property.test.ts
```

### Test Coverage
- **Auto-Split Mathematical Correctness**: Validates that fund splitting preserves amounts and respects percentages
- **Payroll Execution Integrity**: Ensures atomic payroll processing with proper fund management

## Integration

### Frontend Integration
The contracts are integrated with the frontend through:
- `lib/contracts.ts` - Contract interaction hooks and utilities
- `lib/networks.ts` - Network configuration and contract addresses
- `types/contracts/` - TypeScript interfaces for contract interactions

### Contract Addresses
After deployment, update the following environment variables:

**Sepolia Testnet:**
```
NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA=0x...
NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA=0x...
NEXT_PUBLIC_USDY_TOKEN_SEPOLIA=0x...
NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA=0x...
```

**Mainnet:**
```
NEXT_PUBLIC_BUCKET_VAULT_MAINNET=0x...
NEXT_PUBLIC_PAYROLL_ENGINE_MAINNET=0x...
NEXT_PUBLIC_USDY_TOKEN_MAINNET=0x...
NEXT_PUBLIC_MUSD_TOKEN_MAINNET=0x...
```

## Security Considerations

1. **Access Control**: Contracts use OpenZeppelin's Ownable for administrative functions
2. **Reentrancy Protection**: All state-changing functions use ReentrancyGuard
3. **Input Validation**: Comprehensive validation of all user inputs
4. **Atomic Operations**: Payroll processing ensures all-or-nothing execution
5. **Fund Safety**: Multiple safeguards prevent unauthorized fund access

## Gas Optimization

- Efficient storage patterns to minimize gas costs
- Batch operations for payroll processing
- Optimized loops and calculations
- Strategic use of events for off-chain indexing

## Upgradeability

The current contracts are not upgradeable by design for security and immutability. Future versions would require new deployments and migration processes.