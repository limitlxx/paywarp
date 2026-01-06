#!/usr/bin/env node

/**
 * User Migration Script
 * Migrates users from old UserRegistry to new upgradeable version
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: '.env.local' });

// Contract addresses
const OLD_REGISTRY = '0x88ffe6b6D0eD0C45278d65b83eB3CaeBbfcff0b5';
const NEW_REGISTRY = '0x28d4C8100F199BDa17c62948790aFDBaa8e33C0A';
const RPC_URL = 'https://rpc.sepolia.mantle.xyz';

// ABIs (simplified for this script)
const OLD_REGISTRY_ABI = [
  'function getTotalUsers() view returns (uint256)',
  'function userInfo(address) view returns (bool isRegistered, uint256 registrationDate, bytes32 messageHash, bytes signature)',
  'event UserRegistered(address indexed user, uint256 timestamp, uint256 totalUsers)'
];

const NEW_REGISTRY_ABI = [
  'function batchRegisterUsers(address[] users, uint256[] registrationDates, bytes32[] messageHashes, bytes[] signatures)',
  'function getTotalUsers() view returns (uint256)',
  'function owner() view returns (address)'
];

async function main() {
  console.log('🔄 Starting user migration process...');
  
  // Setup provider and contracts
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const oldRegistry = new ethers.Contract(OLD_REGISTRY, OLD_REGISTRY_ABI, provider);
  const newRegistry = new ethers.Contract(NEW_REGISTRY, NEW_REGISTRY_ABI, provider);
  
  try {
    // Get total users from old contract
    const totalUsers = await oldRegistry.getTotalUsers();
    console.log(`📊 Total users in old registry: ${totalUsers}`);
    
    if (totalUsers.toString() === '0') {
      console.log('✅ No users to migrate');
      return;
    }
    
    // Get UserRegistered events from old contract
    console.log('🔍 Fetching UserRegistered events...');
    const filter = oldRegistry.filters.UserRegistered();
    const events = await oldRegistry.queryFilter(filter, 0, 'latest');
    
    console.log(`📋 Found ${events.length} registration events`);
    
    if (events.length === 0) {
      console.log('⚠️  No registration events found');
      return;
    }
    
    // Extract user data from events
    const users = [];
    const registrationDates = [];
    const messageHashes = [];
    const signatures = [];
    
    for (const event of events) {
      const userAddress = event.args.user;
      const timestamp = event.args.timestamp;
      
      // Get user info from old contract
      const userInfo = await oldRegistry.userInfo(userAddress);
      
      users.push(userAddress);
      registrationDates.push(timestamp);
      messageHashes.push(userInfo.messageHash);
      signatures.push(userInfo.signature);
      
      console.log(`📝 User: ${userAddress} - Registered: ${new Date(Number(timestamp) * 1000).toISOString()}`);
    }
    
    console.log('\n📋 Migration Summary:');
    console.log(`   Users to migrate: ${users.length}`);
    console.log(`   Old registry: ${OLD_REGISTRY}`);
    console.log(`   New registry: ${NEW_REGISTRY}`);
    
    console.log('\n🔧 To complete migration, run:');
    console.log(`   1. Connect as contract owner: ${await newRegistry.owner()}`);
    console.log(`   2. Call batchRegisterUsers with the following data:`);
    console.log(`      - users: [${users.map(u => `"${u}"`).join(', ')}]`);
    console.log(`      - registrationDates: [${registrationDates.join(', ')}]`);
    console.log(`      - messageHashes: [${messageHashes.map(h => `"${h}"`).join(', ')}]`);
    console.log(`      - signatures: [${signatures.map(s => `"${s}"`).join(', ')}]`);
    
    // Save migration data to file
    const migrationData = {
      timestamp: new Date().toISOString(),
      oldRegistry: OLD_REGISTRY,
      newRegistry: NEW_REGISTRY,
      totalUsers: users.length,
      users,
      registrationDates: registrationDates.map(d => d.toString()),
      messageHashes,
      signatures
    };
    
    const fs = require('fs');
    const filename = `migration-data-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(migrationData, null, 2));
    console.log(`\n💾 Migration data saved to: ${filename}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };