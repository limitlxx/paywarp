// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Utils.sol";

/**
 * @title UserRegistryUpgradeable
 * @dev Upgradeable smart contract for global user registration and community tracking
 * Implements message signature verification for wallet ownership proof
 */
contract UserRegistryUpgradeable is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable, 
    UUPSUpgradeable 
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct UserInfo {
        bool isRegistered;
        uint256 registrationDate;
        bytes32 messageHash;
        bytes signature;
    }

    // State variables
    mapping(address => UserInfo) public userInfo;
    uint256 public totalUsers;
    
    // Events
    event UserRegistered(address indexed user, uint256 timestamp, uint256 totalUsers);
    event RegistrationFailed(address indexed user, string reason);
    event ContractUpgraded(address indexed newImplementation, uint256 version);

    // Version tracking
    uint256 public constant VERSION = 1;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initialize the contract (replaces constructor for upgradeable contracts)
     * @param initialOwner The address that will own the contract
     */
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        totalUsers = 0;
    }

    /**
     * @dev Register a user with message signature verification
     * @param messageHash The hash of the message that was signed
     * @param signature The signature proving wallet ownership
     */
    function registerUser(bytes32 messageHash, bytes calldata signature) external nonReentrant {
        address user = msg.sender;
        
        // Check if user is already registered
        if (userInfo[user].isRegistered) {
            emit RegistrationFailed(user, "User already registered");
            revert("User already registered");
        }

        // Verify the signature
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(signature);
        
        if (recoveredSigner != user) {
            emit RegistrationFailed(user, "Invalid signature");
            revert("Invalid signature");
        }

        // Register the user
        userInfo[user] = UserInfo({
            isRegistered: true,
            registrationDate: block.timestamp,
            messageHash: messageHash,
            signature: signature
        });

        totalUsers++;
        
        emit UserRegistered(user, block.timestamp, totalUsers);
    }

    /**
     * @dev Check if a user is registered
     * @param user The address to check
     * @return bool indicating registration status
     */
    function isUserRegistered(address user) external view returns (bool) {
        return userInfo[user].isRegistered;
    }

    /**
     * @dev Get total number of registered users
     * @return uint256 total user count
     */
    function getTotalUsers() external view returns (uint256) {
        return totalUsers;
    }

    /**
     * @dev Get complete user information
     * @param user The address to query
     * @return UserInfo struct with registration details
     */
    function getUserInfo(address user) external view returns (UserInfo memory) {
        return userInfo[user];
    }

    /**
     * @dev Get user registration date
     * @param user The address to query
     * @return uint256 registration timestamp (0 if not registered)
     */
    function getRegistrationDate(address user) external view returns (uint256) {
        return userInfo[user].registrationDate;
    }

    /**
     * @dev Emergency function to reset a user's registration (owner only)
     * @param user The address to reset
     */
    function resetUserRegistration(address user) external onlyOwner {
        if (userInfo[user].isRegistered) {
            delete userInfo[user];
            totalUsers--;
        }
    }

    /**
     * @dev Get registration statistics for analytics
     * @return totalUsers Current total user count
     * @return contractDeployTime When this contract was deployed
     */
    function getRegistrationStats() external view returns (uint256, uint256) {
        return (totalUsers, block.timestamp);
    }

    /**
     * @dev Batch register multiple users (owner only) - for migration purposes
     * @param users Array of user addresses
     * @param registrationDates Array of registration timestamps
     * @param messageHashes Array of message hashes
     * @param signatures Array of signatures
     */
    function batchRegisterUsers(
        address[] calldata users,
        uint256[] calldata registrationDates,
        bytes32[] calldata messageHashes,
        bytes[] calldata signatures
    ) external onlyOwner {
        require(
            users.length == registrationDates.length && 
            users.length == messageHashes.length && 
            users.length == signatures.length,
            "Array lengths must match"
        );

        for (uint256 i = 0; i < users.length; i++) {
            if (!userInfo[users[i]].isRegistered) {
                userInfo[users[i]] = UserInfo({
                    isRegistered: true,
                    registrationDate: registrationDates[i],
                    messageHash: messageHashes[i],
                    signature: signatures[i]
                });
                totalUsers++;
                emit UserRegistered(users[i], registrationDates[i], totalUsers);
            }
        }
    }

    /**
     * @dev Get contract version
     * @return uint256 current version number
     */
    function getVersion() external pure returns (uint256) {
        return VERSION;
    }

    /**
     * @dev Authorize upgrade (only owner can upgrade)
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        emit ContractUpgraded(newImplementation, VERSION);
    }

    /**
     * @dev Get implementation address (for transparency)
     * @return address of current implementation
     */
    function getImplementation() external view returns (address) {
        return ERC1967Utils.getImplementation();
    }
}