'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { 
  Settings, 
  ArrowRight, 
  Sparkles,
  Target,
  Percent,
  CheckCircle
} from 'lucide-react';

interface LaunchFeatureProps {
  onComplete?: () => void;
}

type LaunchStep = 'welcome' | 'settings';

export function LaunchFeature({ onComplete }: LaunchFeatureProps) {
  const [currentStep, setCurrentStep] = useState<LaunchStep>('welcome');
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  // Update progress based on current step
  useEffect(() => {
    const progressMap = {
      'welcome': 50,
      'settings': 100
    };
    setProgress(progressMap[currentStep]);
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep === 'welcome') {
      setCurrentStep('settings');
    } else {
      router.push('/settings');
    }
  };

  const handleGoToSettings = () => {
    router.push('/settings');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
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
                  className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                
                <h1 className="text-4xl font-bold text-white">
                  Welcome to PayWarp!
                </h1>
                
                <p className="text-xl text-white/80 max-w-2xl mx-auto">
                  You're ready to start managing your finances with smart bucket allocations and automated savings.
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                  <CardContent className="p-6 text-center">
                    <Settings className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Configure Your Settings</h3>
                    <p className="text-white/70 text-sm">
                      Set up your bucket allocations and preferences to get started
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Button
                onClick={handleNext}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>
          )}

          {currentStep === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                
                <h2 className="text-3xl font-bold text-white">
                  Configure Your Financial Settings
                </h2>
                
                <p className="text-white/80 max-w-2xl mx-auto">
                  This is the first and most important step. Set up your bucket allocations to automatically manage your money across different financial goals.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Percent className="w-6 h-6 text-blue-400" />
                      <h3 className="text-lg font-semibold text-white">Bucket Allocations</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-white/90 text-sm">Billings & Expenses</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-white/90 text-sm">Savings Goals</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-white/90 text-sm">Growth Investments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-white/90 text-sm">Instant Access</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <Target className="w-6 h-6 text-purple-400" />
                      <h3 className="text-lg font-semibold text-white">Smart Features</h3>
                    </div>
                    <div className="space-y-3">
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
                        <span className="text-white/90 text-sm">Yield optimization</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-white/90 text-sm">Smart notifications</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleGoToSettings}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg"
                >
                  Go to Settings
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}