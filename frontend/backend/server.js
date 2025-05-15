const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const web3 = require("@solana/web3.js");
const anchor = require("@project-serum/anchor");
const fs = require("fs");
const path = require("path");
const bs58 = require("bs58");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins in development
    methods: ["GET", "POST"],
  },
});

// Solana program constants
const PROGRAM_ID = "EhWxGGbjAm1ir5DsoothYsHuRqQqpZ15AxZqbJ9y8exy";
const SHARD_TOKEN_ADDRESS = "B3G9uhi7euWErYvwfTye2MpDJytkYX6mAgUhErHbnSoT";
const TREASURY_ADDRESS = "9yqmoJ4ekXvTPQDCj7zQS36ar2fMb1fTx1FA2xovfZjR";
const MINT_AUTHORITY_SEED = "mint-authority";
const SHARDS_PER_SOL = 3000;
const WINNER_PAYOUT_PERCENTAGE = 95; // Winner gets 95% of the pool

// Load the IDL from file
const idlFile = path.join(__dirname, "../../idl.json");
const idlContent = fs.readFileSync(idlFile, "utf8");
const idl = JSON.parse(idlContent);

// Store active rooms
const rooms = new Map();

// Setup Solana connection
const connection = new web3.Connection(web3.clusterApiUrl("devnet"));

// Create treasury keypair
let payer;
try {
  const treasurySecretKey =
    "5Tk3LG8dWKL4Xpj8DaAi68muebuh5iAgC7u2puQfzcBpe1kM4xDrV8TMvji2e3qPEaV4bcyRsQWGo7JnaGZjEXD";
  const secretKey = bs58.decode(treasurySecretKey);
  payer = web3.Keypair.fromSecretKey(secretKey);

  console.log("Treasury public key:", payer.publicKey.toString());
  if (payer.publicKey.toString() !== TREASURY_ADDRESS) {
    console.warn(
      "Warning: Treasury keypair public key does not match expected address"
    );
    console.warn("Expected:", TREASURY_ADDRESS);
    console.warn("Got:", payer.publicKey.toString());
  }
} catch (err) {
  console.error("Failed to load treasury keypair:", err);
  payer = web3.Keypair.generate(); // Fallback for testing
  console.warn(
    "Using generated keypair for testing:",
    payer.publicKey.toString()
  );
}

// Create an anchor provider and program
const provider = new anchor.AnchorProvider(
  connection,
  {
    publicKey: payer.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(payer);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map((tx) => {
        tx.partialSign(payer);
        return tx;
      });
    },
  },
  { commitment: "processed" }
);

const program = new anchor.Program(
  idl,
  new web3.PublicKey(PROGRAM_ID),
  provider
);

// Function to mint tokens to a winner
async function mintTokensToWinner(winnerAddress, amount) {
  try {
    console.log(`Minting ${amount} tokens to winner ${winnerAddress}`);

    const winnerPublicKey = new web3.PublicKey(winnerAddress);
    const mintPublicKey = new web3.PublicKey(SHARD_TOKEN_ADDRESS);

    // Find the PDA for mint authority
    const [mintAuthorityPDA] = await web3.PublicKey.findProgramAddress(
      [Buffer.from(MINT_AUTHORITY_SEED), mintPublicKey.toBuffer()],
      new web3.PublicKey(PROGRAM_ID)
    );

    // Calculate token amount (3000 tokens per SOL)
    const tokenAmount = Math.floor(amount * SHARDS_PER_SOL);

    // Get or create the associated token account for the winner
    const associatedTokenAddress = await anchor.utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: winnerPublicKey,
    });

    // Check if the associated token account exists
    let tokenAccount;
    try {
      tokenAccount = await connection.getAccountInfo(associatedTokenAddress);
    } catch (error) {
      console.error("Error checking token account:", error);
    }

    // If token account doesn't exist, create it
    if (!tokenAccount) {
      console.log("Creating token account for winner");
      const createATAIx =
        anchor.utils.token.createAssociatedTokenAccountInstruction(
          payer.publicKey,
          associatedTokenAddress,
          winnerPublicKey,
          mintPublicKey
        );

      const tx = new web3.Transaction().add(createATAIx);
      const signature = await web3.sendAndConfirmTransaction(connection, tx, [
        payer,
      ]);
      console.log("Created token account:", signature);
    }

    // Create the mint instruction with PDA as signer
    const txn = await program.methods
      .mintTokens(new anchor.BN(tokenAmount))
      .accounts({
        mintAuthority: mintAuthorityPDA,
        recipient: winnerPublicKey,
        tokenMint: mintPublicKey,
        recipientTokenAccount: associatedTokenAddress,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    console.log(
      `Successfully minted ${tokenAmount} tokens to ${winnerAddress}`
    );
    console.log("Transaction signature:", txn);

    return {
      success: true,
      amount: tokenAmount,
      txId: txn,
    };
  } catch (error) {
    console.error("Error minting tokens:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

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

  // Add check_room event handler
  socket.on("check_room", (data, callback) => {
    const { roomCode } = data;

    if (rooms.has(roomCode)) {
      const room = rooms.get(roomCode);
      callback({
        exists: true,
        stakeAmount: room.stakeAmount,
        players: room.players.length,
      });
    } else {
      callback({ exists: false });
    }
  });

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

    // Calculate reward for the winner (95% of the total stake pool)
    const totalStake = room.players.reduce(
      (sum, player) => sum + player.stakeAmount,
      0
    );
    const winnerRewardLamports = Math.floor(
      (totalStake * WINNER_PAYOUT_PERCENTAGE) / 100
    );
    const winnerRewardSOL = winnerRewardLamports / web3.LAMPORTS_PER_SOL;

    console.log(
      `Winner will receive ${winnerRewardSOL} SOL worth of tokens (${winnerRewardLamports} lamports)`
    );

    // Mint tokens to the winner
    mintTokensToWinner(winner, winnerRewardSOL)
      .then((result) => {
        if (result.success) {
          // Notify all clients about the token reward
          io.to(roomCode).emit("winner_rewarded", {
            winner,
            roomCode,
            amount: result.amount,
            txId: result.txId,
          });

          console.log(
            `Successfully rewarded winner ${winner} with ${result.amount} tokens`
          );

          // Update room results with reward info
          if (room.gameResults) {
            room.gameResults.tokenReward = {
              amount: result.amount,
              txId: result.txId,
            };
          }

          // Broadcast updated room data with reward information
          io.to(roomCode).emit("room_updated", room);
        } else {
          console.error(`Failed to reward winner: ${result.error}`);
        }
      })
      .catch((err) => {
        console.error("Error in reward process:", err);
      });

    // Emit game_over event to the entire room
    io.to(roomCode).emit("game_over", {
      winner,
      loser,
      winnerNickname,
      draw: false,
      rewardAmount: winnerRewardSOL * SHARDS_PER_SOL,
    });
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
