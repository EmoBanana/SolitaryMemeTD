const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const {
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID,
} = require("@metaplex-foundation/mpl-token-metadata");
const {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");
const fs = require("fs");

async function deployNFT() {
  // Read the metadata JSON file
  const metadata = JSON.parse(fs.readFileSync("./Tralala.json", "utf8"));

  console.log("Deploying NFT with metadata:", metadata.name);

  // Connect to the Solana devnet
  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  // For demo purposes, you would normally load your keypair from a file
  // const payer = Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync('/path/to/keypair.json'))));

  // For demonstration, we'll create a new keypair
  // In production, NEVER expose your private keys
  const payer = Keypair.generate();
  console.log("Generated wallet address:", payer.publicKey.toString());

  // Request airdrop for testing
  console.log("Requesting SOL airdrop...");
  try {
    const airdropSignature = await connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL // 2 SOL
    );

    await connection.confirmTransaction(airdropSignature);
    console.log("Airdrop received!");
  } catch (error) {
    console.error("Airdrop failed:", error);
    return;
  }

  try {
    // Create a new mint (token) - Create a keypair first
    console.log("Creating NFT mint...");
    const mintKeypair = Keypair.generate();
    console.log("Mint keypair created:", mintKeypair.publicKey.toString());

    // Create the token mint
    await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      0, // decimals (0 for NFT)
      mintKeypair // use the keypair we created
    );
    console.log("Mint created:", mintKeypair.publicKey.toString());

    // Create token account
    console.log("Creating token account...");
    const tokenAccount = await createAssociatedTokenAccount(
      connection,
      payer,
      mintKeypair.publicKey,
      payer.publicKey
    );
    console.log("Token account created:", tokenAccount.toString());

    // Mint 1 token (NFT)
    console.log("Minting NFT...");
    await mintTo(
      connection,
      payer,
      mintKeypair.publicKey,
      tokenAccount,
      payer.publicKey,
      1 // For NFT, we mint exactly 1 token
    );
    console.log("NFT minted to token account");

    // Create metadata
    console.log("Creating metadata...");
    const metadataData = {
      name: metadata.name,
      symbol: metadata.symbol || "TOWER",
      uri: metadata.image,
      sellerFeeBasisPoints: 500, // 5% royalty
      creators: [
        {
          address: payer.publicKey,
          verified: true,
          share: 100,
        },
      ],
      collection: null,
      uses: null,
    };

    // Calculate the metadata PDA
    const metadataPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    )[0];

    console.log("Metadata address:", metadataPDA.toString());

    // Create the metadata instruction
    const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataPDA,
        mint: mintKeypair.publicKey,
        mintAuthority: payer.publicKey,
        payer: payer.publicKey,
        updateAuthority: payer.publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: metadataData,
          isMutable: true,
          collectionDetails: null,
        },
      }
    );

    // Calculate the master edition PDA
    const masterEditionPDA = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      PROGRAM_ID
    )[0];

    console.log("Master edition address:", masterEditionPDA.toString());

    // Create the master edition instruction (making it a true NFT)
    const createMasterEditionInstruction =
      createCreateMasterEditionV3Instruction(
        {
          edition: masterEditionPDA,
          mint: mintKeypair.publicKey,
          updateAuthority: payer.publicKey,
          mintAuthority: payer.publicKey,
          payer: payer.publicKey,
          metadata: metadataPDA,
        },
        {
          createMasterEditionArgs: {
            maxSupply: 0, // 0 for a true NFT with no additional prints
          },
        }
      );

    // Create and send transaction with both instructions
    const transaction = new Transaction()
      .add(createMetadataInstruction)
      .add(createMasterEditionInstruction);

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
    ]);

    console.log("NFT deployed successfully!");
    console.log("Transaction signature:", signature);
    console.log("\nSummary:");
    console.log("- Mint address:", mintKeypair.publicKey.toString());
    console.log("- Token account:", tokenAccount.toString());
    console.log("- Metadata address:", metadataPDA.toString());
    console.log("- Master edition address:", masterEditionPDA.toString());
    console.log("\nYou can view your NFT on Solana Explorer:");
    console.log(
      `https://explorer.solana.com/address/${mintKeypair.publicKey.toString()}?cluster=devnet`
    );
  } catch (error) {
    console.error("Error deploying NFT:", error);
  }
}

deployNFT().catch(console.error);
