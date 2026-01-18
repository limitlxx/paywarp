// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MockRWA.sol";

/**
 * @title MockmETH
 * @dev Mock implementation of Mantle mETH token for testnet development
 * Simulates value-accruing staking rewards with MEV simulation and variable rewards
 */
contract MockmETH is MockRWA {
    uint256 public mevRewardPool; // Pool of MEV rewards to distribute
    uint256 public lastMevDistribution;
    uint256 public mevDistributionInterval; // Time between MEV distributions
    uint256 public baseStakingRate; // Base staking rate separate from MEV
    
    mapping(address => uint256) public lastClaimTime; // Track last claim time for each user
    mapping(address => uint256) public mevRewardDebt; // Track MEV reward debt
    
    event MEVRewardDistributed(uint256 totalReward, uint256 perTokenReward);
    event MEVRewardClaimed(address indexed user, uint256 rewardAmount);
    event StakingRewardAccrued(address indexed user, uint256 rewardAmount);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialAPY
    ) MockRWA(name, symbol, initialAPY) {
        baseStakingRate = initialAPY / 2; // Half of APY from base staking, half from MEV
        mevDistributionInterval = 1 hours; // Distribute MEV rewards every hour
        lastMevDistribution = block.timestamp;
        mevRewardPool = 0;
    }

    /**
     * @dev Override deposit to initialize MEV tracking
     * @param usdcAmount Amount of USDC to deposit (in wei)
     */
    function deposit(uint256 usdcAmount) external override {
        require(usdcAmount > 0, "Amount must be positive");
        
        // Distribute any pending MEV rewards before deposit
        _distributeMEVRewards();
        
        // Accrue yield before minting
        accrueYield();
        
        // Calculate tokens to mint based on current redemption value (value-accruing)
        uint256 tokenAmount = (usdcAmount * 1e18) / redemptionValue;
        
        // Track original deposit for yield calculation
        originalDeposits[msg.sender] += usdcAmount;
        
        // Initialize MEV tracking for new user
        if (balanceOf(msg.sender) == 0) {
            lastClaimTime[msg.sender] = block.timestamp;
            mevRewardDebt[msg.sender] = 0;
        }
        
        // Mint tokens
        _mint(msg.sender, tokenAmount);
        
        emit Deposit(msg.sender, usdcAmount, tokenAmount);
    }

    /**
     * @dev Override redeem to handle MEV rewards
     * @param tokenAmount Amount of mETH tokens to redeem
     */
    function redeem(uint256 tokenAmount) external override {
        require(tokenAmount > 0, "Amount must be positive");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");
        
        // Distribute and claim MEV rewards before redemption
        _distributeMEVRewards();
        _claimMEVRewards(msg.sender);
        
        // Accrue yield before redemption
        accrueYield();
        
        // Calculate USDC amount based on current redemption value
        uint256 usdcAmount = (tokenAmount * redemptionValue) / 1e18;
        
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
     * @dev Override accrual to use base staking rate and handle MEV
     */
    function accrueYield() public override {
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        if (timeElapsed > 0) {
            // Use base staking rate for redemption value increase
            uint256 yieldRate = (baseStakingRate * timeElapsed) / (10000 * 365 * 24 * 3600);
            redemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;
            lastAccrualTime = block.timestamp;
            
            emit YieldAccrued(redemptionValue, baseStakingRate);
        }
        
        // Also distribute MEV rewards if interval has passed
        _distributeMEVRewards();
    }

    /**
     * @dev Get pending yield including MEV rewards
     * @param user Address to check pending yield for
     * @return pendingYield Amount of pending yield in USDC terms
     */
    function getPendingYield(address user) external view override returns (uint256 pendingYield) {
        // Base yield from redemption value increase
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        uint256 simulatedRedemptionValue = redemptionValue;
        
        if (timeElapsed > 0) {
            uint256 yieldRate = (baseStakingRate * timeElapsed) / (10000 * 365 * 24 * 3600);
            simulatedRedemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;
        }
        
        uint256 currentValue = (balanceOf(user) * simulatedRedemptionValue) / 1e18;
        uint256 originalValue = originalDeposits[user];
        
        if (currentValue > originalValue) {
            pendingYield = currentValue - originalValue;
        }
        
        // Add pending MEV rewards
        uint256 pendingMEV = _calculatePendingMEVRewards(user);
        pendingYield += pendingMEV;
    }

    /**
     * @dev Claim MEV rewards
     */
    function claimMEVRewards() external {
        _distributeMEVRewards();
        _claimMEVRewards(msg.sender);
    }

    /**
     * @dev Add MEV rewards to the pool (simulates MEV extraction)
     * @param rewardAmount Amount of rewards to add (in USDC terms)
     */
    function addMEVRewards(uint256 rewardAmount) external onlyOwner {
        mevRewardPool += rewardAmount;
    }

    /**
     * @dev Set MEV distribution interval
     * @param newInterval New interval in seconds
     */
    function setMEVDistributionInterval(uint256 newInterval) external onlyOwner {
        mevDistributionInterval = newInterval;
    }

    /**
     * @dev Set base staking rate
     * @param newRate New base staking rate in basis points
     */
    function setBaseStakingRate(uint256 newRate) external onlyOwner {
        accrueYield(); // Accrue with old rate first
        baseStakingRate = newRate;
    }

    /**
     * @dev Get MEV reward pool size
     * @return poolSize Current MEV reward pool size
     */
    function getMEVRewardPool() external view returns (uint256 poolSize) {
        return mevRewardPool;
    }

    /**
     * @dev Calculate pending MEV rewards for user
     */
    function _calculatePendingMEVRewards(address user) internal view returns (uint256 pendingRewards) {
        if (balanceOf(user) == 0 || totalSupply() == 0) {
            return 0;
        }
        
        // Simulate MEV distribution
        uint256 timeSinceLastDistribution = block.timestamp - lastMevDistribution;
        uint256 distributionsToSimulate = timeSinceLastDistribution / mevDistributionInterval;
        
        if (distributionsToSimulate > 0 && mevRewardPool > 0) {
            // Calculate user's share of MEV rewards
            uint256 userShare = (balanceOf(user) * 1e18) / totalSupply();
            uint256 rewardPerDistribution = mevRewardPool / (distributionsToSimulate + 1); // Conservative estimate
            pendingRewards = (rewardPerDistribution * userShare) / 1e18;
        }
    }

    /**
     * @dev Distribute MEV rewards if interval has passed
     */
    function _distributeMEVRewards() internal {
        uint256 timeSinceLastDistribution = block.timestamp - lastMevDistribution;
        
        if (timeSinceLastDistribution >= mevDistributionInterval && mevRewardPool > 0 && totalSupply() > 0) {
            uint256 rewardToDistribute = mevRewardPool / 4; // Distribute 25% of pool each time
            
            if (rewardToDistribute > 0) {
                // Calculate per-token reward
                uint256 perTokenReward = (rewardToDistribute * 1e18) / totalSupply();
                
                // Update redemption value to reflect MEV rewards
                uint256 valueIncrease = (rewardToDistribute * 1e18) / totalSupply();
                redemptionValue += valueIncrease;
                
                // Reduce MEV pool
                mevRewardPool -= rewardToDistribute;
                lastMevDistribution = block.timestamp;
                
                emit MEVRewardDistributed(rewardToDistribute, perTokenReward);
            }
        }
    }

    /**
     * @dev Claim MEV rewards for user
     */
    function _claimMEVRewards(address user) internal {
        uint256 userBalance = balanceOf(user);
        if (userBalance > 0) {
            uint256 timeSinceLastClaim = block.timestamp - lastClaimTime[user];
            
            if (timeSinceLastClaim > 0) {
                // Calculate claimable MEV rewards based on time held
                uint256 mevRewards = _calculatePendingMEVRewards(user);
                
                if (mevRewards > 0) {
                    // Convert MEV rewards to additional token value (already reflected in redemption value)
                    lastClaimTime[user] = block.timestamp;
                    
                    emit MEVRewardClaimed(user, mevRewards);
                }
            }
        }
    }

    /**
     * @dev Simulate MEV extraction for testing
     * @param extractionAmount Amount of MEV to simulate
     */
    function simulateMEVExtraction(uint256 extractionAmount) external onlyOwner {
        mevRewardPool += extractionAmount;
        _distributeMEVRewards();
    }
}