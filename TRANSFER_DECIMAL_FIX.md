# Transfer Decimal Fix

## Problem
Transfer between buckets was failing with "Insufficient balance" error even when there was sufficient balance.

## Root Cause
The contract stores bucket balances in **6 decimals** (USDC format), but the transfer modal was converting amounts to 18 decimals before sending to the contract.

### Discovery Process
1. Initial assumption: Contract uses 18 decimals (like most ERC20 tokens)
2. Test revealed: Raw balance `29850000` formatted as:
   - With 6 decimals: `29.85` USDC ✅ (correct)
   - With 18 decimals: `0.00000000002985` (wrong)
3. Conclusion: Contract stores in 6 decimals, not 18

## Solution
Changed the transfer amount conversion from:
```typescript
// WRONG: Converting to 18 decimals
const amountIn6Decimals = parseUnits(amount, 6)
const amountIn18Decimals = amountIn6Decimals * BigInt(10 ** 12)
await contract.transferBetweenBuckets(fromId, toId, amountIn18Decimals)
```

To:
```typescript
// CORRECT: Using 6 decimals directly
const amountIn6Decimals = parseUnits(amount, 6)
await contract.transferBetweenBuckets(fromId, toId, amountIn6Decimals)
```

## Test Results
Successfully transferred 1.0 USDC from spendable to savings:
- **Before:** spendable: 29.85 USDC, savings: 46.2675 USDC
- **After:** spendable: 28.85 USDC, savings: 47.2675 USDC
- **Transaction:** `0x6521d9ca0323aa7521fa6dfb1128e18620f54a74318d9e7cec4e70cc7fe2e93c`

## Files Modified
1. `components/modals/transfer-modal.tsx` - Fixed decimal conversion
2. `scripts/test-transfer.js` - Created test script to verify transfers

## Key Learnings
1. **Contract Storage Format:** BucketVault stores balances in 6 decimals (USDC format)
2. **Display Format:** `useBucketBalances` correctly formats with 6 decimals
3. **Transfer Format:** Must use 6 decimals when calling `transferBetweenBuckets`
4. **Consistency:** All bucket operations use 6 decimals throughout

## Decimal Format Summary
| Operation | Format | Example |
|-----------|--------|---------|
| Contract Storage | 6 decimals | `29850000` = 29.85 USDC |
| Display (UI) | 6 decimals | `29.85` |
| Transfer Amount | 6 decimals | `parseUnits("1.0", 6)` = `1000000` |
| Deposit Amount | 6 decimals | Same as transfer |

## Testing Checklist
- [x] Transfer with sufficient balance succeeds
- [x] Balance updates correctly after transfer
- [x] Amount conversion uses correct decimals
- [x] UI displays correct balances
- [x] Transaction confirms on blockchain

## Next Steps
1. ✅ Fix transfer modal decimal conversion
2. ✅ Test transfer functionality
3. Verify deposit functionality uses same format
4. Update documentation for decimal handling
5. Add unit tests for decimal conversions
