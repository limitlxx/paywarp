# Debug Guide: Bucket Allocation Contract Calls

## The Fix Applied ✅

The issue was that the contract expects values in **basis points** (where 10000 = 100%), but we were sending raw percentages (where 100 = 100%).

### Before Fix ❌
```typescript
// Sending raw percentages
billingsPercent: BigInt(30)  // Should be 3000
savingsPercent: BigInt(25)   // Should be 2500
// Total: 100 (contract expects 10000)
```

### After Fix ✅
```typescript
// Sending basis points (percentage * 100)
billingsPercent: BigInt(30 * 100)  // = 3000
savingsPercent: BigInt(25 * 100)   // = 2500
// Total: 10000 (contract expects 10000)
```

## How to Verify the Fix 🔍

### 1. Check Browser Console
When you save bucket settings, you should see debug logs like:
```
Split config being sent to contract: {
  billings: "3000 basis points (30%)",
  savings: "2500 basis points (25%)",
  growth: "2000 basis points (20%)",
  instant: "1500 basis points (15%)",
  spendable: "1000 basis points (10%)",
  totalBasisPoints: 10000,
  totalPercentage: 100
}
```

### 2. Verify Your Current Settings
Before saving, make sure your bucket percentages sum to exactly 100%:

**Example Working Configuration:**
- Billings: 30%
- Growth: 25% 
- Savings: 20%
- Instant: 15%
- Spendable: 10%
- **Total: 100%** ✅

### 3. Test Different Scenarios

**Scenario A: All Buckets Enabled**
```
Billings: 30% → 3000 basis points
Growth: 25% → 2500 basis points  
Savings: 20% → 2000 basis points
Instant: 15% → 1500 basis points
Spendable: 10% → 1000 basis points
Total: 10000 basis points ✅
```

**Scenario B: One Bucket Disabled**
```
Billings: 33% → 3300 basis points
Growth: 28% → 2800 basis points
Savings: 22% → 2200 basis points  
Instant: 17% → 1700 basis points
Spendable: 0% (disabled) → 0 basis points
Total: 10000 basis points ✅
```

## Troubleshooting Steps 🛠️

### If You Still Get the Error:

1. **Check the Console Logs**
   - Open browser dev tools (F12)
   - Go to Console tab
   - Try saving settings
   - Look for the debug log showing basis points

2. **Verify Percentage Math**
   - Make sure enabled buckets sum to exactly 100%
   - Use the auto-balance feature if needed
   - Check for decimal/rounding issues

3. **Test with Simple Values**
   Try this configuration first:
   ```
   Billings: 50%
   Growth: 30%
   Savings: 20%
   Others: 0% (disabled)
   Total: 100%
   ```

4. **Check Network/Contract**
   - Verify you're on the correct network (Mantle Sepolia)
   - Check that the contract address is correct
   - Ensure your wallet has enough gas

### Expected Contract Call
The transaction should call `setSplitConfig` with these parameters:
```solidity
setSplitConfig({
  billingsPercent: 3000,    // 30% in basis points
  savingsPercent: 2500,     // 25% in basis points  
  growthPercent: 2000,      // 20% in basis points
  instantPercent: 1500,     // 15% in basis points
  spendablePercent: 1000    // 10% in basis points
})
```

## Quick Test Commands 🧪

Run these in your project directory to test the logic:

```bash
# Test the redistribution logic
node test-bucket-allocation-fix.js

# Test exact contract call simulation  
node test-contract-call.js
```

Both should show "✅ YES" for contract validation.

## What Changed in the Code 📝

### 1. Basis Points Conversion
```typescript
// OLD: Raw percentages
billingsPercent: BigInt(percentage)

// NEW: Convert to basis points  
billingsPercent: BigInt(percentage * 100)
```

### 2. Loading from Contract
```typescript
// OLD: Use raw values from contract
percentage = Number(splitConfig.billingsPercent)

// NEW: Convert basis points back to percentage
percentage = Number(splitConfig.billingsPercent) / 100
```

### 3. Validation Check
```typescript
// OLD: Check for 100
if (totalContractPercentage !== 100)

// NEW: Check for 10000 basis points
if (totalContractPercentage !== 10000)
```

## Success Indicators ✅

You'll know the fix worked when:

1. **No Console Errors**: The debug log shows 10000 total basis points
2. **Transaction Succeeds**: The blockchain transaction completes successfully  
3. **Settings Persist**: Your bucket allocations are saved and reload correctly
4. **Contract State**: You can verify the contract state shows your percentages

## Still Having Issues? 🆘

If you're still getting the error after this fix:

1. **Share the Console Log**: Copy the debug output from browser console
2. **Check Transaction Details**: Look at the failed transaction on the block explorer
3. **Verify Contract Version**: Make sure you're using the latest contract deployment
4. **Test with Minimal Config**: Try with just 2 buckets (50%/50%) to isolate the issue

The fix should resolve the "Split percentages must sum to 100%" error by correctly converting UI percentages to contract basis points! 🎉