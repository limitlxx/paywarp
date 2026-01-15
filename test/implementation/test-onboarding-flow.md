# Onboarding Flow Test Plan

## Test Scenarios

### 1. New User (Not Registered)
**Expected Flow:**
1. User clicks "Open App" → Wallet connects
2. System detects user is not registered
3. Shows registration form
4. After registration → Goes to syncing step
5. Syncs last 100 blocks (fast UX)
6. Shows wrapped page if activity found
7. Redirects to dashboard

### 2. Existing User (Already Registered)
**Expected Flow:**
1. User clicks "Open App" → Wallet connects
2. System detects user is already registered
3. **Directly redirects to dashboard** (no sync step)
4. User can manually sync more history from dashboard

### 3. User Without Wallet Connected
**Expected Behavior:**
- Shows community stats with user count
- Shows network switch option
- "Open App" button triggers wallet connection

### 4. Dashboard Features
**Available Actions:**
- "Sync More History" - syncs additional blocks
- "View Wrapped" - shows wrapped reports (if activity exists)
- Real transaction data displayed (not dummy data)
- Empty state for users with no transactions

## Key Improvements Made

1. **Separated Registration from Sync**: Registration and sync are now independent steps
2. **Fast Initial Sync**: Only syncs 100 recent blocks for new users (fast UX)
3. **Smart Routing**: Registered users skip directly to dashboard
4. **Progressive Sync**: Users can sync more history from dashboard
5. **Real Data**: Dashboard shows actual transaction data, not dummy data
6. **Better UX**: Shows sync progress with block count and transaction count
7. **Community Stats**: Always visible, even without wallet connection

## Sync Strategy

- **New Users**: Sync 100 recent blocks (fast onboarding)
- **Dashboard Refresh**: Sync more historical data incrementally
- **Cache Usage**: Leverages caching for faster subsequent loads
- **Error Handling**: Graceful fallbacks if sync fails