#!/bin/bash

# PayWarp Contract Verification Script for Mantle Sepolia
# Chain ID: 5003

set -e

# Load environment variables
source .env

# Contract addresses from deployment
MOCK_USDC="0x93B3e03e9Ca401Ca79150C406a74430F1ff70EA8"
MOCK_USDY="0xCE6C8F97241f455A3498711C28D468A50559673f"
MOCK_MUSD="0xA61F1287B3aC96D7B6ab75e6190DEcaad68Ad641"
BUCKET_VAULT_IMPL="0x89c70d73C6F02DFf40Ee0c3b2Ccf5e9D4ED62871"
BUCKET_VAULT_PROXY="0x5eB859EC3E38B6F7713e3d7504D08Cb8D50f3825"
PAYROLL_ENGINE_IMPL="0x0bF6e5d289151E7Ac34f8c746df65e38aA9BC0De"
PAYROLL_ENGINE_PROXY="0x918e725B7922129627C7FeFd4D64D6ee9b3dBFF4"
USER_REGISTRY="0x88ffe6b6D0eD0C45278d65b83eB3CaeBbfcff0b5"

# Verification settings
CHAIN_ID="5003"
VERIFIER_URL="https://explorer.sepolia.mantle.xyz/api"
API_KEY="$MANTLESCAN_API_KEY"

echo "🔍 Starting contract verification on Mantle Sepolia (Chain ID: $CHAIN_ID)"
echo "=================================================="

# Function to verify contract with retry logic
verify_contract() {
    local address=$1
    local contract_path=$2
    local contract_name=$3
    local constructor_args=$4
    
    echo "📝 Verifying $contract_name at $address..."
    
    if [ -n "$constructor_args" ]; then
        forge verify-contract \
            --chain-id $CHAIN_ID \
            --verifier etherscan \
            --verifier-url $VERIFIER_URL \
            --etherscan-api-key $API_KEY \
            --constructor-args $constructor_args \
            --watch \
            $address \
            $contract_path:$contract_name
    else
        forge verify-contract \
            --chain-id $CHAIN_ID \
            --verifier etherscan \
            --verifier-url $VERIFIER_URL \
            --etherscan-api-key $API_KEY \
            --watch \
            $address \
            $contract_path:$contract_name
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ $contract_name verified successfully!"
    else
        echo "❌ Failed to verify $contract_name"
    fi
    echo ""
}

# Verify Mock USDC
USDC_ARGS=$(cast abi-encode "constructor(string,string,uint8)" "Mock USDC" "USDC" 6)
verify_contract $MOCK_USDC "contracts/MockERC20.sol" "MockERC20" $USDC_ARGS

# Verify Mock USDY
USDY_ARGS=$(cast abi-encode "constructor(string,string,uint256)" "Mock USDY" "USDY" 450)
verify_contract $MOCK_USDY "contracts/MockUSDY.sol" "MockUSDY" $USDY_ARGS

# Verify Mock mUSD
MUSD_ARGS=$(cast abi-encode "constructor(string,string,uint256)" "Mock mUSD" "mUSD" 320)
verify_contract $MOCK_MUSD "contracts/MockMUSD.sol" "MockMUSD" $MUSD_ARGS

# Verify BucketVault Implementation (no constructor args for upgradeable)
verify_contract $BUCKET_VAULT_IMPL "contracts/BucketVaultUpgradeable.sol" "BucketVaultUpgradeable"

# Verify PayrollEngine Implementation (no constructor args for upgradeable)
verify_contract $PAYROLL_ENGINE_IMPL "contracts/PayrollEngineUpgradeable.sol" "PayrollEngineUpgradeable"

# Verify UserRegistry (no constructor args)
verify_contract $USER_REGISTRY "contracts/UserRegistry.sol" "UserRegistry"

echo "🎉 Verification process completed!"
echo ""
echo "📋 Manual Proxy Verification Required:"
echo "BucketVault Proxy: $BUCKET_VAULT_PROXY"
echo "PayrollEngine Proxy: $PAYROLL_ENGINE_PROXY"
echo ""
echo "Visit https://explorer.sepolia.mantle.xyz to manually verify proxy contracts"
echo "Use the 'Verify & Publish' feature and select 'Proxy' verification type"