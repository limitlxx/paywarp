'use client'

import React, { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Camera, Upload, Loader2, Check, AlertCircle, Eye, EyeOff, Link } from 'lucide-react'
import { useOCRMode } from '@/contexts/ocr-mode-context'
import { enhancedOCRProcessor, DynamicReceiptData } from '@/lib/enhanced-ocr-processor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface EnhancedExpenseFormProps {
  onExpenseExtracted?: (data: DynamicReceiptData) => void
  onExpenseSubmitted?: (data: DynamicReceiptData) => void
  useBlockchain?: boolean
}

export function EnhancedExpenseForm({ 
  onExpenseExtracted, 
  onExpenseSubmitted,
  useBlockchain = false
}: EnhancedExpenseFormProps) {
  const { mode, isOnline, apiBaseUrl } = useOCRMode()
  const [image, setImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<DynamicReceiptData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [showRawData, setShowRawData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use the singleton OCR processor instance
  const ocrProcessor = enhancedOCRProcessor

  // Handle file drop/upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onload = () => {
        setImage(reader.result as string)
      }
      reader.readAsDataURL(file)
      setExtractedData(null)
      setStatus('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  })

  // Handle camera capture
  const handleCameraCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onDrop([file])
    }
  }

  // Process receipt with OCR
  const processReceipt = async () => {
    if (!imageFile) return

    setIsProcessing(true)
    setStatus('Processing receipt...')

    try {
      const result = await ocrProcessor.processReceipt(imageFile, mode)
      setExtractedData(result)
      setStatus(`Processing complete with ${Math.round(result.confidence * 100)}% confidence`)
      onExpenseExtracted?.(result)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Processing failed'
      setStatus(`Error: ${errorMessage}`)
      console.error('OCR processing error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Submit expense
  const submitExpense = async () => {
    if (!extractedData) return

    setIsSubmitting(true)
    try {
      // Submit the expense (parent component handles blockchain integration)
      await onExpenseSubmitted?.(extractedData)
      
      setStatus(useBlockchain 
        ? 'Expense submitted to blockchain and local storage!' 
        : 'Expense submitted successfully!'
      )
      
      // Reset form
      setTimeout(() => {
        setImage(null)
        setImageFile(null)
        setExtractedData(null)
        setStatus('')
      }, 2000)
    } catch (error) {
      setStatus('Failed to submit expense')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update extracted data
  const updateExtractedData = (field: keyof DynamicReceiptData, value: any) => {
    if (!extractedData) return
    
    setExtractedData({
      ...extractedData,
      [field]: value
    })
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getModeDisplayName = () => {
    switch (mode) {
      case 'gemini': return 'Gemini API'
      case 'tesseract': return 'Tesseract.js'
      case 'hybrid': return 'Hybrid Mode'
      default: return mode
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Receipt Upload
            <div className="flex items-center justify-between">
              <Badge variant="outline">{getModeDisplayName()}</Badge>
              <div className="flex items-center gap-2">
                {useBlockchain && (
                  <Badge variant="default" className="bg-green-500">
                    <Link className="h-3 w-3 mr-1" />
                    Blockchain
                  </Badge>
                )}
                {!isOnline && <Badge variant="destructive">Offline</Badge>}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? 'Drop receipt here' : 'Upload receipt image'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Drag & drop or click to select • JPEG, PNG, WebP up to 10MB
                  </p>
                </div>
              </div>
            </div>

            {/* Camera Button */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleCameraCapture}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Take Photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {/* Image Preview */}
            {image && (
              <div className="space-y-4">
                <div className="relative">
                  <img
                    src={image}
                    alt="Receipt preview"
                    className="max-w-full h-auto max-h-96 mx-auto rounded-lg shadow-md"
                  />
                </div>
                
                <div className="flex justify-center gap-2">
                  <Button
                    onClick={processReceipt}
                    disabled={isProcessing}
                    className="flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {isProcessing ? 'Processing...' : `Extract with ${getModeDisplayName()}`}
                  </Button>
                </div>
              </div>
            )}

            {/* Status */}
            {status && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Extracted Data Section */}
      {extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Extracted Data
              <div className="flex items-center gap-2">
                <Badge 
                  className={`${getConfidenceColor(extractedData.confidence)} text-white`}
                >
                  {Math.round(extractedData.confidence * 100)}% confidence
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRawData(!showRawData)}
                >
                  {showRawData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Core Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    value={extractedData.vendor}
                    onChange={(e) => updateExtractedData('vendor', e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={extractedData.amount}
                      onChange={(e) => updateExtractedData('amount', parseFloat(e.target.value))}
                    />
                    <Select
                      value={extractedData.currency}
                      onValueChange={(value) => updateExtractedData('currency', value)}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="NGN">NGN</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={extractedData.date.toISOString().split('T')[0]}
                    onChange={(e) => updateExtractedData('date', new Date(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select
                    value={extractedData.businessType || 'other'}
                    onValueChange={(value) => updateExtractedData('businessType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="gas-station">Gas Station</SelectItem>
                      <SelectItem value="grocery">Grocery</SelectItem>
                      <SelectItem value="pharmacy">Pharmacy</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Extended Fields */}
              {(extractedData.subtotal || extractedData.tax || extractedData.tip) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {extractedData.subtotal && (
                      <div>
                        <Label htmlFor="subtotal">Subtotal</Label>
                        <Input
                          id="subtotal"
                          type="number"
                          step="0.01"
                          value={extractedData.subtotal}
                          onChange={(e) => updateExtractedData('subtotal', parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                    
                    {extractedData.tax && (
                      <div>
                        <Label htmlFor="tax">Tax</Label>
                        <Input
                          id="tax"
                          type="number"
                          step="0.01"
                          value={extractedData.tax}
                          onChange={(e) => updateExtractedData('tax', parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                    
                    {extractedData.tip && (
                      <div>
                        <Label htmlFor="tip">Tip</Label>
                        <Input
                          id="tip"
                          type="number"
                          step="0.01"
                          value={extractedData.tip}
                          onChange={(e) => updateExtractedData('tip', parseFloat(e.target.value))}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Items */}
              {extractedData.items && extractedData.items.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label>Items</Label>
                    <div className="mt-2 space-y-2">
                      {extractedData.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <span className="flex-1">{item.name}</span>
                          {item.quantity && (
                            <Badge variant="outline">Qty: {item.quantity}</Badge>
                          )}
                          <span className="font-medium">${item.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Raw Data Toggle */}
              {showRawData && (
                <>
                  <Separator />
                  <div>
                    <Label>Raw Extracted Data</Label>
                    <Textarea
                      value={JSON.stringify(extractedData, null, 2)}
                      readOnly
                      className="mt-2 font-mono text-sm"
                      rows={10}
                    />
                  </div>
                </>
              )}

              {/* Validation Flags */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={extractedData.validationFlags.vendorIdentified ? "default" : "destructive"}>
                  {extractedData.validationFlags.vendorIdentified ? "✓" : "✗"} Vendor ID
                </Badge>
                <Badge variant={extractedData.validationFlags.amountMatches ? "default" : "destructive"}>
                  {extractedData.validationFlags.amountMatches ? "✓" : "✗"} Amount
                </Badge>
                <Badge variant={extractedData.validationFlags.dateReasonable ? "default" : "destructive"}>
                  {extractedData.validationFlags.dateReasonable ? "✓" : "✗"} Date
                </Badge>
                <Badge variant={extractedData.validationFlags.structureValid ? "default" : "destructive"}>
                  {extractedData.validationFlags.structureValid ? "✓" : "✗"} Structure
                </Badge>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  onClick={submitExpense}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isSubmitting 
                    ? 'Submitting...' 
                    : useBlockchain 
                      ? 'Submit to Blockchain' 
                      : 'Submit Expense'
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}