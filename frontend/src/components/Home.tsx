// @ts-nocheck
import React from "react";
import { useState, useEffect } from "react";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as web3 from "@solana/web3.js";
import { useNavigate } from "react-router-dom";
import UpgradeCardExample from "./UpgradeCardExample";
import * as anchor from "@project-serum/anchor";
import {
  PROGRAM_ID,
  TREASURY_ADDRESS,
  SHARD_TOKEN_ADDRESS as SMTD_MINT,
  SHARDS_PER_SOL,
} from "../constants";

// Add proper type definitions
declare global {
  interface Window {
    solana?: any;
  }
}

// Define MouseEvent directly
type MouseEvent = any;

interface HomeProps {
  onDisconnect: () => void;
}

const SMTD_TOKEN_SYMBOL = "SMTD";

// Tralalero Tralala tower data from JSON
const towerData = {
  name: "Tralalero Tralala",
  symbol: "TRALALA",
  description: "Tralalero Tralala",
  image:
    "https://silver-cheap-silkworm-705.mypinata.cloud/ipfs/bafybeibojiqj5yxxjbsp5aa2fuznltogxasdlkpynn62jqtgego2rndjbe",
  attributes: [
    {
      trait_type: "HP",
      value: 10,
    },
    {
      trait_type: "Max HP",
      value: 10,
    },
    {
      trait_type: "HP Regen",
      value: 0,
    },
    {
      trait_type: "Damage",
      value: 20,
    },
    {
      trait_type: "Range",
      value: 3,
    },
    {
      trait_type: "Fire Rate",
      value: 1200,
    },
    {
      trait_type: "Enemy Reward Multiplier",
      value: 1.0,
    },
    {
      trait_type: "Wave Reward Multiplier",
      value: 1.0,
    },
  ],
};

// Update RPC endpoints with Helius as primary
const RPC_ENDPOINTS = [
  "https://devnet.helius-rpc.com/?api-key=bb60d3b9-ed20-448d-a3fe-96b8f541b19b", // Helius devnet provided by user
  "https://api.devnet.solana.com", // Fallback to regular devnet
];

