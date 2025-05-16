# Solitary Meme Tower Defense (SMTD)

A tower defense game built on Solana where players can compete in 1v1 matches and stake SOL for rewards.

## Multiplayer Testing Instructions

To test the multiplayer feature with different wallets on one laptop:

### Quick Start (Windows)

1. Run the `start-multiplayer.bat` file to automatically install dependencies and start both servers.
2. Open the frontend URL (typically http://localhost:5173) in two different browser windows. You can use:
   - Regular browser window and incognito/private window
   - Two different browsers (e.g., Chrome and Firefox)
   - Different browser profiles if supported

### Manual Setup

If you're not on Windows or prefer to start servers manually:

1. Install backend dependencies:

   ```
   cd frontend/backend
   npm install
   ```

2. Start the backend server:

   ```
   npm start
   ```

3. In a new terminal, install frontend dependencies:

   ```
   cd frontend
   npm install
   npm install socket.io-client
   ```

4. Start the frontend server:
   ```
   npm run dev
   ```

### Testing Steps

1. Connect Different Wallets:

   - In each browser window, connect a different wallet (e.g., Phantom in one, Solflare in another)
   - You can use the same wallet provider but different accounts

2. Create a Room:

   - In the first window, click "Multiplayer Mode"
   - Select "Create Room"
   - Enter a nickname and stake amount
   - Click "Create Room"
   - Note the 6-digit room code displayed

3. Join the Room:

   - In the second window, click "Multiplayer Mode"
   - Select "Join Room"
   - Enter the same 6-digit room code from the first window
   - Enter a nickname
   - Click "Join Room"

4. Start a Match:

   - In either window, one player can challenge the other
   - The challenged player must accept the challenge
   - A countdown will begin, and the game will start automatically

5. Spectator Testing:
   - Open a third browser window and connect with a third wallet
   - Join the same room code
   - You'll automatically be placed as a spectator
   - You can place bets on players

## Features

- Real-time 1v1 multiplayer with Socket.io
- Room creation and joining with 6-digit codes
- Spectator mode with betting
- Challenge system
- Live opponent status display
- Support for multiple wallets testing on one machine

## Project Structure

The project is organized as follows:

- `frontend/` - Contains the main React application
  - `backend/` - Contains the Socket.io server for multiplayer functionality
  - `src/` - React source code
    - `components/` - Game components
    - `utils/` - Utility functions including socketService.ts

## Implementation Details

- Frontend: React, Vite, Three.js
- Backend: Node.js, Express, Socket.io
- Blockchain: Solana with AppKit

Note: For this demo, the SOL staking functionality is simulated. In a production environment, this would involve real blockchain transactions.

## Environment Setup

This project requires a Solana private key for treasury operations. For security reasons, the key is not included in the repository.

### Setting up the Treasury Key

1. Create a `.env` file in the `frontend/backend` directory with:

   ```
   TREASURY_SECRET_KEY="your_solana_private_key_here"
   ```

2. Alternatively, set the environment variable directly in your terminal:
   - Windows: `set TREASURY_SECRET_KEY=your_private_key_here`
   - Linux/Mac: `export TREASURY_SECRET_KEY=your_private_key_here`

For more detailed security guidelines, refer to the [SECURITY.md](SECURITY.md) file.
