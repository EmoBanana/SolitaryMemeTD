const {
  Metaplex,
  keypairIdentity,
  bundlrStorage,
} = require("@metaplex-foundation/js");
const {
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const fs = require("fs");

async function deployNFT() {
  try {
    // Read the metadata JSON file
    const metadataJson = JSON.parse(fs.readFileSync("./Tralala.json", "utf8"));

    console.log("Deploying NFT with metadata:", metadataJson.name);

    // Connect to the Solana devnet
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    // Create a keypair for testing
    const wallet = Keypair.generate();
    console.log("Generated wallet address:", wallet.publicKey.toString());

    // Request airdrop
    console.log("Requesting SOL airdrop...");
    const airdropSignature = await connection.requestAirdrop(
      wallet.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSignature);
    console.log("Airdrop received!");

    // Create a Metaplex instance with the wallet
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(wallet))
      .use(
        bundlrStorage({
          address: "https://devnet.bundlr.network",
          providerUrl: clusterApiUrl("devnet"),
          timeout: 60000,
        })
      );

    // Upload the metadata
    console.log("Uploading metadata...");
    const { uri } = await metaplex.nfts().uploadMetadata(metadataJson);

    console.log("Metadata uploaded with URI:", uri);

    // Create the NFT
    console.log("Creating NFT...");
    const { nft } = await metaplex.nfts().create({
      uri,
      name: metadataJson.name,
      symbol: metadataJson.symbol,
      sellerFeeBasisPoints: 500, // 5% royalty
    });

    console.log("\nNFT created successfully!");
    console.log("NFT Address:", nft.address.toString());
    console.log("Metadata Address:", nft.metadataAddress.toString());
    console.log(
      "View on Solana Explorer:",
      `https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
    );
  } catch (error) {
    console.error("Error deploying NFT:", error);
  }
}

deployNFT().catch(console.error);
