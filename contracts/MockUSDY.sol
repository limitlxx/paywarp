// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDY
 * @dev Mock implementation of Ondo Finance USDY token for testnet development
 * Simulates yield generation through redemption value increases
 */
contract MockUSDY is ERC20, Ownable {
    uint256 public redemptionValue; // Current redemption value (starts at 1e18, increases over time)
    uint256 public currentAPY; // Current APY in basis points (e.g., 450 = 4.5%)
    uint256 public lastAccrualTime;
    
    mapping(address => uint256) public originalDeposits; // Track original USDC deposits
    
    event YieldAccrued(uint256 newRedemptionValue, uint256 apy);
    event Deposit(address indexed user, uint256 usdcAmount, uint256 usdyAmount);
    event Redemption(address indexed user, uint256 usdyAmount, uint256 usdcAmount);

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
     * @dev Deposit USDC and mint USDY tokens
     * @param usdcAmount Amount of USDC to deposit (in wei)
     */
    function deposit(uint256 usdcAmount) external {
        require(usdcAmount > 0, "Amount must be positive");
        
        // Accrue yield before minting
        accrueYield();
        
        // Calculate USDY tokens to mint based on current redemption value
        uint256 usdyAmount = (usdcAmount * 1e18) / redemptionValue;
        
        // Track original deposit for yield calculation
        originalDeposits[msg.sender] += usdcAmount;
        
        // Mint USDY tokens
        _mint(msg.sender, usdyAmount);
        
        emit Deposit(msg.sender, usdcAmount, usdyAmount);
    }

    /**
     * @dev Redeem USDY tokens for USDC
     * @param usdyAmount Amount of USDY tokens to redeem
     */
    function redeem(uint256 usdyAmount) external {
        require(usdyAmount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= usdyAmount, "Insufficient balance");
        
        // Accrue yield before redemption
        accrueYield();
        
        // Calculate USDC amount based on current redemption value
        uint256 usdcAmount = (usdyAmount * redemptionValue) / 1e18;
        
        // Burn USDY tokens
        _burn(msg.sender, usdyAmount);
        
        // Update original deposits proportionally
        uint256 totalBalance = balanceOf(msg.sender) + usdyAmount;
        if (totalBalance > 0) {
            originalDeposits[msg.sender] = (originalDeposits[msg.sender] * balanceOf(msg.sender)) / totalBalance;
        }
        
        emit Redemption(msg.sender, usdyAmount, usdcAmount);
    }

    /**
     * @dev Accrue yield by updating redemption value
     */
    function accrueYield() public {
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
     * @dev Get current value of USDY holdings in USDC terms
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
    function updateAPY(uint256 newAPY) external onlyOwner {
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
}