const Home = ({ onDisconnect }: HomeProps) => {
  // Wallet info
  const { address } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();

  // Initialize balance to 0
  const [balance, setBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);

  // Add state for tower collection overlay
  const [showTowerOverlay, setShowTowerOverlay] = useState<boolean>(false);

  // Add state for upgrades overlay
  const [showUpgradesOverlay, setShowUpgradesOverlay] =
    useState<boolean>(false);

  // Add state for buy shards overlay
  const [showBuyShardsOverlay, setShowBuyShardsOverlay] =
    useState<boolean>(false);

  // Add state for shop overlay
  const [showShopOverlay, setShowShopOverlay] = useState<boolean>(false);

  // Add state for transaction status
  const [isTransacting, setIsTransacting] = useState<boolean>(false);
  const [transactionError, setTransactionError] = useState<string>("");
  const [transactionSuccess, setTransactionSuccess] = useState<boolean>(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // Fetch SMTD token balance with better error handling
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address) {
        setBalance("0");
        return;
      }

      setIsLoadingBalance(true);

      // Try each RPC endpoint
      for (const endpoint of RPC_ENDPOINTS) {
        try {
          const connection = new Connection(endpoint);
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(address),
            { mint: new PublicKey(SMTD_MINT) }
          );

          // If token account is found, update balance
          if (tokenAccounts.value.length > 0) {
            const amount =
              tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount;
            if (amount && amount.amount) {
              setBalance(
                (
                  Number(amount.amount) / Math.pow(10, amount.decimals || 9)
                ).toLocaleString()
              );
              setIsLoadingBalance(false);
              return; // Exit if successful
            }
          }

          // No token account found, set balance to 0
          setBalance("0");
          setIsLoadingBalance(false);
          return;
        } catch (e) {
          console.log(`Error fetching balance from ${endpoint}:`, e);
          // Continue to next endpoint on failure
        }
      }

      // If all endpoints fail, set balance to 0
      setBalance("0");
      setIsLoadingBalance(false);
    };

    fetchBalance();
  }, [address]);

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnect();
    onDisconnect();
  };

  // Handle Summon button
  const handleSummon = () => {
    navigate("/game");
  };

  // Handle Multiplayer button
  const handleMultiplayer = () => {
    navigate("/multiplayer");
  };

  // Toggle tower overlay
  const toggleTowerOverlay = (e: MouseEvent) => {
    e.preventDefault();
    setShowTowerOverlay(!showTowerOverlay);
    // Close other overlays
    setShowUpgradesOverlay(false);
  };

  // Toggle upgrades overlay
  const toggleUpgradesOverlay = (e: MouseEvent) => {
    e.preventDefault();
    setShowUpgradesOverlay(!showUpgradesOverlay);
    // Close other overlays
    setShowTowerOverlay(false);
  };

  // Toggle buy shards overlay
  const toggleBuyShardsOverlay = (e: MouseEvent) => {
    e.preventDefault();
    setShowBuyShardsOverlay(!showBuyShardsOverlay);
    // Close other overlays
    setShowTowerOverlay(false);
    setShowUpgradesOverlay(false);
  };

  // Toggle shop overlay
  const toggleShopOverlay = (e: MouseEvent) => {
    e.preventDefault();
    setShowShopOverlay(!showShopOverlay);
    // Close other overlays
    setShowTowerOverlay(false);
    setShowUpgradesOverlay(false);
    setShowBuyShardsOverlay(false);
  };

  // Handle buying shards with SOL
  const handleBuyShards = async (solAmount: number, shardAmount: number) => {
    try {
      setIsTransacting(true);
      setTransactionError("");
      setSelectedAmount(solAmount);

      if (!window.solana || !window.solana.isPhantom) {
        setTransactionError(
          "Phantom wallet not found. Please install Phantom wallet."
        );
        setIsTransacting(false);
        return;
      }

      // Request connection to the user's wallet
      await window.solana.connect();
      const walletPublicKey = window.solana.publicKey;

      // Initialize connection to the Solana devnet
      // Use the same RPC endpoints we use for fetching balance for consistency
      const connection = new web3.Connection(RPC_ENDPOINTS[0]);

      console.log("Connecting to:", RPC_ENDPOINTS[0]);
      console.log("Program ID:", PROGRAM_ID);

      // Create a provider object
      const provider = new anchor.AnchorProvider(connection, window.solana, {
        commitment: "confirmed", // Use confirmed for better reliability
      });
      anchor.setProvider(provider);

      try {
        const programId = new web3.PublicKey(PROGRAM_ID);
        const tokenMint = new web3.PublicKey(SMTD_MINT);
        const treasuryAddress = new web3.PublicKey(TREASURY_ADDRESS);

        // Check if the program exists
        const programInfo = await connection.getAccountInfo(programId);
        if (!programInfo) {
          setTransactionError("Program not found on this network.");
          setIsTransacting(false);
          return;
        }

        console.log("Program exists:", !!programInfo);
        console.log("Program owner:", programInfo.owner.toString());

        // Create the associated token account if it doesn't exist
        const associatedTokenAddress =
          await anchor.utils.token.associatedAddress({
            mint: tokenMint,
            owner: walletPublicKey,
          });

        console.log(`Buying ${shardAmount} tokens for ${solAmount} SOL`);

        // Calculate lamports
        const lamports = Math.round(solAmount * web3.LAMPORTS_PER_SOL);
        console.log("Lamports amount:", lamports);

        // Step 1: Create a simple SOL transfer transaction
        const transferTx = new web3.Transaction().add(
          web3.SystemProgram.transfer({
            fromPubkey: provider.wallet.publicKey,
            toPubkey: treasuryAddress,
            lamports: lamports,
          })
        );

        // Send the transaction
        const tx = await provider.sendAndConfirm(transferTx);
        console.log("SOL transfer successful:", tx);

        // Display explorer link
        const explorerLink = `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
        console.log("View transaction on Solana Explorer:", explorerLink);

        // Step 2: Create program instance for token minting (similar to Game.tsx)
        // Use a minimal IDL with just the mintTokens method
        const idl = {
          version: "0.1.0",
          name: "solitary_meme_td",
          instructions: [
            {
              name: "mintTokens",
              accounts: [
                { name: "mintAuthority", isMut: true, isSigner: true },
                { name: "recipient", isMut: false, isSigner: false },
                { name: "tokenMint", isMut: true, isSigner: false },
                { name: "recipientTokenAccount", isMut: true, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                {
                  name: "associatedTokenProgram",
                  isMut: false,
                  isSigner: false,
                },
                { name: "rent", isMut: false, isSigner: false },
              ],
              args: [{ name: "amount", type: "u64" }],
            },
          ],
        };

        // Create the program instance
        // @ts-ignore - The Program constructor does require the provider, the type definition is wrong
        const program = new anchor.Program(idl, programId, provider);

        try {
          // Calculate token amount with 9 decimals
          const TOKEN_DECIMALS = 9;
          const tokenAmount = shardAmount * Math.pow(10, TOKEN_DECIMALS);
          console.log(
            `Minting ${shardAmount} tokens (${tokenAmount} base units)...`
          );

          // Try to mint tokens like in Game.tsx
          const mintTx = await program.methods
            .mintTokens(new anchor.BN(tokenAmount.toString()))
            .accounts({
              mintAuthority: provider.wallet.publicKey,
              recipient: walletPublicKey,
              tokenMint: tokenMint,
              recipientTokenAccount: associatedTokenAddress,
              systemProgram: web3.SystemProgram.programId,
              tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
              rent: web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();

          console.log("Mint transaction submitted:", mintTx);
        } catch (mintError) {
          // Mint failure is expected since this is likely handled server-side
          console.log(
            "Mint transaction failed but may be handled server-side:",
            mintError.message
          );
        }

        // Wait for a few seconds to give any backend processes time to complete
        console.log(
          "SOL transferred. Waiting (5 seconds) for token minting..."
        );
        setTimeout(() => {
          fetchBalance();
        }, 5000);

        console.log(
          `Successfully bought ${shardAmount} tokens for ${solAmount} SOL`
        );
        setTransactionSuccess(true);

        // Reset states after 3 seconds
        setTimeout(() => {
          setTransactionSuccess(false);
          setSelectedAmount(null);
        }, 3000);
      } catch (error: any) {
        console.error("Failed to execute buy transaction:", error);
        setTransactionError(`Transaction failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error("Error buying tokens:", error);
      setTransactionError(`Failed to buy tokens: ${error.message}`);
    } finally {
      setIsTransacting(false);
    }
  };

  // Fetch SMTD token balance function
  const fetchBalance = async () => {
    if (!address) {
      setBalance("0");
      return;
    }

    setIsLoadingBalance(true);

    // Try each RPC endpoint
    for (const endpoint of RPC_ENDPOINTS) {
      try {
        const connection = new Connection(endpoint);
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          new PublicKey(address),
          { mint: new PublicKey(SMTD_MINT) }
        );

        // If token account is found, update balance
        if (tokenAccounts.value.length > 0) {
          const amount =
            tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount;
          if (amount && amount.amount) {
            setBalance(
              (
                Number(amount.amount) / Math.pow(10, amount.decimals || 9)
              ).toLocaleString()
            );
            setIsLoadingBalance(false);
            return; // Exit if successful
          }
        }

        // No token account found, set balance to 0
        setBalance("0");
        setIsLoadingBalance(false);
        return;
      } catch (e) {
        console.log(`Error fetching balance from ${endpoint}:`, e);
        // Continue to next endpoint on failure
      }
    }

    // If all endpoints fail, set balance to 0
    setBalance("0");
    setIsLoadingBalance(false);
  };

  // Tower Collection Overlay
  const renderTowerOverlay = () => {
    if (!showTowerOverlay) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflow: "auto",
        }}
      >
        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "900px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid #facc15",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
              borderBottom: "2px solid #333",
              paddingBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#facc15",
                fontFamily: "'Jersey20', sans-serif",
              }}
            >
              Your Tower Collection
            </h2>
            <button
              onClick={() => setShowTowerOverlay(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Tower cards container */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2rem",
              justifyContent: "center",
            }}
          >
            {/* Tralalero Tralala Tower Card */}
            <div
              style={{
                backgroundColor: "rgba(30, 30, 60, 0.8)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                width: "300px",
                border: "1px solid #444",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 20px 25px -5px rgba(0, 0, 0, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 10px 15px -3px rgba(0, 0, 0, 0.3)";
              }}
            >
              {/* Tower Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={towerData.image}
                  alt={towerData.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    backgroundColor: "#facc15",
                    color: "black",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    borderBottomLeftRadius: "0.5rem",
                  }}
                >
                  OWNED
                </div>
              </div>

              {/* Tower Details */}
              <div style={{ padding: "1rem" }}>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "#facc15",
                    marginBottom: "0.5rem",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                >
                  {towerData.name}
                </h3>
                <p
                  style={{
                    color: "#aaa",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {towerData.description}
                </p>

                {/* Tower Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {towerData.attributes.map((attr, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.25rem 0",
                        borderBottom: "1px dashed rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ color: "#999" }}>{attr.trait_type}:</span>
                      <span style={{ color: "#fff", fontWeight: "bold" }}>
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Select button */}
                <button
                  style={{
                    width: "100%",
                    backgroundColor: "#facc15",
                    color: "black",
                    fontWeight: "bold",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    marginTop: "1rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fde047";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#facc15";
                  }}
                >
                  Select Tower
                </button>
              </div>
            </div>

            {/* "No more towers" placeholder card */}
            <div
              style={{
                backgroundColor: "rgba(30, 30, 60, 0.4)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                width: "300px",
                border: "1px dashed #444",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem",
                textAlign: "center",
                aspectRatio: "0.8",
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  color: "#555",
                  marginBottom: "1rem",
                }}
              >
                +
              </div>
              <p style={{ color: "#777" }}>Buy lootbox to get more towers!</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Upgrades Overlay
  const renderUpgradesOverlay = () => {
    if (!showUpgradesOverlay) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "900px",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid #facc15",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
              borderBottom: "2px solid #333",
              paddingBottom: "1rem",
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#facc15",
                fontFamily: "'Jersey20', sans-serif",
              }}
            >
              Tower Upgrades
            </h2>
            <button
              onClick={() => setShowUpgradesOverlay(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Upgrades content - now takes remaining space */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "0",
              overflow: "hidden",
              flex: 1,
            }}
          >
            <UpgradeCardExample />
          </div>
        </div>
      </div>
    );
  };

  // Buy Shards Overlay
  const renderBuyShardsOverlay = () => {
    if (!showBuyShardsOverlay) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid #facc15",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
              borderBottom: "2px solid #333",
              paddingBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#facc15",
                fontFamily: "'Jersey20', sans-serif",
              }}
            >
              Buy Shards
            </h2>
            <button
              onClick={() => setShowBuyShardsOverlay(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {transactionError && (
            <div
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.1)",
                color: "#ef4444",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              {transactionError}
            </div>
          )}

          {transactionSuccess && (
            <div
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                color: "#22c55e",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                marginBottom: "1rem",
                fontSize: "0.875rem",
              }}
            >
              Transaction successful! Your shards have been added to your
              wallet.
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img
                  src="/Shards.png"
                  alt="Shards"
                  style={{ height: "2rem" }}
                />
                <span style={{ fontSize: "1.25rem", color: "white" }}>
                  {SHARDS_PER_SOL.toLocaleString()} Shards
                </span>
              </div>
              <button
                style={{
                  backgroundColor:
                    isTransacting && selectedAmount === 1 ? "#555" : "#facc15",
                  color: "black",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  fontWeight: "bold",
                  border: "none",
                  cursor: isTransacting ? "not-allowed" : "pointer",
                  opacity: isTransacting ? 0.7 : 1,
                  position: "relative",
                }}
                onClick={() =>
                  !isTransacting && handleBuyShards(1, SHARDS_PER_SOL)
                }
                disabled={isTransacting}
              >
                {isTransacting && selectedAmount === 1 ? (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "1rem",
                        height: "1rem",
                        border: "2px solid #000",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginRight: "0.5rem",
                      }}
                    ></span>
                    Processing...
                  </div>
                ) : (
                  "1 SOL"
                )}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img
                  src="/Shards.png"
                  alt="Shards"
                  style={{ height: "2rem" }}
                />
                <span style={{ fontSize: "1.25rem", color: "white" }}>
                  {(SHARDS_PER_SOL * 2).toLocaleString()} Shards
                </span>
              </div>
              <button
                style={{
                  backgroundColor:
                    isTransacting && selectedAmount === 2 ? "#555" : "#facc15",
                  color: "black",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  fontWeight: "bold",
                  border: "none",
                  cursor: isTransacting ? "not-allowed" : "pointer",
                  opacity: isTransacting ? 0.7 : 1,
                }}
                onClick={() =>
                  !isTransacting && handleBuyShards(2, SHARDS_PER_SOL * 2)
                }
                disabled={isTransacting}
              >
                {isTransacting && selectedAmount === 2 ? (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "1rem",
                        height: "1rem",
                        border: "2px solid #000",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginRight: "0.5rem",
                      }}
                    ></span>
                    Processing...
                  </div>
                ) : (
                  "2 SOL"
                )}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "1rem",
                borderRadius: "0.5rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <img
                  src="/Shards.png"
                  alt="Shards"
                  style={{ height: "2rem" }}
                />
                <span style={{ fontSize: "1.25rem", color: "white" }}>
                  {(SHARDS_PER_SOL * 3).toLocaleString()} Shards
                </span>
              </div>
              <button
                style={{
                  backgroundColor:
                    isTransacting && selectedAmount === 3 ? "#555" : "#facc15",
                  color: "black",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  fontWeight: "bold",
                  border: "none",
                  cursor: isTransacting ? "not-allowed" : "pointer",
                  opacity: isTransacting ? 0.7 : 1,
                }}
                onClick={() =>
                  !isTransacting && handleBuyShards(3, SHARDS_PER_SOL * 3)
                }
                disabled={isTransacting}
              >
                {isTransacting && selectedAmount === 3 ? (
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "1rem",
                        height: "1rem",
                        border: "2px solid #000",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        marginRight: "0.5rem",
                      }}
                    ></span>
                    Processing...
                  </div>
                ) : (
                  "3 SOL"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Shop Overlay
  const renderShopOverlay = () => {
    if (!showShopOverlay) return null;

    // Copy these NFT stats from the existing towerData
    const seasonalNFTStats = towerData.attributes;

    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "1000px",
            maxHeight: "80vh",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid #facc15",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
              borderBottom: "2px solid #333",
              paddingBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#facc15",
                fontFamily: "'Jersey20', sans-serif",
              }}
            >
              Tower Shop
            </h2>
            <button
              onClick={() => setShowShopOverlay(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          {/* Lootbox Container */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "2rem",
            }}
          >
            {/* Lootbox Card - Made larger */}
            <div
              style={{
                backgroundColor: "rgba(30, 30, 60, 0.8)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                width: "450px",
                border: "2px solid #facc15",
                boxShadow: "0 10px 25px -3px rgba(0, 0, 0, 0.5)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 20px 25px -5px rgba(0, 0, 0, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 10px 25px -3px rgba(0, 0, 0, 0.5)";
              }}
            >
              {/* Lootbox Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1.2",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src="/Lootbox.png"
                  alt="Mystery Lootbox"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: "#facc15",
                    color: "black",
                    padding: "0.5rem 1rem",
                    fontSize: "1rem",
                    fontWeight: "bold",
                    borderRadius: "0.5rem",
                  }}
                >
                  MYSTERY
                </div>
              </div>

              {/* Lootbox Details */}
              <div style={{ padding: "1.5rem" }}>
                <h3
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: "bold",
                    color: "#facc15",
                    marginBottom: "0.75rem",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                >
                  Tower Lootbox
                </h3>
                <p
                  style={{
                    color: "#aaa",
                    marginBottom: "1.5rem",
                    fontSize: "1rem",
                    lineHeight: "1.4",
                  }}
                >
                  Open this lootbox to receive a random tower with unique
                  abilities and bonuses! You might discover a rare or legendary
                  tower to add to your collection.
                </p>

                {/* Purchase button */}
                <button
                  style={{
                    width: "100%",
                    backgroundColor: "#facc15",
                    color: "black",
                    fontWeight: "bold",
                    padding: "1rem 1.5rem",
                    borderRadius: "0.5rem",
                    marginTop: "1rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.2rem",
                    fontFamily: "'Pixellari', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fde047";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#facc15";
                  }}
                >
                  <span>Purchase</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "'Jersey20', sans-serif",
                    }}
                  >
                    <span>3000</span>
                    <img
                      src="/Shards.png"
                      alt="Shards"
                      style={{
                        height: "1.4rem",
                        marginLeft: "0.25rem",
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Seasonal NFTs Title */}
          <div
            style={{
              width: "100%",
              textAlign: "center",
              marginBottom: "1.5rem",
              marginTop: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "#f43f5e",
                fontFamily: "'Jersey20', sans-serif",
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                position: "relative",
                display: "inline-block",
              }}
            >
              Seasonal NFTs
              <div
                style={{
                  position: "absolute",
                  bottom: "-10px",
                  left: "10%",
                  right: "10%",
                  height: "3px",
                  background:
                    "linear-gradient(90deg, transparent, #f43f5e, transparent)",
                }}
              />
            </h3>
          </div>

          {/* Seasonal NFTs Container - 2 per row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2rem",
              justifyContent: "center",
            }}
          >
            {/* Bombardiro NFT Card */}
            <div
              style={{
                backgroundColor: "rgba(30, 30, 60, 0.8)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                width: "350px",
                border: "1px solid #f43f5e",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
                flex: "0 0 calc(50% - 2rem)",
                maxWidth: "calc(50% - 2rem)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 20px 25px -5px rgba(0, 0, 0, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 10px 15px -3px rgba(0, 0, 0, 0.3)";
              }}
            >
              {/* NFT Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src="/BombardiroNFT.png"
                  alt="Bombardiro"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: "#f43f5e",
                    color: "white",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    borderRadius: "0.5rem",
                  }}
                >
                  SEASONAL
                </div>
              </div>

              {/* NFT Details */}
              <div style={{ padding: "1rem" }}>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "#facc15",
                    marginBottom: "0.5rem",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                >
                  Bombardino Crocodilo
                </h3>
                <p
                  style={{
                    color: "#aaa",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    textAlign: "justify",
                  }}
                >
                  Bombardino Crocodilo is a hybrid creature with the head of a
                  crocodile and the body of a military bomber plane.
                </p>

                {/* Tower Stats - Just a sample of stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  {seasonalNFTStats.slice(0, 4).map((attr, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.25rem 0",
                        borderBottom: "1px dashed rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ color: "#999" }}>{attr.trait_type}:</span>
                      <span style={{ color: "#fff", fontWeight: "bold" }}>
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Purchase button */}
                <button
                  style={{
                    width: "100%",
                    backgroundColor: "#facc15",
                    color: "black",
                    fontWeight: "bold",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    marginTop: "1rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontFamily: "'Pixellari', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fde047";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#facc15";
                  }}
                >
                  <span>Purchase</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "'Jersey20', sans-serif",
                    }}
                  >
                    <span>5000</span>
                    <img
                      src="/Shards.png"
                      alt="Shards"
                      style={{
                        height: "1.2rem",
                        marginLeft: "0.25rem",
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* TungSahur NFT Card */}
            <div
              style={{
                backgroundColor: "rgba(30, 30, 60, 0.8)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                width: "350px",
                border: "1px solid #f43f5e",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
                flex: "0 0 calc(50% - 2rem)",
                maxWidth: "calc(50% - 2rem)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-5px)";
                e.currentTarget.style.boxShadow =
                  "0 20px 25px -5px rgba(0, 0, 0, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 10px 15px -3px rgba(0, 0, 0, 0.3)";
              }}
            >
              {/* NFT Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src="/TungSahurNFT.png"
                  alt="TungSahur"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: "#f43f5e",
                    color: "white",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: "bold",
                    borderRadius: "0.5rem",
                  }}
                >
                  SEASONAL
                </div>
              </div>

              {/* NFT Details */}
              <div style={{ padding: "1rem" }}>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: "#facc15",
                    marginBottom: "0.5rem",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                >
                  Tung Tung Tung Sahur
                </h3>
                <p
                  style={{
                    color: "#aaa",
                    marginBottom: "1rem",
                    fontSize: "0.875rem",
                    textAlign: "justify",
                  }}
                >
                  The "Tung Tung Tung" in the character's name is an
                  onomatopoeic reference to the drum-beating used in Indonesia
                  to signify the beginning of Suhur.The "Tung Tung Tung" in the
                  character's name is an onomatopoeic reference to the
                  drum-beating used in Indonesia to signify the beginning of
                  Suhur.
                </p>

                {/* Tower Stats - Just a sample of stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "0.5rem",
                    fontSize: "0.875rem",
                    marginBottom: "1rem",
                  }}
                >
                  {seasonalNFTStats.slice(0, 4).map((attr, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.25rem 0",
                        borderBottom: "1px dashed rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ color: "#999" }}>{attr.trait_type}:</span>
                      <span style={{ color: "#fff", fontWeight: "bold" }}>
                        {attr.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Purchase button */}
                <button
                  style={{
                    width: "100%",
                    backgroundColor: "#facc15",
                    color: "black",
                    fontWeight: "bold",
                    padding: "0.75rem 1rem",
                    borderRadius: "0.5rem",
                    marginTop: "1rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontFamily: "'Pixellari', sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fde047";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#facc15";
                  }}
                >
                  <span>Purchase</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: "'Jersey20', sans-serif",
                    }}
                  >
                    <span>5000</span>
                    <img
                      src="/Shards.png"
                      alt="Shards"
                      style={{
                        height: "1.2rem",
                        marginLeft: "0.25rem",
                      }}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center flex flex-col"
      style={{
        backgroundImage: 'url("/Background.png")',
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        position: "relative",
      }}
    >
      {/* Semi-transparent overlay for better text visibility */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 0,
        }}
      />

      {/* Content container (above overlay) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.5rem 2.5rem",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Left: Title */}
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: "white",
              fontFamily: "'Jersey20', sans-serif",
            }}
          >
            SMTD
          </div>
          {/* Center: Nav */}
          <nav
            style={{
              display: "flex",
              gap: "3rem",
              fontSize: "2.1rem",
              fontWeight: "bold",
              color: "white",
              marginLeft: "12rem",
              fontFamily: "'Jersey20', sans-serif",
            }}
          >
            <a
              href="#"
              style={{
                color: "white",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onClick={toggleTowerOverlay}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fde047";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "white";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Towers
            </a>
            <a
              href="#"
              style={{
                color: "white",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onClick={toggleUpgradesOverlay}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fde047";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "white";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Upgrades
            </a>
            <a
              href="#"
              style={{
                color: "white",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onClick={toggleShopOverlay}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fde047";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "white";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Shop
            </a>
          </nav>
          {/* Right: Token balance & wallet */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <div>
              <div
                style={{
                  backgroundColor: "#132447",
                  color: "black",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  fontWeight: "bold",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  fontSize: "1rem",
                  fontFamily: "'Pixellari', sans-serif",
                  border: "1px solid #facc15",
                }}
                onClick={toggleBuyShardsOverlay}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#1a3366";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#132447";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {isLoadingBalance ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: "1rem",
                      height: "1rem",
                      border: "2px solid #facc15",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      marginRight: "0.5rem",
                    }}
                  ></span>
                ) : null}
                <img
                  src="/Shards.png"
                  alt="Shards"
                  style={{
                    height: "1.2rem",
                    marginRight: "0.25rem",
                    verticalAlign: "middle",
                  }}
                />
                <span
                  style={{
                    color: "#facc15",
                    fontFamily: "'Jersey20', sans-serif",
                    fontSize: "1.3rem",
                  }}
                >
                  {balance} SMTD
                </span>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                fontFamily: "monospace",
                fontWeight: "bold",
                transition: "all 0.2s",
                border: "none",
                cursor: "pointer",
                fontSize: "1.3rem",
                fontFamily: "'Jersey20', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#ef4444";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(255, 255, 255, 0.2)";
                e.currentTarget.style.boxShadow = "none";
              }}
              title="Click to disconnect"
            >
              {address
                ? `${address.slice(0, 4)}...${address.slice(-4)}`
                : "Connect Wallet"}
            </button>
          </div>
        </header>

        {/* Main content */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            padding: "0 1rem",
          }}
        >
          <div style={{ maxWidth: "56rem", width: "100%" }}>
            <h2
              style={{
                fontSize: "clamp(2.5rem, 5vw, 3.75rem)",
                fontWeight: "bold",
                color: "white",
                textShadow: "0 4px 6px rgba(0, 0, 0, 0.5)",
                marginBottom: "3rem",
                textAlign: "center",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              One Meme, Countless Enemies.
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.5rem",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "1.5rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={handleSummon}
                  style={{
                    padding: "1.25rem 2.5rem",
                    backgroundColor: "#facc15",
                    color: "black",
                    fontSize: "1.875rem",
                    fontWeight: "bold",
                    borderRadius: "0.75rem",
                    boxShadow:
                      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    transition: "all 0.2s",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fde047";
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow =
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#facc15";
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  Summon Your Tower
                </button>
                <button
                  onClick={handleMultiplayer}
                  style={{
                    padding: "1.25rem 2.5rem",
                    backgroundColor: "#9333ea",
                    color: "white",
                    fontSize: "1.875rem",
                    fontWeight: "bold",
                    borderRadius: "0.75rem",
                    boxShadow:
                      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                    transition: "all 0.2s",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Pixellari', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#a855f7";
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow =
                      "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#9333ea";
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  Multiplayer Mode
                </button>
              </div>
              <div
                style={{
                  marginTop: "1.5rem",
                  fontSize: "0.875rem",
                  color: "white",
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backdropFilter: "blur(4px)",
                  maxWidth: "32rem",
                  margin: "0 auto",
                  textAlign: "center",
                }}
              >
                Multiplayer: Create or join a room with a 6-digit code.
                Challenge others and stake SOL to win!
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Render Shop Overlay */}
      {renderShopOverlay()}

      {/* Render Buy Shards Overlay */}
      {renderBuyShardsOverlay()}

      {/* Render Tower Collection Overlay */}
      {renderTowerOverlay()}

      {/* Render Upgrades Overlay */}
      {renderUpgradesOverlay()}
    </div>
  );
};

export default Home;
