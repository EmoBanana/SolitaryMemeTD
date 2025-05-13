const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"],
  },
});

// Store active rooms
const rooms = new Map();

app.get("/", (req, res) => {
  res.send("SMTD Multiplayer Server is running");
});

app.get("/api/rooms", (req, res) => {
  const roomsData = Array.from(rooms.entries()).map(([code, room]) => ({
    code,
    playerCount: room.players.length,
    spectatorCount: room.spectators.length,
    status: room.status,
  }));

  res.json(roomsData);
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new room
  socket.on("create_room", (data) => {
    const { roomCode, nickname, address, stakeAmount } = data;

    // Check if room already exists
    if (rooms.has(roomCode)) {
      socket.emit("room_error", { message: "Room code already exists" });
      return;
    }

    // Create new room
    const newRoom = {
      code: roomCode,
      owner: address,
      players: [
        {
          socketId: socket.id,
          address,
          nickname,
          isReady: false,
          stakeAmount: stakeAmount || 0,
        },
      ],
      spectators: [],
      status: "waiting",
      createdAt: Date.now(),
      stakeAmount: stakeAmount || 0,
      gameState: {},
    };

    rooms.set(roomCode, newRoom);

    // Join the socket to the room
    socket.join(roomCode);

    // Send room data back to creator
    socket.emit("room_created", newRoom);
    console.log(`Room created: ${roomCode} by ${nickname}`);
  });

  // Join an existing room
  socket.on("join_room", (data) => {
    const { roomCode, nickname, address } = data;

    // Check if room exists
    if (!rooms.has(roomCode)) {
      socket.emit("room_error", { message: "Room not found" });
      return;
    }

    const room = rooms.get(roomCode);

    // Check if already a player in the room
    const existingPlayer = room.players.find((p) => p.address === address);
    if (existingPlayer) {
      // Update socket ID if reconnecting
      existingPlayer.socketId = socket.id;
      socket.join(roomCode);
      socket.emit("room_joined", room);
      io.to(roomCode).emit("room_updated", room);
      return;
    }

    // Check if game is already in progress
    if (room.status === "playing") {
      // Join as spectator if game is in progress
      const newSpectator = {
        socketId: socket.id,
        address,
        nickname,
        betOn: null,
        betAmount: 0,
      };

      room.spectators.push(newSpectator);
      socket.join(roomCode);
      socket.emit("joined_as_spectator", room);
      io.to(roomCode).emit("room_updated", room);
      return;
    }

    // Join as player if there are less than 2 players and game not started
    if (room.players.length < 2 && room.status === "waiting") {
      const newPlayer = {
        socketId: socket.id,
        address,
        nickname,
        isReady: false,
        stakeAmount: 0,
      };

      room.players.push(newPlayer);
      socket.join(roomCode);
      socket.emit("room_joined", room);
      io.to(roomCode).emit("room_updated", room);
    } else {
      // Join as spectator
      const newSpectator = {
        socketId: socket.id,
        address,
        nickname,
        betOn: null,
        betAmount: 0,
      };

      room.spectators.push(newSpectator);
      socket.join(roomCode);
      socket.emit("joined_as_spectator", room);
      io.to(roomCode).emit("room_updated", room);
    }

    console.log(`${nickname} joined room: ${roomCode}`);
  });

  // Place a bet (for spectators)
  socket.on("place_bet", (data) => {
    const { roomCode, playerAddress, amount } = data;

    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    const spectator = room.spectators.find((s) => s.socketId === socket.id);

    if (spectator) {
      spectator.betOn = playerAddress;
      spectator.betAmount = amount;
      io.to(roomCode).emit("room_updated", room);
    }
  });

  // Send challenge
  socket.on("send_challenge", (data) => {
    const { roomCode, challengerAddress, challengedAddress } = data;

    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    room.challengeStatus = {
      challenger: challengerAddress,
      challenged: challengedAddress,
      accepted: false,
    };

    io.to(roomCode).emit("challenge_sent", {
      roomCode,
      challenger: challengerAddress,
      challenged: challengedAddress,
    });

    io.to(roomCode).emit("room_updated", room);
  });

  // Accept challenge
  socket.on("accept_challenge", (data) => {
    const { roomCode } = data;

    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);

    if (room.challengeStatus) {
      room.challengeStatus.accepted = true;
      room.status = "countdown";

      io.to(roomCode).emit("challenge_accepted", { roomCode });
      io.to(roomCode).emit("room_updated", room);

      // Start match after countdown
      setTimeout(() => {
        room.status = "playing";
        io.to(roomCode).emit("match_started", { roomCode });
        io.to(roomCode).emit("room_updated", room);
      }, 5000); // 5 second countdown
    }
  });

  // Game state update
  socket.on("game_state_update", (data) => {
    const { roomCode, gameState } = data;

    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);
    const player = room.players.find((p) => p.socketId === socket.id);

    if (player) {
      room.gameState[player.address] = gameState;

      // Broadcast the state to all other users in the room
      socket.to(roomCode).emit("opponent_state_update", {
        address: player.address,
        state: gameState,
      });

      // Check for game over
      if (gameState.towerHp <= 0) {
        // Skip if the room is already marked as finished or this player already received a game over
        if (room.matchFinished || room.gameState[player.address].gameOverSent) {
          return;
        }

        // Mark this player as having received a game over message
        room.gameState[player.address].gameOverSent = true;

        // Mark the room as finished to prevent duplicate notifications
        room.matchFinished = true;

        const otherPlayer = room.players.find((p) => p.socketId !== socket.id);

        if (otherPlayer) {
          // This player lost, other player won
          io.to(roomCode).emit("game_over", {
            winner: otherPlayer.address,
            loser: player.address,
          });

          room.status = "finished";
          room.gameResults = {
            winner: otherPlayer.address,
            playerWaves: {
              [player.address]: gameState.wave,
              [otherPlayer.address]:
                room.gameState[otherPlayer.address]?.wave || 0,
            },
            playerTimes: {
              [player.address]: gameState.gameTime,
              [otherPlayer.address]:
                room.gameState[otherPlayer.address]?.gameTime || 0,
            },
          };

          io.to(roomCode).emit("room_updated", room);
        }
      }
    }
  });

  // Leave room
  socket.on("leave_room", (data) => {
    const { roomCode } = data;
    leaveRoom(socket, roomCode);
  });

  // Disconnect handler
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find all rooms the user is in and handle their departure
    rooms.forEach((room, roomCode) => {
      leaveRoom(socket, roomCode);
    });
  });

  // Wave synchronization
  socket.on("wave_sync", (data) => {
    const { roomCode, playerAddress, readyForNextWave, currentWave } = data;

    if (!rooms.has(roomCode)) {
      console.log(`[Wave Sync] Room ${roomCode} not found`);
      return;
    }

    const room = rooms.get(roomCode);
    const player = room.players.find((p) => p.address === playerAddress);

    if (!player) {
      console.log(
        `[Wave Sync] Player ${playerAddress} not found in room ${roomCode}`
      );
      return;
    }

    // Update wave status in gameState if it exists
    if (!room.gameState[playerAddress]) {
      room.gameState[playerAddress] = {};
    }

    // Store the previous state to detect changes
    const previousReadyState = room.gameState[playerAddress].readyForNextWave;

    // Update the state
    room.gameState[playerAddress].readyForNextWave = readyForNextWave;

    // If currentWave is provided, update that too
    if (currentWave !== undefined) {
      room.gameState[playerAddress].wave = currentWave;
    }

    // Log wave sync event with full state for debugging - DETAILED LOGGING
    console.log(
      `[Wave Sync] Room ${roomCode}: Player ${playerAddress.slice(0, 6)} is ${
        readyForNextWave ? "READY" : "not ready"
      } for next wave. Current wave: ${room.gameState[playerAddress].wave || 1}`
    );

    // IMMEDIATELY forward the wave sync event to all clients in the room
    // This is critical to ensure all clients have consistent state
    io.to(roomCode).emit("wave_sync", data);

    // Get all player states and check if all players are ready
    const playerCount = room.players.length;
    const readyPlayers = Object.entries(room.gameState)
      .filter(([addr, state]) => state.readyForNextWave === true)
      .map(([addr]) => addr);

    const readyCount = readyPlayers.length;

    console.log(
      `[Wave Sync] Room ${roomCode}: ${readyCount}/${playerCount} players ready: ${readyPlayers.join(
        ", "
      )}`
    );

    const allReady = readyCount === playerCount && playerCount > 1;

    // If all players are ready, advance the wave for everyone
    if (allReady) {
      // Find the minimum wave number among players who are ready
      const nextWave = Math.min(
        ...Object.values(room.gameState)
          .filter((state) => state.readyForNextWave)
          .map((state) => (state.wave || 1) + 1)
      );

      console.log(
        `[Wave Sync] Room ${roomCode}: !!! ADVANCING ALL PLAYERS !!! to wave ${nextWave}`
      );

      // Notify all clients to advance to the next wave
      io.to(roomCode).emit("advance_wave", {
        roomCode,
        wave: nextWave,
      });

      // Reset ready states for all players after advancing
      for (const [addr, state] of Object.entries(room.gameState)) {
        state.readyForNextWave = false;
        if (state.wave !== undefined) {
          state.wave = nextWave;
        }
      }

      // Update all clients with the new game state after wave advancement
      io.to(roomCode).emit("game_state_update", {
        roomCode,
        gameState: room.gameState,
      });
    }
  });

  // Handle when a player wins
  socket.on("player_won", (data) => {
    const { roomCode, winner, loser } = data;

    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);

    // Skip if the room is already marked as finished to prevent duplicate game over notifications
    if (room.status === "finished" || room.gameOver) {
      console.log(`Game over already processed for room ${roomCode}`);
      return;
    }

    // Mark room as finished and set a gameOver flag
    room.status = "finished";
    room.gameOver = true;

    // Find winner's nickname from players array
    const winnerPlayer = room.players.find((p) => p.address === winner);
    const winnerNickname = winnerPlayer?.nickname || "Unknown";

    // Store game results
    if (!room.gameResults) {
      room.gameResults = {
        winner,
        loser,
        winnerNickname,
        playerWaves: {},
        playerTimes: {},
      };
    }

    // Get player states if available
    if (room.gameState) {
      if (room.gameState[winner]) {
        room.gameResults.playerWaves[winner] = room.gameState[winner].wave || 1;
        room.gameResults.playerTimes[winner] =
          room.gameState[winner].gameTime || 0;
      }
      if (room.gameState[loser]) {
        room.gameResults.playerWaves[loser] = room.gameState[loser].wave || 1;
        room.gameResults.playerTimes[loser] =
          room.gameState[loser].gameTime || 0;
      }
    }

    console.log(
      `Game over in room ${roomCode}. Winner: ${winner} (${winnerNickname}), Loser: ${loser}`
    );

    // Notify all players in the room
    for (const playerId of room.playerSockets.keys()) {
      const playerSocket = io.sockets.sockets.get(playerId);
      if (playerSocket) {
        playerSocket.emit("game_over", {
          winner,
          loser,
          winnerNickname,
          draw: false,
        });
      }
    }

    // Notify spectators
    for (const spectatorId of room.spectatorSockets) {
      const spectatorSocket = io.sockets.sockets.get(spectatorId);
      if (spectatorSocket) {
        spectatorSocket.emit("game_over", {
          winner,
          loser,
          winnerNickname,
          draw: false,
        });
      }
    }
  });

  // Helper function to handle leaving a room
  function leaveRoom(socket, roomCode) {
    if (!rooms.has(roomCode)) return;

    const room = rooms.get(roomCode);

    // Check if socket is a player
    const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
    if (playerIndex !== -1) {
      // If owner leaves, transfer ownership or delete room
      if (room.players[playerIndex].address === room.owner) {
        if (room.players.length > 1) {
          // Transfer ownership to next player
          room.owner = room.players.find(
            (p) => p.socketId !== socket.id
          ).address;
        } else {
          // Delete room if empty
          rooms.delete(roomCode);
          io.to(roomCode).emit("room_closed", { roomCode });
          return;
        }
      }

      // Remove player
      room.players.splice(playerIndex, 1);
    } else {
      // Check if socket is a spectator
      const spectatorIndex = room.spectators.findIndex(
        (s) => s.socketId === socket.id
      );
      if (spectatorIndex !== -1) {
        room.spectators.splice(spectatorIndex, 1);
      }
    }

    socket.leave(roomCode);
    io.to(roomCode).emit("room_updated", room);
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
