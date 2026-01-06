export interface SplitConfig {
  billingsPercent: bigint;
  savingsPercent: bigint;
  growthPercent: bigint;
  instantPercent: bigint;
  spendablePercent: bigint;
}

export interface SavingsGoal {
  targetAmount: bigint;
  currentAmount: bigint;
  targetDate: bigint;
  description: string;
  completed: boolean;
  locked: boolean;
  bonusAPY: bigint;
}

export interface BucketBalance {
  balance: bigint;
  yieldBalance: bigint;
  isYielding: boolean;
}

export interface BucketVaultContract {
  // Read functions
  getBucketBalance(user: string, bucket: string): Promise<BucketBalance>;
  getSavingsGoal(user: string, goalId: bigint): Promise<SavingsGoal>;
  getSplitConfig(user: string): Promise<SplitConfig>;
  userSplitConfigs(user: string): Promise<SplitConfig>;
  userBuckets(user: string, bucket: string): Promise<BucketBalance>;
  userSavingsGoals(user: string, goalId: bigint): Promise<SavingsGoal>;
  userGoalCount(user: string): Promise<bigint>;
  baseToken(): Promise<string>;
  yieldToken(): Promise<string>;
  BASIS_POINTS(): Promise<bigint>;
  BONUS_APY(): Promise<bigint>;

  // Write functions
  setSplitConfig(config: SplitConfig): Promise<any>;
  depositAndSplit(amount: bigint): Promise<any>;
  transferBetweenBuckets(fromBucket: string, toBucket: string, amount: bigint): Promise<any>;
  createSavingsGoal(targetAmount: bigint, targetDate: bigint, description: string): Promise<any>;
  contributeToGoal(goalId: bigint, amount: bigint): Promise<any>;
  withdrawFromBucket(bucket: string, amount: bigint): Promise<any>;
  setYieldToken(yieldToken: string): Promise<any>;

  // Events
  on(event: 'FundsSplit', listener: (user: string, amount: bigint, config: SplitConfig) => void): void;
  on(event: 'BucketTransfer', listener: (user: string, fromBucket: string, toBucket: string, amount: bigint) => void): void;
  on(event: 'GoalCreated', listener: (user: string, goalId: bigint, targetAmount: bigint, targetDate: bigint, description: string) => void): void;
  on(event: 'GoalCompleted', listener: (user: string, goalId: bigint, bonusApy: bigint) => void): void;
  on(event: 'YieldGenerated', listener: (user: string, bucket: string, yieldAmount: bigint) => void): void;
}