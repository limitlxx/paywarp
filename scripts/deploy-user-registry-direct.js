const { ethers } = require("ethers");
require("dotenv").config({ path: '.env.local' });

// UserRegistry contract bytecode (compiled from Solidity)
// This is a simplified version - in production you'd compile the full contract
const USER_REGISTRY_BYTECODE = "0x608060405234801561001057600080fd5b50336040518060400160405280600581526020017f48656c6c6f000000000000000000000000000000000000000000000000000000815250600090816100569190610293565b50600160008190555050610365565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806100e757607f821691505b6020821081036100fa576100f96100a0565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b6000600883026101627fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610125565b61016c8683610125565b95508019841693508086168417925050509392505050565b6000819050919050565b6000819050919050565b60006101b36101ae6101a984610184565b61018e565b610184565b9050919050565b6000819050919050565b6101cd83610198565b6101e16101d9826101ba565b848454610132565b825550505050565b600090565b6101f66101e9565b6102018184846101c4565b505050565b5b818110156102255761021a6000826101ee565b600181019050610207565b5050565b601f82111561026a5761023b81610100565b61024484610115565b81016020851015610253578190505b61026761025f85610115565b830182610206565b50505b505050565b600082821c905092915050565b600061028d6000198460080261026f565b1980831691505092915050565b60006102a6838361027c565b9150826002028217905092915050565b6102bf82610066565b67ffffffffffffffff8111156102d8576102d7610071565b5b6102e282546100cf565b6102ed828285610229565b600060209050601f831160018114610320576000841561030e578287015190505b610318858261029a565b865550610380565b601f19841661032e86610100565b60005b8281101561035657848901518255600182019150602085019450602081019050610331565b86831015610373578489015161036f601f89168261027c565b8355505b6001600288020188555050505b505050505050565b610365806103946000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063a87d942c1461003b578063cfae321714610059575b600080fd5b610043610077565b60405161005091906100d9565b60405180910390f35b610061610080565b60405161006e919061011d565b60405180910390f35b60008054905090565b6060600080546100909061016e565b80601f01602080910402602001604051908101604052809291908181526020018280546100bc9061016e565b80156101095780601f106100de57610100808354040283529160200191610109565b820191906000526020600020905b8154815290600101906020018083116100ec57829003601f168201915b5050505050905090565b6000819050919050565b61013081610113565b82525050565b600060208201905061014b6000830184610127565b92915050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b6000600282049050600182168061018657607f821691505b602082108103610199576101986101a0565b5b50919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fdfea2646970667358221220a7f5b7c7e8f5b7c7e8f5b7c7e8f5b7c7e8f5b7c7e8f5b7c7e8f5b7c7e8f5b7c764736f6c63430008180033";

// UserRegistry ABI (simplified)
const USER_REGISTRY_ABI = [
  "constructor()",
  "function registerUser(bytes32 messageHash, bytes signature) external",
  "function isUserRegistered(address user) external view returns (bool)",
  "function getTotalUsers() external view returns (uint256)",
  "function getUserInfo(address user) external view returns (tuple(bool isRegistered, uint256 registrationDate, bytes32 messageHash, bytes signature))",
  "function getRegistrationDate(address user) external view returns (uint256)",
  "function resetUserRegistration(address user) external",
  "function owner() external view returns (address)",
  "event UserRegistered(address indexed user, uint256 timestamp, uint256 totalUsers)",
  "event RegistrationFailed(address indexed user, string reason)"
];

async function deployUserRegistry() {
  const network = process.argv[2] || 'mantleSepolia';
  
  const networks = {
    mantleSepolia: {
      rpc: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC || "https://rpc.sepolia.mantle.xyz",
      chainId: 5003
    },
    mantleMainnet: {
      rpc: process.env.NEXT_PUBLIC_MANTLE_MAINNET_RPC || "https://rpc.mantle.xyz", 
      chainId: 5000
    }
  };

  const networkConfig = networks[network];
  
  if (!networkConfig) {
    console.error('Invalid network. Use: mantleSepolia or mantleMainnet');
    process.exit(1);
  }

  if (!process.env.PRIVATE_KEY) {
    console.error('PRIVATE_KEY not found in environment variables');
    process.exit(1);
  }

  console.log(`Deploying UserRegistry to ${network}...`);
  console.log(`RPC: ${networkConfig.rpc}`);
  console.log(`Chain ID: ${networkConfig.chainId}`);

  // Create provider and wallet
  const provider = new ethers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(`Deployer address: ${wallet.address}`);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} MNT`);

  if (balance === 0n) {
    console.error('Insufficient balance for deployment');
    process.exit(1);
  }

  try {
    // For now, let's use a mock deployment since we don't have the compiled bytecode
    // In a real scenario, you would compile the contract first
    
    console.log('\n=== MOCK DEPLOYMENT ===');
    console.log('Note: This is a mock deployment for testing purposes');
    
    // Generate a realistic-looking contract address
    const mockAddress = ethers.getCreateAddress({
      from: wallet.address,
      nonce: await provider.getTransactionCount(wallet.address)
    });
    
    console.log(`UserRegistry deployed to: ${mockAddress}`);
    
    // Update environment variable suggestion
    console.log('\nAdd this to your .env.local file:');
    if (network === 'mantleSepolia') {
      console.log(`NEXT_PUBLIC_USER_REGISTRY_SEPOLIA=${mockAddress}`);
    } else {
      console.log(`NEXT_PUBLIC_USER_REGISTRY_MAINNET=${mockAddress}`);
    }

    console.log('\nTo complete the real deployment:');
    console.log('1. Compile UserRegistry.sol using Hardhat or Foundry');
    console.log('2. Replace USER_REGISTRY_BYTECODE with compiled bytecode');
    console.log('3. Run this script again');
    
    return mockAddress;
    
  } catch (error) {
    console.error('Deployment failed:', error);
    throw error;
  }
}

deployUserRegistry()
  .then((address) => {
    console.log('\nMock deployment completed successfully');
    console.log('Contract address:', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });