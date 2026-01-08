# Transaction Caching System

## Overview

The PayWarp transaction caching system provides efficient, offline-capable transaction history management with authentication-gated RPC access.

## Key Features

### 🔐 Authentication-Gated Sync
- **No RPC calls until user registration**: Prevents unnecessary network requests for unregistered users
- **Registration check**: Only registered users can access transaction history
- **Graceful fallback**: Shows registration prompt instead of errors

### 💾 Persistent Caching (IndexedDB)
- **Local storage**: Transactions stored in browser's IndexedDB
- **Offline capability**: Works without network connection using cached data
- **Cross-session persistence**: Data survives browser restarts
- **Efficient storage**: Optimized data structure for fast queries

### 🔄 Incremental Syncing
- **Smart updates**: Only fetches new blocks since last sync
- **Append-only**: New transactions added to existing cache
- **Block tracking**: Remembers last synced block number
- **Conservative limits**: Max 100 blocks per incremental sync

### ⚡ Performance Optimizations
- **Instant loading**: Cached data loads immediately
- **Background refresh**: New data synced in background
- **RPC efficiency**: Minimal network requests
- **Chunked requests**: Small block ranges to avoid RPC limits

## Usage

### Basic Transaction History
```typescript
import { useTransactionHistory } from '@/hooks/use-transaction-history'

function TransactionList() {
  const { 
    transactions, 
    isLoading, 
    fromCache, 
    refreshHistory 
  } = useTransactionHistory()

  // transactions automatically loaded from cache or fresh sync
  // fromCache indicates data source
}
```

### Manual Cache Management
```typescript
const { 
  clearCache, 
  getCacheInfo, 
  refreshHistory 
} = useTransactionHistory()

// Clear all cached data
await clearCache()

// Get cache statistics
const info = await getCacheInfo()

// Sync only new transactions
await refreshHistory()
```

### Cache Status Component
```typescript
import { TransactionCacheStatus } from '@/components/transaction-cache-status'

function SettingsPage() {
  return (
    <div>
      <TransactionCacheStatus />
    </div>
  )
}
```

## Data Flow

### 1. User Registration Check
```
User connects wallet → Check registration status → 
  ✅ Registered: Proceed to sync
  ❌ Not registered: Show registration prompt
```

### 2. Initial Load
```
Load from cache → Check cache age →
  🕐 Recent (< 1 hour): Use cached data
  ⏰ Stale: Fetch fresh data + update cache
```

### 3. Incremental Updates
```
User refreshes → Get last synced block →
  📦 New blocks available: Sync incrementally
  ✅ Up to date: No action needed
```

## Storage Structure

### IndexedDB Stores

#### `transactions`
- **Key**: Transaction ID
- **Indexes**: userAddress, chainId, blockNumber, timestamp
- **Data**: Serialized transaction objects

#### `syncMetadata`
- **Key**: [userAddress, chainId]
- **Data**: Last synced block, timestamps, counts

### Cache Metadata
```typescript
interface SyncMetadata {
  userAddress: string
  chainId: number
  lastSyncedBlock: string
  lastSyncedTimestamp: number
  totalTransactions: number
  lastUpdated: number
}
```

## RPC Optimization

### Conservative Block Limits
- **Initial sync**: 100 blocks max (≈3 hours of history)
- **Incremental sync**: 100 blocks max
- **Chunk size**: 5 blocks per request (Alchemy free tier safe)

### Error Handling
- **Alchemy free tier**: Automatic 5-block chunking
- **Content too large**: Aggressive chunk size reduction
- **Network errors**: Graceful fallback to cached data

### Fallback Strategy
```
Primary RPC fails → Try fallback RPCs → 
  All fail: Use cached data + show offline indicator
```

## Benefits

### For Users
- ⚡ **Instant loading** of transaction history
- 🌐 **Offline access** to previously synced data
- 📱 **Reduced data usage** with smart caching
- 🔄 **Automatic updates** in background

### For Developers
- 🚫 **No RPC spam** from unregistered users
- 💰 **Reduced API costs** with efficient caching
- 🛡️ **Error resilience** with offline fallbacks
- 📊 **Better UX** with instant data loading

### For Infrastructure
- 📉 **Lower RPC load** with cached data
- 🎯 **Targeted requests** only for registered users
- 🔧 **Easier debugging** with cache inspection tools
- 📈 **Scalable architecture** for growing user base

## Cache Management

### Automatic Cleanup
- Cache persists across sessions
- No automatic expiration (user controlled)
- Efficient storage with minimal overhead

### Manual Management
- **Clear cache**: Remove all stored data
- **Force refresh**: Bypass cache and fetch fresh
- **Cache info**: View storage statistics and metadata

### Troubleshooting
```typescript
// Clear cache if issues occur
await clearCache()

// Force fresh sync
await syncHistory({ forceSync: true, useCache: false })

// Check cache status
const info = await getCacheInfo()
console.log('Cache stats:', info)
```

## Migration Notes

### From Previous Version
- Old localStorage data automatically migrated
- No breaking changes to existing APIs
- Enhanced with new caching capabilities

### Future Improvements
- [ ] Cache compression for large datasets
- [ ] Selective cache clearing by date range
- [ ] Cross-device sync with user accounts
- [ ] Cache sharing between similar addresses