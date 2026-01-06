/**
 * Paystack Deposit Component
 * Handles fiat-to-crypto deposits with auto-split integration
 */

'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, CheckCircle2, CreditCard, ExternalLink, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePaystack } from '@/hooks/use-paystack'
import { useCurrency } from '@/hooks/use-currency'

interface PaystackDepositProps {
  onSuccess?: (depositAmount: number) => void
  onError?: (error: string) => void
}

export function PaystackDeposit({ onSuccess, onError }: PaystackDepositProps) {
  const { address } = useAccount()
  const { convertAmount, formatCurrency, currentCurrency } = useCurrency()
  const {
    currentSession,
    isInitializing,
    initializePayment,
    verifyPayment,
    triggerAutoSplit,
    depositHistory,
    error,
    clearError
  } = usePaystack()

  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('USD')
  const [email, setEmail] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPaymentWindow, setShowPaymentWindow] = useState(false)

  /**
   * Handle payment initialization
   */
  const handleInitializePayment = async () => {
    if (!amount || !email || !address) return

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      onError?.('Please enter a valid amount')
      return
    }

    clearError()
    const session = await initializePayment(numericAmount, currency, email)
    
    if (session) {
      setShowPaymentWindow(true)
      // Open Paystack payment page in new window
      window.open(session.paystackUrl, 'paystack-payment', 'width=500,height=700')
    }
  }

  /**
   * Handle payment verification after user returns from Paystack
   */
  const handleVerifyPayment = async () => {
    if (!currentSession) return

    setIsProcessing(true)
    
    try {
      const verified = await verifyPayment(currentSession.reference)
      
      if (verified) {
        // Find the corresponding deposit record
        const depositRecord = depositHistory.find(
          record => record.paystackReference === currentSession.reference
        )
        
        if (depositRecord) {
          // Trigger auto-split
          const autoSplitSuccess = await triggerAutoSplit(depositRecord)
          
          if (autoSplitSuccess) {
            onSuccess?.(depositRecord.cryptoAmount)
            setAmount('')
            setEmail('')
            setShowPaymentWindow(false)
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment processing failed'
      onError?.(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Calculate equivalent amounts in different currencies
   */
  const getEquivalentAmounts = () => {
    if (!amount) return null

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount)) return null

    const usdAmount = currency === 'USD' ? numericAmount : numericAmount / 1500 // Mock NGN rate
    const ngnAmount = currency === 'NGN' ? numericAmount : numericAmount * 1500
    const mntAmount = convertAmount(usdAmount, 'USD', 'MNT')

    return {
      usd: usdAmount,
      ngn: ngnAmount,
      mnt: mntAmount,
      usdc: usdAmount // 1:1 with USD
    }
  }

  const equivalentAmounts = getEquivalentAmounts()

  /**
   * Listen for payment completion messages from popup window
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://checkout.paystack.com') return
      
      if (event.data.type === 'payment_complete') {
        setShowPaymentWindow(false)
        handleVerifyPayment()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [currentSession])

  if (!address) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to use Paystack deposits
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Paystack Deposit
        </CardTitle>
        <CardDescription>
          Convert fiat currency to USDC and automatically split across your buckets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Payment Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isInitializing || isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={(value: 'NGN' | 'USD') => setCurrency(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="NGN">NGN (₦)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isInitializing || isProcessing}
            />
          </div>

          {/* Conversion Preview */}
          {equivalentAmounts && (
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Conversion Preview</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>You pay: {formatCurrency(equivalentAmounts[currency.toLowerCase() as keyof typeof equivalentAmounts], currency)}</div>
                <div>You receive: {equivalentAmounts.usdc.toFixed(2)} USDC</div>
                <div>USD equivalent: ${equivalentAmounts.usd.toFixed(2)}</div>
                <div>MNT equivalent: {formatCurrency(equivalentAmounts.mnt, 'MNT')}</div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Payment Actions */}
        <div className="space-y-4">
          {!currentSession && (
            <Button
              onClick={handleInitializePayment}
              disabled={!amount || !email || isInitializing}
              className="w-full"
            >
              {isInitializing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initializing Payment...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay with Paystack
                </>
              )}
            </Button>
          )}

          {currentSession && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Payment Session</p>
                  <p className="text-sm text-muted-foreground">
                    {currency} {currentSession.amount.toLocaleString()}
                  </p>
                </div>
                <Badge variant={
                  currentSession.status === 'success' ? 'default' :
                  currentSession.status === 'failed' ? 'destructive' :
                  'secondary'
                }>
                  {currentSession.status}
                </Badge>
              </div>

              {currentSession.status === 'pending' && (
                <div className="space-y-2">
                  <Button
                    onClick={() => window.open(currentSession.paystackUrl, 'paystack-payment', 'width=500,height=700')}
                    variant="outline"
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Payment Page
                  </Button>
                  
                  <Button
                    onClick={handleVerifyPayment}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        I've Completed Payment
                      </>
                    )}
                  </Button>
                </div>
              )}

              {currentSession.status === 'success' && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Payment successful! Your USDC has been deposited and split across your buckets.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Recent Deposits */}
        {depositHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Recent Deposits</h4>
              <div className="space-y-2">
                {depositHistory.slice(0, 3).map((deposit) => (
                  <div
                    key={deposit.id}
                    className="flex items-center justify-between p-2 bg-muted/30 rounded"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {deposit.fiatCurrency} {deposit.fiatAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deposit.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{deposit.cryptoAmount.toFixed(2)} USDC</p>
                      <Badge variant={
                        deposit.status === 'completed' ? 'default' :
                        deposit.status === 'failed' ? 'destructive' :
                        'secondary'
                      } className="text-xs">
                        {deposit.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}