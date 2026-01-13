'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Settings, 
  Receipt, 
  ArrowRight, 
  CheckCircle, 
  Percent,
  FileSearch,
  Wallet,
  TrendingUp,
  Target,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import { useAccount } from 'wagmi';

interface LaunchFeatureProps {
  onComplete?: () => void;
}

type LaunchStep = 'welcome' | 'settings-preview' | 'expenses-preview' | 'complete';

export function LaunchFeature({ onComplete }: LaunchFeatureProps) {
  const [currentStep, setCurrentStep] = useState<LaunchStep>('welcome');
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const { address } = useAccount();
  const { settings } = useSettings();

  // Update progress based on current step
  useEffect(() => {
    const progressMap = {
      'welcome': 25,
      'settings-preview': 50,
      'expenses-preview': 75,
      'complete': 100
    };
    setProgress(progressMap[currentStep]);
  }, [currentStep]);

  const handleNext = () => {
    switch (currentStep) {
      case 'welcome':
        setCurrentStep('settings-preview');
        break;
      case 'settings-preview':
        setCurrentStep('expenses-preview');
        break;
      case 'expenses-preview':
        setCurrentStep('complete');
        break;
      case 'complete':
        onComplete?.();
        router.push('/dashboard');
        break;
    }
  };

  const handleSkipToSettings = () => {
    router.push('/settings');
  };

  const handleSkipToExpenses = () => {
    router.push('/expenses');
  };

  const handleSkipToDashboard = () => {
    onComplete?.();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white/70">Setup Progress</span>
            <span className="text-sm font-medium text-white/70">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          {currentStep === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                
                <h1 className="text-4xl font-bold text-white">
                  Welcome to PayWarp!
                </h1>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto">
                  You're all set up! Let's explore the key features that will help you manage your finances like a pro.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-6 text-center">
                    <Settings className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Smart Settings</h3>
                    <p className="text-white/70 text-sm">
                      Configure your bucket allocations and automate your savings strategy
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-6 text-center">
                    <Receipt className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Expense Tracking</h3>
                    <p className="text-white/70 text-sm">
                      Scan receipts with AI and track expenses automatically on blockchain
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Button
                onClick={handleNext}
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg"
              >
                Let's Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}

          {currentStep === 'settings-preview' && (
            <motion.div
              key="settings-preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl font-bold text-white">
                  Smart Financial Settings
                </h2>
                
                <p className="text-white/80 max-w-2xl mx-auto">
                  Configure how your money is automatically allocated across different buckets for optimal financial management.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Percent className="w-5 h-5 text-purple-400" />
                      Bucket Allocations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {settings.bucketAllocations.slice(0, 3).map((bucket) => (
                      <div key={bucket.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: bucket.color }}
                          />
                          <span className="text-white/90 text-sm">{bucket.name}</span>
                        </div>
                        <Badge variant="secondary" className="bg-white/20 text-white">
                          {bucket.percentage}%
                        </Badge>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/20">
                      <p className="text-xs text-white/60">
                        + {settings.bucketAllocations.length - 3} more buckets
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Target className="w-5 h-5 text-green-400" />
                      Key Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Auto-balance allocations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Session key automation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Token allowance management</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Smart notifications</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleSkipToSettings}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Configure Now
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  Next: Expenses
                  <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 'expenses-preview' && (
            <motion.div
              key="expenses-preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl font-bold text-white">
                  AI-Powered Expense Tracking
                </h2>
                
                <p className="text-white/80 max-w-2xl mx-auto">
                  Scan receipts with advanced OCR technology and automatically track expenses on the blockchain.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <FileSearch className="w-5 h-5 text-green-400" />
                      OCR Features
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Instant receipt scanning</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">AI-powered data extraction</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Business type detection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Item-level breakdown</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Wallet className="w-5 h-5 text-blue-400" />
                      Blockchain Integration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Permanent expense records</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Recurring expense automation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Expense verification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-white/90 text-sm">Real-time analytics</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <Card className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-sm border-green-400/30 max-w-md mx-auto">
                  <CardContent className="p-6">
                    <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-white mb-2">Smart Analytics</h3>
                    <p className="text-white/80 text-sm">
                      Get insights into your spending patterns and optimize your budget automatically
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleSkipToExpenses}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Try Expense Tracking
                </Button>
                <Button
                  onClick={handleNext}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                >
                  Complete Setup
                  <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="mx-auto w-24 h-24 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center"
              >
                <CheckCircle className="w-12 h-12 text-white" />
              </motion.div>
              
              <div className="space-y-4">
                <h2 className="text-4xl font-bold text-white">
                  You're All Set!
                </h2>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto">
                  Welcome to the future of personal finance. Your PayWarp journey begins now!
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4 text-center">
                    <Settings className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                    <h4 className="text-white font-medium">Settings</h4>
                    <p className="text-white/60 text-xs">Configure your preferences</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4 text-center">
                    <Receipt className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <h4 className="text-white font-medium">Expenses</h4>
                    <p className="text-white/60 text-xs">Track your spending</p>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <h4 className="text-white font-medium">Dashboard</h4>
                    <p className="text-white/60 text-xs">Monitor your progress</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-center gap-4">
                <Button
                  onClick={handleSkipToSettings}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Go to Settings
                </Button>
                <Button
                  onClick={handleSkipToExpenses}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Try Expenses
                </Button>
                <Button
                  onClick={handleSkipToDashboard}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}