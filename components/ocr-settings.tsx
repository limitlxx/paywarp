'use client'

import React from 'react'
import { useOCRMode, useOCRModeInfo, OCR_MODES } from '@/contexts/ocr-mode-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Wifi, WifiOff, Settings, Info } from 'lucide-react'

export function OCRSettings() {
  const { mode, setMode, isOnline, apiBaseUrl, setApiBaseUrl } = useOCRMode()
  const { currentMode, allModes } = useOCRModeInfo()

  const handleModeChange = (newMode: string) => {
    setMode(newMode as typeof mode)
  }

  const handleApiUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiBaseUrl(event.target.value)
  }

  const resetApiUrl = () => {
    setApiBaseUrl('/api/ocr')
  }

  const testConnection = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/extract-receipt-enhanced`)
      const data = await response.json()
      alert(`Connection test: ${data.status === 'healthy' ? 'Success' : 'Failed'}`)
    } catch (error) {
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            OCR Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"}>
              {isOnline ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          
          <div className="mt-4 space-y-2">
            <Label htmlFor="apiUrl">API Base URL</Label>
            <div className="flex gap-2">
              <Input
                id="apiUrl"
                value={apiBaseUrl}
                onChange={handleApiUrlChange}
                placeholder="/api/ocr"
              />
              <Button variant="outline" onClick={resetApiUrl}>
                Reset
              </Button>
              <Button variant="outline" onClick={testConnection}>
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OCR Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle>OCR Processing Mode</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how receipts are processed for data extraction
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={handleModeChange}>
            {Object.values(OCR_MODES).map((modeOption) => {
              const modeInfo = allModes.find(m => m.name.toLowerCase().includes(modeOption))
              if (!modeInfo) return null

              return (
                <div key={modeOption} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value={modeOption} 
                      id={modeOption}
                      disabled={!modeInfo.available}
                    />
                    <Label 
                      htmlFor={modeOption} 
                      className={`flex-1 cursor-pointer ${!modeInfo.available ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{modeInfo.name}</span>
                            {modeInfo.recommended && (
                              <Badge variant="secondary">Recommended</Badge>
                            )}
                            {!modeInfo.available && (
                              <Badge variant="destructive">Unavailable</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {modeInfo.description}
                          </p>
                        </div>
                        {modeInfo.available ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </Label>
                  </div>
                  
                  {/* Mode Details */}
                  <div className="ml-6 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-green-600">Pros:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {modeInfo.pros.map((pro, index) => (
                            <li key={index}>{pro}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-medium text-red-600">Cons:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {modeInfo.cons.map((con, index) => (
                            <li key={index}>{con}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Current Mode Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Current Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Mode:</span>
              <Badge variant="outline">{currentMode.name}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant={currentMode.available ? "default" : "destructive"}>
                {currentMode.available ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Connection:</span>
              <Badge variant={isOnline ? "default" : "destructive"}>
                {isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>

            {!isOnline && mode === OCR_MODES.GEMINI && (
              <Alert>
                <AlertDescription>
                  You're offline and Gemini mode is selected. The system will automatically 
                  fall back to Tesseract mode for offline processing.
                </AlertDescription>
              </Alert>
            )}

            {mode === OCR_MODES.HYBRID && (
              <Alert>
                <AlertDescription>
                  Hybrid mode will try Gemini first for best accuracy, then fall back to 
                  Tesseract if needed. This provides the best balance of accuracy and reliability.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-medium">For best results:</span>
              <ul className="list-disc list-inside text-muted-foreground mt-1">
                <li>Ensure good lighting when taking photos</li>
                <li>Keep the receipt flat and fully visible</li>
                <li>Avoid shadows and glare</li>
                <li>Use high resolution images (but under 10MB)</li>
              </ul>
            </div>
            
            <div>
              <span className="font-medium">Supported formats:</span>
              <ul className="list-disc list-inside text-muted-foreground mt-1">
                <li>JPEG, PNG, WebP images</li>
                <li>Maximum file size: 10MB</li>
                <li>Recommended: 1080p or higher resolution</li>
              </ul>
            </div>
            
            <div>
              <span className="font-medium">Privacy:</span>
              <ul className="list-disc list-inside text-muted-foreground mt-1">
                <li>Gemini: Images processed by Google's servers</li>
                <li>Tesseract: Images processed locally in your browser</li>
                <li>Hybrid: Uses Gemini when online, Tesseract when offline</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}