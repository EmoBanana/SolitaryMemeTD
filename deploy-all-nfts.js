const {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} = require("@solana/web3.js");
const {
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
} = require("@metaplex-foundation/mpl-token-metadata");
const {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} = require("@solana/spl-token");
const fs = require("fs");

// Hardcoded Metaplex Token Metadata Program ID
const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

// List of metadata files to deploy
const NFT_METADATA_FILES = [
  "./Tralala.json",
  "./Bombardino.json",
  "./TungSahur.json",
];

async function deployNFT(connection, payer, metadataPath) {
  try {
    // Read the metadata JSON file
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));

    console.log(`\n------------------------------`);
    console.log(`Deploying NFT: ${metadata.name}`);
    console.log(`------------------------------`);

    // Create a new mint (token)
    console.log("Creating NFT mint...");
    const mintKeypair = Keypair.generate();
    console.log("Mint address:", mintKeypair.publicKey.toString());

    await createMint(
      connection,
      payer,
      payer.publicKey, // mint authority
      payer.publicKey, // freeze authority
      0, // decimals (0 for NFT)
      mintKeypair // use the keypair we created
    );

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
        METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
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
        METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      METADATA_PROGRAM_ID
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
    console.log("Mint address:", mintKeypair.publicKey.toString());
    console.log(
      "Explorer URL:",
      `https://explorer.solana.com/address/${mintKeypair.publicKey.toString()}?cluster=devnet`
    );

    // Return the mint address for reference
    return {
      name: metadata.name,
      mintAddress: mintKeypair.publicKey.toString(),
      signature,
    };
  } catch (error) {
    console.error(`Error deploying NFT from ${metadataPath}:`, error);
    return null;
  }
}

async function deployAllNFTs() {
  try {
    // Connect to the Solana devnet
    const connection = new Connection(
      "https://api.devnet.solana.com",
      "confirmed"
    );

    // Load the Phantom wallet keypair
    console.log("Loading wallet from phantom-keypair.json...");
    const secretKey = new Uint8Array(
      JSON.parse(fs.readFileSync("phantom-keypair.json"))
    );
    const payer = Keypair.fromSecretKey(secretKey);
    console.log("Wallet address:", payer.publicKey.toString());

    // Check wallet balance
    const balance = await connection.getBalance(payer.publicKey);
    console.log(`Wallet balance: ${balance / 1_000_000_000} SOL`);

    if (balance < 10000000) {
      console.log(
        "Warning: Low balance. You might need more SOL to deploy all NFTs."
      );
    }

    // Track deployment results
    const results = [];

    // Deploy each NFT
    for (const metadataFile of NFT_METADATA_FILES) {
      const result = await deployNFT(connection, payer, metadataFile);
      if (result) {
        results.push(result);
      }
    }

    // Print summary
    console.log("\n------------------------------");
    console.log("DEPLOYMENT SUMMARY");
    console.log("------------------------------");

    if (results.length > 0) {
      console.log("Successfully deployed NFTs:");
      results.forEach((result, i) => {
        console.log(`${i + 1}. ${result.name}: ${result.mintAddress}`);
      });
    } else {
      console.log("No NFTs were successfully deployed.");
    }

    if (results.length !== NFT_METADATA_FILES.length) {
      console.log(
        `Failed to deploy ${NFT_METADATA_FILES.length - results.length} NFTs.`
      );
    }
  } catch (error) {
    console.error("Error in deployment process:", error);
  }
}

deployAllNFTs().catch(console.error);
