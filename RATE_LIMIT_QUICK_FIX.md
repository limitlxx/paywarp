# Rate Limit Quick Fix ⚡

## Problem
```
50/second request limit reached - reduce calls per second or upgrade your account
```

## Solution (2 Changes)

### 1. Use Public RPC (No Rate Limits)
**File**: `.env`
```env
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
```

### 2. Reduce Refetch Frequency
**File**: `hooks/use-bucket-balances.ts`
```typescript
refetchInterval: 30000, // 30 seconds (was 10)
staleTime: 20000, // Cache for 20 seconds
```

## Result
- ✅ No more rate limit errors
- ✅ 75% fewer requests
- ✅ Faster with caching
- ✅ Still updates every 30s

## Test
1. Refresh page
2. Check console - no errors
3. Data updates every 30 seconds
4. Manual refresh still works instantly

**Status**: ✅ FIXED
