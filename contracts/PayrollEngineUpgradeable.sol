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
 * @title PayrollEngineUpgradeable
 * @dev Upgradeable smart contract for automated payroll processing with Chainlink automation
 * @custom:security-contact security@paywarp.com
 */
contract PayrollEngineUpgradeable is 
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    struct PayrollEntry {
        address recipient;
        uint256 salary;
        uint256 paymentDate; // Day of month (1-31)
        bool active;
        uint256 totalPaid;
        uint256 lastPaidDate;
        string name;
        string email;
    }

    struct PayrollBatch {
        uint256 totalAmount;
        uint256 scheduledDate;
        uint256 employeeCount;
        bool processed;
        bool failed;
        string failureReason;
        uint256 processedAt;
        uint256 gasUsed;
    }

    struct PaymentRecord {
        address recipient;
        uint256 amount;
        uint256 date;
        bytes32 transactionHash;
        bool successful;
        uint256 gasUsed;
        string failureReason;
    }

    // Constants
    uint256 public constant MAX_EMPLOYEES_PER_BATCH = 100;
    uint256 public constant MIN_SALARY = 1e6; // 1 USDC minimum
    uint256 public constant MAX_SALARY = 1000000e6; // 1M USDC maximum

    // State variables
    mapping(address => mapping(uint256 => PayrollEntry)) public employeeEntries;
    mapping(address => uint256) public employeeCount;
    mapping(address => mapping(uint256 => PayrollBatch)) public payrollBatches;
    mapping(address => uint256) public batchCount;
    mapping(address => mapping(uint256 => PaymentRecord[])) public batchPayments;
    mapping(address => bool) public authorizedKeepers;
    mapping(address => uint256) public employerNonces;
    
    IERC20 public paymentToken;
    address public bucketVault;
    uint256 public protocolFee; // Basis points
    address public feeRecipient;
    
    // Chainlink Automation
    address public automationRegistry;
    uint256 public maxGasPerPayment;

    // Security features
    mapping(address => bool) public trustedEmployers;
    mapping(address => uint256) public maxBatchSize;
    uint256 public emergencyPauseDelay;
    mapping(address => uint256) public emergencyPauseRequests;

    // Events
    event EmployeeAdded(
        address indexed employer,
        address indexed employee,
        uint256 salary,
        uint256 paymentDate,
        string name
    );
    
    event EmployeeUpdated(
        address indexed employer,
        address indexed employee,
        uint256 newSalary,
        uint256 newPaymentDate
    );
    
    event EmployeeRemoved(
        address indexed employer,
        address indexed employee
    );
    
    event PayrollScheduled(
        address indexed employer,
        uint256 indexed batchId,
        uint256 scheduledDate,
        uint256 totalAmount,
        uint256 employeeCount
    );
    
    event PayrollProcessed(
        uint256 indexed batchId,
        address indexed employer,
        uint256 totalAmount,
        uint256 employeeCount,
        bool successful,
        uint256 gasUsed
    );
    
    event PaymentExecuted(
        address indexed employer,
        address indexed recipient,
        uint256 amount,
        bool successful,
        string failureReason
    );

    event KeeperAuthorized(address indexed keeper, bool authorized);
    event EmergencyPauseRequested(address indexed employer, uint256 timestamp);
    event TrustedEmployerSet(address indexed employer, bool trusted);

    modifier onlyAuthorizedKeeper() {
        require(
            authorizedKeepers[msg.sender] || msg.sender == owner(),
            "Not authorized keeper"
        );
        _;
    }

    modifier onlyTrustedEmployer() {
        require(trustedEmployers[msg.sender] || msg.sender == owner(), "Not trusted employer");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract
     * @param _paymentToken Payment token address (USDC)
     * @param _bucketVault BucketVault contract address
     * @param _owner Contract owner
     */
    function initialize(
        address _paymentToken,
        address _bucketVault,
        address _owner
    ) public initializer {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_bucketVault != address(0), "Invalid bucket vault");
        require(_owner != address(0), "Invalid owner");

        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        paymentToken = IERC20(_paymentToken);
        bucketVault = _bucketVault;
        protocolFee = 25; // 0.25%
        feeRecipient = _owner;
        maxGasPerPayment = 100000;
        emergencyPauseDelay = 1 hours;
    }

    /**
     * @dev Required by UUPSUpgradeable
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @dev Set the automation registry address
     * @param _automationRegistry Chainlink automation registry
     */
    function setAutomationRegistry(address _automationRegistry) external onlyOwner {
        automationRegistry = _automationRegistry;
    }

    /**
     * @dev Authorize a keeper for automation
     * @param keeper Keeper address
     * @param authorized Authorization status
     */
    function setAuthorizedKeeper(address keeper, bool authorized) external onlyOwner {
        authorizedKeepers[keeper] = authorized;
        emit KeeperAuthorized(keeper, authorized);
    }

    /**
     * @dev Set trusted employer status
     * @param employer Employer address
     * @param trusted Trust status
     */
    function setTrustedEmployer(address employer, bool trusted) external onlyOwner {
        trustedEmployers[employer] = trusted;
        emit TrustedEmployerSet(employer, trusted);
    }

    /**
     * @dev Set protocol fee
     * @param _protocolFee Fee in basis points (max 100 = 1%)
     */
    function setProtocolFee(uint256 _protocolFee) external onlyOwner {
        require(_protocolFee <= 100, "Fee too high"); // Max 1%
        protocolFee = _protocolFee;
    }

    /**
     * @dev Set maximum gas per payment
     */
    function setMaxGasPerPayment(uint256 _maxGas) external onlyOwner {
        require(_maxGas >= 50000 && _maxGas <= 500000, "Invalid gas limit");
        maxGasPerPayment = _maxGas;
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
     * @dev Add an employee to payroll
     * @param recipient Employee wallet address
     * @param salary Monthly salary amount
     * @param paymentDate Day of month for payment (1-31)
     * @param name Employee name
     * @param email Employee email
     */
    function addEmployee(
        address recipient,
        uint256 salary,
        uint256 paymentDate,
        string memory name,
        string memory email
    ) external whenNotPaused {
        require(recipient != address(0), "Invalid recipient address");
        require(recipient != msg.sender, "Cannot add self as employee");
        require(salary >= MIN_SALARY && salary <= MAX_SALARY, "Invalid salary amount");
        require(paymentDate >= 1 && paymentDate <= 31, "Invalid payment date");
        require(bytes(name).length > 0, "Name required");
        require(employeeCount[msg.sender] < MAX_EMPLOYEES_PER_BATCH, "Too many employees");

        // Check for duplicate recipient
        for (uint256 i = 0; i < employeeCount[msg.sender]; i++) {
            require(
                employeeEntries[msg.sender][i].recipient != recipient || 
                !employeeEntries[msg.sender][i].active,
                "Employee already exists"
            );
        }

        uint256 employeeId = employeeCount[msg.sender];
        
        employeeEntries[msg.sender][employeeId] = PayrollEntry({
            recipient: recipient,
            salary: salary,
            paymentDate: paymentDate,
            active: true,
            totalPaid: 0,
            lastPaidDate: 0,
            name: name,
            email: email
        });

        employeeCount[msg.sender]++;

        emit EmployeeAdded(msg.sender, recipient, salary, paymentDate, name);
    }

    /**
     * @dev Update employee information
     * @param employeeId Employee identifier
     * @param newSalary New salary amount
     * @param newPaymentDate New payment date
     */
    function updateEmployee(
        uint256 employeeId,
        uint256 newSalary,
        uint256 newPaymentDate
    ) external whenNotPaused {
        require(employeeId < employeeCount[msg.sender], "Employee not found");
        require(newSalary >= MIN_SALARY && newSalary <= MAX_SALARY, "Invalid salary amount");
        require(newPaymentDate >= 1 && newPaymentDate <= 31, "Invalid payment date");

        PayrollEntry storage employee = employeeEntries[msg.sender][employeeId];
        require(employee.active, "Employee not active");

        employee.salary = newSalary;
        employee.paymentDate = newPaymentDate;

        emit EmployeeUpdated(msg.sender, employee.recipient, newSalary, newPaymentDate);
    }

    /**
     * @dev Remove an employee from payroll
     * @param employeeId Employee identifier
     */
    function removeEmployee(uint256 employeeId) external whenNotPaused {
        require(employeeId < employeeCount[msg.sender], "Employee not found");

        PayrollEntry storage employee = employeeEntries[msg.sender][employeeId];
        require(employee.active, "Employee already inactive");

        employee.active = false;

        emit EmployeeRemoved(msg.sender, employee.recipient);
    }

    /**
     * @dev Schedule payroll for a specific date
     * @param scheduledDate Target date for payroll processing
     */
    function schedulePayroll(uint256 scheduledDate) external whenNotPaused {
        require(scheduledDate > block.timestamp, "Scheduled date must be in future");
        require(scheduledDate <= block.timestamp + 90 days, "Scheduled date too far");

        uint256 batchId = batchCount[msg.sender];
        uint256 totalAmount = 0;
        uint256 activeEmployees = 0;

        // Calculate total amount needed
        for (uint256 i = 0; i < employeeCount[msg.sender]; i++) {
            PayrollEntry storage employee = employeeEntries[msg.sender][i];
            if (employee.active) {
                totalAmount += employee.salary;
                activeEmployees++;
            }
        }

        require(activeEmployees > 0, "No active employees");
        require(activeEmployees <= MAX_EMPLOYEES_PER_BATCH, "Too many employees in batch");

        // Calculate protocol fee
        uint256 fee = (totalAmount * protocolFee) / 10000;
        uint256 totalWithFee = totalAmount + fee;

        payrollBatches[msg.sender][batchId] = PayrollBatch({
            totalAmount: totalWithFee,
            scheduledDate: scheduledDate,
            employeeCount: activeEmployees,
            processed: false,
            failed: false,
            failureReason: "",
            processedAt: 0,
            gasUsed: 0
        });

        batchCount[msg.sender]++;

        emit PayrollScheduled(msg.sender, batchId, scheduledDate, totalWithFee, activeEmployees);
    }

    /**
     * @dev Process payroll batch (called by automation or manually)
     * @param employer Employer address
     * @param batchId Batch identifier
     */
    function processPayroll(address employer, uint256 batchId) 
        external 
        onlyAuthorizedKeeper 
        nonReentrant 
        whenNotPaused
    {
        require(batchId < batchCount[employer], "Batch not found");
        
        PayrollBatch storage batch = payrollBatches[employer][batchId];
        require(!batch.processed, "Batch already processed");
        require(block.timestamp >= batch.scheduledDate, "Batch not ready for processing");

        uint256 gasStart = gasleft();

        // Check if contract has sufficient balance
        require(
            paymentToken.balanceOf(address(this)) >= batch.totalAmount,
            "Insufficient contract balance"
        );

        bool allPaymentsSuccessful = true;
        uint256 successfulPayments = 0;
        uint256 totalSalaryPaid = 0;

        // Process each employee payment
        for (uint256 i = 0; i < employeeCount[employer]; i++) {
            PayrollEntry storage employee = employeeEntries[employer][i];
            
            if (employee.active) {
                (bool paymentSuccess, string memory failureReason) = _executePayment(
                    employer, 
                    batchId, 
                    employee
                );
                
                if (paymentSuccess) {
                    employee.totalPaid += employee.salary;
                    employee.lastPaidDate = block.timestamp;
                    successfulPayments++;
                    totalSalaryPaid += employee.salary;
                } else {
                    allPaymentsSuccessful = false;
                }
            }
        }

        // Transfer protocol fee
        if (allPaymentsSuccessful && protocolFee > 0) {
            uint256 fee = (totalSalaryPaid * protocolFee) / 10000;
            if (fee > 0) {
                paymentToken.safeTransfer(feeRecipient, fee);
            }
        }

        // Update batch status
        batch.processed = true;
        batch.processedAt = block.timestamp;
        batch.gasUsed = gasStart - gasleft();
        
        if (!allPaymentsSuccessful) {
            batch.failed = true;
            batch.failureReason = "Some payments failed";
        }

        uint256 nonce = employerNonces[employer]++;
        emit PayrollProcessed(
            batchId,
            employer,
            batch.totalAmount,
            successfulPayments,
            allPaymentsSuccessful,
            batch.gasUsed
        );
    }

    /**
     * @dev Execute individual payment
     * @param employer Employer address
     * @param batchId Batch identifier
     * @param employee Employee data
     * @return success Payment success status
     * @return failureReason Reason for failure if any
     */
    function _executePayment(
        address employer,
        uint256 batchId,
        PayrollEntry memory employee
    ) internal returns (bool success, string memory failureReason) {
        uint256 gasStart = gasleft();
        
        try paymentToken.transfer(employee.recipient, employee.salary) {
            success = true;
            failureReason = "";
        } catch Error(string memory reason) {
            success = false;
            failureReason = reason;
        } catch {
            success = false;
            failureReason = "Transfer failed";
        }

        uint256 gasUsed = gasStart - gasleft();

        // Record payment
        batchPayments[employer][batchId].push(PaymentRecord({
            recipient: employee.recipient,
            amount: employee.salary,
            date: block.timestamp,
            transactionHash: blockhash(block.number - 1), // Simplified
            successful: success,
            gasUsed: gasUsed,
            failureReason: failureReason
        }));

        emit PaymentExecuted(employer, employee.recipient, employee.salary, success, failureReason);
        
        return (success, failureReason);
    }

    /**
     * @dev Request emergency pause
     */
    function requestEmergencyPause() external {
        emergencyPauseRequests[msg.sender] = block.timestamp;
        emit EmergencyPauseRequested(msg.sender, block.timestamp);
    }

    /**
     * @dev Execute emergency pause after delay
     */
    function executeEmergencyPause() external {
        require(
            emergencyPauseRequests[msg.sender] != 0 &&
            block.timestamp >= emergencyPauseRequests[msg.sender] + emergencyPauseDelay,
            "Emergency pause not ready"
        );
        
        _pause();
        emergencyPauseRequests[msg.sender] = 0;
    }

    /**
     * @dev Get upcoming payrolls for an employer
     * @param employer Employer address
     * @return batches Array of upcoming payroll batches
     */
    function getUpcomingPayrolls(address employer) 
        external 
        view 
        returns (PayrollBatch[] memory batches) 
    {
        uint256 upcomingCount = 0;
        
        // Count upcoming batches
        for (uint256 i = 0; i < batchCount[employer]; i++) {
            if (!payrollBatches[employer][i].processed && 
                payrollBatches[employer][i].scheduledDate > block.timestamp) {
                upcomingCount++;
            }
        }

        batches = new PayrollBatch[](upcomingCount);
        uint256 index = 0;

        // Populate upcoming batches
        for (uint256 i = 0; i < batchCount[employer]; i++) {
            PayrollBatch memory batch = payrollBatches[employer][i];
            if (!batch.processed && batch.scheduledDate > block.timestamp) {
                batches[index] = batch;
                index++;
            }
        }
    }

    /**
     * @dev Get payroll history for an employer
     * @param employer Employer address
     * @return batches Array of processed payroll batches
     */
    function getPayrollHistory(address employer) 
        external 
        view 
        returns (PayrollBatch[] memory batches) 
    {
        uint256 processedCount = 0;
        
        // Count processed batches
        for (uint256 i = 0; i < batchCount[employer]; i++) {
            if (payrollBatches[employer][i].processed) {
                processedCount++;
            }
        }

        batches = new PayrollBatch[](processedCount);
        uint256 index = 0;

        // Populate processed batches
        for (uint256 i = 0; i < batchCount[employer]; i++) {
            PayrollBatch memory batch = payrollBatches[employer][i];
            if (batch.processed) {
                batches[index] = batch;
                index++;
            }
        }
    }

    /**
     * @dev Get employee information
     * @param employer Employer address
     * @param employeeId Employee identifier
     * @return employee PayrollEntry struct
     */
    function getEmployee(address employer, uint256 employeeId) 
        external 
        view 
        returns (PayrollEntry memory employee) 
    {
        require(employeeId < employeeCount[employer], "Employee not found");
        return employeeEntries[employer][employeeId];
    }

    /**
     * @dev Get payment records for a batch
     * @param employer Employer address
     * @param batchId Batch identifier
     * @return payments Array of payment records
     */
    function getBatchPayments(address employer, uint256 batchId) 
        external 
        view 
        returns (PaymentRecord[] memory payments) 
    {
        return batchPayments[employer][batchId];
    }

    /**
     * @dev Emergency withdrawal function
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        paymentToken.safeTransfer(owner(), amount);
    }

    /**
     * @dev Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}