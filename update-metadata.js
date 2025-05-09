const {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
} = require("@solana/web3.js");
const fs = require("fs");

// Token Metadata Program ID (fixed address on Solana)
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

async function updateTokenMetadata() {
  try {
    // Load the keypair from file - already stored as array
    const keypairData = JSON.parse(
      fs.readFileSync("./phantom-keypair.json", "utf8")
    );
    const secretKey = new Uint8Array(keypairData);
    const keypair = Keypair.fromSecretKey(secretKey);

    console.log("Using wallet:", keypair.publicKey.toString());

    // Initialize connection to Solana (using devnet instead of mainnet)
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Token mint address
    const mintAddress = "B3G9uhi7euWErYvwfTye2MpDJytkYX6mAgUhErHbnSoT";

    // IPFS URL for the metadata
    const metadataUri =
      "https://silver-cheap-silkworm-705.mypinata.cloud/ipfs/bafkreibzb3gdmz6wdnxl4mnu5mmy253wltximay3mtg7vzlq7oyc5qj5tu";

    // Read the token.json to get the image URL
    const tokenJson = JSON.parse(fs.readFileSync("./token.json", "utf8"));
    const imageUrl = tokenJson.image;

    console.log("Creating/updating metadata for SPL token:", mintAddress);
    console.log("Using metadata URI:", metadataUri);
    console.log("Image URL from token.json:", imageUrl);
    console.log("Network: devnet");

    // Create a script to update metadata
    const tempFile = "./update-script.js";
    fs.writeFileSync(
      tempFile,
      `
const { Metaplex, keypairIdentity } = require('@metaplex-foundation/js');
const { Connection, clusterApiUrl, Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const axios = require('axios');

async function main() {
  try {
    // Load keypair
    const keypairData = JSON.parse(fs.readFileSync('./phantom-keypair.json', 'utf8'));
    const secretKey = new Uint8Array(keypairData);
    const keypair = Keypair.fromSecretKey(secretKey);

    // Initialize Metaplex with devnet
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const metaplex = Metaplex.make(connection).use(keypairIdentity(keypair));

    // Get the mint address
    const mintAddress = new PublicKey('${mintAddress}');
    
    // Validate token metadata directly from IPFS
    try {
      console.log('Fetching metadata from IPFS...');
      const response = await axios.get('${metadataUri}');
      const metadata = response.data;
      console.log('IPFS Metadata:', JSON.stringify(metadata, null, 2));
      
      if (!metadata.image) {
        console.error('Warning: The metadata JSON does not have an image field!');
      } else {
        console.log('Image URL in metadata:', metadata.image);
      }
    } catch (error) {
      console.error('Error fetching metadata from IPFS:', error.message);
    }

    console.log('Finding token...');
    
    // Find the mint account to check if token exists
    const mintInfo = await connection.getAccountInfo(mintAddress);
    
    if (!mintInfo) {
      console.error('Token mint account does not exist on devnet');
      return;
    }
    
    console.log('Token mint account found. Checking for metadata...');
    
    try {
      // Try to find existing metadata
      const tokenMetadata = await metaplex.nfts().findByMint({ mintAddress });
      console.log('Existing metadata found:', tokenMetadata.name);
      console.log('Current URI:', tokenMetadata.uri);
      console.log('Current JSON data:', JSON.stringify(tokenMetadata.json, null, 2));
      
      // Update the token metadata
      console.log('Updating token metadata...');
      const { response } = await metaplex.nfts().update({
        nftOrSft: tokenMetadata,
        uri: '${metadataUri}',
        name: 'Shards',
        symbol: 'SMTD',
        // Add the image explicitly
        sellerFeeBasisPoints: 0,
      });
      
      console.log('Update completed successfully!');
      console.log('Transaction signature:', response.signature);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        console.log('No metadata found. Creating new metadata...');
        
        // Create metadata for the token with explicit image
        const { response } = await metaplex.nfts().createSft({
          uri: '${metadataUri}',
          name: 'Shards',
          symbol: 'SMTD',
          decimals: 9,
          sellerFeeBasisPoints: 0, // No royalties
          useExistingMint: mintAddress,
        });
        
        console.log('Metadata created successfully!');
        console.log('Transaction signature:', response.signature);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error updating metadata:', error);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
    `
    );

    console.log("Created temporary script to create/update metadata");
    console.log("Running the script...");

    const { execSync } = require("child_process");
    try {
      // Install axios if not already installed
      try {
        execSync("npm list axios || npm install axios --no-save", {
          encoding: "utf-8",
        });
      } catch (e) {
        console.log("Installing axios dependency...");
        execSync("npm install axios --no-save", { encoding: "utf-8" });
      }

      const output = execSync(`node ${tempFile}`, { encoding: "utf-8" });
      console.log(output);
      console.log("Cleanup temporary file...");
      fs.unlinkSync(tempFile);
    } catch (error) {
      console.error("Error executing script:", error.message);
      if (error.stdout) console.log("Script output:", error.stdout);
      if (error.stderr) console.error("Script error:", error.stderr);
    }
  } catch (error) {
    console.error("Error setting up metadata:", error);
  }
}

updateTokenMetadata().catch(console.error);
