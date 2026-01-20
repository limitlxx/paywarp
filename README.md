# PayWarp Quick Start Guide

Get PayWarp running locally in under 5 minutes!

---

## ⚡ Prerequisites

- Node.js 18+ and npm/pnpm
- Git
- MetaMask or compatible Web3 wallet
- Basic understanding of Web3 and smart contracts

---

## 🚀 Quick Setup (5 Minutes)

### 1. Clone and Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/limitlxx/paywarp.git
cd paywarp

# Install dependencies
npm install
# or
pnpm install
```

### 2. Environment Configuration (2 minutes)

Create a `.env` file in the root directory:

```env
# Mantle Network (Required)
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_DEFAULT_NETWORK=sepolia

# Contract Addresses - Already Deployed on Sepolia (Required)
NEXT_PUBLIC_BUCKET_VAULT_SEPOLIA=0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825
NEXT_PUBLIC_PAYROLL_ENGINE_SEPOLIA=0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4
NEXT_PUBLIC_USER_REGISTRY_SEPOLIA=0x28d4C8100F199BDa17c62948790aFDBaa8e33C0A
NEXT_PUBLIC_EXPENSE_TRACKER_SEPOLIA=0x23cbfeeE878DfDA122881A68F0e555B97B8F8FFD
NEXT_PUBLIC_USDC_TOKEN_SEPOLIA=0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8
NEXT_PUBLIC_USDY_TOKEN_SEPOLIA=0xCE6C8F97241f455A3498711C28D468A50559673f
NEXT_PUBLIC_MUSD_TOKEN_SEPOLIA=0xA61F1287B3aC96D7B6ab75e6190DEcaad68Ad641

# RWA Mock Contracts - Sepolia Testnet (UPDATED)
NEXT_PUBLIC_MOCK_USDY_SEPOLIA=0xD83794CFD929612509Ac42e0E9Ab00CB764966c3
NEXT_PUBLIC_MOCK_MUSD_SEPOLIA=0xE396D5a59AbaFE26a7a256f453735872593f1c03
NEXT_PUBLIC_MOCK_USDE_SEPOLIA=0xDCf439790840C5bf66916997dB54cD15083773f0
NEXT_PUBLIC_MOCK_METH_SEPOLIA=0xcB1E04273dce35C8e58239B5BF46fB8d1fEDa5F8

# WalletConnect (Required - Get free at https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Default Network (mainnet or sepolia)
NEXT_PUBLIC_DEFAULT_NETWORK=sepolia

# Mantlescan API Key for contract verification
MANTLESCAN_API_KEY=your_etherscan_api_key

# Private key for deployment (use a test account)
PRIVATE_KEY=your_mantle_private_key

# PAYSTACK KEYS
PAYSTACK_SECRET_KEY=your_paystack_key
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=your_paystack_key
PAYSTACK_WEBHOOK_SECRET=paystack_webhook_secret_test

# MANAGED WALLET FOR PAYSTACK DEPOSITS (Server-side only)
MANAGED_WALLET_PRIVATE_KEY=your_faucet_private_key
MANAGED_WALLET_ADDRESS=your_faucet_wallet

# Optional APIs (for full functionality)
GEMINI_API_KEY=your_gemini_key_here
ALCHEMY_API_KEY=your_alchemy_key_here
CMC_API_KEY=your_cmc_key_here
```

**Quick API Key Setup:**

1. **WalletConnect** (Required, 30 seconds)
   - Go to https://cloud.walletconnect.com
   - Sign up and create a new project
   - Copy the Project ID

2. **Gemini AI** (Optional, for OCR - 1 minute)
   - Go to https://aistudio.google.com/app/apikey
   - Click "Create API Key"
   - Copy the key

3. **Alchemy** (Optional, for optimized RPC - 1 minute)
   - Go to https://dashboard.alchemy.com
   - Create account and new app
   - Copy the API key

### 3. Run Development Server (1 minute)

```bash
npm run dev

or

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Get Testnet Tokens (1 minute)

1. Connect your wallet (MetaMask recommended)
2. Switch to Mantle Sepolia network
3. Go to the Faucet page in the app
4. Request testnet MNT and USDC
5. Tokens arrive instantly!

---

## 🎮 Try It Out (3-Minute Demo)

### Step 1: Connect Wallet (10 seconds)
- Click "Connect Wallet" button
- Choose MetaMask or social login
- Approve connection

### Step 2: Get Testnet Tokens (30 seconds)
- Navigate to "Faucet" page
- Click "Request Tokens"
- Receive 10 MNT + 1000 USDC

