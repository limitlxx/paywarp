# Faucet BigInt Conversion Fix

## Problem
Users were getting "Cannot convert a BigInt value to a number" error when requesting USDC from the faucet page.

## Root Cause
The issue was caused by mixing `ethers` and `viem` utilities in the deposit service:
- Using `parseUnits` from `viem` which returns BigInt
- Using `ethers` contracts which also work with BigInt
- The BigInt comparison and operations were causing conversion errors

## Solution
1. **Removed viem dependency**: Replaced `parseUnits` from `viem` with `ethers.parseUnits`
2. **Consistent BigInt handling**: All amount parsing now uses ethers utilities
3. **Updated all instances**: Fixed all three occurrences of `parseUnits` in the deposit service

## Files Modified
- `lib/deposit-service.ts`: Updated imports and parseUnits usage

## Changes Made
```typescript
// Before (mixing viem and ethers)
import { parseUnits } from 'viem'
const amountWei = parseUnits(amount.toString(), decimals)

// After (consistent ethers usage)
const amountWei = ethers.parseUnits(amount.toString(), decimals)
```

## Testing
- Created `test-faucet-bigint-fix.js` to verify BigInt handling
- Tested actual faucet functionality with `test-faucet-fix.js`
- All BigInt operations now work correctly without conversion errors

## Result
✅ Faucet now works without BigInt conversion errors
✅ Users can successfully request USDC tokens
✅ All amount calculations handle BigInt properly