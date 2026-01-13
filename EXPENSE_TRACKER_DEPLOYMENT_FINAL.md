# ExpenseTracker Contract Deployment Summary

## Deployment Details

**Network:** Mantle Sepolia Testnet (Chain ID: 5003)
**Deployment Date:** January 12, 2026
**Deployer:** 0x6a62e5bA998874A5c8A5B3b3A1add5c9E3A31a4a

## Contract Addresses

### ExpenseTrackerUpgradeable Implementation
- **Address:** `0x09331f172bd08C8A5B94D1f58811f9eC3cf083c2`
- **Transaction Hash:** `0x5efff688fa4a7f0e2f2186e62ed9269afb186cb5896389223f61286b9cc021ff`
- **Block:** 33340754
- **Gas Used:** 9,035,380,488 gas
- **Gas Price:** 0.0201 gwei
- **Cost:** 0.1816111478088 MNT

### ERC1967Proxy (Main Contract)
- **Address:** `0x23cbfeeE878DfDA122881A68F0e555B97B8F8FFD`
- **Transaction Hash:** `0xe37a7eebeb72bfaab74865eebf98d2054bffdd147ded60b7d6acc710d62a427d`
- **Block:** 33340757
- **Gas Used:** 809,952,566 gas
- **Gas Price:** 0.0201 gwei
- **Cost:** 0.0162800465766 MNT

## Total Deployment Cost
- **Total Gas:** 9,845,333,054 gas
- **Total Cost:** 0.1978911943854 MNT

## Verification Status
- ✅ Implementation Contract: Verified on Mantlescan
- ✅ Proxy Contract: Verified on Mantlescan

## Contract Features

The ExpenseTrackerUpgradeable contract includes:

1. **UUPS Upgradeability Pattern**
   - Secure upgrade mechanism
   - Owner-controlled upgrades

2. **Expense Management**
   - Add, edit, delete expenses
   - Category-based organization
   - OCR integration for receipt processing

3. **Recurring Expenses**
   - Automated recurring expense creation
   - Flexible scheduling (daily, weekly, monthly, yearly)

4. **Security Features**
   - Reentrancy protection
   - Pausable functionality
   - Owner access control

5. **Data Retrieval**
   - Paginated expense queries
   - Category filtering
   - Date range filtering
   - Comprehensive expense statistics

## Environment Variables Updated

```env
NEXT_PUBLIC_EXPENSE_TRACKER_SEPOLIA=0x23cbfeeE878DfDA122881A68F0e555B97B8F8FFD
```

## Verification Links

- **Implementation:** https://sepolia.mantlescan.xyz/address/0x09331f172bd08c8a5b94d1f58811f9ec3cf083c2
- **Proxy:** https://sepolia.mantlescan.xyz/address/0x23cbfeeE878DfDA122881A68F0e555B97B8F8FFD

## Next Steps

1. The contract is ready for frontend integration
2. OCR functionality can now process receipts and create expenses
3. Users can manage expenses through the web interface
4. Contract can be upgraded if needed using the UUPS pattern

## Contract ABI

The contract ABI is available in the `out/ExpenseTrackerUpgradeable.sol/ExpenseTrackerUpgradeable.json` file for frontend integration.