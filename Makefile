# ExpenseTracker Deployment Makefile

# Load environment variables
include .env
export

# Default network
NETWORK ?= mantle_sepolia
RPC_URL ?= https://rpc.sepolia.mantle.xyz

# Directories
SCRIPT_DIR = script
DEPLOY_DIR = deployments

# Colors for output
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

.PHONY: help build test deploy verify upgrade clean

help: ## Show this help message
	@echo "$(GREEN)ExpenseTracker Deployment Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(YELLOW)%-20s$(NC) %s\n", $$1, $$2}'

build: ## Build the contracts
	@echo "$(GREEN)Building contracts...$(NC)"
	forge build

test: ## Run contract tests
	@echo "$(GREEN)Running tests...$(NC)"
	forge test -vv

deploy: build ## Deploy ExpenseTracker to network
	@echo "$(GREEN)Deploying ExpenseTracker to $(NETWORK)...$(NC)"
	@mkdir -p $(DEPLOY_DIR)
	forge script $(SCRIPT_DIR)/DeployExpenseTracker.s.sol:DeployExpenseTracker \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--verify \
		-vvvv

deploy-sepolia: ## Deploy to Mantle Sepolia
	@$(MAKE) deploy NETWORK=mantle_sepolia RPC_URL=https://rpc.sepolia.mantle.xyz

deploy-mainnet: ## Deploy to Mantle Mainnet
	@$(MAKE) deploy NETWORK=mantle_mainnet RPC_URL=https://rpc.mantle.xyz

test-deployment: ## Test the deployed contract
	@echo "$(GREEN)Testing deployed contract...$(NC)"
	forge script $(SCRIPT_DIR)/TestExpenseTracker.s.sol:TestExpenseTracker \
		--rpc-url $(RPC_URL) \
		--broadcast \
		-vvvv

verify: ## Verify the implementation contract
	@echo "$(GREEN)Verifying contract...$(NC)"
	@if [ -z "$(IMPL_ADDRESS)" ]; then \
		echo "$(RED)Please set IMPL_ADDRESS environment variable$(NC)"; \
		exit 1; \
	fi
	forge verify-contract $(IMPL_ADDRESS) \
		contracts/ExpenseTrackerUpgradeable.sol:ExpenseTrackerUpgradeable \
		--chain $(NETWORK) \
		--etherscan-api-key $(MANTLESCAN_API_KEY)

upgrade: ## Upgrade the contract
	@echo "$(GREEN)Upgrading ExpenseTracker...$(NC)"
	forge script $(SCRIPT_DIR)/UpgradeExpenseTracker.s.sol:UpgradeExpenseTracker \
		--rpc-url $(RPC_URL) \
		--broadcast \
		--verify \
		-vvvv

# Utility commands
clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	forge clean
	rm -rf $(DEPLOY_DIR)/*.env

install: ## Install dependencies
	@echo "$(GREEN)Installing dependencies...$(NC)"
	forge install

update: ## Update dependencies
	@echo "$(GREEN)Updating dependencies...$(NC)"
	forge update

# Gas estimation
estimate-gas: ## Estimate deployment gas
	@echo "$(GREEN)Estimating gas costs...$(NC)"
	forge script $(SCRIPT_DIR)/DeployExpenseTracker.s.sol:DeployExpenseTracker \
		--rpc-url $(RPC_URL) \
		--gas-estimate

# Local testing
test-local: ## Run tests on local fork
	@echo "$(GREEN)Running tests on local fork...$(NC)"
	forge test --fork-url $(RPC_URL) -vv

# Contract size check
size: build ## Check contract sizes
	@echo "$(GREEN)Checking contract sizes...$(NC)"
	forge build --sizes

# Coverage report
coverage: ## Generate test coverage report
	@echo "$(GREEN)Generating coverage report...$(NC)"
	forge coverage

# Format code
fmt: ## Format Solidity code
	@echo "$(GREEN)Formatting code...$(NC)"
	forge fmt

# Lint code
lint: ## Lint Solidity code
	@echo "$(GREEN)Linting code...$(NC)"
	forge fmt --check

# Quick deployment check
check-deployment: ## Quick check if deployment was successful
	@echo "$(GREEN)Checking deployment...$(NC)"
	@if [ -f "$(DEPLOY_DIR)/expense-tracker.env" ]; then \
		echo "$(GREEN)✅ Deployment file found$(NC)"; \
		cat $(DEPLOY_DIR)/expense-tracker.env; \
	else \
		echo "$(RED)❌ No deployment file found$(NC)"; \
	fi

# Show deployment info
info: ## Show deployment information
	@echo "$(GREEN)Deployment Information:$(NC)"
	@echo "Network: $(NETWORK)"
	@echo "RPC URL: $(RPC_URL)"
	@echo "Private Key: $(shell echo $(PRIVATE_KEY) | cut -c1-10)..."
	@echo "Mantlescan API Key: $(shell echo $(MANTLESCAN_API_KEY) | cut -c1-10)..."