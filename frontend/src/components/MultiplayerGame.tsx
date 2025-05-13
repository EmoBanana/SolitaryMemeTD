import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppKitAccount } from "@reown/appkit/react";
import Game from "./Game";
import socketService from "../utils/socketService";

// Mock function to simulate an API/backend call to get room data
const fetchRoomData = async (roomId: string) => {
  // In a real implementation, this would be an API call
  return {
    id: roomId,
    code: "123456",
    owner: "OwnerAddress",
    players: [
      {
        address: "PlayerOneAddress",
        nickname: "Player One",
        isReady: true,
        stakeAmount: 0.01 * 1_000_000_000,
      },
      {
        address: "PlayerTwoAddress",
        nickname: "Player Two",
        isReady: true,
        stakeAmount: 0.01 * 1_000_000_000,
      },
    ],
    spectators: [
      {
        address: "SpectatorAddress",
        nickname: "Spectator",
        betOn: "PlayerOneAddress",
        betAmount: 0.005,
      },
    ],
    status: "playing",
    createdAt: Date.now() - 60000, // 1 minute ago
    stakeAmount: 0.01 * 1_000_000_000,
    challengeStatus: {
      challenger: "PlayerOneAddress",
      challenged: "PlayerTwoAddress",
      accepted: true,
    },
  };
};

interface MultiplayerGameProps {
  onExit: () => void;
}

