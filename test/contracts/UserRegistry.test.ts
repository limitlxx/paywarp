import { describe, it, expect, beforeEach } from 'vitest';
import { ethers } from 'hardhat';
import { UserRegistry } from '../../types/contracts/UserRegistry';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('UserRegistry Contract', () => {
  let userRegistry: UserRegistry;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    
    const UserRegistryFactory = await ethers.getContractFactory('UserRegistry');
    userRegistry = await UserRegistryFactory.deploy();
    await userRegistry.waitForDeployment();
  });

  describe('Registration Logic', () => {
    it('should register a user with valid signature', async () => {
      const message = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      await expect(userRegistry.connect(user1).registerUser(messageHash, signature))
        .to.emit(userRegistry, 'UserRegistered')
        .withArgs(user1.address, expect.any(Number), 1);

      expect(await userRegistry.isUserRegistered(user1.address)).to.be.true;
      expect(await userRegistry.getTotalUsers()).to.equal(1);
    });

    it('should prevent duplicate registration', async () => {
      const message = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await user1.signMessage(ethers.getBytes(messageHash));

      // First registration
      await userRegistry.connect(user1).registerUser(messageHash, signature);
      
      // Second registration attempt
      await expect(userRegistry.connect(user1).registerUser(messageHash, signature))
        .to.emit(userRegistry, 'RegistrationFailed')
        .withArgs(user1.address, 'User already registered');

      expect(await userRegistry.getTotalUsers()).to.equal(1);
    });

    it('should reject invalid signature', async () => {
      const message = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await user2.signMessage(ethers.getBytes(messageHash)); // Wrong signer

      await expect(userRegistry.connect(user1).registerUser(messageHash, signature))
        .to.emit(userRegistry, 'RegistrationFailed')
        .withArgs(user1.address, 'Invalid signature');

      expect(await userRegistry.isUserRegistered(user1.address)).to.be.false;
      expect(await userRegistry.getTotalUsers()).to.equal(0);
    });

    it('should track multiple user registrations', async () => {
      // Register user1
      const message1 = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash1 = ethers.keccak256(ethers.toUtf8Bytes(message1));
      const signature1 = await user1.signMessage(ethers.getBytes(messageHash1));
      await userRegistry.connect(user1).registerUser(messageHash1, signature1);

      // Register user2
      const message2 = `Register wallet ${user2.address} with PayWarp at ${Date.now() + 1000}`;
      const messageHash2 = ethers.keccak256(ethers.toUtf8Bytes(message2));
      const signature2 = await user2.signMessage(ethers.getBytes(messageHash2));
      await userRegistry.connect(user2).registerUser(messageHash2, signature2);

      expect(await userRegistry.getTotalUsers()).to.equal(2);
      expect(await userRegistry.isUserRegistered(user1.address)).to.be.true;
      expect(await userRegistry.isUserRegistered(user2.address)).to.be.true;
    });
  });

  describe('Data Retrieval', () => {
    beforeEach(async () => {
      const message = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await user1.signMessage(ethers.getBytes(messageHash));
      await userRegistry.connect(user1).registerUser(messageHash, signature);
    });

    it('should return correct user info', async () => {
      const userInfo = await userRegistry.getUserInfo(user1.address);
      
      expect(userInfo.isRegistered).to.be.true;
      expect(userInfo.registrationDate).to.be.greaterThan(0);
      expect(userInfo.messageHash).to.not.equal(ethers.ZeroHash);
      expect(userInfo.signature).to.not.equal('0x');
    });

    it('should return registration date', async () => {
      const registrationDate = await userRegistry.getRegistrationDate(user1.address);
      expect(registrationDate).to.be.greaterThan(0);
    });

    it('should return zero date for unregistered user', async () => {
      const registrationDate = await userRegistry.getRegistrationDate(user2.address);
      expect(registrationDate).to.equal(0);
    });

    it('should return registration stats', async () => {
      const [totalUsers, timestamp] = await userRegistry.getRegistrationStats();
      expect(totalUsers).to.equal(1);
      expect(timestamp).to.be.greaterThan(0);
    });
  });

  describe('Owner Functions', () => {
    beforeEach(async () => {
      const message = `Register wallet ${user1.address} with PayWarp at ${Date.now()}`;
      const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message));
      const signature = await user1.signMessage(ethers.getBytes(messageHash));
      await userRegistry.connect(user1).registerUser(messageHash, signature);
    });

    it('should allow owner to reset user registration', async () => {
      expect(await userRegistry.getTotalUsers()).to.equal(1);
      
      await userRegistry.connect(owner).resetUserRegistration(user1.address);
      
      expect(await userRegistry.isUserRegistered(user1.address)).to.be.false;
      expect(await userRegistry.getTotalUsers()).to.equal(0);
    });

    it('should prevent non-owner from resetting registration', async () => {
      await expect(
        userRegistry.connect(user1).resetUserRegistration(user1.address)
      ).to.be.revertedWithCustomError(userRegistry, 'OwnableUnauthorizedAccount');
    });
  });
});