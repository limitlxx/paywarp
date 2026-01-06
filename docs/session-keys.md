# Session Key Automation System

The Session Key Automation System provides limited-permission signing capabilities for automated transactions with configurable limits, expiration, and revocation handling.

## Overview

Session keys enable users to automate small transactions without repeatedly signing each one, while maintaining strict security boundaries through:

- **Transaction amount limits** - Maximum per-transaction and daily spending limits
- **Time boundaries** - Automatic expiration after configured duration
- **Contract allowlists** - Only approved contracts can be called
- **Method restrictions** - Only specific contract methods are allowed
- **Immediate revocation** - Users can instantly disable session keys

## Core Components

### 1. SessionKeyManager (`lib/session-keys.ts`)

The core service that manages session key creation, validation, and execution:

```typescript
const sessionManager = new SessionKeyManager(chainId)

// Create a session key
const sessionId = sessionManager.createSessionKey({
  maxTransactionAmount: BigInt('1000000000000000000'), // 1 token
  maxDailyAmount: BigInt('10000000000000000000'), // 10 tokens
  maxTransactionCount: 50,
  expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  allowedContracts: [bucketVaultAddress],
  allowedMethods: ['depositAndSplit', 'transferBetweenBuckets'],
  requireUserConfirmation: false,
  emergencyRevocation: true
})
```

### 2. useSessionKeys Hook (`hooks/use-session-keys.ts`)

React hook for session key management in components:

```typescript
const {
  createStandardSessionKey,
  executeAutomatedTransaction,
  revokeSessionKey,
  activeSessionKeys,
  isAutomationEnabled,
  enableAutomation
} = useSessionKeys()

// Create a standard session key
const sessionId = await createStandardSessionKey(
  'standard', // micro | standard | highValue
  24, // hours
  [bucketVaultAddress, payrollEngineAddress]
)
```

### 3. SessionKeyManager Component (`components/session-key-manager.tsx`)

UI component for managing session keys in the settings page:

- Create new session keys with different security levels
- View active session keys and their usage statistics
- Monitor daily limits and transaction counts
- Revoke session keys immediately
- Enable/disable automation globally

## Security Boundaries

### Transaction Limits

Session keys enforce multiple layers of transaction limits:

1. **Per-transaction limit** - Maximum amount for any single transaction
2. **Daily amount limit** - Maximum total amount per 24-hour period
3. **Daily transaction count** - Maximum number of transactions per day

### Time Boundaries

- **Expiration time** - Session keys automatically expire after configured duration
- **Creation time** - Tracks when session key was created
- **Usage tracking** - Records all transactions with timestamps

### Access Control

- **Contract allowlist** - Only approved contract addresses can be called
- **Method allowlist** - Only specific contract methods are permitted
- **Immediate revocation** - Users can instantly disable session keys

## Default Configurations

### Micro Transactions
- Max per transaction: 1 token
- Max daily amount: 10 tokens
- Max daily transactions: 50
- Allowed methods: `transfer`, `approve`
- Use case: Small automated actions

### Standard Operations
- Max per transaction: 100 tokens
- Max daily amount: 1,000 tokens
- Max daily transactions: 20
- Allowed methods: `depositAndSplit`, `transferBetweenBuckets`, `withdraw`
- Use case: Regular bucket operations

### High Value Operations
- Max per transaction: 10,000 tokens
- Max daily amount: 100,000 tokens
- Max daily transactions: 5
- Allowed methods: `processPayroll`, `batchTransfer`
- Requires user confirmation: Yes
- Use case: Payroll and large operations

## Usage Examples

### Creating a Session Key for Bucket Operations

```typescript
import { useSessionKeys } from '@/hooks/use-session-keys'
import { useContracts } from '@/lib/contracts'

function BucketAutomation() {
  const { createStandardSessionKey } = useSessionKeys()
  const { bucketVaultAddress } = useContracts()
  
  const enableAutomation = async () => {
    const sessionId = await createStandardSessionKey(
      'standard',
      24, // 24 hours
      [bucketVaultAddress]
    )
    
    console.log('Session key created:', sessionId)
  }
}
```

### Executing Automated Transactions

```typescript
import { useAutomatedBucketOperations } from '@/lib/session-key-integration'

function AutomatedDeposit() {
  const { automatedDeposit } = useAutomatedBucketOperations()
  
  const handleAutomatedDeposit = async (sessionId: string, amount: bigint) => {
    try {
      const result = await automatedDeposit({
        sessionId,
        amount,
        onSuccess: (hash) => console.log('Transaction successful:', hash),
        onError: (error) => console.error('Transaction failed:', error)
      })
    } catch (error) {
      console.error('Automation failed:', error)
    }
  }
}
```

### Monitoring Session Key Usage

```typescript
function SessionKeyMonitor({ sessionId }: { sessionId: string }) {
  const { getSessionStatistics, checkTransactionLimits } = useSessionKeys()
  
  const stats = getSessionStatistics(sessionId)
  const limits = checkTransactionLimits(sessionId, amount, contract, method)
  
  return (
    <div>
      <p>Total transactions: {stats?.totalTransactions}</p>
      <p>Total spent: {formatEther(stats?.totalAmountSpent || 0n)}</p>
      <p>Can execute: {limits.canExecuteTransaction ? 'Yes' : 'No'}</p>
      <p>Remaining daily amount: {formatEther(limits.remainingDailyAmount)}</p>
    </div>
  )
}
```

## Integration with Existing Systems

### Bucket Operations

Session keys integrate with the existing bucket system to enable:
- Automated deposits with fund splitting
- Scheduled transfers between buckets
- Automated yield harvesting
- Goal-based savings automation

### Payroll Management

Session keys enable automated payroll operations:
- Scheduled payroll execution
- Automated employee onboarding
- Batch payment processing
- Emergency payroll handling

### Error Handling

The system provides comprehensive error handling:
- Limit exceeded notifications
- Expiration warnings
- Revocation confirmations
- Transaction failure recovery

## Security Considerations

1. **Private Key Management** - Session keys generate new private keys that are stored securely
2. **Limit Enforcement** - All limits are enforced at the smart contract level
3. **Audit Trail** - All session key usage is logged and trackable
4. **Emergency Revocation** - Users can immediately disable session keys
5. **Expiration Handling** - Automatic cleanup of expired session keys

## Testing

The system includes comprehensive property-based tests that verify:
- Transaction amount limits are enforced correctly
- Daily limits accumulate properly
- Session expiration is handled correctly
- Revocation is immediate and permanent
- Contract and method allowlists are strictly enforced

Run tests with:
```bash
npm test session-key-security.property.test.ts
```

## Future Enhancements

Potential improvements to the session key system:
- Hardware wallet integration for enhanced security
- Multi-signature session keys for team operations
- Conditional automation based on market conditions
- Integration with external automation services
- Advanced scheduling and recurring operations