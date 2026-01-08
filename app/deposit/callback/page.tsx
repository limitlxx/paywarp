"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function DepositCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading')
  const [message, setMessage] = useState('')
  
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
      
      try {
        // Store the callback using PaystackStorage
        const callbackData = {
          reference: paymentReference,
          timestamp: Date.now(),
          status: 'success' as const
        }
        
        // Import and use PaystackStorage
        const { PaystackStorage } = await import('@/lib/paystack-storage')
        PaystackStorage.storeCallback(callbackData)
        
        // Also update the session status using PaystackStorage
        PaystackStorage.updateSession({
          status: 'success',
          completedAt: Date.now()
        })
        
        setStatus('success')
        setMessage('Payment completed successfully! Redirecting you back...')
        
        // Show success toast
        toast({
          title: 'Payment Successful',
          description: 'Your payment has been processed successfully.',
        })
        
        // Redirect back to dashboard with payment reference after a short delay
        setTimeout(() => {
          router.push(`/dashboard?payment=success&reference=${paymentReference}`)
        }, 2000)
        
      } catch (error) {
        console.error('Callback processing error:', error)
        
        // Store failed callback
        try {
          const { PaystackStorage } = await import('@/lib/paystack-storage')
          PaystackStorage.storeCallback({
            reference: paymentReference,
            timestamp: Date.now(),
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        } catch (storageError) {
          console.error('Failed to store error callback:', storageError)
        }
        
        setStatus('failed')
        setMessage('Failed to process payment callback. Redirecting you back...')
        
        toast({
          title: 'Payment Error',
          description: 'There was an error processing your payment.',
          variant: 'destructive'
        })
        
        // Redirect back to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard?payment=failed')
        }, 3000)
      }
    }
    
    handleCallback()
  }, [searchParams, toast])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-purple-500/20 bg-black/90 backdrop-blur-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
            {status === 'loading' && (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                Processing Payment
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-400" />
                Payment Successful
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
          
          {status === 'success' && (
            <div className="space-y-3">
              <p className="text-sm text-green-400">
                Your deposit has been processed successfully. You will be redirected to the dashboard shortly.
              </p>
              
              <Button 
                onClick={() => router.push('/dashboard')}
                className="w-full gradient-primary text-white"
              >
                Return to Dashboard Now
              </Button>
            </div>
          )}
          
          {status === 'failed' && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">
                Please try again or contact support if the issue persists.
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