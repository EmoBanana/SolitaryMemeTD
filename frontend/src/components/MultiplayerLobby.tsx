import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";
import socketService from "../utils/socketService";

// Add JSX namespace to fix TypeScript errors
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
    }
  }
}

interface MultiplayerLobbyProps {
  onBack: () => void;
}

// Generate a random 6-digit room code
const generateRoomCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

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
    };
  }, [address, activeRoom, navigate]);

  // Save nickname to localStorage when changed
  useEffect(() => {
    if (nickname) {
      localStorage.setItem("smtd_nickname", nickname);
    }
  }, [nickname]);

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
      socketService.joinRoom({
        roomCode,
        nickname,
        address,
      });
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
      (p) => p.address === address
    );
    if (activeRoom.players.length < 2 || !ownerIsPlaying) {
      setError("Need at least 2 players to start a match");
      return;
    }

    // For a real implementation, you would send a startMatch event to the server
    // Instead, let's directly navigate to the game as a workaround
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
    const isPlayer = activeRoom.players.some((p) => p.address === address);
    if (isPlayer) {
      setError("Players cannot place bets");
      return;
    }

    try {
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

    return (
      <div
        style={{
          backgroundColor: "#1F2937",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          width: "100%",
          maxWidth: "28rem",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
            Room: {activeRoom.code}
          </h2>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleLeaveRoom}
              style={{
                backgroundColor: "#4B5563",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                cursor: "pointer",
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
                }}
                disabled={loading}
              >
                Start Game
              </button>
            )}
          </div>
        </div>

        {hasPendingChallenge && (
          <div
            style={{
              backgroundColor: "#4338CA",
              padding: "1rem",
              borderRadius: "0.375rem",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "white" }}>
              {activeRoom.players.find(
                (p) => p.address === activeRoom.challengeStatus?.challenger
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
              }}
              disabled={loading}
            >
              Accept Challenge
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: "#7F1D1D",
              border: "1px solid #B91C1C",
              color: "white",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
          <div
            style={{
              backgroundColor: "#374151",
              borderRadius: "0.375rem",
              padding: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: "bold",
                marginBottom: "0.75rem",
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
              {activeRoom.players.map((player) => (
                <div
                  key={player.address}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem",
                    backgroundColor:
                      player.address === activeRoom.owner
                        ? "#1F2937"
                        : "#2D3748",
                    borderRadius: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontWeight: "500" }}>
                      {player.nickname}
                      {player.address === activeRoom.owner && (
                        <span style={{ marginLeft: "0.25rem" }}>👑</span>
                      )}
                      {player.address === address && (
                        <span
                          style={{
                            marginLeft: "0.25rem",
                            color: "#9CA3AF",
                            fontSize: "0.875rem",
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
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                      onClick={() => handleSendChallenge(player.address)}
                      disabled={
                        loading ||
                        activeRoom.status === "playing" ||
                        !!activeRoom.challengeStatus
                      }
                    >
                      Challenge
                    </button>
                  )}

                  {/* For non-owners, don't show challenge buttons */}
                  {!isOwner && player.address === activeRoom.owner && (
                    <div
                      style={{
                        color: "#9CA3AF",
                        fontSize: "0.875rem",
                        padding: "0.25rem 0.75rem",
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
              borderRadius: "0.375rem",
              padding: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: "bold",
                marginBottom: "0.75rem",
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
                      padding: "0.5rem",
                      backgroundColor: "#2D3748",
                      borderRadius: "0.25rem",
                    }}
                  >
                    <span style={{ fontWeight: "500" }}>
                      {spectator.nickname}
                      {spectator.address === address && (
                        <span
                          style={{
                            marginLeft: "0.25rem",
                            color: "#9CA3AF",
                            fontSize: "0.875rem",
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
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.875rem",
                          cursor: "pointer",
                        }}
                        onClick={() => handleSendChallenge(spectator.address)}
                        disabled={
                          loading ||
                          activeRoom.status === "playing" ||
                          !!activeRoom.challengeStatus
                        }
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
              marginTop: "1rem",
              backgroundColor: "#2D3748",
              padding: "1rem",
              borderRadius: "0.375rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Game in progress</span>
            <button
              onClick={() => navigate(`/multiplayer-game/${activeRoom.code}`)}
              style={{
                backgroundColor: "#4338CA",
                color: "white",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Watch Game
            </button>
          </div>
        )}

        {activeRoom.gameResults && (
          <div
            style={{
              marginTop: "1rem",
              backgroundColor: "#2D3748",
              padding: "1rem",
              borderRadius: "0.375rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: "bold",
                marginBottom: "0.75rem",
              }}
            >
              Last Match Results
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ fontWeight: "bold", fontSize: "1.125rem" }}>
                Winner:{" "}
                {activeRoom.players.find(
                  (p) => p.address === activeRoom.gameResults?.winner
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
                      (p) => p.address === playerAddress
                    );
                    return (
                      <div
                        key={playerAddress}
                        style={{
                          backgroundColor: "#1F2937",
                          padding: "0.5rem",
                          borderRadius: "0.25rem",
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{player?.nickname || "Unknown"}:</span>
                        <span>Wave {wave}</span>
                        <span>
                          Time:{" "}
                          {Math.floor(
                            activeRoom.gameResults?.playerTimes[playerAddress] /
                              1000 || 0
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
    );
  };

  // If a room is active, show the room lobby
  if (activeRoom) {
    return renderRoomLobby();
  }

  // Otherwise show the create/join form
  return (
    <div style={containerStyle}>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
          textAlign: "center",
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
            ...buttonStyle,
            flex: 1,
            backgroundColor: activeTab === "join" ? "#2563EB" : "#4B5563",
            borderTopRightRadius: 0,
            borderBottomRightRadius: 0,
          }}
          onClick={() => setActiveTab("join")}
        >
          Join Room
        </button>
        <button
          style={{
            ...buttonStyle,
            flex: 1,
            backgroundColor: activeTab === "create" ? "#10B981" : "#4B5563",
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
          }}
          onClick={() => setActiveTab("create")}
        >
          Create Room
        </button>
      </div>

      {/* Nickname input */}
      <div style={{ marginBottom: "1rem" }}>
        <label
          style={{
            display: "block",
            color: "#9CA3AF",
            marginBottom: "0.25rem",
          }}
        >
          Your Nickname
        </label>
        <input
          type="text"
          style={inputStyle}
          placeholder="Enter nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
        />
      </div>

      {activeTab === "join" ? (
        /* Join Room Form */
        <div style={{ width: "100%" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                color: "#9CA3AF",
                marginBottom: "0.25rem",
              }}
            >
              Room Code
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="Enter 6-digit code"
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
            />
          </div>

          <button
            style={{
              ...buttonStyle,
              width: "100%",
              backgroundColor: "#2563EB",
              padding: "0.5rem 0",
              marginTop: "1rem",
            }}
            onClick={handleJoinRoom}
            disabled={loading}
          >
            {loading ? "Joining..." : "Join Room"}
          </button>
        </div>
      ) : (
        /* Create Room Form */
        <div style={{ width: "100%" }}>
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                color: "#9CA3AF",
                marginBottom: "0.25rem",
              }}
            >
              Stake Amount (SOL)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              style={inputStyle}
              value={stakeAmount}
              onChange={(e) => setStakeAmount(parseFloat(e.target.value))}
            />
            <p
              style={{
                fontSize: "0.75rem",
                color: "#6B7280",
                marginTop: "0.25rem",
              }}
            >
              Amount each player needs to stake to participate. Winner takes 95%
              of the pot.
            </p>
          </div>

          <button
            style={{
              ...buttonStyle,
              width: "100%",
              backgroundColor: "#10B981",
              padding: "0.5rem 0",
              marginTop: "1rem",
            }}
            onClick={handleCreateRoom}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: "1rem",
            backgroundColor: "#7F1D1D",
            border: "1px solid #B91C1C",
            color: "white",
            padding: "0.75rem",
            borderRadius: "0.375rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <button
          onClick={onBack}
          style={{
            color: "#9CA3AF",
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          ← Back to Menu
        </button>
      </div>
    </div>
  );
};

export default MultiplayerLobby;
