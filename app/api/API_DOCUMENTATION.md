limitlxx# PayWarp API Documentation

Complete reference for PayWarp's backend API routes and smart contract interfaces.

---

## 📚 Table of Contents

1. [REST API Endpoints](#rest-api-endpoints)
2. [Smart Contract ABIs](#smart-contract-abis)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Error Handling](#error-handling)
6. [Webhooks](#webhooks)

---

## 🌐 REST API Endpoints

Base URL: `https://paywarp.vercel.app/api`

### OCR Endpoints

#### POST /api/ocr/extract-receipt-enhanced

Extract comprehensive data from receipt images using AI-powered OCR.

**Request:**

```typescript
{
  imageBase64: string;      // Base64-encoded image
  mimeType: string;         // "image/jpeg" | "image/png" | "image/webp"
  extractionMode?: string;  // "comprehensive" | "basic" (default: "comprehensive")
}
```

**Response:**

```typescript
{
  success: boolean;
  structuredData: {
    merchant: string;
    total: number;
    currency: string;
    date: string;           // ISO 8601 format
    items?: Array<{
      name: string;
      price: number;
      quantity: number;
    }>;
    location?: {
      address: string;
      city: string;
      state: string;
      zipCode: string;
    };
    contact?: {
      phone: string;
      email: string;
      website: string;
    };
    payment?: {
      method: string;
      lastFour: string;
    };
    subtotal?: number;
    tax?: number;
      tip?: number;
    discount?: number;
  };
  confidence: number;       // 0-1 confidence score
  processedAt: string;      // ISO 8601 timestamp
  ocrMode: "gemini" | "tesseract";
}
```

**Example:**

```bash
curl -X POST https://paywarp.vercel.app/api/ocr/extract-receipt-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "mimeType": "image/jpeg",
    "extractionMode": "comprehensive"
  }'
```

**Rate Limit**: 100 requests per 15 minutes per IP

---

#### POST /api/ocr/extract-receipt

Legacy endpoint for basic receipt extraction (backward compatibility).

**Request:**

```typescript
{
  imageBase64: string;
  mimeType: string;
}
```

**Response:**

```typescript
{
  success: boolean;
  data: {
    merchant: string;
    amount: number;
    date: string;
    currency: string;
  };
  confidence: number;
}
```

---

### Price Feed Endpoints

#### GET /api/price/mnt-usd

Get current MNT/USD price from Chainlink oracle.

**Response:**

```typescript
{
  price: number;            // MNT price in USD
  timestamp: number;        // Unix timestamp
  source: "chainlink";
  decimals: number;         // Price decimals (usually 8)
}
```

**Example:**

```bash
curl https://paywarp.vercel.app/api/price/mnt-usd
```

---

#### GET /api/price/usd-ngn

Get current USD/NGN forex rate from CoinMarketCap.

**Response:**

```typescript
{
  rate: number;             // USD to NGN conversion rate
  timestamp: number;
  source: "coinmarketcap";
  lastUpdated: string;      // ISO 8601 timestamp
}
```

**Example:**

```bash
curl https://paywarp.vercel.app/api/price/usd-ngn
```

---

### Paystack Integration Endpoints

#### POST /api/paystack/initialize

Initialize a Paystack payment for NGN deposits.

**Request:**

```typescript
{
  email: string;
  amount: number;           // Amount in NGN (kobo)
  walletAddress: string;    // User's wallet address
  metadata?: {
    bucketAllocation?: {
      billings: number;
      savings: number;
      growth: number;
      instant: number;
      spendable: number;
    };
  };
}
```

**Response:**

```typescript
{
  success: boolean;
  authorizationUrl: string; // Redirect URL for payment
  reference: string;        // Payment reference
  accessCode: string;       // Paystack access code
}
```

**Example:**

```bash
curl -X POST https://paywarp.vercel.app/api/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "amount": 50000,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

---

#### POST /api/paystack/verify

Verify Paystack payment and process deposit.

**Request:**

```typescript
{
  reference: string;        // Payment reference from initialize
}
```

**Response:**

```typescript
{
  success: boolean;
  data: {
    status: "success" | "failed";
    amount: number;
    currency: string;
    paidAt: string;
    transactionHash?: string; // Blockchain tx hash
  };
}
```

---

#### POST /api/paystack/webhook

Webhook endpoint for Paystack payment notifications (internal use).

**Headers:**

```
x-paystack-signature: string  // HMAC SHA512 signature
```

**Request:**

```typescript
{
  event: "charge.success" | "charge.failed";
  data: {
    reference: string;
    amount: number;
    customer: {
      email: string;
    };
    metadata: object;
  };
}
```

---

### Faucet Endpoints

#### POST /api/faucet/request

Request testnet tokens (MNT and USDC).

**Request:**

```typescript
{
  address: string;          // Recipient wallet address
  tokenType: "MNT" | "USDC" | "both";
}
```

**Response:**

```typescript
{
  success: boolean;
  transactions: Array<{
    token: string;
    amount: string;
    hash: string;
  }>;
  message: string;
}
```

**Rate Limit**: 1 request per 24 hours per address

**Example:**

```bash
curl -X POST https://paywarp.vercel.app/api/faucet/request \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "tokenType": "both"
  }'
```

---

## 🔗 Smart Contract ABIs

### BucketVault Contract

**Address (Sepolia)**: `0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825`

#### Key Functions

##### depositAndSplit

Deposit tokens and automatically split across buckets.

```solidity
function depositAndSplit(
    address token,
    uint256 amount
) external returns (bool)
```

**Parameters:**
- `token`: ERC-20 token address (USDC, USDY, etc.)
- `amount`: Amount to deposit (in token decimals)

**Events Emitted:**
```solidity
event Deposit(
    address indexed user,
    address indexed token,
    uint256 amount,
    uint256 timestamp
);

event BucketSplit(
    address indexed user,
    uint256 billings,
    uint256 savings,
    uint256 growth,
    uint256 instant,
    uint256 spendable
);
```

---

##### setSplitConfig

Configure bucket allocation percentages.

```solidity
function setSplitConfig(
    uint8 billingsPercent,
    uint8 savingsPercent,
    uint8 growthPercent,
    uint8 instantPercent,
    uint8 spendablePercent
) external
```

**Requirements:**
- All percentages must sum to 100
- Each percentage must be 0-100

---

##### transferBetweenBuckets

Transfer funds between buckets.

```solidity
function transferBetweenBuckets(
    string memory fromBucket,
    string memory toBucket,
    uint256 amount
) external returns (bool)
```

**Parameters:**
- `fromBucket`: Source bucket ("billings", "savings", "growth", "instant", "spendable")
- `toBucket`: Destination bucket
- `amount`: Amount to transfer

---

##### withdrawFromBucket

Withdraw funds from a bucket to wallet.

```solidity
function withdrawFromBucket(
    string memory bucketName,
    uint256 amount
) external returns (bool)
```

---

##### getBucketBalance

Get balance of a specific bucket.

```solidity
function getBucketBalance(
    address user,
    string memory bucketName
) external view returns (uint256)
```

---

##### getAllBuckets

Get all bucket balances for a user.

```solidity
function getAllBuckets(
    address user
) external view returns (
    uint256 billings,
    uint256 savings,
    uint256 growth,
    uint256 instant,
    uint256 spendable
)
```

---

### PayrollEngine Contract

**Address (Sepolia)**: `0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4`

#### Key Functions

##### addEmployee

Add employee to payroll system.

```solidity
function addEmployee(
    address employeeAddress,
    uint256 salary,
    uint256 paymentInterval
) external onlyOwner
```

**Parameters:**
- `employeeAddress`: Employee's wallet address
- `salary`: Salary amount per payment period
- `paymentInterval`: Seconds between payments (e.g., 2592000 for monthly)

---

##### schedulePayroll

Schedule a payroll batch for future processing.

```solidity
function schedulePayroll(
    address[] memory employees,
    uint256[] memory amounts,
    uint256 scheduledTime
) external onlyOwner returns (uint256 batchId)
```

**Returns**: Batch ID for tracking

---

##### processPayroll

Execute scheduled payroll batch (called by Chainlink Automation).

```solidity
function processPayroll(
    uint256 batchId
) external returns (bool)
```

**Events Emitted:**
```solidity
event PayrollProcessed(
    uint256 indexed batchId,
    uint256 totalAmount,
    uint256 employeeCount,
    uint256 timestamp
);

event EmployeePaid(
    address indexed employee,
    uint256 amount,
    uint256 timestamp
);
```

---

##### getUpcomingPayrolls

Get list of scheduled payroll batches.

```solidity
function getUpcomingPayrolls() 
    external 
    view 
    returns (
        uint256[] memory batchIds,
        uint256[] memory scheduledTimes,
        uint256[] memory amounts
    )
```

---

### ExpenseTracker Contract

**Address (Sepolia)**: `0x23cbfeeE878DfDA122881A68F0e555B97B8F8FFD`

#### Key Functions

##### recordExpense

Record an expense on-chain.

```solidity
function recordExpense(
    string memory merchant,
    uint256 amount,
    string memory category,
    string memory date,
    string memory receiptHash
) external returns (uint256 expenseId)
```

**Parameters:**
- `merchant`: Merchant name
- `amount`: Expense amount
- `category`: Expense category
- `date`: Date of expense (ISO 8601)
- `receiptHash`: IPFS hash of receipt image (optional)

**Returns**: Unique expense ID

---

##### getExpense

Retrieve expense details.

```solidity
function getExpense(
    uint256 expenseId
) external view returns (
    address user,
    string memory merchant,
    uint256 amount,
    string memory category,
    string memory date,
    uint256 timestamp
)
```

---

##### getUserExpenses

Get all expenses for a user.

```solidity
function getUserExpenses(
    address user
) external view returns (uint256[] memory expenseIds)
```

---

## 🔐 Authentication

### Wallet-Based Authentication

PayWarp uses wallet signatures for authentication:

1. **Connect Wallet**: User connects via RainbowKit or Particle Network
2. **Sign Message**: User signs a message to prove ownership
3. **Verify Signature**: Backend verifies signature matches address
4. **Session Token**: JWT token issued for subsequent requests

**Example Sign Message:**

```typescript
const message = `Sign this message to authenticate with PayWarp.

Nonce: ${nonce}
Timestamp: ${timestamp}`;

const signature = await signer.signMessage(message);
```

---

## ⚡ Rate Limiting

All API endpoints are rate-limited to prevent abuse:

| Endpoint | Limit | Window |
|----------|-------|--------|
| OCR Extraction | 100 requests | 15 minutes |
| Faucet Request | 1 request | 24 hours |
| Price Feeds | 60 requests | 1 minute |
| Paystack Initialize | 10 requests | 1 minute |
| General APIs | 100 requests | 15 minutes |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

**Rate Limit Exceeded Response:**

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 900,
  "message": "Too many requests. Please try again in 15 minutes."
}
```

---

## ❌ Error Handling

### Standard Error Response

```typescript
{
  error: string;            // Error type
  message: string;          // Human-readable message
  code: number;             // HTTP status code
  details?: object;         // Additional error details
}
```

### Common Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |
| 503 | Service Unavailable | Temporary service outage |

### Example Error Responses

**Invalid Parameters:**

```json
{
  "error": "ValidationError",
  "message": "Invalid wallet address format",
  "code": 400,
  "details": {
    "field": "walletAddress",
    "value": "invalid_address"
  }
}
```

**Rate Limit Exceeded:**

```json
{
  "error": "RateLimitError",
  "message": "Too many OCR requests. Please try again later.",
  "code": 429,
  "details": {
    "retryAfter": 900,
    "limit": 100,
    "window": "15 minutes"
  }
}
```

---

## 🪝 Webhooks

### Paystack Webhook

PayWarp receives payment notifications from Paystack via webhooks.

**Endpoint**: `POST /api/paystack/webhook`

**Signature Verification:**

```typescript
const crypto = require('crypto');

const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (hash === req.headers['x-paystack-signature']) {
  // Signature valid, process webhook
}
```

**Event Types:**

- `charge.success`: Payment completed successfully
- `charge.failed`: Payment failed
- `transfer.success`: Payout completed
- `transfer.failed`: Payout failed

---

## 📊 Usage Examples

### Complete Deposit Flow

```typescript
// 1. Initialize Paystack payment
const initResponse = await fetch('/api/paystack/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    amount: 50000, // 500 NGN in kobo
    walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
  })
});

const { authorizationUrl, reference } = await initResponse.json();

// 2. Redirect user to Paystack
window.location.href = authorizationUrl;

// 3. After payment, verify on callback
const verifyResponse = await fetch('/api/paystack/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reference })
});

const { success, data } = await verifyResponse.json();

if (success) {
  console.log('Deposit successful:', data.transactionHash);
}
```

---

### OCR Expense Extraction

```typescript
// 1. Convert image to base64
const fileReader = new FileReader();
fileReader.onload = async (e) => {
  const imageBase64 = e.target.result;
  
  // 2. Send to OCR API
  const response = await fetch('/api/ocr/extract-receipt-enhanced', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      mimeType: 'image/jpeg',
      extractionMode: 'comprehensive'
    })
  });
  
  const { structuredData, confidence } = await response.json();
  
  // 3. Record expense on-chain
  const contract = new ethers.Contract(
    EXPENSE_TRACKER_ADDRESS,
    ExpenseTrackerABI,
    signer
  );
  
  const tx = await contract.recordExpense(
    structuredData.merchant,
    ethers.parseUnits(structuredData.total.toString(), 6),
    'business',
    structuredData.date,
    '' // Receipt hash (optional)
  );
  
  await tx.wait();
  console.log('Expense recorded:', tx.hash);
};

fileReader.readAsDataURL(receiptFile);
```

---

### Smart Contract Interaction

```typescript
import { useContractWrite } from 'wagmi';

// Deposit and split across buckets
const { write: depositAndSplit } = useContractWrite({
  address: BUCKET_VAULT_ADDRESS,
  abi: BucketVaultABI,
  functionName: 'depositAndSplit',
  args: [
    USDC_TOKEN_ADDRESS,
    ethers.parseUnits('100', 6) // 100 USDC
  ],
  onSuccess: (data) => {
    console.log('Deposit successful:', data.hash);
  },
  onError: (error) => {
    console.error('Deposit failed:', error);
  }
});

// Execute transaction
depositAndSplit();
```

---

## 🔧 SDK (Coming Soon)

We're working on official SDKs for easier integration:

- **JavaScript/TypeScript SDK**: `@paywarp/sdk`
- **Python SDK**: `paywarp-python`
- **React Hooks**: `@paywarp/react`

---

## 📞 Support

For API support and questions:

- **Documentation**: [docs.paywarp.io](https://docs.paywarp.io)
- **Discord**: [Join our server](https://discord.gg/paywarp)
- **Email**: elgravi

---

**Last Updated**: January 14, 2026  
**API Version**: v1.0.0