### Step 3: Make a Deposit (45 seconds)
- Go to "Dashboard"
- Click "Deposit" button
- Enter amount (e.g., 100 USDC)
- Approve transaction
- Watch funds auto-split across buckets!
- **NEW**: See RWA yield generation in real-time!

### Step 4: Track an Expense (60 seconds)
- Navigate to "Expenses" page
- Upload a receipt photo
- AI extracts merchant, amount, date
- Confirm and record on-chain

### Step 5: View Your Wrapped (30 seconds)
- Go to "Wrapped" page
- See your personalized 8-slide carousel
- View transaction metrics and archetype
- Share to Twitter!

### Step 6: Monitor RWA Yields (NEW - 30 seconds)
- Check bucket cards for yield bubbles
- View APY rates (4.5% - 10% range)
- Watch compound interest grow over time
- Claim or compound yields as needed

---

## 🆕 Latest Updates (January 2026)

### RWA Yield Integration ✨

PayWarp now features **Real World Asset (RWA) yield generation** on all bucket deposits:

- **Billings Bucket**: 4.5% APY via MockUSDY (Ondo Finance simulation)
- **Savings Bucket**: 3.2% APY via MockmUSD (Mantle mUSD simulation)  
- **Growth Bucket**: 8.0% APY via MockUSDe (Ethena USDe simulation)
- **Instant Bucket**: 10.0% APY via MockmETH (Mantle staked ETH simulation)

**Key Features:**
- ⚡ **Real-time yield tracking** with 30-second polling
- 🔄 **Automatic compounding** for maximum returns
- 📊 **Live APY display** on bucket cards
- 🎯 **Property-based testing** ensures correctness
- 🛡️ **Error recovery** with USDC fallback

### Updated Contract Addresses

All RWA contracts have been redeployed with enhanced features:

```
MockUSDY:  0xD83794CFD929612509Ac42e0E9Ab00CB764966c3
MockMUSD:  0xE396D5a59AbaFE26a7a256f453735872593f1c03  
MockUSDe:  0xDCf439790840C5bf66916997dB54cD15083773f0
MockmETH:  0xcB1E04273dce35C8e58239B5BF46fB8d1fEDa5F8
```

**BucketVault Upgraded**: New implementation at `0x2919629f4fE225127d4430594cE918D0B38a4a32`

---

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Compile smart contracts
npm run compile

# Deploy contracts to Sepolia
npm run deploy:sepolia

# Deploy contracts to Mainnet
npm run deploy:mainnet
```

---

## 📁 Project Structure

```
paywarp/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Main dashboard
│   ├── buckets/          # Bucket management
│   ├── expenses/         # Expense tracking
│   ├── wrapped/          # 2025 Wrapped
│   └── api/              # API routes
├── components/            # React components
├── contracts/            # Smart contracts
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── contexts/             # React contexts
├── types/                # TypeScript types
└── public/               # Static assets
```

---

## 🔧 Configuration

### Network Configuration

Edit `lib/networks.ts` to add custom networks:

```typescript
export const networks = {
  mantleSepolia: {
    id: 5003,
    name: 'Mantle Sepolia',
    rpcUrl: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC,
    blockExplorer: 'https://sepolia.mantlescan.xyz',
  },
  // Add your custom network here
}
```

### Bucket Configuration

Default bucket percentages in `lib/constants.ts`:

```typescript
export const DEFAULT_BUCKET_ALLOCATION = {
  billings: 20,
  savings: 30,
  growth: 20,
  instant: 20,
  spendable: 10,
}
```

---

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Test Specific Features

```bash
# Test OCR processing
node test-expense-blockchain-integration.js

# Test payroll automation
node test-session-key-automation.js

# Test transaction syncing
node test-transaction-sync-fix.js

# Test RWA yield integration (NEW)
npm run test test/integration/rwa-deployed-contracts.integration.test.ts --run

