#!/usr/bin/env node

/**
 * Managed Wallet CLI
 * Quick access to all managed wallet operations
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const commands = {
  status: {
    description: 'Check wallet and contract status',
    command: 'node scripts/managed-wallet-operations.js status'
  },
  buckets: {
    description: 'View all bucket balances',
    command: 'node scripts/managed-wallet-operations.js view-buckets'
  },
  deposit: {
    description: 'Make a deposit (usage: deposit <amount>)',
    command: (amount) => `node scripts/managed-wallet-operations.js deposit ${amount}`
  },
  config: {
    description: 'Update split config (usage: config <b> <s> <g> <i> <sp>)',
    command: (...percentages) => `node scripts/managed-wallet-operations.js update-config ${percentages.join(' ')}`
  },
  transfer: {
    description: 'Transfer between buckets (usage: transfer <from> <to> <amount>)',
    command: (from, to, amount) => `node scripts/managed-wallet-operations.js transfer ${from} ${to} ${amount}`
  },
  test: {
    description: 'Test Paystack flow',
    command: 'node scripts/test-paystack-flow.js'
  },
  init: {
    description: 'Initialize contract state (first time setup)',
    command: 'node scripts/initialize-contract-state.js'
  },
  paystack: {
    description: 'Process Paystack deposit (usage: paystack <mode> <address> <amount> [ref])',
    command: (mode, address, amount, ref) => `node scripts/process-paystack-deposit.js ${mode} ${address} ${amount} ${ref || ''}`
  }
};

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log('🔧 Managed Wallet CLI\n');
    console.log('Usage: node scripts/wallet-cli.js <command> [args]\n');
    console.log('Available commands:\n');
    
    Object.entries(commands).forEach(([name, { description }]) => {
      console.log(`  ${name.padEnd(12)} - ${description}`);
    });
    
    console.log('\nExamples:');
    console.log('  node scripts/wallet-cli.js status');
    console.log('  node scripts/wallet-cli.js buckets');
    console.log('  node scripts/wallet-cli.js deposit 100');
    console.log('  node scripts/wallet-cli.js config 20 30 20 20 10');
    console.log('  node scripts/wallet-cli.js transfer savings growth 50');
    console.log('  node scripts/wallet-cli.js test');
    console.log('  node scripts/wallet-cli.js paystack deposit 0x123... 100 REF-123');
    
    console.log('\n📚 Documentation:');
    console.log('  - MANAGED_WALLET_QUICK_START.md');
    console.log('  - docs/MANAGED_WALLET_OPERATIONS.md');
    console.log('  - CONTRACT_STATE_FIXED.md');
    
    process.exit(0);
  }
  
  const commandConfig = commands[cmd];
  
  if (!commandConfig) {
    console.error(`❌ Unknown command: ${cmd}`);
    console.log('Run "node scripts/wallet-cli.js help" to see available commands');
    process.exit(1);
  }
  
  try {
    let command;
    
    if (typeof commandConfig.command === 'function') {
      command = commandConfig.command(...args.slice(1));
    } else {
      command = commandConfig.command;
    }
    
    console.log(`🚀 Running: ${command}\n`);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
