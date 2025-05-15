// Copy and paste this into the Solana Playground console
// This script creates NFTs with metadata for your tower defense game

// Function to create an NFT
async function createNFT(name, symbol, imageUrl, attributes) {
  console.log(`Creating NFT: ${name}`);

  // Create metadata JSON
  const metadata = {
    name,
    symbol,
    description: `Tower Defense NFT: ${name}`,
    image: imageUrl,
    attributes,
  };

  // Log the metadata for copying
  console.log("NFT Metadata:");
  console.log(JSON.stringify(metadata, null, 2));

  // Create a new mint account
  const mint = Keypair.generate();
  console.log(`Mint address: ${mint.publicKey.toString()}`);

  // Create the token
  await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    wallet.publicKey,
    0
  );

  // Create token account
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    mint.publicKey,
    wallet.publicKey
  );

  // Mint one token
  await mintTo(
    connection,
    wallet.payer,
    mint.publicKey,
    tokenAccount.address,
    wallet.payer,
    1
  );

  console.log(`NFT ${name} created successfully!`);
  console.log(`Mint address: ${mint.publicKey.toString()}`);
  console.log("-----------------------------");

  return mint.publicKey;
}

// Create the NFTs
async function createAllNFTs() {
  // Tralala NFT
  await createNFT(
    "Tralalero Tralala",
    "TRALALA",
    "https://silver-cheap-silkworm-705.mypinata.cloud/ipfs/bafybeibojiqj5yxxjbsp5aa2fuznltogxasdlkpynn62jqtgego2rndjbe",
    [
      { trait_type: "HP", value: 10 },
      { trait_type: "Max HP", value: 10 },
      { trait_type: "HP Regen", value: 0 },
      { trait_type: "Damage", value: 20 },
      { trait_type: "Range", value: 3 },
      { trait_type: "Fire Rate", value: 1200 },
      { trait_type: "Enemy Reward Multiplier", value: 1.0 },
      { trait_type: "Wave Reward Multiplier", value: 1.0 },
    ]
  );

  // Bombardino NFT
  await createNFT(
    "Bombardino Crocodilo",
    "BOMBARD",
    "https://silver-cheap-silkworm-705.mypinata.cloud/ipfs/your_bombardino_image_cid",
    [
      { trait_type: "HP", value: 15 },
      { trait_type: "Max HP", value: 15 },
      { trait_type: "HP Regen", value: 0 },
      { trait_type: "Damage", value: 35 },
      { trait_type: "Range", value: 2 },
      { trait_type: "Fire Rate", value: 2000 },
      { trait_type: "Enemy Reward Multiplier", value: 1.2 },
      { trait_type: "Wave Reward Multiplier", value: 1.1 },
    ]
  );

  // TungSahur NFT
  await createNFT(
    "Tung Tung Tung Sahur",
    "TUNG",
    "https://silver-cheap-silkworm-705.mypinata.cloud/ipfs/your_tungsahur_image_cid",
    [
      { trait_type: "HP", value: 8 },
      { trait_type: "Max HP", value: 8 },
      { trait_type: "HP Regen", value: 1 },
      { trait_type: "Damage", value: 15 },
      { trait_type: "Range", value: 4 },
      { trait_type: "Fire Rate", value: 800 },
      { trait_type: "Enemy Reward Multiplier", value: 0.9 },
      { trait_type: "Wave Reward Multiplier", value: 1.3 },
    ]
  );

  console.log("All NFTs created successfully!");
}

// Run the function
createAllNFTs().catch(console.error);
