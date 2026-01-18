// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title IRWA
 * @dev Interface for RWA token contracts
 */
interface IRWA {
    function deposit(uint256 usdcAmount) external;
    function redeem(uint256 tokenAmount) external;
    function balanceOf(address account) external view returns (uint256);
    function getPendingYield(address user) external view returns (uint256);
    function getCurrentValue(address user) external view returns (uint256);
    function getYieldEarned(address user) external view returns (uint256);
    function getAPY() external view returns (uint256);
}

/**
 * @title BucketVaultUpgradeable
 * @dev Upgradeable smart contract for automated fund splitting across budget buckets with savings goals
 * @custom:security-contact security@paywarp.com
 */
contract BucketVaultUpgradeable is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    struct SplitConfig {
        uint256 billingsPercent;
        uint256 savingsPercent;
        uint256 growthPercent;
        uint256 instantPercent;
        uint256 spendablePercent;
    }

    struct SavingsGoal {
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 targetDate;
        string description;
        bool completed;
        bool locked;
        uint256 bonusAPY; // Basis points (100 = 1%)
        uint256 createdAt;
    }

    struct BucketBalance {
        uint256 balance;
        uint256 yieldBalance;
        bool isYielding;
        uint256 lastYieldUpdate;
    }

    // Constants
    uint256 public constant BASIS_POINTS = 10000; // 100.00%
    uint256 public constant BONUS_APY = 100; // 1% bonus APY in basis points
    uint256 public constant MAX_SPLIT_PERCENT = 10000; // 100%
    uint256 public constant MIN_DEPOSIT = 1e6; // Minimum deposit (1 USDC with 6 decimals)

    // State variables
    mapping(address => SplitConfig) public userSplitConfigs;
    mapping(address => mapping(string => BucketBalance)) public userBuckets;
    mapping(address => mapping(uint256 => SavingsGoal)) public userSavingsGoals;
    mapping(address => uint256) public userGoalCount;
    mapping(address => bool) public authorizedOperators;
    mapping(address => uint256) public userNonces;
    
    IERC20 public baseToken; // USDC or similar
    address public yieldToken; // USDY or mUSD address (deprecated, use rwaContracts)
    uint256 public totalValueLocked;
    uint256 public protocolFee; // Basis points
    address public feeRecipient;

    // RWA Integration
    mapping(string => address) public rwaContracts; // bucket name => RWA contract address
    mapping(address => mapping(string => uint256)) public userRWABalances; // user => bucket => RWA token balance
    bool public rwaIntegrationEnabled;

    // Security features
    mapping(address => uint256) public dailyWithdrawLimits;
    mapping(address => mapping(uint256 => uint256)) public dailyWithdrawn; // user => day => amount
    uint256 public emergencyWithdrawDelay;
    mapping(address => uint256) public emergencyWithdrawRequests;

    // Events
    event FundsSplit(
        address indexed user,
        uint256 amount,
        SplitConfig config,
        uint256 nonce
    );
    
    event BucketTransfer(
        address indexed user,
        string indexed fromBucket,
        string indexed toBucket,
        uint256 amount,
        uint256 nonce
    );
    
    event GoalCreated(
        address indexed user,
        uint256 indexed goalId,
        uint256 targetAmount,
        uint256 targetDate,
        string description
    );
    
    event GoalCompleted(
        address indexed user,
        uint256 indexed goalId,
        uint256 bonusApy
    );
    
    event YieldGenerated(
        address indexed user,
        string indexed bucket,
        uint256 yieldAmount
    );

    event OperatorAuthorized(address indexed operator, bool authorized);
    event EmergencyWithdrawRequested(address indexed user, uint256 timestamp);
    event EmergencyWithdrawExecuted(address indexed user, uint256 amount);
    event DailyLimitSet(address indexed user, uint256 limit);

    // RWA Integration Events
    event RWAContractSet(string indexed bucket, address indexed rwaContract);
    event RWADeposit(address indexed user, string indexed bucket, uint256 usdcAmount, uint256 rwaTokenAmount);
    event RWAWithdrawal(address indexed user, string indexed bucket, uint256 rwaTokenAmount, uint256 usdcAmount);
    event RWAIntegrationToggled(bool enabled);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param _baseToken Base token address (USDC)
     * @param _owner Contract owner
     */
    function initialize(
        address _baseToken,
        address _owner
    ) public initializer {
        require(_baseToken != address(0), "Invalid base token");
        require(_owner != address(0), "Invalid owner");

        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        baseToken = IERC20(_baseToken);
        protocolFee = 50; // 0.5%
        feeRecipient = _owner;
        emergencyWithdrawDelay = 24 hours;
    }

    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Set the yield token address (USDY/mUSD)
     */
    function setYieldToken(address _yieldToken) external onlyOwner {
        require(_yieldToken != address(0), "Invalid yield token");
        yieldToken = _yieldToken;
    }

    /**
     * @dev Set protocol fee
     * @param _protocolFee Fee in basis points (max 500 = 5%)
     */
    function setProtocolFee(uint256 _protocolFee) external onlyOwner {
        require(_protocolFee <= 500, "Fee too high"); // Max 5%
        protocolFee = _protocolFee;
    }

    /**
     * @dev Set fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Set RWA contract for a specific bucket
     * @param bucket Bucket name (billings, savings, growth, instant)
     * @param rwaContract Address of the RWA contract
     */
    function setRWAContract(string memory bucket, address rwaContract) external onlyOwner {
        require(rwaContract != address(0), "Invalid RWA contract");
        require(
            keccak256(abi.encodePacked(bucket)) == keccak256(abi.encodePacked("billings")) ||
            keccak256(abi.encodePacked(bucket)) == keccak256(abi.encodePacked("savings")) ||
            keccak256(abi.encodePacked(bucket)) == keccak256(abi.encodePacked("growth")) ||
            keccak256(abi.encodePacked(bucket)) == keccak256(abi.encodePacked("instant")),
            "Invalid bucket name"
        );
        
        rwaContracts[bucket] = rwaContract;
        emit RWAContractSet(bucket, rwaContract);
    }

    /**
     * @dev Enable or disable RWA integration
     * @param enabled Whether RWA integration should be enabled
     */
    function setRWAIntegrationEnabled(bool enabled) external onlyOwner {
        rwaIntegrationEnabled = enabled;
        emit RWAIntegrationToggled(enabled);
    }

    /**
     * @dev Authorize/deauthorize operator
     */
    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
        emit OperatorAuthorized(operator, authorized);
    }

    /**
     * @dev Set daily withdraw limit for user
     */
    function setDailyWithdrawLimit(uint256 limit) external {
        dailyWithdrawLimits[msg.sender] = limit;
        emit DailyLimitSet(msg.sender, limit);
    }

    /**
     * @dev Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Set user's split configuration
     * @param config Split percentages that must sum to 100%
     */
    function setSplitConfig(SplitConfig memory config) external whenNotPaused {
        require(
            config.billingsPercent + 
            config.savingsPercent + 
            config.growthPercent + 
            config.instantPercent + 
            config.spendablePercent == BASIS_POINTS,
            "Split percentages must sum to 100%"
        );
        
        // Validate individual percentages
        require(config.billingsPercent <= MAX_SPLIT_PERCENT, "Invalid billings percent");
        require(config.savingsPercent <= MAX_SPLIT_PERCENT, "Invalid savings percent");
        require(config.growthPercent <= MAX_SPLIT_PERCENT, "Invalid growth percent");
        require(config.instantPercent <= MAX_SPLIT_PERCENT, "Invalid instant percent");
        require(config.spendablePercent <= MAX_SPLIT_PERCENT, "Invalid spendable percent");
        
        userSplitConfigs[msg.sender] = config;
    }

    /**
     * @dev Deposit tokens and automatically split across buckets
     * @param amount Amount to deposit and split
     */
    function depositAndSplit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_DEPOSIT, "Amount below minimum");
        
        SplitConfig memory config = userSplitConfigs[msg.sender];
        require(
            config.billingsPercent + config.savingsPercent + 
            config.growthPercent + config.instantPercent + 
            config.spendablePercent > 0,
            "Split configuration not set"
        );

        // Calculate protocol fee
        uint256 fee = (amount * protocolFee) / BASIS_POINTS;
        uint256 netAmount = amount - fee;

        // Transfer tokens from user
        baseToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Transfer fee to recipient
        if (fee > 0) {
            baseToken.safeTransfer(feeRecipient, fee);
        }

        // Calculate and allocate to each bucket
        uint256 billingsAmount = (netAmount * config.billingsPercent) / BASIS_POINTS;
        uint256 savingsAmount = (netAmount * config.savingsPercent) / BASIS_POINTS;
        uint256 growthAmount = (netAmount * config.growthPercent) / BASIS_POINTS;
        uint256 instantAmount = (netAmount * config.instantPercent) / BASIS_POINTS;
        uint256 spendableAmount = (netAmount * config.spendablePercent) / BASIS_POINTS;

        // Route funds to RWA contracts or update bucket balances
        if (rwaIntegrationEnabled) {
            _routeToRWA(msg.sender, "billings", billingsAmount);
            _routeToRWA(msg.sender, "savings", savingsAmount);
            _routeToRWA(msg.sender, "growth", growthAmount);
            _routeToRWA(msg.sender, "instant", instantAmount);
            // Spendable bucket always stays in USDC
            userBuckets[msg.sender]["spendable"].balance += spendableAmount;
        } else {
            // Fallback to regular bucket balances
            userBuckets[msg.sender]["billings"].balance += billingsAmount;
            userBuckets[msg.sender]["savings"].balance += savingsAmount;
            userBuckets[msg.sender]["growth"].balance += growthAmount;
            userBuckets[msg.sender]["instant"].balance += instantAmount;
            userBuckets[msg.sender]["spendable"].balance += spendableAmount;
        }

        // Update TVL
        totalValueLocked += netAmount;

        // Handle overflow from billings to growth
        _handleBillingsOverflow(msg.sender);

        uint256 nonce = userNonces[msg.sender]++;
        emit FundsSplit(msg.sender, netAmount, config, nonce);
    }

    /**
     * @dev Transfer funds between buckets with rule enforcement
     * @param fromBucket Source bucket name
     * @param toBucket Destination bucket name
     * @param amount Amount to transfer
     */
    function transferBetweenBuckets(
        string memory fromBucket,
        string memory toBucket,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        // Enforce Growth bucket rule - no direct withdrawals
        require(
            keccak256(abi.encodePacked(fromBucket)) != keccak256(abi.encodePacked("growth")) ||
            keccak256(abi.encodePacked(toBucket)) != keccak256(abi.encodePacked("external")),
            "Cannot withdraw directly from Growth bucket"
        );

        BucketBalance storage fromBucketBalance = userBuckets[msg.sender][fromBucket];
        require(fromBucketBalance.balance >= amount, "Insufficient balance");

        // Execute transfer
        fromBucketBalance.balance -= amount;
        userBuckets[msg.sender][toBucket].balance += amount;

        uint256 nonce = userNonces[msg.sender]++;
        emit BucketTransfer(msg.sender, fromBucket, toBucket, amount, nonce);
    }

    /**
     * @dev Create a savings goal with fund locking
     * @param targetAmount Target amount for the goal
     * @param targetDate Target completion date (timestamp)
     * @param description Goal description
     */
    function createSavingsGoal(
        uint256 targetAmount,
        uint256 targetDate,
        string memory description
    ) external whenNotPaused {
        require(targetAmount > 0, "Target amount must be greater than 0");
        require(targetDate > block.timestamp, "Target date must be in the future");
        require(targetDate <= block.timestamp + 365 days * 5, "Target date too far"); // Max 5 years
        require(bytes(description).length > 0, "Description required");

        uint256 goalId = userGoalCount[msg.sender];
        userSavingsGoals[msg.sender][goalId] = SavingsGoal({
            targetAmount: targetAmount,
            currentAmount: 0,
            targetDate: targetDate,
            description: description,
            completed: false,
            locked: true,
            bonusAPY: 0,
            createdAt: block.timestamp
        });

        userGoalCount[msg.sender]++;

        emit GoalCreated(msg.sender, goalId, targetAmount, targetDate, description);
    }

    /**
     * @dev Contribute to a savings goal
     * @param goalId Goal identifier
     * @param amount Amount to contribute
     */
    function contributeToGoal(uint256 goalId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(goalId < userGoalCount[msg.sender], "Goal not found");
        
        SavingsGoal storage goal = userSavingsGoals[msg.sender][goalId];
        require(!goal.completed, "Goal already completed");
        require(goal.locked, "Goal not active");
        require(block.timestamp <= goal.targetDate, "Goal expired");

        // Transfer from savings bucket
        BucketBalance storage savingsBucket = userBuckets[msg.sender]["savings"];
        require(savingsBucket.balance >= amount, "Insufficient savings balance");

        savingsBucket.balance -= amount;
        goal.currentAmount += amount;

        // Check if goal is completed
        if (goal.currentAmount >= goal.targetAmount) {
            goal.completed = true;
            goal.bonusAPY = BONUS_APY;
            emit GoalCompleted(msg.sender, goalId, BONUS_APY);
        }
    }

    /**
     * @dev Request emergency withdrawal
     */
    function requestEmergencyWithdraw() external {
        emergencyWithdrawRequests[msg.sender] = block.timestamp;
        emit EmergencyWithdrawRequested(msg.sender, block.timestamp);
    }

    /**
     * @dev Execute emergency withdrawal after delay
     * @param bucket Bucket to withdraw from
     * @param amount Amount to withdraw
     */
    function executeEmergencyWithdraw(
        string memory bucket,
        uint256 amount
    ) external nonReentrant {
        require(
            emergencyWithdrawRequests[msg.sender] != 0 &&
            block.timestamp >= emergencyWithdrawRequests[msg.sender] + emergencyWithdrawDelay,
            "Emergency withdraw not ready"
        );

        BucketBalance storage bucketBalance = userBuckets[msg.sender][bucket];
        require(bucketBalance.balance >= amount, "Insufficient balance");

        bucketBalance.balance -= amount;
        totalValueLocked -= amount;
        
        // Reset emergency request
        emergencyWithdrawRequests[msg.sender] = 0;

        baseToken.safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawExecuted(msg.sender, amount);
    }

    /**
     * @dev Withdraw from a bucket (with restrictions and limits)
     * @param bucket Bucket name
     * @param amount Amount to withdraw
     */
    function withdrawFromBucket(string memory bucket, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        // Prevent direct withdrawal from Growth bucket
        require(
            keccak256(abi.encodePacked(bucket)) != keccak256(abi.encodePacked("growth")),
            "Cannot withdraw directly from Growth bucket"
        );

        // Check daily limit
        uint256 today = block.timestamp / 1 days;
        uint256 dailyLimit = dailyWithdrawLimits[msg.sender];
        if (dailyLimit > 0) {
            require(
                dailyWithdrawn[msg.sender][today] + amount <= dailyLimit,
                "Daily withdraw limit exceeded"
            );
            dailyWithdrawn[msg.sender][today] += amount;
        }

        uint256 actualWithdrawn;
        
        if (rwaIntegrationEnabled && rwaContracts[bucket] != address(0)) {
            // Withdraw from RWA contract
            actualWithdrawn = _withdrawFromRWA(msg.sender, bucket, amount);
        } else {
            // Withdraw from regular bucket balance
            BucketBalance storage bucketBalance = userBuckets[msg.sender][bucket];
            require(bucketBalance.balance >= amount, "Insufficient balance");
            
            bucketBalance.balance -= amount;
            actualWithdrawn = amount;
        }

        totalValueLocked -= actualWithdrawn;
        baseToken.safeTransfer(msg.sender, actualWithdrawn);
    }

    /**
     * @dev Handle automatic overflow from billings to growth bucket
     * @param user User address
     */
    function _handleBillingsOverflow(address user) internal {
        BucketBalance storage billingsBucket = userBuckets[user]["billings"];
        
        // Example: if billings exceeds a certain threshold, overflow to growth
        uint256 overflowThreshold = 1000 * 10**6; // 1000 USDC (6 decimals)
        
        if (billingsBucket.balance > overflowThreshold) {
            uint256 overflow = billingsBucket.balance - overflowThreshold;
            billingsBucket.balance = overflowThreshold;
            userBuckets[user]["growth"].balance += overflow;
            
            uint256 nonce = userNonces[user]++;
            emit BucketTransfer(user, "billings", "growth", overflow, nonce);
        }
    }

    /**
     * @dev Route funds to RWA contract or fallback to regular bucket
     * @param user User address
     * @param bucket Bucket name
     * @param amount Amount to route
     */
    function _routeToRWA(address user, string memory bucket, uint256 amount) internal {
        if (amount == 0) return;
        
        address rwaContract = rwaContracts[bucket];
        
        if (rwaContract != address(0)) {
            try this._safeRWADeposit(rwaContract, amount) {
                // Track RWA token balance for user
                IRWA rwa = IRWA(rwaContract);
                uint256 rwaTokenBalance = rwa.balanceOf(address(this));
                userRWABalances[user][bucket] = rwaTokenBalance;
                
                // Update bucket to reflect RWA integration
                userBuckets[user][bucket].isYielding = true;
                userBuckets[user][bucket].lastYieldUpdate = block.timestamp;
                
                emit RWADeposit(user, bucket, amount, rwaTokenBalance);
            } catch {
                // Fallback to regular bucket balance on RWA failure
                userBuckets[user][bucket].balance += amount;
            }
        } else {
            // No RWA contract configured, use regular bucket
            userBuckets[user][bucket].balance += amount;
        }
    }

    /**
     * @dev Withdraw from RWA contract
     * @param user User address
     * @param bucket Bucket name
     * @param amount Amount to withdraw in USDC terms
     * @return actualWithdrawn Actual amount withdrawn
     */
    function _withdrawFromRWA(address user, string memory bucket, uint256 amount) internal returns (uint256 actualWithdrawn) {
        address rwaContract = rwaContracts[bucket];
        require(rwaContract != address(0), "RWA contract not set");
        
        IRWA rwa = IRWA(rwaContract);
        uint256 currentValue = rwa.getCurrentValue(address(this));
        require(currentValue >= amount, "Insufficient RWA balance");
        
        // Calculate RWA tokens to redeem based on current value
        uint256 rwaTokenBalance = rwa.balanceOf(address(this));
        uint256 tokensToRedeem = (amount * rwaTokenBalance) / currentValue;
        
        try this._safeRWARedeem(rwaContract, tokensToRedeem) {
            // Update user's RWA balance tracking
            userRWABalances[user][bucket] = rwa.balanceOf(address(this));
            
            actualWithdrawn = amount;
            emit RWAWithdrawal(user, bucket, tokensToRedeem, amount);
        } catch {
            // Fallback to regular bucket balance on RWA failure
            BucketBalance storage bucketBalance = userBuckets[user][bucket];
            require(bucketBalance.balance >= amount, "Insufficient fallback balance");
            
            bucketBalance.balance -= amount;
            actualWithdrawn = amount;
        }
    }

    /**
     * @dev Safe RWA deposit with external call isolation
     * @param rwaContract RWA contract address
     * @param amount Amount to deposit
     */
    function _safeRWADeposit(address rwaContract, uint256 amount) external {
        require(msg.sender == address(this), "Internal function only");
        
        // For mock contracts, we just call deposit with the amount
        // In production, this would involve actual USDC transfers
        IRWA(rwaContract).deposit(amount);
    }

    /**
     * @dev Safe RWA redemption with external call isolation
     * @param rwaContract RWA contract address
     * @param tokenAmount Amount of RWA tokens to redeem
     */
    function _safeRWARedeem(address rwaContract, uint256 tokenAmount) external {
        require(msg.sender == address(this), "Internal function only");
        
        // Redeem RWA tokens for USDC
        IRWA(rwaContract).redeem(tokenAmount);
    }

    /**
     * @dev Get user's bucket balance including RWA tokens and yields
     * @param user User address
     * @param bucket Bucket name
     * @return BucketBalance struct with updated values
     */
    function getBucketBalance(address user, string memory bucket) 
        external 
        view 
        returns (BucketBalance memory) 
    {
        BucketBalance memory bucketBalance = userBuckets[user][bucket];
        
        if (rwaIntegrationEnabled && rwaContracts[bucket] != address(0)) {
            // Get RWA token balance and current value
            IRWA rwaContract = IRWA(rwaContracts[bucket]);
            uint256 rwaTokenBalance = rwaContract.balanceOf(user);
            uint256 currentValue = rwaContract.getCurrentValue(user);
            uint256 pendingYield = rwaContract.getPendingYield(user);
            
            // Update bucket balance with RWA data
            bucketBalance.yieldBalance = rwaTokenBalance;
            bucketBalance.balance = currentValue; // Current USDC value of RWA tokens
            bucketBalance.isYielding = rwaTokenBalance > 0;
            bucketBalance.lastYieldUpdate = block.timestamp;
            
            // Add pending yield to balance for display purposes
            if (pendingYield > 0) {
                bucketBalance.balance += pendingYield;
            }
        }
        
        return bucketBalance;
    }

    /**
     * @dev Get user's savings goal
     * @param user User address
     * @param goalId Goal identifier
     * @return SavingsGoal struct
     */
    function getSavingsGoal(address user, uint256 goalId) 
        external 
        view 
        returns (SavingsGoal memory) 
    {
        require(goalId < userGoalCount[user], "Goal not found");
        return userSavingsGoals[user][goalId];
    }

    /**
     * @dev Get user's split configuration
     * @param user User address
     * @return SplitConfig struct
     */
    function getSplitConfig(address user) external view returns (SplitConfig memory) {
        return userSplitConfigs[user];
    }

    /**
     * @dev Get RWA contract address for a bucket
     * @param bucket Bucket name
     * @return rwaContract RWA contract address
     */
    function getRWAContract(string memory bucket) external view returns (address rwaContract) {
        return rwaContracts[bucket];
    }

    /**
     * @dev Get user's RWA token balance for a bucket
     * @param user User address
     * @param bucket Bucket name
     * @return rwaBalance RWA token balance
     */
    function getUserRWABalance(address user, string memory bucket) external view returns (uint256 rwaBalance) {
        address rwaContract = rwaContracts[bucket];
        if (rwaContract != address(0)) {
            return IRWA(rwaContract).balanceOf(user);
        }
        return 0;
    }

    /**
     * @dev Get pending yield for user's bucket
     * @param user User address
     * @param bucket Bucket name
     * @return pendingYield Pending yield amount in USDC terms
     */
    function getBucketPendingYield(address user, string memory bucket) external view returns (uint256 pendingYield) {
        address rwaContract = rwaContracts[bucket];
        if (rwaContract != address(0)) {
            return IRWA(rwaContract).getPendingYield(user);
        }
        return 0;
    }

    /**
     * @dev Get APY for a bucket's RWA contract
     * @param bucket Bucket name
     * @return apy APY in basis points
     */
    function getBucketAPY(string memory bucket) external view returns (uint256 apy) {
        address rwaContract = rwaContracts[bucket];
        if (rwaContract != address(0)) {
            return IRWA(rwaContract).getAPY();
        }
        return 0;
    }

    /**
     * @dev Check if RWA integration is enabled
     * @return enabled Whether RWA integration is enabled
     */
    function isRWAIntegrationEnabled() external view returns (bool enabled) {
        return rwaIntegrationEnabled;
    }

    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}