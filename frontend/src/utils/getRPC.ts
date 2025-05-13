// Update RPC endpoints with Helius as primary
const RPC_ENDPOINTS = [
  "https://devnet.helius-rpc.com/?api-key=bb60d3b9-ed20-448d-a3fe-96b8f541b19b", // Helius devnet provided by user
  "https://api.devnet.solana.com", // Fallback to regular devnet
];

// Function to get an RPC endpoint
export const getRPC = () => {
  return RPC_ENDPOINTS[0]; // Use primary by default
};

// Function to get all RPC endpoints
export const getAllRPCs = () => {
  return RPC_ENDPOINTS;
};
