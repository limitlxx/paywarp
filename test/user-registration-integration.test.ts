import { describe, it, expect, beforeAll } from 'vitest';
import { CONTRACT_ADDRESSES } from '../types/contracts';
import dotenv from 'dotenv';

// Load environment variables for testing
beforeAll(() => {
  dotenv.config({ path: '.env.local' });
});

describe('User Registration Integration', () => {
  it('should have UserRegistry contract address configured for Sepolia', () => {
    const sepoliaConfig = CONTRACT_ADDRESSES[5003];
    expect(sepoliaConfig).toBeDefined();
    expect(sepoliaConfig.UserRegistry).toBeDefined();
    expect(sepoliaConfig.UserRegistry).not.toBe('0x0000000000000000000000000000000000000000');
    
    console.log('Sepolia UserRegistry address:', sepoliaConfig.UserRegistry);
  });

  it('should have proper contract address format', () => {
    const sepoliaConfig = CONTRACT_ADDRESSES[5003];
    const address = sepoliaConfig.UserRegistry;
    
    // Should be a valid Ethereum address format
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(address.length).toBe(42);
  });

  it('should have all required contract addresses', () => {
    const sepoliaConfig = CONTRACT_ADDRESSES[5003];
    
    expect(sepoliaConfig.BucketVault).toBeDefined();
    expect(sepoliaConfig.PayrollEngine).toBeDefined();
    expect(sepoliaConfig.UserRegistry).toBeDefined();
    expect(sepoliaConfig.BaseToken).toBeDefined();
    expect(sepoliaConfig.YieldToken).toBeDefined();
  });
});