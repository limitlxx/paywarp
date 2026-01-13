import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserRegistration, CommunityStats } from '../components/user-registration';
import { useAccount } from 'wagmi';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useSignMessage: vi.fn(() => ({
    signMessage: vi.fn(),
    data: null,
    isPending: false,
    error: null,
  })),
  useReadContract: vi.fn(() => ({
    data: null,
    refetch: vi.fn(),
  })),
  useWriteContract: vi.fn(() => ({
    writeContract: vi.fn(),
    data: null,
    isPending: false,
    error: null,
  })),
  useWaitForTransactionReceipt: vi.fn(() => ({
    isLoading: false,
    isSuccess: false,
  })),
}));

// Mock user registration hook
vi.mock('../lib/user-registration', () => ({
  useUserRegistration: vi.fn(() => ({
    isRegistered: false,
    totalUsers: 0,
    registerUser: vi.fn(),
    isPending: false,
    isConfirming: false,
    isConfirmed: false,
    error: null,
    refetchRegistrationStatus: vi.fn(),
    refetchTotalUsers: vi.fn(),
  })),
  generateRegistrationMessage: vi.fn((address) => `Register ${address}`),
  createMessageHash: vi.fn(() => '0x1234567890abcdef'),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UserRegistration Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when wallet is not connected', () => {
    (useAccount as any).mockReturnValue({
      address: null,
      isConnected: false,
      chainId: null,
    });

    const { container } = render(<UserRegistration />);
    expect(container.firstChild).toBeNull();
  });

  it('should show "Registration Coming Soon" when contract is not deployed', () => {
    (useAccount as any).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      chainId: 5003, // Mantle Sepolia
    });

    render(<UserRegistration />);
    
    expect(screen.getByText('Registration Coming Soon')).toBeInTheDocument();
    expect(screen.getByText('User registration will be available once the UserRegistry contract is deployed')).toBeInTheDocument();
  });

  it('should show registration form when contract is deployed', () => {
    // Mock environment variable for deployed contract
    process.env.NEXT_PUBLIC_USER_REGISTRY_SEPOLIA = '0x4dCC40797DC08F7cF473D31f96dE1EEDd32D9051';
    
    (useAccount as any).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
      chainId: 5003, // Mantle Sepolia
    });

    render(<UserRegistration />);
    
    expect(screen.getByText('Join PayWarp Community')).toBeInTheDocument();
    expect(screen.getByText('Register Wallet')).toBeInTheDocument();
  });
});

describe('CommunityStats Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "coming soon" when contract is not deployed', () => {
    (useAccount as any).mockReturnValue({
      chainId: 5003,
    });

    render(<CommunityStats />);
    
    expect(screen.getByText('Community registration coming soon')).toBeInTheDocument();
  });

  it('should show user count when contract is deployed', () => {
    // Mock environment variable for deployed contract
    process.env.NEXT_PUBLIC_USER_REGISTRY_SEPOLIA = '0x4dCC40797DC08F7cF473D31f96dE1EEDd32D9051';
    
    (useAccount as any).mockReturnValue({
      chainId: 5003,
    });

    const { useUserRegistration } = require('../lib/user-registration');
    useUserRegistration.mockReturnValue({
      totalUsers: 42,
      isLoading: false,
    });

    render(<CommunityStats />);
    
    expect(screen.getByText('Join 42 registered users')).toBeInTheDocument();
  });
});