const MultiplayerGame: React.FC<MultiplayerGameProps> = ({ onExit }) => {
  const { roomId } = useParams<{ roomId: string }>();
  const { address } = useAppKitAccount();
  const navigate = useNavigate();

  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opponentState, setOpponentState] = useState<{
    wave: number;
    towerHp: number;
    maxTowerHp: number;
    coins: number;
    gameTime: number;
    readyForNextWave?: boolean;
  } | null>(null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [readyForNextWave, setReadyForNextWave] = useState(false);
  const [shouldStopGame, setShouldStopGame] = useState(false);
  const [forcedGameOver, setForcedGameOver] = useState(false);
  const [wave, setWave] = useState(1); // Track current player's wave

  // Reference to track if component is mounted
  const isMounted = useRef(true);

  // Flag to track if user is intentionally leaving
  const isIntentionalLeaving = useRef(false);

  // Player role tracking
  const [isSpectator, setIsSpectator] = useState(false);
  const [isRoomOwner, setIsRoomOwner] = useState(false);

  // Game result state
  const [gameResult, setGameResult] = useState<{
    isGameOver: boolean;
    winner: string | null;
    loser: string | null;
    winnerNickname: string;
    isDraw: boolean;
  } | null>(null);

  // Wave synchronization
  useEffect(() => {
    if (!opponentState || !roomId || isSpectator) return;

    // If opponent is ready for next wave and we are ready too, reset the flags
    if (opponentState.readyForNextWave && readyForNextWave) {
      setReadyForNextWave(false);
      setWaitingForOpponent(false);

      // Send an update to reset our ready state
      if (roomId) {
        socketService.emit("wave_sync", {
          roomCode: roomId,
          playerAddress: address,
          readyForNextWave: false,
        });
      }
    }
  }, [opponentState, readyForNextWave, roomId, address, isSpectator]);

  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    isIntentionalLeaving.current = false;

    if (!roomId || !address) {
      setError("Invalid room ID or wallet not connected");
      setLoading(false);
      return;
    }

    console.log(`Joining multiplayer game room: ${roomId} as ${address}`);

    // Connect to socket server
    const socket = socketService.connect();

    // Set up socket event listeners for game
    socketService.on("room_updated", (room: any) => {
      console.log("Room updated:", room);
      if (room.code === roomId && isMounted.current) {
        setGameData(room);

        // Determine if user is a player or spectator
        const playerEntry = room.players.find(
          (p: any) => p.address === address
        );
        setIsSpectator(!playerEntry);

        // Determine if user is the room owner
        setIsRoomOwner(room.owner === address);

        // Update loading status
        setLoading(false);
      }
    });

    socketService.on("opponent_state_update", (data: any) => {
      // Only process updates from opponents
      if (data.address !== address && isMounted.current) {
        // Skip state updates if game is already over
        if (shouldStopGame || forcedGameOver || gameResult?.isGameOver) {
          console.log("Ignoring opponent state update because game is over");
          return;
        }

        console.log("Received opponent state update:", data);
        setOpponentState(data.state);

        // If opponent's tower HP is 0, trigger game over
        if (data.state.towerHp <= 0 && !shouldStopGame) {
          console.log("Opponent tower destroyed - we win");
          setShouldStopGame(true);
          // Let server know we won
          socketService.emit("player_won", {
            roomCode: roomId,
            winner: address,
            loser: data.address,
          });
        }
      }
    });

    socketService.on("wave_sync", (data) => {
      if (data.playerAddress !== address) {
        console.log("Received wave sync update:", data);
        // Update opponent's ready state in our local state
        setOpponentState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            readyForNextWave: data.readyForNextWave,
            wave: data.currentWave || prev.wave,
          };
        });

        // If this is our own data, also update our own wave
        if (data.playerAddress === address && data.currentWave) {
          setWave(data.currentWave);
        }

        // If opponent becomes ready and we're also ready, play a notification sound
        if (data.readyForNextWave && readyForNextWave) {
          // Play a notification sound
          try {
            const audio = new Audio("/sounds/ready-notification.mp3");
            audio.volume = 0.5;
            audio
              .play()
              .catch((err) => console.error("Error playing sound:", err));
          } catch (err) {
            console.error("Could not play notification sound:", err);
          }
        }
      }
    });

    socketService.on("advance_wave", (data) => {
      console.log("Received advance_wave event:", data);

      if (!roomId || data.roomCode !== roomId) return;

      // CRITICAL: Reset waiting state FIRST to allow spawning to continue
      setWaitingForOpponent(false);

      // Then reset readyForNextWave flag
      setReadyForNextWave(false);

      // Update our wave number to match the new wave
      setWave(data.wave);

      // Reset opponent state's readyForNextWave flag
      setOpponentState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          readyForNextWave: false,
          wave: data.wave,
        };
      });

      // Import the useGame from Game.tsx if not already available
      // This ensures the wave is correctly updated in the global state
      if (window.useGameSetWave) {
        // Set the wave directly in the game state to ensure synchronization
        window.useGameSetWave(data.wave);
        console.log(`Advanced game wave to ${data.wave} via global state`);
      } else {
        console.warn("Could not access global useGame state to set wave");
      }

      // Alert the user that waves are advancing
      try {
        // Create a temporary notification element for wave advancement
        const notification = document.createElement("div");
        notification.style.position = "absolute";
        notification.style.top = "50%";
        notification.style.left = "50%";
        notification.style.transform = "translate(-50%, -50%)";
        notification.style.backgroundColor = "rgba(0,64,0,0.9)";
        notification.style.color = "#33ff33";
        notification.style.padding = "20px 30px";
        notification.style.borderRadius = "8px";
        notification.style.fontWeight = "bold";
        notification.style.zIndex = "1001";
        notification.style.boxShadow = "0 0 25px rgba(0,255,0,0.5)";
        notification.style.fontSize = "24px";
        notification.style.border = "3px solid #33ff33";
        notification.style.textAlign = "center";
        notification.innerHTML = `<div>ADVANCING TO WAVE ${data.wave}</div><div style="font-size: 18px; margin-top: 10px;">Both players ready!</div>`;

        document.body.appendChild(notification);

        // Play a sound to notify the player that both are ready
        const audio = new Audio("/sounds/wave-advance.mp3");
        audio.volume = 0.5;
        audio
          .play()
          .catch((err) =>
            console.error("Error playing wave advance sound:", err)
          );

        // Remove notification after 2 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 2000);
      } catch (err) {
        console.error("Could not create wave advance notification:", err);
      }
    });

    socketService.on("game_over", (data: any) => {
      // Handle game over event
      console.log("Game over:", data);

      if (!isMounted.current) return;

      // Immediately force game over - critical to prevent further state updates
      setShouldStopGame(true);
      setForcedGameOver(true);

      // Force opponent state to reflect the game over
      setOpponentState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          towerHp: data.loser === address ? 0 : prev.towerHp,
          readyForNextWave: false,
        };
      });

      // Immediately stop all socket listeners for game state updates
      socketService.off("opponent_state_update");
      socketService.off("wave_sync");
      socketService.off("advance_wave");

      // Show winner/loser screen
      setGameResult({
        isGameOver: true,
        winner: data.winner,
        loser: data.loser,
        winnerNickname: data.winnerNickname || "Unknown",
        isDraw: data.draw || false,
      });

      // Ensure our UI shows the correct state immediately
      if (data.loser === address) {
        // We lost - set our tower HP to 0
        window.useGameSetWave && window.useGameSetWave(-1);
      }
    });

    socketService.on("room_error", (data: { message: string }) => {
      console.error("Room error:", data);
      if (isMounted.current) {
        setError(data.message);
        setLoading(false);
      }
    });

    socketService.on("room_closed", (data: any) => {
      console.log("Room closed:", data);
      if (!isMounted.current) return;

      // Only show error if not caused by this user's actions
      if (!isIntentionalLeaving.current) {
        setError("The room was closed by the owner");
        setTimeout(() => {
          if (isMounted.current) {
            navigate("/multiplayer");
          }
        }, 3000);
      }
    });

    socketService.on("room_joined", (room: any) => {
      console.log("Room joined:", room);
      if (room.code === roomId && isMounted.current) {
        setGameData(room);
        setIsSpectator(false);
        setIsRoomOwner(room.owner === address);
        setLoading(false);

        // Reset game state when rejoining
        setShouldStopGame(false);
        setForcedGameOver(false);
        setReadyForNextWave(false);
        setWaitingForOpponent(false);
      }
    });

    socketService.on("joined_as_spectator", (room: any) => {
      console.log("Joined as spectator:", room);
      if (room.code === roomId && isMounted.current) {
        setGameData(room);
        setIsSpectator(true);
        setIsRoomOwner(false);
        setLoading(false);
      }
    });

    // Delay joining the room slightly to ensure socket connection is established
    setTimeout(() => {
      // Join the room
      console.log(`Sending join_room for room ${roomId}`);
      socketService.joinRoom({
        roomCode: roomId,
        nickname:
          localStorage.getItem("smtd_nickname") ||
          `Player_${address.slice(0, 4)}`,
        address,
      });
    }, 500);

    return () => {
      // Clean up on unmount
      console.log(
        "MultiplayerGame component unmounting, cleaning up socket listeners"
      );
      isMounted.current = false;

      socketService.off("room_updated");
      socketService.off("opponent_state_update");
      socketService.off("game_over");
      socketService.off("room_error");
      socketService.off("room_closed");
      socketService.off("room_joined");
      socketService.off("joined_as_spectator");
      socketService.off("wave_sync");
      socketService.off("advance_wave");

      // Only leave the room if it's an intentional navigation action
      // This prevents accidental room leaving during component unmounting
      if (isIntentionalLeaving.current && roomId) {
        socketService.leaveRoom(roomId);
      }
    };
  }, [roomId, address, navigate]);

  // Send local game state to server/opponent
  const sendGameState = (gameState: any) => {
    if (roomId && !isSpectator) {
      // Capture the current wave from the game state
      if (gameState.wave) {
        setWave(gameState.wave);
      }

      // Add ready for next wave flag to the game state
      const updatedState = {
        ...gameState,
        readyForNextWave,
      };

      console.log("Sending game state update:", updatedState);
      socketService.updateGameState(roomId, updatedState);
    }
  };

  // Signal that we are ready for next wave
  const handleWaveCleared = (currentWave: number) => {
    if (roomId && !isSpectator) {
      // Special case: -1 indicates game over notification from Game component
      if (currentWave === -1) {
        console.log("Received game over signal from Game component");
        // Do nothing else, as the game is already ending
        return;
      }

      // Store the current wave number
      setWave(currentWave);

      console.log(
        `Wave ${currentWave} cleared, ENFORCING WAIT for opponent to finish...`
      );

      // HARDCODED: Always set waiting state right away to force pause
      setWaitingForOpponent(true);

      // Update UI state to show waiting overlay
      setReadyForNextWave(true);

      // Emit wave sync event to server immediately
      socketService.emit("wave_sync", {
        roomCode: roomId,
        playerAddress: address,
        readyForNextWave: true,
        currentWave,
      });

      // Display a toast notification to the user - MAKE IT VERY VISIBLE
      try {
        // Create a temporary notification element
        const notification = document.createElement("div");
        notification.style.position = "absolute";
        notification.style.bottom = "80px";
        notification.style.left = "50%";
        notification.style.transform = "translateX(-50%)";
        notification.style.backgroundColor = "rgba(0,0,0,0.9)";
        notification.style.color = "#ffcc00";
        notification.style.padding = "15px 25px";
        notification.style.borderRadius = "8px";
        notification.style.fontWeight = "bold";
        notification.style.zIndex = "1000";
        notification.style.boxShadow = "0 5px 15px rgba(0,0,0,0.5)";
        notification.style.fontSize = "18px"; // Bigger font
        notification.style.border = "2px solid red"; // Attention-grabbing border
        notification.textContent =
          "PAUSED: Waiting for opponent to finish wave...";

        document.body.appendChild(notification);

        // Remove it after 3 seconds
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 3000);
      } catch (err) {
        console.error("Could not create notification:", err);
      }
    }
  };

  // Handle game exit and cleanup
  const handleGameExit = () => {
    console.log("Game exit requested, leaving room:", roomId);
    if (roomId) {
      isIntentionalLeaving.current = true;
      socketService.leaveRoom(roomId);
    }
    onExit();
  };

  // Return to room after game ends (for rematch)
  const handleReturnToRoom = () => {
    setGameResult(null);
    setShouldStopGame(false);
    setForcedGameOver(false);

    // Reset game state but stay in the room
    if (roomId) {
      // Re-join the room to get fresh state
      socketService.joinRoom({
        roomCode: roomId,
        nickname:
          localStorage.getItem("smtd_nickname") ||
          `Player_${address.slice(0, 4)}`,
        address,
      });
    }
  };

  // Handle challenge initiation (only for room owner)
  const handleInitiateChallenge = (challengedPlayerAddress: string) => {
    if (roomId && isRoomOwner) {
      socketService.emit("send_challenge", {
        roomCode: roomId,
        challengerAddress: address,
        challengedAddress: challengedPlayerAddress,
      });
    }
  };

  // Render opponent's game state panel
  const renderOpponentPanel = () => {
    if (!opponentState || !gameData) return null;

    const opponent = gameData.players.find((p: any) => p.address !== address);
    if (!opponent) return null;

    return (
      <div
        id="opponent-panel"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          zIndex: 100,
          background: "rgba(0,0,0,0.8)",
          borderRadius: "8px",
          padding: "15px",
          width: "260px",
          border: opponentState.readyForNextWave
            ? "2px solid rgba(100,255,100,0.7)"
            : "2px solid rgba(255,100,100,0.5)",
          boxShadow: opponentState.readyForNextWave
            ? "0 0 15px rgba(0, 255, 0, 0.4)"
            : "0 0 15px rgba(255, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "10px",
            textAlign: "center",
            color: "#ff5555",
          }}
        >
          OPPONENT: {opponent.nickname || "Unknown"}
        </div>

        {/* Tower HP */}
        <div
          style={{
            position: "relative",
            height: "20px",
            background: "#333",
            borderRadius: "4px",
            overflow: "hidden",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${
                (opponentState.towerHp / opponentState.maxTowerHp) * 100
              }%`,
              background:
                opponentState.towerHp < opponentState.maxTowerHp * 0.3
                  ? "#ff3333"
                  : "#33cc33",
              transition: "width 0.3s",
            }}
          />
          <div
            style={{
              position: "relative",
              textAlign: "center",
              color: "white",
              textShadow: "0 0 3px black, 0 0 3px black, 0 0 3px black",
              fontSize: "12px",
              fontWeight: "bold",
              lineHeight: "20px",
            }}
          >
            HP: {Math.floor(opponentState.towerHp)}/
            {Math.floor(opponentState.maxTowerHp)}
          </div>
        </div>

        {/* Other stats */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            fontSize: "14px",
            color: "#ccc",
          }}
        >
          <div>Wave: {opponentState.wave}</div>
          <div>Coins: {opponentState.coins}</div>
          <div>Time: {Math.floor(opponentState.gameTime / 1000)}s</div>
          {opponentState.readyForNextWave && (
            <div
              style={{
                color: "#66ff66",
                marginTop: "5px",
                fontWeight: "bold",
                background: "rgba(0,50,0,0.4)",
                padding: "6px 10px",
                borderRadius: "4px",
                textAlign: "center",
                border: "1px solid #33cc33",
                animation: "pulse 1.5s infinite",
              }}
            >
              READY FOR NEXT WAVE!
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render waiting overlay when player has completed a wave but is waiting for opponent
  const renderWaveWaitingOverlay = () => {
    // Only show waiting overlay when readyForNextWave is true
    if (!readyForNextWave || !roomId) return null;

    // Check if opponent is also ready for next wave
    const opponentIsReady = opponentState?.readyForNextWave;

    // Use the current player's wave number, not the opponent's
    const currentWave = wave;

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 900,
          background: "rgba(0,0,0,0.9)",
          padding: "30px 40px",
          borderRadius: "15px",
          textAlign: "center",
          color: opponentIsReady ? "#33cc33" : "#ffcc00",
          fontSize: "28px",
          fontWeight: "bold",
          backdropFilter: "blur(8px)",
          boxShadow: "0 0 30px rgba(0,0,0,0.8)",
          border: opponentIsReady ? "4px solid #33cc33" : "4px solid #ff0000",
          minWidth: "400px",
          animation: opponentIsReady
            ? "attention-pulse 0.5s ease-in-out 3"
            : "none",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "20px" }}>
          Wave {currentWave} Cleared!
        </div>

        <div style={{ fontSize: "24px", marginBottom: "25px" }}>
          {opponentIsReady
            ? "Your opponent is also ready! Advancing..."
            : "Waiting for your opponent to finish..."}
        </div>

        <div
          style={{
            marginTop: "20px",
            fontSize: "22px",
            opacity: 1,
            animation: "pulse 1.5s infinite",
            color: "#ff3333",
            background: "rgba(80,0,0,0.5)",
            padding: "15px",
            borderRadius: "10px",
            border: "2px solid #ff3333",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          GAME PAUSED
        </div>

        <div
          style={{
            fontSize: "18px",
            opacity: 0.9,
            color: "#ffcc77",
            background: "rgba(50,40,0,0.4)",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,204,0,0.4)",
            marginBottom: "10px",
          }}
        >
          Enemies will not spawn until your opponent finishes
        </div>

        {opponentState && !opponentIsReady && (
          <div
            style={{
              fontSize: "16px",
              color: "#aaaaaa",
              marginTop: "15px",
            }}
          >
            Opponent is on wave {opponentState.wave || 1}
            {opponentState.enemyCount
              ? ` (${opponentState.enemyCount} enemies left)`
              : ""}
          </div>
        )}
      </div>
    );
  };

  // Render spectator view with both players' games side by side
  const renderSpectatorView = () => {
    if (!isSpectator || !gameData) return null;

    // Get the two players
    const player1 = gameData.players[0];
    const player2 = gameData.players.length > 1 ? gameData.players[1] : null;

    if (!player1) return <div>Waiting for players...</div>;
    if (!player2) return <div>Waiting for second player...</div>;

    // Get player game states
    const player1State = gameData.gameState[player1.address] || {};
    const player2State = gameData.gameState[player2.address] || {};

    // Find the spectator entry for the current user
    const userSpectator = gameData.spectators.find(
      (s: any) => s.address === address
    );

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          background: "#111",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.9)",
            color: "#ffcc00",
            padding: "10px",
            textAlign: "center",
            fontSize: "18px",
            fontWeight: "bold",
            borderBottom: "2px solid #333",
          }}
        >
          SPECTATOR MODE - MATCH IN PROGRESS
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
          }}
        >
          {/* Player 1 side */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRight: "2px solid #333",
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.7)",
                color:
                  userSpectator?.betOn === player1.address
                    ? "#ffcc00"
                    : "white",
                padding: "8px",
                textAlign: "center",
                fontSize: "16px",
                fontWeight: "bold",
                borderBottom: "1px solid #333",
              }}
            >
              {player1.nickname}
              {userSpectator?.betOn === player1.address && " (Your Bet)"}
            </div>

            {/* Player 1 stats */}
            <div
              style={{
                padding: "10px",
                background: "rgba(0,0,0,0.5)",
                borderBottom: "1px solid #333",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                }}
              >
                <span>Wave:</span>
                <span>{player1State.wave || "?"}</span>
              </div>

              {/* HP Bar */}
              <div style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    position: "relative",
                    height: "15px",
                    background: "#333",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${
                        player1State.towerHp && player1State.maxTowerHp
                          ? (player1State.towerHp / player1State.maxTowerHp) *
                            100
                          : 100
                      }%`,
                      background:
                        player1State.towerHp &&
                        player1State.maxTowerHp &&
                        player1State.towerHp < player1State.maxTowerHp * 0.3
                          ? "#ff3333"
                          : "#33cc33",
                      transition: "width 0.3s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      textAlign: "center",
                      color: "white",
                      textShadow: "0 0 3px black",
                      fontSize: "10px",
                      fontWeight: "bold",
                      lineHeight: "15px",
                    }}
                  >
                    HP:{" "}
                    {player1State.towerHp
                      ? Math.floor(player1State.towerHp)
                      : "?"}
                    /
                    {player1State.maxTowerHp
                      ? Math.floor(player1State.maxTowerHp)
                      : "?"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                }}
              >
                <span>Coins:</span>
                <span>{player1State.coins || "0"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Time:</span>
                <span>
                  {player1State.gameTime
                    ? Math.floor(player1State.gameTime / 1000) + "s"
                    : "0s"}
                </span>
              </div>
            </div>

            {/* Game content placeholder */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#222",
                color: "#999",
                fontSize: "14px",
              }}
            >
              {!player1State.wave ? "Game not started yet" : "Game in progress"}
              <br />
              {player1State.towerHp <= 0 && "Tower destroyed!"}
            </div>
          </div>

          {/* Player 2 side */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.7)",
                color:
                  userSpectator?.betOn === player2.address
                    ? "#ffcc00"
                    : "white",
                padding: "8px",
                textAlign: "center",
                fontSize: "16px",
                fontWeight: "bold",
                borderBottom: "1px solid #333",
              }}
            >
              {player2.nickname}
              {userSpectator?.betOn === player2.address && " (Your Bet)"}
            </div>

            {/* Player 2 stats */}
            <div
              style={{
                padding: "10px",
                background: "rgba(0,0,0,0.5)",
                borderBottom: "1px solid #333",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                }}
              >
                <span>Wave:</span>
                <span>{player2State.wave || "?"}</span>
              </div>

              {/* HP Bar */}
              <div style={{ marginBottom: "8px" }}>
                <div
                  style={{
                    position: "relative",
                    height: "15px",
                    background: "#333",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${
                        player2State.towerHp && player2State.maxTowerHp
                          ? (player2State.towerHp / player2State.maxTowerHp) *
                            100
                          : 100
                      }%`,
                      background:
                        player2State.towerHp &&
                        player2State.maxTowerHp &&
                        player2State.towerHp < player2State.maxTowerHp * 0.3
                          ? "#ff3333"
                          : "#33cc33",
                      transition: "width 0.3s",
                    }}
                  />
                  <div
                    style={{
                      position: "relative",
                      textAlign: "center",
                      color: "white",
                      textShadow: "0 0 3px black",
                      fontSize: "10px",
                      fontWeight: "bold",
                      lineHeight: "15px",
                    }}
                  >
                    HP:{" "}
                    {player2State.towerHp
                      ? Math.floor(player2State.towerHp)
                      : "?"}
                    /
                    {player2State.maxTowerHp
                      ? Math.floor(player2State.maxTowerHp)
                      : "?"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                }}
              >
                <span>Coins:</span>
                <span>{player2State.coins || "0"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Time:</span>
                <span>
                  {player2State.gameTime
                    ? Math.floor(player2State.gameTime / 1000) + "s"
                    : "0s"}
                </span>
              </div>
            </div>

            {/* Game content placeholder */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#222",
                color: "#999",
                fontSize: "14px",
              }}
            >
              {!player2State.wave ? "Game not started yet" : "Game in progress"}
              <br />
              {player2State.towerHp <= 0 && "Tower destroyed!"}
            </div>
          </div>
        </div>

        {/* Bottom bar with match info and controls */}
        <div
          style={{
            background: "rgba(0,0,0,0.9)",
            padding: "10px",
            display: "flex",
            justifyContent: "space-between",
            borderTop: "2px solid #333",
          }}
        >
          <div style={{ color: "#ccc" }}>
            Room: {gameData.code} | Stake:{" "}
            {gameData.stakeAmount / 1_000_000_000} SOL
          </div>

          <button
            onClick={handleGameExit}
            style={{
              background: "#333",
              border: "none",
              color: "white",
              padding: "5px 15px",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Exit to Lobby
          </button>
        </div>
      </div>
    );
  };

  // Render room return options after game is over
  const renderRoomOptions = () => {
    if (!gameData || !gameData.players) return null;

    // Only show challenge controls for room owner
    if (!isRoomOwner) return null;

    const otherPlayers = gameData.players.filter(
      (p: any) => p.address !== address
    );
    const spectators = gameData.spectators || [];

    return (
      <div style={{ marginTop: "20px" }}>
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "10px",
            color: "#ffcc00",
          }}
        >
          Challenge a Player
        </div>

        {otherPlayers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {otherPlayers.map((player: any) => (
              <button
                key={player.address}
                onClick={() => handleInitiateChallenge(player.address)}
                style={{
                  background: "#2a6e2f",
                  border: "none",
                  borderRadius: "4px",
                  padding: "8px 12px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Challenge {player.nickname || player.address.slice(0, 6)}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ color: "#aaa", fontSize: "14px" }}>
            No other players to challenge
          </div>
        )}

        {spectators.length > 0 && (
          <div style={{ marginTop: "15px" }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: "bold",
                marginBottom: "8px",
                color: "#ffcc00",
              }}
            >
              Spectators
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {spectators.map((spectator: any) => (
                <button
                  key={spectator.address}
                  onClick={() => handleInitiateChallenge(spectator.address)}
                  style={{
                    background: "#336699",
                    border: "none",
                    borderRadius: "4px",
                    padding: "8px 12px",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Challenge{" "}
                  {spectator.nickname || spectator.address.slice(0, 6)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render game result overlay
  const renderGameResultOverlay = () => {
    if (!gameResult || !gameResult.isGameOver) return null;

    const isWinner = gameResult.winner === address;
    const textColor = isWinner ? "#66ff66" : "#ff5555";
    const backgroundColor = isWinner
      ? "rgba(0,50,0,0.95)"
      : "rgba(50,0,0,0.95)";

    // Get the appropriate nickname to display
    const winnerNickname = isWinner
      ? "YOU"
      : gameResult.winnerNickname || "OPPONENT";

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: backgroundColor,
          color: "white",
          textAlign: "center",
          padding: "30px",
        }}
      >
        <div
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            marginBottom: "20px",
            color: textColor,
          }}
        >
          {isWinner ? "YOU WON!" : `${winnerNickname} WON!`}
        </div>

        <div style={{ fontSize: "24px", marginBottom: "30px" }}>
          {isWinner
            ? "Your opponent lost their tower!"
            : "Your tower was destroyed!"}
        </div>

        <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
          <button
            onClick={handleReturnToRoom}
            style={{
              background: "#ffcc00",
              border: "none",
              color: "#222",
              padding: "12px 25px",
              borderRadius: "6px",
              fontSize: "18px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Return to Room
          </button>

          <button
            onClick={handleGameExit}
            style={{
              background: "#333",
              border: "none",
              color: "white",
              padding: "12px 25px",
              borderRadius: "6px",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            Exit to Lobby
          </button>
        </div>

        {renderRoomOptions()}
      </div>
    );
  };

  // We need a style tag for animations
  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
          @keyframes attention-pulse {
            0% { transform: scale(1); }
            25% { transform: scale(1.05); }
            50% { transform: scale(1); }
            75% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .attention-pulse {
            animation: attention-pulse 0.5s ease-in-out 3;
          }
        `}
      </style>

      {/* Main component content */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#1a1a2e",
            color: "white",
            fontSize: "24px",
          }}
        >
          Loading multiplayer game...
        </div>
      ) : error ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            background: "#1a1a2e",
            color: "white",
            padding: "20px",
          }}
        >
          <div
            style={{ fontSize: "24px", marginBottom: "20px", color: "#ff5555" }}
          >
            Error: {error}
          </div>
          <button
            onClick={() => {
              isIntentionalLeaving.current = true;
              onExit();
            }}
            style={{
              background: "#3a3a5e",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              color: "white",
              fontSize: "18px",
              cursor: "pointer",
            }}
          >
            Return to Lobby
          </button>
        </div>
      ) : isSpectator ? (
        // For spectators, we show a custom view with both player games
        <>
          {renderSpectatorView()}
          {renderGameResultOverlay()}
        </>
      ) : (
        // For players, we show the regular game with opponent info
        <div style={{ position: "relative", width: "100%", height: "100vh" }}>
          {/* Main game component */}
          <Game
            onExit={handleGameExit}
            isMultiplayer={true}
            onGameStateUpdate={sendGameState}
            isSpectator={false}
            onWaveCleared={handleWaveCleared}
            canAdvanceWave={!waitingForOpponent}
            shouldStopGame={shouldStopGame || forcedGameOver}
            opponentNickname={opponentState?.nickname || "Unknown"}
          />

          {/* Opponent panel */}
          {renderOpponentPanel()}

          {/* Waiting for opponent overlay */}
          {renderWaveWaitingOverlay()}

          {/* Room info banner */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 100,
              background: "rgba(0,0,0,0.8)",
              borderRadius: "4px",
              padding: "8px 15px",
              fontSize: "14px",
              color: "#ffcc00",
              display: "flex",
              gap: "10px",
            }}
          >
            <span>Room: {gameData?.code}</span>
            <span>|</span>
            <span>Stake: {gameData?.stakeAmount / 1_000_000_000} SOL</span>
            <span>|</span>
            <span>Mode: {isRoomOwner ? "Owner" : "Player"}</span>
          </div>

          {/* Game result overlay */}
          {renderGameResultOverlay()}
        </div>
      )}
    </>
  );
};

export default MultiplayerGame;
