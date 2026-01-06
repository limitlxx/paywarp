#!/bin/bash
echo "Testing price API..."
curl -s "http://localhost:3000/api/price?token=mnt&fiat_amount=1000&fiat_currency=NGN&network=sepolia" | jq .