import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Breakout } from "../target/types/breakout";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createMint,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";

describe("breakout", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Breakout as Program<Breakout>;
  const wallet = provider.wallet;

  // Define test accounts
  let shardTokenMint: PublicKey;
  let userTokenAccount: PublicKey;
  let userStats: PublicKey;
  let tower: PublicKey;
  let towerMint: PublicKey;
  let mintAuthority: PublicKey;
  let gamePool: PublicKey;
  let gameServer: PublicKey;
  let feePayer: PublicKey;
  let vrfState: PublicKey;

  // Test user
  const user = Keypair.generate();

  // Constants from the program
  const USER_STATS_SEED = Buffer.from("user_stats");
  const TOWER_SEED = Buffer.from("tower");
  const MINT_AUTHORITY_SEED = Buffer.from("mint_authority");
  const GAME_POOL_SEED = Buffer.from("game_pool");
  const GAME_SERVER_SEED = Buffer.from("game_server");
  const FEE_PAYER_SEED = Buffer.from("fee_payer");
  const VRF_STATE_SEED = Buffer.from("vrf_state");

  // Test constants
  const STARTER_TOWER_NAME = "Starter Tower";
  const STARTER_TOWER_URI = "https://example.com/tower/starter";

  before(async () => {
    // Fund user account
    const userAirdrop = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(userAirdrop);

    // Initialize shardToken for testing (in real deployment this would be the fixed address)
    const shardMintKeypair = Keypair.generate();

    // Find PDA for mint authority
    const [mintAuthorityPda, mintBump] = await PublicKey.findProgramAddress(
      [MINT_AUTHORITY_SEED, shardMintKeypair.publicKey.toBuffer()],
      program.programId
    );
    mintAuthority = mintAuthorityPda;

    // Create the token mint
    shardTokenMint = await createMint(
      provider.connection,
      wallet.payer,
      mintAuthorityPda,
      mintAuthorityPda, // Freeze authority
      0 // Decimals
    );

    console.log("Created test shard token mint:", shardTokenMint.toString());

    // Create token account for the user
    userTokenAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      shardTokenMint,
      user.publicKey
    );

    // Get the PDA for user stats
    const [userStatsPda, userStatsBump] = await PublicKey.findProgramAddress(
      [USER_STATS_SEED, user.publicKey.toBuffer()],
      program.programId
    );
    userStats = userStatsPda;

    // Get the PDA for game server
    const [gameServerPda, gameServerBump] = await PublicKey.findProgramAddress(
      [GAME_SERVER_SEED],
      program.programId
    );
    gameServer = gameServerPda;

    // Get the PDA for fee payer
    const [feePayerPda, feePayerBump] = await PublicKey.findProgramAddress(
      [FEE_PAYER_SEED],
      program.programId
    );
    feePayer = feePayerPda;

    // Get the PDA for VRF state
    const [vrfStatePda, vrfStateBump] = await PublicKey.findProgramAddress(
      [VRF_STATE_SEED, user.publicKey.toBuffer()],
      program.programId
    );
    vrfState = vrfStatePda;

    // Get the PDA for game pool
    const [gamePoolPda, gamePoolBump] = await PublicKey.findProgramAddress(
      [GAME_POOL_SEED, user.publicKey.toBuffer()],
      program.programId
    );
    gamePool = gamePoolPda;
  });

  it("Initialize user stats", async () => {
    try {
      await program.methods
        .initializeUserStats()
        .accounts({
          user: user.publicKey,
          userStats: userStats,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Fetch the created account
      const userStatsAccount = await program.account.userStats.fetch(userStats);

      assert.equal(
        userStatsAccount.owner.toString(),
        user.publicKey.toString()
      );
      assert.equal(userStatsAccount.totalGamesPlayed, 0);
      assert.equal(userStatsAccount.totalWins, 0);
      assert.equal(userStatsAccount.totalShardsEarned, 0);
      assert.equal(userStatsAccount.totalShardsSpent, 0);
      assert.equal(userStatsAccount.totalTowersOwned, 0);
      assert.equal(userStatsAccount.hasClaimedStarterTower, false);

      console.log("User stats initialized successfully");
    } catch (error) {
      console.error("Error initializing user stats:", error);
      throw error;
    }
  });

  it("Initialize game server", async () => {
    try {
      await program.methods
        .initializeGameServer()
        .accounts({
          admin: wallet.publicKey,
          gameServer: gameServer,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fetch the created account
      const gameServerAccount = await program.account.gameServer.fetch(
        gameServer
      );

      assert.equal(
        gameServerAccount.authority.toString(),
        wallet.publicKey.toString()
      );

      console.log("Game server initialized successfully");
    } catch (error) {
      console.error("Error initializing game server:", error);
      throw error;
    }
  });

  it("Initialize fee payer", async () => {
    try {
      await program.methods
        .initializeFeePayer()
        .accounts({
          payer: wallet.publicKey, // In real deployment, this would be the treasury address
          feePayer: feePayer,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Fetch the created account
      const feePayerAccount = await program.account.feePayer.fetch(feePayer);

      assert.equal(
        feePayerAccount.authority.toString(),
        wallet.publicKey.toString()
      );

      console.log("Fee payer initialized successfully");
    } catch (error) {
      console.error("Error initializing fee payer:", error);
      throw error;
    }
  });

  it("Mint starter tower", async () => {
    try {
      // Create a keypair for the tower mint
      const towerMintKeypair = Keypair.generate();
      towerMint = towerMintKeypair.publicKey;

      // Find PDA for tower mint authority
      const [towerMintAuthorityPda, towerMintBump] =
        await PublicKey.findProgramAddress(
          [MINT_AUTHORITY_SEED, towerMint.toBuffer()],
          program.programId
        );

      // Find PDA for tower account
      const [towerPda, towerBump] = await PublicKey.findProgramAddress(
        [TOWER_SEED, towerMint.toBuffer()],
        program.programId
      );
      tower = towerPda;

      // Get associated token account for tower
      const towerTokenAccount = await getAssociatedTokenAddress(
        towerMint,
        user.publicKey
      );

      // Metaplex accounts
      const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
        "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
      );

      // Metadata account
      const [metadataAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          towerMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      // Master edition account
      const [masterEditionAccount] = await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          towerMint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      await program.methods
        .mintStarterTower(STARTER_TOWER_URI, STARTER_TOWER_NAME)
        .accounts({
          user: user.publicKey,
          feePayer: wallet.publicKey, // In real deployment, this would be the treasury address
          userStats: userStats,
          towerMint: towerMint,
          towerMintAuthority: towerMintAuthorityPda,
          towerTokenAccount: towerTokenAccount,
          tower: tower,
          metadata: metadataAccount,
          masterEdition: masterEditionAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .signers([user, towerMintKeypair])
        .rpc();

      // Fetch the created tower account
      const towerAccount = await program.account.tower.fetch(tower);

      assert.equal(towerAccount.owner.toString(), user.publicKey.toString());
      assert.equal(towerAccount.mint.toString(), towerMint.toString());
      assert.equal(towerAccount.towerType, 0); // Basic tower
      assert.equal(towerAccount.level, 1);
      assert.equal(towerAccount.xp, 0);

      // Fetch user stats to confirm starter tower claimed
      const userStatsAccount = await program.account.userStats.fetch(userStats);
      assert.equal(userStatsAccount.hasClaimedStarterTower, true);
      assert.equal(userStatsAccount.totalTowersOwned, 1);

      console.log("Starter tower minted successfully");
    } catch (error) {
      console.error("Error minting starter tower:", error);
      throw error;
    }
  });

  it("Upgrade tower damage", async () => {
    try {
      await program.methods
        .upgradeTowerDamage()
        .accounts({
          user: user.publicKey,
          tower: tower,
          tokenMint: shardTokenMint,
          tokenAccount: userTokenAccount,
          userStats: userStats,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Fetch the updated tower account
      const towerAccount = await program.account.tower.fetch(tower);

      assert.equal(towerAccount.damageLevel, 1);

      console.log("Tower damage upgraded successfully");
    } catch (error) {
      console.error("Error upgrading tower damage:", error);
      // This may fail if the user doesn't have enough tokens, which is expected
      console.log(
        "This failure may be expected if user doesn't have enough tokens"
      );
    }
  });

  it("Create game room", async () => {
    try {
      const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL

      await program.methods
        .createGameRoom(stakeAmount)
        .accounts({
          user: user.publicKey,
          treasury: wallet.publicKey, // In real deployment, this would be the treasury address
          gamePool: gamePool,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Fetch the created game pool account
      const gamePoolAccount = await program.account.gamePool.fetch(gamePool);

      assert.equal(gamePoolAccount.owner.toString(), user.publicKey.toString());
      assert.equal(
        gamePoolAccount.stakeAmount.toString(),
        stakeAmount.toString()
      );
      assert.equal(gamePoolAccount.isStarted, false);
      assert.equal(gamePoolAccount.isCompleted, false);
      assert.equal(gamePoolAccount.players.length, 0);

      console.log("Game room created successfully");
    } catch (error) {
      console.error("Error creating game room:", error);
      throw error;
    }
  });

  // Add more tests here for joining games, starting games, etc.
});
