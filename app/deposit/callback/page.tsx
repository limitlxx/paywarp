"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'

export default function DepositCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { address, isConnected } = useAccount()
  
  const [status, setStatus] = useState<'loading' | 'verifying' | 'success' | 'failed' | 'completed'>('loading')
  const [message, setMessage] = useState('')
  const [usdcAmount, setUsdcAmount] = useState<number>(0)
  const [isSplitting, setIsSplitting] = useState(false)
  const [txHash, setTxHash] = useState<string>('')
  const hasProcessedRef = useRef(false)
  
  useEffect(() => {
    const handleCallback = async () => {
      const reference = searchParams.get('reference')
      const trxref = searchParams.get('trxref')
      
      // Use reference from URL params or trxref (Paystack sometimes uses trxref)
      const paymentReference = reference || trxref
      
      if (!paymentReference) {
        setStatus('failed')
        setMessage('No payment reference found in callback')
        return
      }
      
      // Wait for wallet connection
      if (!isConnected || !address) {
        console.log('⏳ Waiting for wallet connection...')
        setMessage('Waiting for wallet connection...')
        return
      }
      
      // Prevent duplicate processing using ref
      if (hasProcessedRef.current) {
        console.log('⏸️ Already processed callback for', paymentReference, '- skipping duplicate call')
        return
      }
      
      hasProcessedRef.current = true
      
      try {
        console.log('🔍 Processing Paystack callback for reference:', paymentReference)
        setStatus('verifying')
        setMessage('Verifying payment with Paystack...')
        
        // Call the verify API directly
        console.log('🔄 Verifying payment...')
        const verifyResponse = await fetch('/api/paystack/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: paymentReference })
        })
        
        const verifyResult = await verifyResponse.json()
        
        if (!verifyResult.success) {
          throw new Error(verifyResult.error || 'Payment verification failed')
        }
        
        console.log('✅ Payment verified with Paystack!')
        console.log('💰 USDC Amount:', verifyResult.data.cryptoAmount)
        console.log('📝 Transaction Hash:', verifyResult.data.txHash)
        
        const amount = Number(verifyResult.data.cryptoAmount)
        setUsdcAmount(amount)
        setStatus('success')
        setMessage(`Payment verified! ${amount.toFixed(2)} USDC has been sent to your wallet.`)
        
        toast({
          title: 'Payment Successful',
          description: `${amount.toFixed(2)} USDC has been sent to your wallet.`,
        })
        
        // Clear any stored session
        try {
          const { PaystackStorage } = await import('@/lib/paystack-storage')
          PaystackStorage.clearSession()
          PaystackStorage.clearCallback()
        } catch (e) {
          console.error('Error clearing storage:', e)
        }
        
        // Don't auto-redirect - let user click the button to split
        
      } catch (error) {
        console.error('Callback processing error:', error)
        
        setStatus('failed')
        setMessage('Failed to process payment callback. Please check your wallet and try completing the deposit manually.')
        
        toast({
          title: 'Payment Error',
          description: error instanceof Error ? error.message : 'There was an error processing your payment.',
          variant: 'destructive'
        })
        
        // Redirect back to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 5000)
      }
    }
    
    handleCallback()
  }, [searchParams, toast, router, isConnected, address])

  const handleDepositAndSplit = async () => {
    if (!address || !isConnected || usdcAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Please ensure your wallet is connected and you have USDC to deposit.',
        variant: 'destructive'
      })
      return
    }

    setIsSplitting(true)
    
    try {
      console.log('🔄 Triggering depositAndSplit for', usdcAmount, 'USDC...')
      
      // Get provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Import deposit service
      const { getDepositService } = await import('@/lib/deposit-service')
      const depositService = getDepositService()
      
      // Call depositFromWallet which handles approval and depositAndSplit
      const result = await depositService.depositFromWallet(signer as any, usdcAmount)
      
      if (result.success) {
        console.log('✅ DepositAndSplit completed successfully!')
        
        setStatus('completed')
        setTxHash(result.transactionHash || '')
        
        toast({
          title: 'Deposit Complete',
          description: `Successfully deposited and split ${usdcAmount} USDC into your buckets!`,
        })
        
        // Don't auto-redirect - let user see the confirmation
      } else {
        throw new Error(result.error || 'Deposit and split failed')
      }
    } catch (error) {
      console.error('❌ Error in depositAndSplit:', error)
      
      toast({
        title: 'Deposit Failed',
        description: error instanceof Error ? error.message : 'Failed to deposit and split funds. Please try from the dashboard.',
        variant: 'destructive'
      })
    } finally {
      setIsSplitting(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-purple-500/20 bg-black/90 backdrop-blur-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            {(status === 'loading' || status === 'verifying') && (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                {status === 'loading' ? 'Processing Payment' : 'Completing Deposit'}
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                Payment Successful
              </>
            )}
            {status === 'completed' && (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                Deposit Complete
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle className="w-6 h-6 text-red-400" />
                Payment Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {message || 'Processing your payment callback...'}
          </p>
          
          {!isConnected && status === 'loading' && (
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <p className="text-sm text-orange-400">
                Please ensure your wallet is connected to complete the deposit.
              </p>
            </div>
          )}
          
          {status === 'success' && usdcAmount > 0 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400 font-medium mb-2">
                  ✅ Payment verified successfully!
                </p>
                <p className="text-sm text-muted-foreground">
                  {usdcAmount.toFixed(2)} USDC has been sent to your wallet. Click the button below to deposit and split the funds across your buckets.
                </p>
              </div>
              
              <Button 
                onClick={handleDepositAndSplit}
                disabled={isSplitting}
                className="w-full gradient-primary text-white h-12 text-base font-bold"
              >
                {isSplitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Deposit...
                  </>
                ) : (
                  <>
                    Deposit & Split {usdcAmount.toFixed(2)} USDC
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              
              <Button 
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="w-full"
                disabled={isSplitting}
              >
                Skip for Now (Go to Dashboard)
              </Button>
            </div>
          )}
          
          {status === 'completed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                  <p className="text-base text-green-400 font-bold">
                    Deposit Complete!
                  </p>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount Deposited:</span>
                    <span className="text-foreground font-medium">{usdcAmount.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="text-green-400 font-medium">Split Across Buckets</span>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3">
                  Your funds have been automatically distributed across your configured buckets according to your split percentages.
                </p>
                
                {txHash && (
                  <a
                    href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors underline"
                  >
                    View transaction on Mantle Explorer
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
              
              <Button 
                onClick={() => router.push('/dashboard')}
                className="w-full gradient-primary text-white h-12 text-base font-bold"
              >
                Go to Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
          
          {status === 'failed' && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">
                Please check your wallet and dashboard. You may need to complete the deposit manually.
              </p>
              
              <Button 
                onClick={() => router.push('/dashboard')}
                variant="outline"
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}