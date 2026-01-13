// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title ExpenseTrackerUpgradeable
 * @dev Upgradeable contract for tracking expenses with OCR integration
 * @notice This contract allows users to record expenses from receipts processed via OCR
 */
contract ExpenseTrackerUpgradeable is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable 
{
    // Expense structure
    struct Expense {
        uint256 id;
        address user;
        string vendor;
        uint256 amount; // Amount in wei (for precision)
        string currency; // Currency code (USD, NGN, etc.)
        uint256 date; // Unix timestamp
        string category; // Business type/category
        string receiptHash; // IPFS hash or image hash
        uint8 confidence; // OCR confidence score (0-100)
        bool verified; // Manual verification status
        uint256 createdAt; // Block timestamp
    }

    // Recurring expense structure
    struct RecurringExpense {
        uint256 id;
        address user;
        string vendor;
        uint256 amount;
        string currency;
        string category;
        uint256 frequency; // Frequency in seconds (weekly=604800, monthly=2629746)
        uint256 nextDue; // Next payment timestamp
        bool active;
        uint256 createdAt;
    }

    // State variables
    mapping(address => Expense[]) private userExpenses;
    mapping(address => RecurringExpense[]) private userRecurringExpenses;
    mapping(address => mapping(string => uint256)) private categoryTotals; // user => category => total
    mapping(address => uint256) private userTotalExpenses;
    
    uint256 private nextExpenseId;
    uint256 private nextRecurringId;
    
    // OCR processor addresses (for access control)
    mapping(address => bool) public authorizedProcessors;
    
    // Events
    event ExpenseAdded(
        uint256 indexed expenseId,
        address indexed user,
        string vendor,
        uint256 amount,
        string currency,
        string category,
        uint8 confidence
    );
    
    event RecurringExpenseAdded(
        uint256 indexed recurringId,
        address indexed user,
        string vendor,
        uint256 amount,
        string currency,
        uint256 frequency
    );
    
    event ExpenseVerified(uint256 indexed expenseId, address indexed user);
    event ProcessorAuthorized(address indexed processor);
    event ProcessorRevoked(address indexed processor);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     */
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        
        nextExpenseId = 1;
        nextRecurringId = 1;
    }

    /**
     * @dev Add a new expense (can be called by user or authorized processor)
     */
    function addExpense(
        string memory _vendor,
        uint256 _amount,
        string memory _currency,
        uint256 _date,
        string memory _category,
        string memory _receiptHash,
        uint8 _confidence
    ) external whenNotPaused nonReentrant {
        require(bytes(_vendor).length > 0, "Vendor cannot be empty");
        require(_amount > 0, "Amount must be greater than 0");
        require(_confidence <= 100, "Confidence must be 0-100");
        
        uint256 expenseId = nextExpenseId++;
        
        Expense memory newExpense = Expense({
            id: expenseId,
            user: msg.sender,
            vendor: _vendor,
            amount: _amount,
            currency: _currency,
            date: _date,
            category: _category,
            receiptHash: _receiptHash,
            confidence: _confidence,
            verified: false,
            createdAt: block.timestamp
        });
        
        userExpenses[msg.sender].push(newExpense);
        categoryTotals[msg.sender][_category] += _amount;
        userTotalExpenses[msg.sender] += _amount;
        
        emit ExpenseAdded(expenseId, msg.sender, _vendor, _amount, _currency, _category, _confidence);
    }

    /**
     * @dev Add expense on behalf of user (only authorized processors)
     */
    function addExpenseForUser(
        address _user,
        string memory _vendor,
        uint256 _amount,
        string memory _currency,
        uint256 _date,
        string memory _category,
        string memory _receiptHash,
        uint8 _confidence
    ) external whenNotPaused nonReentrant {
        require(authorizedProcessors[msg.sender], "Not authorized processor");
        require(_user != address(0), "Invalid user address");
        require(bytes(_vendor).length > 0, "Vendor cannot be empty");
        require(_amount > 0, "Amount must be greater than 0");
        require(_confidence <= 100, "Confidence must be 0-100");
        
        uint256 expenseId = nextExpenseId++;
        
        Expense memory newExpense = Expense({
            id: expenseId,
            user: _user,
            vendor: _vendor,
            amount: _amount,
            currency: _currency,
            date: _date,
            category: _category,
            receiptHash: _receiptHash,
            confidence: _confidence,
            verified: false,
            createdAt: block.timestamp
        });
        
        userExpenses[_user].push(newExpense);
        categoryTotals[_user][_category] += _amount;
        userTotalExpenses[_user] += _amount;
        
        emit ExpenseAdded(expenseId, _user, _vendor, _amount, _currency, _category, _confidence);
    }

    /**
     * @dev Add a recurring expense
     */
    function addRecurringExpense(
        string memory _vendor,
        uint256 _amount,
        string memory _currency,
        string memory _category,
        uint256 _frequency,
        uint256 _nextDue
    ) external whenNotPaused nonReentrant {
        require(bytes(_vendor).length > 0, "Vendor cannot be empty");
        require(_amount > 0, "Amount must be greater than 0");
        require(_frequency > 0, "Frequency must be greater than 0");
        require(_nextDue > block.timestamp, "Next due must be in future");
        
        uint256 recurringId = nextRecurringId++;
        
        RecurringExpense memory newRecurring = RecurringExpense({
            id: recurringId,
            user: msg.sender,
            vendor: _vendor,
            amount: _amount,
            currency: _currency,
            category: _category,
            frequency: _frequency,
            nextDue: _nextDue,
            active: true,
            createdAt: block.timestamp
        });
        
        userRecurringExpenses[msg.sender].push(newRecurring);
        
        emit RecurringExpenseAdded(recurringId, msg.sender, _vendor, _amount, _currency, _frequency);
    }

    /**
     * @dev Verify an expense (mark as manually verified)
     */
    function verifyExpense(uint256 _expenseIndex) external {
        require(_expenseIndex < userExpenses[msg.sender].length, "Invalid expense index");
        
        userExpenses[msg.sender][_expenseIndex].verified = true;
        
        emit ExpenseVerified(
            userExpenses[msg.sender][_expenseIndex].id, 
            msg.sender
        );
    }

    /**
     * @dev Get user's expenses
     */
    function getUserExpenses(address _user) external view returns (Expense[] memory) {
        return userExpenses[_user];
    }

    /**
     * @dev Get user's expenses with pagination
     */
    function getUserExpensesPaginated(
        address _user, 
        uint256 _offset, 
        uint256 _limit
    ) external view returns (Expense[] memory) {
        Expense[] storage expenses = userExpenses[_user];
        require(_offset < expenses.length, "Offset out of bounds");
        
        uint256 end = _offset + _limit;
        if (end > expenses.length) {
            end = expenses.length;
        }
        
        Expense[] memory result = new Expense[](end - _offset);
        for (uint256 i = _offset; i < end; i++) {
            result[i - _offset] = expenses[i];
        }
        
        return result;
    }

    /**
     * @dev Get user's recurring expenses
     */
    function getUserRecurringExpenses(address _user) external view returns (RecurringExpense[] memory) {
        return userRecurringExpenses[_user];
    }

    /**
     * @dev Get user's total expenses
     */
    function getUserTotalExpenses(address _user) external view returns (uint256) {
        return userTotalExpenses[_user];
    }

    /**
     * @dev Get user's category totals
     */
    function getUserCategoryTotal(address _user, string memory _category) external view returns (uint256) {
        return categoryTotals[_user][_category];
    }

    /**
     * @dev Get expense count for user
     */
    function getUserExpenseCount(address _user) external view returns (uint256) {
        return userExpenses[_user].length;
    }

    /**
     * @dev Get expenses by date range
     */
    function getExpensesByDateRange(
        address _user,
        uint256 _startDate,
        uint256 _endDate
    ) external view returns (Expense[] memory) {
        Expense[] storage expenses = userExpenses[_user];
        uint256 count = 0;
        
        // Count matching expenses
        for (uint256 i = 0; i < expenses.length; i++) {
            if (expenses[i].date >= _startDate && expenses[i].date <= _endDate) {
                count++;
            }
        }
        
        // Create result array
        Expense[] memory result = new Expense[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < expenses.length; i++) {
            if (expenses[i].date >= _startDate && expenses[i].date <= _endDate) {
                result[index] = expenses[i];
                index++;
            }
        }
        
        return result;
    }

    /**
     * @dev Authorize OCR processor
     */
    function authorizeProcessor(address _processor) external onlyOwner {
        require(_processor != address(0), "Invalid processor address");
        authorizedProcessors[_processor] = true;
        emit ProcessorAuthorized(_processor);
    }

    /**
     * @dev Revoke OCR processor authorization
     */
    function revokeProcessor(address _processor) external onlyOwner {
        authorizedProcessors[_processor] = false;
        emit ProcessorRevoked(_processor);
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
     * @dev Required for UUPS upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}