'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { WrappedReportService } from '@/lib/wrapped-report-service';

interface WalletLevelStatusProps {
  reportsData: {
    reports: any[];
    hasActivity: boolean;
    isLoading: boolean;
    error: string | null;
    transactions?: any[];
  };
}

export default function WalletLevelStatus({ reportsData }: WalletLevelStatusProps) {
  const { reports, hasActivity, isLoading } = reportsData;
  const [levelData, setLevelData] = useState<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showLevel, setShowLevel] = useState(false);

  // Compute level when data loads
  useEffect(() => {
    if (hasActivity && reports.length > 0 && !isLoading) {
      // Create mock summary data for demo purposes
      const mockSummary = {
        totalYears: reports.length,
        totalTransactions: reports.reduce((sum, report) => sum + (report.totalTransactions || 0), 0),
        totalVolume: reports.reduce((sum, report) => sum + (report.totalVolume || 0), 0),
        firstTransactionDate: new Date(),
        mostActiveYear: reports[0]?.year || new Date().getFullYear(),
        dominantArchetype: reports[0]?.userArchetype?.type || 'Balanced User'
      };
      
      const level = WrappedReportService.computeWalletLevel(mockSummary);
      setLevelData(level);
      
      // Start animation sequence
      setTimeout(() => setIsAnimating(true), 500);
      setTimeout(() => setShowLevel(true), 2000);
    }
  }, [reports, hasActivity, isLoading]);

  if (!hasActivity || !levelData || isLoading) {
    return null;
  }

  return (
    <div className="relative w-full max-w-md mx-auto mb-8 p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden">
      {/* Background Scan Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 rounded-2xl"
        animate={{ 
          backgroundPosition: isAnimating ? ['0% 50%', '100% 50%', '0% 50%'] : '0% 50%' 
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        style={{ backgroundSize: '200% 100%' }}
      />

      {/* Scanning Text */}
      <AnimatePresence>
        {isAnimating && !showLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100" />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-200" />
            </div>
            <p className="text-sm text-zinc-300 font-mono">
              Analyzing your chain mastery...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Badge */}
      <AnimatePresence>
        {showLevel && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotateY: -180 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ 
              duration: 1, 
              type: "spring", 
              damping: 15,
              stiffness: 100
            }}
            className="relative z-10 text-center"
          >
            <motion.div 
              className="text-6xl mb-4"
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatType: "reverse" 
              }}
            >
              {levelData.emoji}
            </motion.div>
            <h3 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {levelData.level}
            </h3>
            <p className="text-sm text-zinc-300 mb-6">{levelData.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <div className="relative z-10 mt-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-400">Chain Mastery</span>
          <span className="text-xs text-zinc-400">
            {showLevel ? `${levelData.progress.toFixed(0)}%` : '0%'}
          </span>
        </div>
        
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ 
              width: isAnimating ? `${levelData.progress}%` : 0 
            }}
            transition={{ 
              duration: 2.5, 
              ease: 'easeOut',
              delay: showLevel ? 0 : 1
            }}
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full relative overflow-hidden"
          >
            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                ease: 'linear',
                delay: 1
              }}
            />
          </motion.div>
        </div>
      </div>

      {/* Unlock Particles */}
      {showLevel && (
        <>
          <motion.div
            className="absolute -top-4 -right-4 w-8 h-8 bg-purple-500/30 rounded-full"
            animate={{ 
              scale: [1, 1.2, 1], 
              opacity: [0.5, 1, 0.5],
              rotate: [0, 180, 360]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute -bottom-2 -left-2 w-6 h-6 bg-blue-500/30 rounded-full"
            animate={{ 
              scale: [1, 1.3, 1], 
              opacity: [0.3, 0.8, 0.3],
              rotate: [360, 180, 0]
            }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
          />
          <motion.div
            className="absolute top-1/2 -right-2 w-4 h-4 bg-indigo-500/30 rounded-full"
            animate={{ 
              scale: [1, 1.1, 1], 
              opacity: [0.4, 0.9, 0.4],
              y: [-10, 10, -10]
            }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />
        </>
      )}
    </div>
  );
}