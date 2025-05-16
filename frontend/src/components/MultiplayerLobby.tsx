import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";
import socketService from "../utils/socketService";
import * as web3 from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import idl from "../../../idl.json";
import {
  TREASURY_ADDRESS,
  PROGRAM_ID,
  SHARD_TOKEN_ADDRESS,
  SHARDS_PER_SOL,
  WINNER_PAYOUT_PERCENTAGE,
} from "../constants";
import { SocketService } from "../services/SocketService";

// Add JSX namespace declaration to fix TypeScript errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      div: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
      >;
      button: React.DetailedHTMLProps<
        React.ButtonHTMLAttributes<HTMLButtonElement>,
        HTMLButtonElement
      >;
      h1: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h2: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      h3: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLHeadingElement>,
        HTMLHeadingElement
      >;
      span: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLSpanElement>,
        HTMLSpanElement
      >;
      input: React.DetailedHTMLProps<
        React.InputHTMLAttributes<HTMLInputElement>,
        HTMLInputElement
      >;
      label: React.DetailedHTMLProps<
        React.LabelHTMLAttributes<HTMLLabelElement>,
        HTMLLabelElement
      >;
      p: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLParagraphElement>,
        HTMLParagraphElement
      >;
      header: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      nav: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      a: React.DetailedHTMLProps<
        React.AnchorHTMLAttributes<HTMLAnchorElement>,
        HTMLAnchorElement
      >;
    }
  }
}

// Multiplayer room types
interface Player {
  address: string;
  nickname: string;
  isReady: boolean;
  stakeAmount: number;
}

interface Room {
  code: string;
  owner: string;
  players: Player[];
  spectators: {
    address: string;
    nickname: string;
    betOn?: string; // Address of player they bet on
    betAmount?: number;
  }[];
  status: "waiting" | "countdown" | "playing" | "finished";
  createdAt: number;
  stakeAmount: number; // SOL amount to stake (in lamports)
  totalPrizePool?: number; // Total prize pool in lamports
  challengeStatus?: {
    challenger: string;
    challenged: string;
    accepted: boolean;
  };
  gameResults?: {
    winner?: string;
    playerWaves: Record<string, number>;
    playerTimes: Record<string, number>;
  };
}

interface MultiplayerLobbyProps {
  onBack: () => void;
}

