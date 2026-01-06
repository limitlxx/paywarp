export interface UserInfo {
  isRegistered: boolean;
  registrationDate: bigint;
  messageHash: string;
  signature: string;
}

export interface UserRegistryContract {
  // Read functions
  isUserRegistered(user: string): Promise<boolean>;
  getTotalUsers(): Promise<bigint>;
  getUserInfo(user: string): Promise<UserInfo>;
  getRegistrationDate(user: string): Promise<bigint>;
  getRegistrationStats(): Promise<[bigint, bigint]>;
  userInfo(user: string): Promise<UserInfo>;
  totalUsers(): Promise<bigint>;
  owner(): Promise<string>;

  // Write functions
  registerUser(messageHash: string, signature: string): Promise<any>;
  resetUserRegistration(user: string): Promise<any>;

  // Events
  on(event: 'UserRegistered', listener: (user: string, timestamp: bigint, totalUsers: bigint) => void): void;
  on(event: 'RegistrationFailed', listener: (user: string, reason: string) => void): void;
}

export type UserRegistry = UserRegistryContract;