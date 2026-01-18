// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./MockRWA.sol";

/**
 * @title MockUSDe
 * @dev Mock implementation of Ethena USDe token for testnet development
 * Simulates hedging yield through staking mechanics with variable rewards
 */
contract MockUSDe is MockRWA {
    uint256 public stakingRewardMultiplier; // Multiplier for staking rewards (1e18 = 1x)
    uint256 public lastRewardUpdate;
    uint256 public accumulatedRewards; // Total rewards accumulated per token
    
    mapping(address => uint256) public userRewardDebt; // Track user reward debt for staking calculation
    mapping(address => uint256) public stakedBalances; // Track staked token amounts
    
    event StakingReward(address indexed user, uint256 rewardAmount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialAPY
    ) MockRWA(name, symbol, initialAPY) {
        stakingRewardMultiplier = 1e18; // Start with 1x multiplier
        lastRewardUpdate = block.timestamp;
    }

    /**
     * @dev Override deposit to automatically stake tokens for yield
     * @param usdcAmount Amount of USDC to deposit (in wei)
     */
    function deposit(uint256 usdcAmount) external override {
        require(usdcAmount > 0, "Amount must be positive");
        
        // Accrue yield and update rewards before minting
        accrueYield();
        _updateRewards();
        
        // Calculate tokens to mint (1:1 ratio for USDe)
        uint256 tokenAmount = usdcAmount; // USDe maintains 1:1 peg
        
        // Track original deposit for yield calculation
        originalDeposits[msg.sender] += usdcAmount;
        
        // Mint tokens
        _mint(msg.sender, tokenAmount);
        
        // Automatically stake for yield
        _stake(msg.sender, tokenAmount);
        
        emit Deposit(msg.sender, usdcAmount, tokenAmount);
    }

    /**
     * @dev Override redeem to handle staked tokens
     * @param tokenAmount Amount of USDe tokens to redeem
     */
    function redeem(uint256 tokenAmount) external override {
        require(tokenAmount > 0, "Amount must be positive");
        require(stakedBalances[msg.sender] >= tokenAmount, "Insufficient staked balance");
        
        // Accrue yield and update rewards before redemption
        accrueYield();
        _updateRewards();
        
        // Claim any pending rewards
        _claimRewards(msg.sender);
        
        // Unstake tokens
        _unstake(msg.sender, tokenAmount);
        
        // Calculate USDC amount (1:1 for base, plus any yield from rewards)
        uint256 usdcAmount = tokenAmount;
        
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
     * @dev Override accrual to include staking rewards
     */
    function accrueYield() public override {
        super.accrueYield();
        _updateRewards();
    }

    /**
     * @dev Get pending yield including staking rewards
     * @param user Address to check pending yield for
     * @return pendingYield Amount of pending yield in USDC terms
     */
    function getPendingYield(address user) external view override returns (uint256 pendingYield) {
        // Calculate base yield manually (same logic as parent contract)
        uint256 timeElapsed = block.timestamp - lastAccrualTime;
        uint256 simulatedRedemptionValue = redemptionValue;
        
        if (timeElapsed > 0) {
            uint256 yieldRate = (currentAPY * timeElapsed) / (10000 * 365 * 24 * 3600);
            simulatedRedemptionValue = redemptionValue + (redemptionValue * yieldRate) / 1e18;
        }
        
        uint256 currentValue = (balanceOf(user) * simulatedRedemptionValue) / 1e18;
        uint256 originalValue = originalDeposits[user];
        
        uint256 baseYield = 0;
        if (currentValue > originalValue) {
            baseYield = currentValue - originalValue;
        }
        
        // Calculate pending staking rewards
        uint256 timeElapsedRewards = block.timestamp - lastRewardUpdate;
        uint256 simulatedAccumulatedRewards = accumulatedRewards;
        
        if (timeElapsedRewards > 0 && totalSupply() > 0) {
            // Simulate reward accumulation
            uint256 rewardRate = (currentAPY * stakingRewardMultiplier) / (10000 * 1e18);
            uint256 newRewards = (rewardRate * timeElapsedRewards) / (365 * 24 * 3600);
            simulatedAccumulatedRewards += newRewards;
        }
        
        // Calculate user's share of rewards
        uint256 userStaked = stakedBalances[user];
        if (userStaked > 0) {
            uint256 pendingRewards = (userStaked * simulatedAccumulatedRewards) / 1e18 - userRewardDebt[user];
            pendingYield = baseYield + pendingRewards;
        } else {
            pendingYield = baseYield;
        }
    }

    /**
     * @dev Claim staking rewards
     */
    function claimRewards() external {
        _updateRewards();
        _claimRewards(msg.sender);
    }

    /**
     * @dev Set staking reward multiplier (owner only)
     * @param newMultiplier New multiplier (1e18 = 1x)
     */
    function setStakingRewardMultiplier(uint256 newMultiplier) external onlyOwner {
        _updateRewards();
        stakingRewardMultiplier = newMultiplier;
    }

    /**
     * @dev Get staked balance for user
     * @param user Address to check
     * @return stakedAmount Amount of tokens staked
     */
    function getStakedBalance(address user) external view returns (uint256 stakedAmount) {
        return stakedBalances[user];
    }

    /**
     * @dev Override token calculation for USDe (1:1 peg)
     */
    function _calculateTokensToMint(uint256 usdcAmount) internal pure override returns (uint256 tokenAmount) {
        // USDe maintains 1:1 peg with USDC
        tokenAmount = usdcAmount;
    }

    /**
     * @dev Override USDC calculation for USDe (1:1 peg)
     */
    function _calculateUSDCFromTokens(uint256 tokenAmount) internal pure override returns (uint256 usdcAmount) {
        // USDe maintains 1:1 peg with USDC
        usdcAmount = tokenAmount;
    }

    /**
     * @dev Internal function to stake tokens
     */
    function _stake(address user, uint256 amount) internal {
        _updateRewards();
        
        // Claim any existing rewards before staking more
        if (stakedBalances[user] > 0) {
            _claimRewards(user);
        }
        
        stakedBalances[user] += amount;
        userRewardDebt[user] = (stakedBalances[user] * accumulatedRewards) / 1e18;
        
        emit Staked(user, amount);
    }

    /**
     * @dev Internal function to unstake tokens
     */
    function _unstake(address user, uint256 amount) internal {
        require(stakedBalances[user] >= amount, "Insufficient staked balance");
        
        _updateRewards();
        _claimRewards(user);
        
        stakedBalances[user] -= amount;
        userRewardDebt[user] = (stakedBalances[user] * accumulatedRewards) / 1e18;
        
        emit Unstaked(user, amount);
    }

    /**
     * @dev Update accumulated rewards
     */
    function _updateRewards() internal {
        uint256 timeElapsed = block.timestamp - lastRewardUpdate;
        
        if (timeElapsed > 0 && totalSupply() > 0) {
            // Calculate new rewards based on APY and staking multiplier
            uint256 rewardRate = (currentAPY * stakingRewardMultiplier) / (10000 * 1e18);
            uint256 newRewards = (rewardRate * timeElapsed) / (365 * 24 * 3600);
            accumulatedRewards += newRewards;
            lastRewardUpdate = block.timestamp;
        }
    }

    /**
     * @dev Claim rewards for user
     */
    function _claimRewards(address user) internal {
        uint256 userStaked = stakedBalances[user];
        if (userStaked > 0) {
            uint256 pendingRewards = (userStaked * accumulatedRewards) / 1e18 - userRewardDebt[user];
            if (pendingRewards > 0) {
                // Mint reward tokens
                _mint(user, pendingRewards);
                userRewardDebt[user] = (userStaked * accumulatedRewards) / 1e18;
                
                emit StakingReward(user, pendingRewards);
            }
        }
    }
}