// Generate a random 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const MultiplayerLobby = ({ onBack }: MultiplayerLobbyProps) => {
  const { address } = useAppKitAccount();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"join" | "create">("join");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [stakeAmount, setStakeAmount] = useState(0.01);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<string | null>(null);
  const [stakingError, setStakingError] = useState("");
  const [stakingInProgress, setStakingInProgress] = useState(false);

  // Style objects to use as fallbacks
  const containerStyle = {
    backgroundColor: "#1F2937",
    borderRadius: "0.5rem",
    padding: "1.5rem",
    width: "100%",
    maxWidth: "28rem",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column" as const,
  };

  const buttonStyle = {
    backgroundColor: "#4338CA",
    color: "white",
    padding: "0.5rem 1rem",
    borderRadius: "0.375rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  const inputStyle = {
    width: "100%",
    backgroundColor: "#374151",
    border: "1px solid #4B5563",
    borderRadius: "0.375rem",
    padding: "0.5rem",
    color: "white",
    marginBottom: "1rem",
  };

  // Initialize nickname from localStorage and connect to socket
  useEffect(() => {
    const savedNickname = localStorage.getItem("smtd_nickname");
    if (savedNickname) {
      setNickname(savedNickname);
    } else {
      // Set a default nickname based on wallet address
      if (address) {
        setNickname(`Player_${address.slice(0, 4)}`);
      }
    }

    // Connect to socket
    socketService.connect();

    // Socket event listeners
    socketService.on("room_created", (room: Room) => {
      setActiveRoom(room);
      setLoading(false);
    });

    socketService.on("room_joined", (room: Room) => {
      setActiveRoom(room);
      setLoading(false);
    });

    socketService.on("joined_as_spectator", (room: Room) => {
      setActiveRoom(room);
      setLoading(false);
    });

    socketService.on("room_updated", (room: Room) => {
      if (activeRoom && activeRoom.code === room.code) {
        setActiveRoom(room);
      }
    });

    socketService.on("room_error", (data: { message: string }) => {
      setError(data.message);
      setLoading(false);
    });

    socketService.on(
      "challenge_sent",
      (data: { roomCode: string; challenger: string; challenged: string }) => {
        // Show notification if needed
        console.log("Challenge sent:", data);
      }
    );

    socketService.on("challenge_accepted", (data: { roomCode: string }) => {
      // Show notification if needed
      console.log("Challenge accepted:", data);
    });

    socketService.on("match_started", (data: { roomCode: string }) => {
      // Navigate to game
      if (activeRoom && activeRoom.code === data.roomCode) {
        navigate(`/multiplayer-game/${data.roomCode}`);
      }
    });

    socketService.on("room_closed", (data: { roomCode: string }) => {
      if (activeRoom && activeRoom.code === data.roomCode) {
        setError("The room has been closed");
        setActiveRoom(null);
      }
    });

    socketService.on(
      "winner_rewarded",
      (data: { winner: string; amount: number; roomCode: string }) => {
        console.log(
          `Winner ${data.winner} rewarded with ${data.amount} tokens`
        );
      }
    );

    return () => {
      // Clean up listeners
      socketService.off("room_created");
      socketService.off("room_joined");
      socketService.off("joined_as_spectator");
      socketService.off("room_updated");
      socketService.off("room_error");
      socketService.off("challenge_sent");
      socketService.off("challenge_accepted");
      socketService.off("match_started");
      socketService.off("room_closed");
      socketService.off("winner_rewarded");
    };
  }, [address, activeRoom, navigate]);

  // Save nickname to localStorage when changed
  useEffect(() => {
    if (nickname) {
      localStorage.setItem("smtd_nickname", nickname);
    }
  }, [nickname]);

  // Function to send SOL to treasury and perform staking
  const sendStakeToTreasury = async (amount: number): Promise<boolean> => {
    setStakingInProgress(true);
    setStakingError("");

    try {
      if (!window.solana || !window.solana.isPhantom) {
        setStakingError(
          "Phantom wallet not found. Please install Phantom wallet."
        );
        return false;
      }

      // Request connection to the user's wallet
      try {
        await window.solana.connect();
      } catch (error: any) {
        console.log("Connection error:", error);
        // If user rejected, that's okay - they might already be connected
        if (error.message.includes("User rejected")) {
          // Continue if we have the public key
          if (!window.solana.publicKey) {
            setStakingError("Please connect your wallet to continue.");
            return false;
          }
        } else {
          throw error;
        }
      }

      const walletPublicKey = window.solana.publicKey;
      if (!walletPublicKey) {
        setStakingError("Wallet not connected");
        return false;
      }

      // Initialize connection to the Solana devnet
      const connection = new web3.Connection(
        web3.clusterApiUrl("devnet"),
        "confirmed"
      );

      // Convert stake amount from SOL to lamports
      const lamportsAmount = amount * web3.LAMPORTS_PER_SOL;

      // Create a transaction
      const transaction = new web3.Transaction();

      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = walletPublicKey;

      // Add the transfer instruction
      transaction.add(
        web3.SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: new web3.PublicKey(TREASURY_ADDRESS),
          lamports: lamportsAmount,
        })
      );

      // Sign and send transaction
      const signature = await window.solana.signAndSendTransaction(transaction);
      console.log("Transaction sent:", signature.signature);

      // Wait for transaction confirmation
      const confirmation = await connection.confirmTransaction({
        signature: signature.signature,
        blockhash: blockhash,
        lastValidBlockHeight: lastValidBlockHeight,
      });

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      console.log("Stake transaction confirmed:", signature.signature);
      console.log(`Successfully staked ${amount} SOL`);

      return true;
    } catch (error: any) {
      console.error("Error staking SOL:", error);
      setStakingError(`Failed to stake: ${error.message}`);
      return false;
    } finally {
      setStakingInProgress(false);
    }
  };

  // Create a new room
  const handleCreateRoom = async () => {
    if (!address) return;
    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // First stake the SOL to the treasury
      const stakeSuccess = await sendStakeToTreasury(stakeAmount);

      if (!stakeSuccess) {
        setError("Failed to stake SOL. Room creation canceled.");
        setLoading(false);
        return;
      }

      const newRoomCode = generateRoomCode();

      socketService.createRoom({
        roomCode: newRoomCode,
        nickname,
        address,
        stakeAmount: stakeAmount * 1_000_000_000, // Convert SOL to lamports
      });
    } catch (err) {
      console.error("Failed to create room:", err);
      setError("Failed to create room. Please try again.");
      setLoading(false);
    }
  };

  // Join an existing room
  const handleJoinRoom = async () => {
    if (!address) return;
    if (!roomCode.trim()) {
      setError("Please enter a room code");
      return;
    }
    if (!nickname.trim()) {
      setError("Please enter a nickname");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Before joining the room, check if it exists and get the stake amount
      const roomInfo = await socketService.checkRoom(roomCode);

      if (roomInfo.exists && roomInfo.stakeAmount !== undefined) {
        const requiredStake = roomInfo.stakeAmount / 1_000_000_000; // Convert lamports to SOL

        // Stake the required amount
        const stakeSuccess = await sendStakeToTreasury(requiredStake);

        if (!stakeSuccess) {
          setError(`Failed to stake ${requiredStake} SOL. Room join canceled.`);
          setLoading(false);
          return;
        }

        // Now join the room
        socketService.joinRoom({
          roomCode,
          nickname,
          address,
        });
      } else {
        setError("Room not found. Please check the code and try again.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to join room:", err);
      setError(
        "Room not found or unable to join. Please check the code and try again."
      );
      setLoading(false);
    }
  };

  // Start a match (as room owner)
  const handleStartMatch = async () => {
    if (!activeRoom || !address || address !== activeRoom.owner) return;

    // Check if there are at least 2 players and the owner is one of them
    const ownerIsPlaying = activeRoom.players.some(
      (p: Player) => p.address === address
    );
    if (activeRoom.players.length < 2 || !ownerIsPlaying) {
      setError("Need at least 2 players to start a match");
      return;
    }

    socketService.emit("accept_challenge", { roomCode: activeRoom.code });
  };

  // Send challenge request to another player
  const handleSendChallenge = (playerAddress: string) => {
    if (!activeRoom || !address) return;

    socketService.sendChallenge({
      roomCode: activeRoom.code,
      challengerAddress: address,
      challengedAddress: playerAddress,
    });
  };

  // Accept a challenge
  const handleAcceptChallenge = async () => {
    if (!activeRoom || !address || !activeRoom.challengeStatus) return;
    if (activeRoom.challengeStatus.challenged !== address) return;

    try {
      socketService.acceptChallenge(activeRoom.code);
    } catch (err) {
      console.error("Failed to accept challenge:", err);
      setError("Failed to accept challenge. Please try again.");
    }
  };

  // Place a bet as a spectator
  const handlePlaceBet = async (playerAddress: string, amount: number) => {
    if (!activeRoom || !address) return;

    // Check if user is already a player
    const isPlayer = activeRoom.players.some(
      (p: Player) => p.address === address
    );
    if (isPlayer) {
      setError("Players cannot place bets");
      return;
    }

    try {
      // First stake the SOL to the treasury
      const stakeSuccess = await sendStakeToTreasury(amount);

      if (!stakeSuccess) {
        setError("Failed to stake SOL for bet. Betting canceled.");
        return;
      }

      socketService.placeBet({
        roomCode: activeRoom.code,
        playerAddress,
        amount,
      });
    } catch (err) {
      console.error("Failed to place bet:", err);
      setError("Failed to place bet. Please try again.");
    }
  };

  // Leave the room
  const handleLeaveRoom = () => {
    if (activeRoom) {
      socketService.leaveRoom(activeRoom.code);
    }
    setActiveRoom(null);
    onBack();
  };

  // Render the room lobby UI
  const renderRoomLobby = () => {
    if (!activeRoom) return null;

    // Check if current user is the room owner
    const isOwner = activeRoom.owner === address;

    // Check if there's a pending challenge for the current user
    const hasPendingChallenge =
      activeRoom.challengeStatus &&
      activeRoom.challengeStatus.challenged === address &&
      !activeRoom.challengeStatus.accepted;

    // Calculate total prize pool - the number of players times the stake amount
    const totalPrizePool = activeRoom.players.length * activeRoom.stakeAmount;
    const prizePoolSOL = totalPrizePool / web3.LAMPORTS_PER_SOL;
    const winnerPayout = (prizePoolSOL * WINNER_PAYOUT_PERCENTAGE) / 100;
    const platformFee = prizePoolSOL - winnerPayout;

    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: 'url("/Background.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
        }}
      >
        {/* Semi-transparent overlay for better contrast */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 0,
          }}
        />

        <div
          style={{
            backgroundColor: "#1a1a2e",
            borderRadius: "1rem",
            padding: "2rem",
            width: "100%",
            maxWidth: "35rem",
            maxHeight: "90vh",
            overflowY: "auto",
            margin: "0 auto",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            border: "2px solid #facc15",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              marginBottom: "1.5rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "2px solid #333",
              paddingBottom: "1rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: "bold",
                color: "#facc15",
                fontFamily: "'Jersey20', sans-serif",
                margin: 0,
              }}
            >
              Room: {activeRoom.code}
            </h2>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleLeaveRoom}
                style={{
                  backgroundColor: "#4B5563",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  border: "none",
                  fontSize: "0.875rem",
                  fontFamily: "'Pixellari', sans-serif",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = "#6B7280";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = "#4B5563";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Leave Room
              </button>

              {isOwner && activeRoom.players.length >= 2 && (
                <button
                  onClick={handleStartMatch}
                  style={{
                    backgroundColor: "#10B981",
                    color: "white",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    border: "none",
                    fontSize: "0.875rem",
                    fontFamily: "'Pixellari', sans-serif",
                    transition: "all 0.2s ease",
                  }}
                  disabled={loading}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "#34D399";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "#10B981";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  Start Game
                </button>
              )}
            </div>
          </div>

          {/* Stake and Prize Pool Information */}
          <div
            style={{
              backgroundColor: "#2D3748",
              padding: "1.25rem",
              borderRadius: "0.5rem",
              marginBottom: "1.5rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              border: "1px solid #374151",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: "bold",
                marginBottom: "1rem",
                color: "#facc15",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              Stake Information
            </h3>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              <span>Entry Stake:</span>
              <span style={{ color: "#facc15", fontWeight: "bold" }}>
                {activeRoom.stakeAmount / web3.LAMPORTS_PER_SOL} SOL
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              <span>Current Prize Pool:</span>
              <span style={{ color: "#facc15", fontWeight: "bold" }}>
                {prizePoolSOL.toFixed(3)} SOL
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "0.75rem",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              <span>Winner Payout:</span>
              <span style={{ color: "#facc15", fontWeight: "bold" }}>
                {winnerPayout.toFixed(3)} SOL ({WINNER_PAYOUT_PERCENTAGE}%)
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              <span>Platform Fee:</span>
              <span style={{ color: "#facc15", fontWeight: "bold" }}>
                {platformFee.toFixed(3)} SOL ({100 - WINNER_PAYOUT_PERCENTAGE}%)
              </span>
            </div>
          </div>

          {hasPendingChallenge && (
            <div
              style={{
                backgroundColor: "#4338CA",
                padding: "1rem",
                borderRadius: "0.5rem",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #6366F1",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <span
                style={{
                  color: "white",
                  fontFamily: "'Pixellari', sans-serif",
                  fontWeight: "bold",
                }}
              >
                {activeRoom.players.find(
                  (p: Player) =>
                    p.address === activeRoom.challengeStatus?.challenger
                )?.nickname || "A player"}{" "}
                has challenged you!
              </span>
              <button
                onClick={handleAcceptChallenge}
                style={{
                  backgroundColor: "#10B981",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "'Pixellari', sans-serif",
                  fontWeight: "bold",
                  transition: "all 0.2s ease",
                }}
                disabled={loading}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = "#34D399";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = "#10B981";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                Accept Challenge
              </button>
            </div>
          )}

          {(error || stakingError) && (
            <div
              style={{
                backgroundColor: "#7F1D1D",
                border: "1px solid #B91C1C",
                color: "white",
                padding: "0.75rem",
                borderRadius: "0.375rem",
                marginBottom: "1.5rem",
                fontFamily: "'Pixellari', sans-serif",
              }}
            >
              {error || stakingError}
            </div>
          )}

          <div
            style={{ display: "flex", gap: "1rem", flexDirection: "column" }}
          >
            <div
              style={{
                backgroundColor: "#374151",
                borderRadius: "0.5rem",
                padding: "1.25rem",
                border: "1px solid #4B5563",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                  color: "#facc15",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Players
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {activeRoom.players.map((player: Player) => (
                  <div
                    key={player.address}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem",
                      backgroundColor:
                        player.address === activeRoom.owner
                          ? "#1F2937"
                          : "#2D3748",
                      borderRadius: "0.375rem",
                      border:
                        player.address === activeRoom.owner
                          ? "1px solid #facc15"
                          : "1px solid #374151",
                      transition: "transform 0.2s ease",
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "500",
                          fontFamily: "'Pixellari', sans-serif",
                        }}
                      >
                        {player.nickname}
                        {player.address === activeRoom.owner && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              color: "#facc15",
                            }}
                          >
                            👑
                          </span>
                        )}
                        {player.address === address && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              color: "#9CA3AF",
                              fontSize: "0.875rem",
                              fontStyle: "italic",
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Only show challenge buttons for the room owner, and not for themselves */}
                    {isOwner && player.address !== address && (
                      <button
                        style={{
                          backgroundColor: "#4338CA",
                          color: "white",
                          padding: "0.35rem 0.75rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                          border: "none",
                          fontFamily: "'Pixellari', sans-serif",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => handleSendChallenge(player.address)}
                        disabled={
                          loading ||
                          activeRoom.status === "playing" ||
                          !!activeRoom.challengeStatus
                        }
                        onMouseEnter={(
                          e: React.MouseEvent<HTMLButtonElement>
                        ) => {
                          if (
                            !(
                              loading ||
                              activeRoom.status === "playing" ||
                              !!activeRoom.challengeStatus
                            )
                          ) {
                            e.currentTarget.style.backgroundColor = "#6366F1";
                          }
                        }}
                        onMouseLeave={(
                          e: React.MouseEvent<HTMLButtonElement>
                        ) => {
                          if (
                            !(
                              loading ||
                              activeRoom.status === "playing" ||
                              !!activeRoom.challengeStatus
                            )
                          ) {
                            e.currentTarget.style.backgroundColor = "#4338CA";
                          }
                        }}
                      >
                        Challenge
                      </button>
                    )}

                    {/* For non-owners, don't show challenge buttons */}
                    {!isOwner && player.address === activeRoom.owner && (
                      <div
                        style={{
                          color: "#facc15",
                          fontSize: "0.875rem",
                          padding: "0.35rem 0.75rem",
                          fontFamily: "'Pixellari', sans-serif",
                          fontWeight: "bold",
                        }}
                      >
                        Owner
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: "#374151",
                borderRadius: "0.5rem",
                padding: "1.25rem",
                border: "1px solid #4B5563",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                  color: "#facc15",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Spectators
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {activeRoom.spectators.length === 0 ? (
                  <div
                    style={{
                      color: "#9CA3AF",
                      textAlign: "center",
                      padding: "1rem",
                      fontFamily: "'Pixellari', sans-serif",
                      fontStyle: "italic",
                    }}
                  >
                    No spectators
                  </div>
                ) : (
                  activeRoom.spectators.map((spectator) => (
                    <div
                      key={spectator.address}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.75rem",
                        backgroundColor: "#2D3748",
                        borderRadius: "0.375rem",
                        border: "1px solid #374151",
                        transition: "transform 0.2s ease",
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "500",
                          fontFamily: "'Pixellari', sans-serif",
                        }}
                      >
                        {spectator.nickname}
                        {spectator.address === address && (
                          <span
                            style={{
                              marginLeft: "0.5rem",
                              color: "#9CA3AF",
                              fontSize: "0.875rem",
                              fontStyle: "italic",
                            }}
                          >
                            (You)
                          </span>
                        )}
                      </span>

                      {/* Allow owner to challenge spectators too */}
                      {isOwner && spectator.address !== address && (
                        <button
                          style={{
                            backgroundColor: "#4338CA",
                            color: "white",
                            padding: "0.35rem 0.75rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.875rem",
                            cursor: "pointer",
                            border: "none",
                            fontFamily: "'Pixellari', sans-serif",
                            transition: "all 0.2s ease",
                          }}
                          onClick={() => handleSendChallenge(spectator.address)}
                          disabled={
                            loading ||
                            activeRoom.status === "playing" ||
                            !!activeRoom.challengeStatus
                          }
                          onMouseEnter={(
                            e: React.MouseEvent<HTMLButtonElement>
                          ) => {
                            if (
                              !(
                                loading ||
                                activeRoom.status === "playing" ||
                                !!activeRoom.challengeStatus
                              )
                            ) {
                              e.currentTarget.style.backgroundColor = "#6366F1";
                            }
                          }}
                          onMouseLeave={(
                            e: React.MouseEvent<HTMLButtonElement>
                          ) => {
                            if (
                              !(
                                loading ||
                                activeRoom.status === "playing" ||
                                !!activeRoom.challengeStatus
                              )
                            ) {
                              e.currentTarget.style.backgroundColor = "#4338CA";
                            }
                          }}
                        >
                          Challenge
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {activeRoom.status === "playing" && (
            <div
              style={{
                marginTop: "1.5rem",
                backgroundColor: "#2D3748",
                padding: "1.25rem",
                borderRadius: "0.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #4B5563",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Pixellari', sans-serif",
                  color: "#facc15",
                  fontWeight: "bold",
                }}
              >
                Game in progress
              </span>
              <button
                onClick={() => navigate(`/multiplayer-game/${activeRoom.code}`)}
                style={{
                  backgroundColor: "#4338CA",
                  color: "white",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  border: "none",
                  fontFamily: "'Pixellari', sans-serif",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = "#6366F1";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = "#4338CA";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Watch Game
              </button>
            </div>
          )}

          {activeRoom.gameResults && (
            <div
              style={{
                marginTop: "1.5rem",
                backgroundColor: "#2D3748",
                padding: "1.25rem",
                borderRadius: "0.5rem",
                border: "1px solid #4B5563",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                  color: "#facc15",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Last Match Results
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "1.25rem",
                    color: "#facc15",
                    fontFamily: "'Pixellari', sans-serif",
                    padding: "0.5rem",
                    backgroundColor: "rgba(250, 204, 21, 0.1)",
                    borderRadius: "0.375rem",
                    textAlign: "center",
                  }}
                >
                  Winner:{" "}
                  {activeRoom.players.find(
                    (p: Player) => p.address === activeRoom.gameResults?.winner
                  )?.nickname || "Unknown"}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {Object.entries(activeRoom.gameResults.playerWaves).map(
                    ([playerAddress, wave]) => {
                      const player = activeRoom.players.find(
                        (p: Player) => p.address === playerAddress
                      );
                      return (
                        <div
                          key={playerAddress}
                          style={{
                            backgroundColor:
                              playerAddress === activeRoom.gameResults?.winner
                                ? "#1F2937"
                                : "#29303d",
                            padding: "0.75rem",
                            borderRadius: "0.375rem",
                            display: "flex",
                            justifyContent: "space-between",
                            border:
                              playerAddress === activeRoom.gameResults?.winner
                                ? "1px solid #facc15"
                                : "1px solid #374151",
                            fontFamily: "'Pixellari', sans-serif",
                          }}
                        >
                          <span>{player?.nickname || "Unknown"}</span>
                          <span style={{ color: "#9CA3AF" }}>Wave {wave}</span>
                          <span style={{ color: "#9CA3AF" }}>
                            Time:{" "}
                            {Math.floor(
                              activeRoom.gameResults?.playerTimes[
                                playerAddress
                              ] / 1000 || 0
                            )}
                            s
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // If a room is active, show the room lobby
  if (activeRoom) {
    return renderRoomLobby();
  }

  // Otherwise show the create/join form
  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: 'url("/Background.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Semi-transparent overlay for better contrast */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 0,
        }}
      />

      <div
        style={{
          backgroundColor: "#1a1a2e",
          borderRadius: "1rem",
          padding: "2rem",
          width: "100%",
          maxWidth: "32rem",
          margin: "0 auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          border: "2px solid #facc15",
          position: "relative",
          zIndex: 1,
        }}
      >
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "1.5rem",
            textAlign: "center",
            color: "#facc15",
            fontFamily: "'Jersey20', sans-serif",
          }}
        >
          Multiplayer Mode
        </h1>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            marginBottom: "1.5rem",
          }}
        >
          <button
            style={{
              flex: 1,
              backgroundColor: activeTab === "join" ? "#2563EB" : "#1F2937",
              color: "white",
              padding: "0.75rem 1rem",
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderTopLeftRadius: "0.375rem",
              borderBottomLeftRadius: "0.375rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              border: "none",
              fontSize: "1rem",
              fontFamily: "'Pixellari', sans-serif",
            }}
            onClick={() => setActiveTab("join")}
          >
            Join Room
          </button>
          <button
            style={{
              flex: 1,
              backgroundColor: activeTab === "create" ? "#10B981" : "#1F2937",
              color: "white",
              padding: "0.75rem 1rem",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderTopRightRadius: "0.375rem",
              borderBottomRightRadius: "0.375rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              border: "none",
              fontSize: "1rem",
              fontFamily: "'Pixellari', sans-serif",
            }}
            onClick={() => setActiveTab("create")}
          >
            Create Room
          </button>
        </div>

        {/* Nickname input */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              color: "#9CA3AF",
              marginBottom: "0.5rem",
              fontFamily: "'Pixellari', sans-serif",
            }}
          >
            Your Nickname
          </label>
          <input
            type="text"
            style={{
              width: "100%",
              backgroundColor: "#2D3748",
              border: "1px solid #4B5563",
              borderRadius: "0.375rem",
              padding: "0.75rem",
              color: "white",
              fontSize: "1rem",
              fontFamily: "'Pixellari', sans-serif",
            }}
            placeholder="Enter nickname"
            value={nickname}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNickname(e.target.value)
            }
            maxLength={20}
          />
        </div>

        {activeTab === "join" ? (
          /* Join Room Form */
          <div style={{ width: "100%" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#9CA3AF",
                  marginBottom: "0.5rem",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Room Code
              </label>
              <input
                type="text"
                style={{
                  width: "100%",
                  backgroundColor: "#2D3748",
                  border: "1px solid #4B5563",
                  borderRadius: "0.375rem",
                  padding: "0.75rem",
                  color: "white",
                  fontSize: "1rem",
                  fontFamily: "'Pixellari', sans-serif",
                  letterSpacing: "0.1em",
                }}
                placeholder="Enter 6-digit code"
                value={roomCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
              />
            </div>

            <button
              style={{
                width: "100%",
                backgroundColor: "#2563EB",
                color: "white",
                padding: "0.75rem 0",
                borderRadius: "0.5rem",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "none",
                fontSize: "1.125rem",
                fontFamily: "'Pixellari', sans-serif",
                marginTop: "1rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              onClick={handleJoinRoom}
              disabled={loading}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#3B82F6";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#2563EB";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? "Joining..." : "Join Room"}
            </button>
          </div>
        ) : (
          /* Create Room Form */
          <div style={{ width: "100%" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  color: "#9CA3AF",
                  marginBottom: "0.5rem",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Stake Amount (SOL)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                style={{
                  width: "100%",
                  backgroundColor: "#2D3748",
                  border: "1px solid #4B5563",
                  borderRadius: "0.375rem",
                  padding: "0.75rem",
                  color: "white",
                  fontSize: "1rem",
                  fontFamily: "'Jersey20', sans-serif",
                }}
                value={stakeAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setStakeAmount(parseFloat(e.target.value))
                }
              />
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#9CA3AF",
                  marginTop: "0.5rem",
                  fontFamily: "'Pixellari', sans-serif",
                }}
              >
                Amount each player needs to stake to participate. Winner takes
                95% of the pot.
              </p>
            </div>

            <button
              style={{
                width: "100%",
                backgroundColor: "#10B981",
                color: "white",
                padding: "0.75rem 0",
                borderRadius: "0.5rem",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "none",
                fontSize: "1.125rem",
                fontFamily: "'Pixellari', sans-serif",
                marginTop: "1rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              onClick={handleCreateRoom}
              disabled={loading}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#34D399";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#10B981";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {loading ? "Creating..." : "Create Room"}
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "1.5rem",
              backgroundColor: "#7F1D1D",
              border: "1px solid #B91C1C",
              color: "white",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              fontFamily: "'Pixellari', sans-serif",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            marginTop: "2rem",
            textAlign: "center",
            borderTop: "1px solid #374151",
            paddingTop: "1.5rem",
          }}
        >
          <button
            onClick={onBack}
            style={{
              color: "#9CA3AF",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontFamily: "'Pixellari', sans-serif",
              transition: "color 0.2s ease",
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = "#F9FAFB";
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.color = "#9CA3AF";
            }}
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;
