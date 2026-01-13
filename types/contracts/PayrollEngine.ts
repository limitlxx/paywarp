export interface PayrollEntry {
  recipient: string;
  salary: bigint;
  paymentDate: bigint;
  active: boolean;
  totalPaid: bigint;
  lastPaidDate: bigint;
}

export interface PayrollBatch {
  totalAmount: bigint;
  scheduledDate: bigint;
  employeeCount: bigint;
  processed: boolean;
  failed: boolean;
  failureReason: string;
  processedAt: bigint;
}

export interface PaymentRecord {
  recipient: string;
  amount: bigint;
  date: bigint;
  transactionHash: string;
  successful: boolean;
  gasUsed: bigint;
}

export interface PayrollEngineContract {
  // Read functions
  employeeEntries(employer: string, employeeId: bigint): Promise<PayrollEntry>;
  employeeCount(employer: string): Promise<bigint>;
  payrollBatches(employer: string, batchId: bigint): Promise<PayrollBatch>;
  batchCount(employer: string): Promise<bigint>;
  paymentToken(): Promise<string>;
  bucketVault(): Promise<string>;
  automationRegistry(): Promise<string>;
  authorizedKeepers(keeper: string): Promise<boolean>;
  
  getUpcomingPayrolls(employer: string): Promise<PayrollBatch[]>;
  getPayrollHistory(employer: string): Promise<PayrollBatch[]>;
  getEmployee(employer: string, employeeId: bigint): Promise<PayrollEntry>;
  getBatchPayments(employer: string, batchId: bigint): Promise<PaymentRecord[]>;

  // Write functions
  setAutomationRegistry(automationRegistry: string): Promise<any>;
  setAuthorizedKeeper(keeper: string, authorized: boolean): Promise<any>;
  addEmployee(recipient: string, salary: bigint, paymentDate: bigint): Promise<any>;
  updateEmployee(employeeId: bigint, newSalary: bigint, newPaymentDate: bigint): Promise<any>;
  removeEmployee(employeeId: bigint): Promise<any>;
  schedulePayroll(scheduledDate: bigint): Promise<any>;
  processPayroll(employer: string, batchId: bigint): Promise<any>;
  emergencyWithdraw(amount: bigint): Promise<any>;

  // Events
  on(event: 'EmployeeAdded', listener: (employer: string, employee: string, salary: bigint, paymentDate: bigint) => void): void;
  on(event: 'EmployeeUpdated', listener: (employer: string, employee: string, newSalary: bigint, newPaymentDate: bigint) => void): void;
  on(event: 'EmployeeRemoved', listener: (employer: string, employee: string) => void): void;
  on(event: 'PayrollScheduled', listener: (employer: string, batchId: bigint, scheduledDate: bigint, totalAmount: bigint, employeeCount: bigint) => void): void;
  on(event: 'PayrollProcessed', listener: (batchId: bigint, employer: string, totalAmount: bigint, employeeCount: bigint, successful: boolean) => void): void;
  on(event: 'PaymentExecuted', listener: (employer: string, recipient: string, amount: bigint, successful: boolean) => void): void;
}