# Test RWA property-based tests (NEW)
npm run test test/rwa-yield-calculations.property.test.ts --run
npm run test test/rwa-round-trip-consistency.property.test.ts --run
```

### Manual Testing Checklist

- [ ] Wallet connection works
- [ ] Faucet distributes tokens
- [ ] Deposits split correctly across buckets
- [ ] **RWA yield generation starts automatically** ✨
- [ ] **Bucket cards show APY rates and pending yields** ✨
- [ ] **Yield bubbles animate when yields accrue** ✨
- [ ] OCR extracts receipt data accurately
- [ ] Payroll CSV upload works
- [ ] Transaction history displays correctly
- [ ] Wrapped carousel shows personalized data
- [ ] Currency toggle works (NGN/USD/MNT)
- [ ] **Yield claiming and compounding functions work** ✨

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to wallet"

**Solution:**
1. Ensure MetaMask is installed
2. Check you're on Mantle Sepolia network
3. Try refreshing the page
4. Clear browser cache

### Issue: "Transaction failed"

**Solution:**
1. Check you have enough MNT for gas
2. Verify contract addresses in `.env`
3. Ensure you've approved token spending
4. Check Mantle network status

### Issue: "OCR not working"

**Solution:**
1. Verify `GEMINI_API_KEY` is set in `.env`
2. Check image size (max 10MB)
3. Try Tesseract.js fallback (toggle in settings)
4. Ensure image is clear and well-lit

### Issue: "Faucet says 'Already claimed'"

**Solution:**
1. Wait 24 hours between requests
2. Try a different wallet address
3. Check if you already have testnet tokens

### Issue: "RWA yields not showing" ✨

**Solution:**
1. Verify RWA contract addresses in `.env` are updated
2. Check that you have deposited funds into buckets
3. Wait 30 seconds for yield polling to update
4. Ensure RWA integration is enabled on BucketVault
5. Try refreshing the page

### Issue: "Yield claiming failed" ✨

**Solution:**
1. Ensure you have pending yields to claim
2. Check you have enough MNT for gas fees
3. Verify the RWA contract is not paused
4. Try claiming smaller amounts first

---

## 📚 Next Steps

### Learn More

- Read the [full README](./README.md)
- Check out [API Documentation](./app/api/API_DOCUMENTATION.md)
- Review [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- See [Submission Details](./SUBMISSION.md)

### Explore Features

- **RWA Yield Generation**: Earn 4.5-10% APY on bucket deposits ✨
- **Bucket Management**: Customize your allocation percentages
- **Real-time Yield Tracking**: Monitor compound interest growth ✨
- **Payroll Automation**: Upload CSV and schedule payouts
- **Expense Tracking**: Try different receipt types
- **Session Keys**: Set up automated transactions
- **Wrapped Experience**: View your financial insights

### Contribute

- Fork the repository
- Create a feature branch
- Make your changes
- Submit a pull request

---

## 🤝 Get Help

### Community

- **Discord**: [Join our server](https://discord.gg/paywarp)
- **Telegram**: [@paywarp](https://t.me/paywarp)
- **Twitter/X**: [@paywarp](https://twitter.com/paywarp)

### Support

- **Email**: support@paywarp.io
- **GitHub Issues**: [Report a bug](https://github.com/yourusername/paywarp/issues)
- **Documentation**: [docs.paywarp.io](https://docs.paywarp.io)

---

## 🎯 Common Use Cases

### For Developers

```bash
# Clone and start developing
git clone https://github.com/yourusername/paywarp.git
cd paywarp
npm install
npm run dev
```

### For Testers

1. Visit the live demo: https://paywarp.vercel.app
2. Connect wallet and get testnet tokens
3. Try all features and report bugs

### For Contributors

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
2. Pick an issue from GitHub
3. Fork, code, and submit PR

---

## 🚀 Deploy Your Own

### Deploy to Vercel (1-Click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/paywarp)

### Manual Deployment

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## 📊 Performance Tips

### Optimize Development

```bash
# Use pnpm for faster installs
pnpm install

# Enable Turbopack (Next.js 16)
npm run dev --turbo

# Use local RPC for faster testing
# Add to .env:
NEXT_PUBLIC_MANTLE_SEPOLIA_RPC=http://localhost:8545
```

### Optimize Production

- Enable Vercel Analytics
- Use Edge Functions for API routes
- Implement Redis caching
- Optimize images with Next.js Image

---

## ✅ Quick Start Checklist

- [ ] Node.js 18+ installed
- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] `.env` file configured
- [ ] WalletConnect Project ID added
- [ ] Development server running
- [ ] Wallet connected
- [ ] Testnet tokens received
- [ ] First deposit made
- [ ] Expense tracked
- [ ] Wrapped viewed

---

**You're all set! Start building with PayWarp! 🎉**

For questions or issues, reach out on [Discord](https://discord.gg/paywarp) or [open an issue](https://github.com/yourusername/paywarp/issues).

## Team

FullStack Developer
Ojo Emmanuel
Email: elgravicodesh@gmail.com
X: @afriquartz

Product Manager
Olajide Oyedele
Email: Olaveezy@gmail.com
X: @Olajidevoo
https://www.linkedin.com/in/olajideoyedele

---

**Built with ❤️ on Mantle L2**
