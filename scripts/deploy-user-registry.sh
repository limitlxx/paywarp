#!/bin/bash

# Deploy and Verify UserRegistry Upgradeable Contract
# Usage: ./scripts/deploy-user-registry.sh [network]
# Example: ./scripts/deploy-user-registry.sh sepolia

set -e

# Configuration
NETWORK=${1:-sepolia}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying UserRegistry to $NETWORK network..."

# Load environment variables
if [ -f "$PROJECT_DIR/.env.local" ]; then
    source "$PROJECT_DIR/.env.local"
fi

# Validate required environment variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env.local"
    exit 1
fi

if [ -z "$MANTLESCAN_API_KEY" ]; then
    echo "⚠️  Warning: MANTLESCAN_API_KEY not set - verification may fail"
fi

# Set RPC URL based on network
case $NETWORK in
    "sepolia")
        RPC_URL=${NEXT_PUBLIC_MANTLE_SEPOLIA_RPC:-"https://rpc.sepolia.mantle.xyz"}
        CHAIN_ID=5003
        EXPLORER_URL="https://sepolia.mantlescan.xyz"
        ;;
    "mainnet")
        RPC_URL=${NEXT_PUBLIC_MANTLE_MAINNET_RPC:-"https://rpc.mantle.xyz"}
        CHAIN_ID=5000
        EXPLORER_URL="https://mantlescan.xyz"
        ;;
    *)
        echo "❌ Error: Unsupported network $NETWORK"
        echo "Supported networks: sepolia, mainnet"
        exit 1
        ;;
esac

echo "📡 Using RPC: $RPC_URL"
echo "🔗 Chain ID: $CHAIN_ID"

# Deploy the contract
echo "📦 Deploying UserRegistry..."
DEPLOY_OUTPUT=$(forge script script/DeployUserRegistry.s.sol:DeployUserRegistry \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast \
    --verify \
    --etherscan-api-key "$MANTLESCAN_API_KEY" \
    -vvvv 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract addresses from deployment output
IMPLEMENTATION_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "UserRegistry implementation deployed at:" | awk '{print $NF}')
PROXY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "UserRegistry proxy deployed at:" | awk '{print $NF}')

if [ -z "$IMPLEMENTATION_ADDRESS" ] || [ -z "$PROXY_ADDRESS" ]; then
    echo "❌ Error: Could not extract contract addresses from deployment output"
    exit 1
fi

echo "✅ Deployment successful!"
echo "📋 Implementation: $IMPLEMENTATION_ADDRESS"
echo "📋 Proxy: $PROXY_ADDRESS"

# Update environment variables
ENV_VAR_NAME="NEXT_PUBLIC_USER_REGISTRY_${NETWORK^^}"
echo "📝 Updating $ENV_VAR_NAME in .env.local..."

# Create backup of .env.local
cp "$PROJECT_DIR/.env.local" "$PROJECT_DIR/.env.local.backup"

# Update or add the environment variable
if grep -q "^$ENV_VAR_NAME=" "$PROJECT_DIR/.env.local"; then
    # Update existing variable
    sed -i.bak "s|^$ENV_VAR_NAME=.*|$ENV_VAR_NAME=$PROXY_ADDRESS|" "$PROJECT_DIR/.env.local"
else
    # Add new variable
    echo "$ENV_VAR_NAME=$PROXY_ADDRESS" >> "$PROJECT_DIR/.env.local"
fi

# Verify the deployment
echo "🔍 Verifying deployment..."
USER_REGISTRY_PROXY=$PROXY_ADDRESS forge script script/VerifyUserRegistry.s.sol:VerifyUserRegistry \
    --rpc-url "$RPC_URL" \
    -vvv

# Generate deployment report
REPORT_FILE="$PROJECT_DIR/deployments/user-registry-$NETWORK-$(date +%Y%m%d-%H%M%S).json"
mkdir -p "$PROJECT_DIR/deployments"

cat > "$REPORT_FILE" << EOF
{
  "network": "$NETWORK",
  "chainId": $CHAIN_ID,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "UserRegistryUpgradeable": {
      "implementation": "$IMPLEMENTATION_ADDRESS",
      "proxy": "$PROXY_ADDRESS",
      "verified": true
    }
  },
  "explorer": {
    "implementation": "$EXPLORER_URL/address/$IMPLEMENTATION_ADDRESS",
    "proxy": "$EXPLORER_URL/address/$PROXY_ADDRESS"
  },
  "deployer": "$(cast wallet address --private-key $PRIVATE_KEY)"
}
EOF

echo "📊 Deployment report saved to: $REPORT_FILE"

# Update the main deployment results
echo "📝 Updating DEPLOYMENT_RESULTS.md..."
{
    echo ""
    echo "## UserRegistry Deployment - $NETWORK ($(date))"
    echo ""
    echo "- **Implementation**: [$IMPLEMENTATION_ADDRESS]($EXPLORER_URL/address/$IMPLEMENTATION_ADDRESS)"
    echo "- **Proxy**: [$PROXY_ADDRESS]($EXPLORER_URL/address/$PROXY_ADDRESS)"
    echo "- **Network**: $NETWORK (Chain ID: $CHAIN_ID)"
    echo "- **Status**: ✅ Deployed and Verified"
    echo ""
} >> "$PROJECT_DIR/DEPLOYMENT_RESULTS.md"

echo "🎉 UserRegistry deployment complete!"
echo ""
echo "📋 Summary:"
echo "   Network: $NETWORK"
echo "   Implementation: $IMPLEMENTATION_ADDRESS"
echo "   Proxy: $PROXY_ADDRESS"
echo "   Explorer: $EXPLORER_URL/address/$PROXY_ADDRESS"
echo ""
echo "🔧 Next steps:"
echo "   1. Update your frontend to use the new proxy address"
echo "   2. Test registration functionality"
echo "   3. Consider migrating existing users if needed"