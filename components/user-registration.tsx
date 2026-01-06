'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { useUserRegistration, generateRegistrationMessage, createMessageHash } from '../lib/user-registration';
import { CONTRACT_ADDRESSES } from '../types/contracts';
import { toast } from 'sonner';

interface UserRegistrationProps {
  onRegistrationComplete?: () => void;
  showCommunityStats?: boolean;
}

export function UserRegistration({ onRegistrationComplete, showCommunityStats = true }: UserRegistrationProps) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessage, data: signature, isPending: isSigningPending, error: signError } = useSignMessage();
  const {
    isRegistered,
    totalUsers,
    registerUser,
    setRegistrationSignature,
    clearRegistrationSignature,
    clearRegistrationFailureReason,
    registrationFailureReason,
    isPending: isRegistrationPending,
    isConfirming,
    isConfirmed,
    error: registrationError,
    refetchRegistrationStatus,
    refetchTotalUsers,
  } = useUserRegistration();

  const [registrationMessage, setRegistrationMessage] = useState<string>('');
  const [messageHash, setMessageHash] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasSignedMessage, setHasSignedMessage] = useState(false);

  // Check if UserRegistry contract is deployed
  const isContractDeployed = chainId && CONTRACT_ADDRESSES[chainId]?.UserRegistry && 
    CONTRACT_ADDRESSES[chainId].UserRegistry !== '0x0000000000000000000000000000000000000000';

  // Generate registration message when address changes
  useEffect(() => {
    if (address) {
      const message = generateRegistrationMessage(address);
      const hash = createMessageHash(message);
      setRegistrationMessage(message);
      setMessageHash(hash);
      // Reset signing state when address changes
      setHasSignedMessage(false);
      // Clear any previous failure reasons
      clearRegistrationFailureReason();
    }
  }, [address, clearRegistrationFailureReason]);

  // Handle registration completion
  useEffect(() => {
    if (isConfirmed) {
      toast.success('Registration successful! Welcome to PayWarp!');
      refetchRegistrationStatus();
      refetchTotalUsers();
      onRegistrationComplete?.();
      setIsProcessing(false);
      setHasSignedMessage(false);
      clearRegistrationSignature();
    }
  }, [isConfirmed, refetchRegistrationStatus, refetchTotalUsers, onRegistrationComplete, clearRegistrationSignature]);

  // Handle registration errors
  useEffect(() => {
    if (registrationError) {
      toast.error(`Registration failed: ${registrationError.message}`);
      setIsProcessing(false);
      setHasSignedMessage(false);
      clearRegistrationSignature();
    }
  }, [registrationError, clearRegistrationSignature]);

  // Handle signing errors
  useEffect(() => {
    if (signError) {
      toast.error(`Signing failed: ${signError.message}`);
      setIsProcessing(false);
      setHasSignedMessage(false);
    }
  }, [signError]);

  // Handle registration failure events from contract
  useEffect(() => {
    if (registrationFailureReason) {
      toast.error(`Registration failed: ${registrationFailureReason}`);
      setIsProcessing(false);
      setHasSignedMessage(false);
      clearRegistrationSignature();
    }
  }, [registrationFailureReason, clearRegistrationSignature]);

  const handleRegistration = async () => {
    if (!address || !registrationMessage || hasSignedMessage) return;

    setIsProcessing(true);

    try {
      // Step 1: Sign the registration message
      await signMessage({
        message: registrationMessage,
      });
    } catch (error) {
      console.error('Failed to sign message:', error);
      setIsProcessing(false);
    }
  };

  // Step 2: Submit registration after signature is obtained
  useEffect(() => {
    if (signature && messageHash && !hasSignedMessage && !isRegistrationPending && !isConfirming && isProcessing) {
      setHasSignedMessage(true);
      
      const submitRegistration = async () => {
        try {
          // Set the signature in the hook
          setRegistrationSignature(signature, messageHash);
          
          const result = await registerUser();
          if (!result.success) {
            toast.error(`Registration failed: ${result.error}`);
            setIsProcessing(false);
            setHasSignedMessage(false);
          }
          // Success handling is done in the isConfirmed effect
        } catch (error) {
          console.error('Registration submission failed:', error);
          toast.error('Registration submission failed');
          setIsProcessing(false);
          setHasSignedMessage(false);
        }
      };

      submitRegistration();
    }
  }, [signature, messageHash, registerUser, setRegistrationSignature, isRegistrationPending, isConfirming, isProcessing, hasSignedMessage]);

  if (!isConnected || !address) {
    return null;
  }

  // If contract is not deployed, show a message
  if (!isContractDeployed) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle>Registration Coming Soon</CardTitle>
          <CardDescription>
            User registration will be available once the UserRegistry contract is deployed
          </CardDescription>
        {showCommunityStats && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalUsers > 0 ? `${totalUsers.toLocaleString()} registered users` : 'Registration system deploying...'}
            </Badge>
          </div>
        )}
        </CardHeader>
      </Card>
    );
  }

  if (isRegistered) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <CardTitle className="text-green-700">Welcome Back!</CardTitle>
          <CardDescription>
            Your wallet is already registered with PayWarp
          </CardDescription>
        </CardHeader>
        {showCommunityStats && (
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Join {totalUsers > 0 ? totalUsers.toLocaleString() : '0'} registered users</span>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle>Join PayWarp Community</CardTitle>
        <CardDescription>
          Register your wallet on-chain to verify your identity and join our growing community
        </CardDescription>
        {showCommunityStats && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalUsers > 0 ? `${totalUsers.toLocaleString()} registered users` : 'Be the first to register!'}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Registration process:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Sign a message to prove wallet ownership</li>
            <li>Submit registration transaction on-chain</li>
            <li>Join the verified PayWarp community</li>
          </ol>
        </div>

        <Button
          onClick={handleRegistration}
          disabled={isProcessing || isSigningPending || isRegistrationPending || isConfirming}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isSigningPending && 'Sign Message...'}
              {isRegistrationPending && 'Submitting Registration...'}
              {isConfirming && 'Confirming Transaction...'}
              {!isSigningPending && !isRegistrationPending && !isConfirming && 'Processing...'}
            </>
          ) : (
            'Register Wallet'
          )}
        </Button>

        {(registrationError || signError || registrationFailureReason) && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            <AlertCircle className="h-4 w-4" />
            <span>
              {registrationFailureReason || registrationError?.message || signError?.message || 'Registration failed'}
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          <p>Registration requires a small gas fee on Mantle network</p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Community statistics component for landing page
 */
export function CommunityStats() {
  const { totalUsers } = useUserRegistration();
  const { chainId } = useAccount();

  // Check if UserRegistry contract is deployed
  const isContractDeployed = chainId && CONTRACT_ADDRESSES[chainId]?.UserRegistry && 
    CONTRACT_ADDRESSES[chainId].UserRegistry !== '0x0000000000000000000000000000000000000000';

  if (!isContractDeployed) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>Community registration coming soon</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Users className="h-4 w-4" />
      <span>
        {totalUsers > 0 
          ? `Join ${totalUsers.toLocaleString()} registered users`
          : 'Be the first to register!'
        }
      </span>
    </div>
  );
}

/**
 * Registration status checker component
 */
export function RegistrationStatusChecker({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { isRegistered } = useUserRegistration();
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      setShowRegistration(!isRegistered);
    }
  }, [isConnected, address, isRegistered]);

  if (!isConnected) {
    return <>{children}</>;
  }

  if (showRegistration) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <UserRegistration
          onRegistrationComplete={() => setShowRegistration(false)}
          showCommunityStats={true}
        />
      </div>
    );
  }

  return <>{children}</>;
}