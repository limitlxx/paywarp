// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockRWA
 * @dev Base contract for mock Real World Asset tokens with yield accrual logic
 * Provides common functionality for all RWA token implementations
 */
abstract contract MockRWA is ERC20, Ownable {
    uint256 public redemptionValue; // Current redemption value (starts at 1e18, increases over time)
    uint256 public currentAPY; // Current APY in basis points (e.g., 800 = 8%)
    uint256 public lastAccrualTime;
    
    mapping(address => uint256) public originalDeposits; // Track original USDC deposits
    
    event YieldAccrued(uint256 newRedemptionValue, uint256 apy);
    event Deposit(address indexed user, uint256 usdcAmount, uint256 tokenAmount);
    event Redemption(address indexed user, uint256 tokenAmount, uint256 usdcAmount);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialAPY
    ) ERC20(name, symbol) Ownable(msg.sender) {
        redemptionValue = 1e18; // Start at 1:1 ratio
        currentAPY = initialAPY;
        lastAccrualTime = block.timestamp;
    }

    /**
     * @dev Deposit USDC and mint RWA tokens
     * @param usdcAmount Amount of USDC to deposit (in wei)
     */
    function deposit(uint256 usdcAmount) external virtual {
        require(usdcAmount > 0, "Amount must be positive");
        
        // Accrue yield before minting
        accrueYield();
        
        // Calculate tokens to mint based on current redemption value
        uint256 tokenAmount = _calculateTokensToMint(usdcAmount);
        
        // Track original deposit for yield calculation
        originalDeposits[msg.sender] += usdcAmount;
        
        // Mint tokens
        _mint(msg.sender, tokenAmount);
        
        emit Deposit(msg.sender, usdcAmount, tokenAmount);
    }

    /**
     * @dev Redeem RWA tokens for USDC
     * @param tokenAmount Amount of RWA tokens to redeem
     */
    function redeem(uint256 tokenAmount) external virtual {
        require(tokenAmount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Accrue yield before redemption
        accrueYield();
        
        // Calculate USDC amount based on current redemption value
        uint256 usdcAmount = _calculateUSDCFromTokens(tokenAmount);
        
        // Burn tokens
        _burn(msg.sender, tokenAmount);
        
        // Update original deposits proportionally
        uint256 totalBalance = balanceOf(msg.sender) + tokenAmount;
        if (totalBalance > 0) {
            originalDeposits[msg.sender] = (originalDeposits[msg.sender] * balanceOf(msg.sender)) / totalBalance;
        }
        
        emit Redemption(msg.sender, tokenAmount, usdcAmount);
    }

    /**
     * @dev Accrue yield by updating redemption value
     */
    function accrueYield() public virtual {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed > 0) {
            // Calculate yield: (APY / 10000) / (365 * 24 * 3600) * timeElapsed
            uint256 yieldRate = (currentAPY * timeElapsed) / (10000 * 365 * 24 * 3600);
            redemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;
            lastAccrualTime = block.timestamp;
            
            emit YieldAccrued(redemptionValue, currentAPY);
        }
    }

    /**
     * @dev Get pending yield for a user (view function that simulates accrual)
     * @param user Address to check pending yield for
     * @return pendingYield Amount of pending yield in USDC terms
     */
    function getPendingYield(address user) external view virtual returns (uint256 pendingYield) {
        // Calculate what the redemption value would be if we accrued now
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        uint256 simulatedRedemptionValue = redemptionValue;
        
        if (timeElapsed > 0) {
            uint256 yieldRate = (currentAPY * timeElapsed) / (10000 * 365 * 24 * 3600);
            simulatedRedemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;
        }
        
        // Calculate current value with simulated redemption value
        uint256 currentValue = (balanceOf(user) * simulatedRedemptionValue) / 1e18;
        uint256 originalValue = originalDeposits[user];
        
        if (currentValue > originalValue) {
            pendingYield = currentValue - originalValue;
        }
    }

    /**
     * @dev Get current yield earned by an address
     * @param user Address to check yield for
     * @return yieldEarned Amount of yield earned in USDC terms
     */
    function getYieldEarned(address user) external view returns (uint256 yieldEarned) {
        uint256 currentValue = (balanceOf(user) * redemptionValue) / 1e18;
        uint256 originalValue = originalDeposits[user];
        
        if (currentValue > originalValue) {
            yieldEarned = currentValue - originalValue;
        }
    }

    /**
     * @dev Get current value of RWA holdings in USDC terms
     * @param user Address to check value for
     * @return currentValue Current value in USDC
     */
    function getCurrentValue(address user) external view returns (uint256 currentValue) {
        currentValue = (balanceOf(user) * redemptionValue) / 1e18;
    }

    /**
     * @dev Update APY (owner only)
     * @param newAPY New APY in basis points
     */
    function setApyBps(uint256 newAPY) external onlyOwner {
        accrueYield(); // Accrue with old APY first
        currentAPY = newAPY;
    }

    /**
     * @dev Get current APY
     * @return apy Current APY in basis points
     */
    function getAPY() external view returns (uint256 apy) {
        return currentAPY;
    }

    /**
     * @dev Simulate time passage for testing (testnet only)
     * @param timeInSeconds Number of seconds to simulate
     */
    function simulateTimePassage(uint256 timeInSeconds) external onlyOwner {
        lastAccrualTime += timeInSeconds;
        accrueYield();
    }

    /**
     * @dev Emergency mint for testing purposes (testnet only)
     * @param to Address to mint to
     * @param amount Amount to mint
     */
    function emergencyMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Calculate tokens to mint based on USDC amount (can be overridden for different mechanics)
     * @param usdcAmount Amount of USDC being deposited
     * @return tokenAmount Amount of tokens to mint
     */
    function _calculateTokensToMint(uint256 usdcAmount) internal view virtual returns (uint256 tokenAmount) {
        // Default: value-accruing mechanism (like USDY)
        tokenAmount = (usdcAmount * 1e18) / redemptionValue;
    }

    /**
     * @dev Calculate USDC amount from tokens (can be overridden for different mechanics)
     * @param tokenAmount Amount of tokens being redeemed
     * @return usdcAmount Amount of USDC to return
     */
    function _calculateUSDCFromTokens(uint256 tokenAmount) internal view virtual returns (uint256 usdcAmount) {
        // Default: value-accruing mechanism (like USDY)
        usdcAmount = (tokenAmount * redemptionValue) / 1e18;
    }
}