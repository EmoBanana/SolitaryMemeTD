import { io, Socket } from "socket.io-client";

// Backend server URL - this stays the same as the backend will run on port 3001
const SOCKET_URL = "http://localhost:3001";

class SocketService {
  private socket: Socket | null = null;
  private listeners: { [event: string]: Function[] } = {};

  // Connect to socket server
  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL);
    this.setupListeners();
    return this.socket;
  }

  // Disconnect from socket server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Setup default listeners
  private setupListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("Connected to socket server");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
  }

  // Register event listener
  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    if (this.socket) {
      this.socket.on(event, (...args) => {
        callback(...args);
      });
    }
  }

  // Remove event listener
  off(event: string, callback?: Function) {
    if (!this.socket) return;

    if (callback && this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    } else {
      delete this.listeners[event];
    }

    this.socket.off(event);
  }

  // Emit event to server
  emit(event: string, data: any, callback?: Function) {
    if (!this.socket) {
      this.connect();
    }

    if (this.socket) {
      if (callback) {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    }
  }

  // Create a room
  createRoom(data: {
    roomCode: string;
    nickname: string;
    address: string;
    stakeAmount: number;
  }) {
    this.emit("create_room", data);
  }

  // Join a room
  joinRoom(data: { roomCode: string; nickname: string; address: string }) {
    this.emit("join_room", data);
  }

  // Leave a room
  leaveRoom(roomCode: string) {
    this.emit("leave_room", { roomCode });
  }

  // Send challenge
  sendChallenge(data: {
    roomCode: string;
    challengerAddress: string;
    challengedAddress: string;
  }) {
    this.emit("send_challenge", data);
  }

  // Accept challenge
  acceptChallenge(roomCode: string) {
    this.emit("accept_challenge", { roomCode });
  }

  // Send game state update
  updateGameState(roomCode: string, gameState: any) {
    this.emit("game_state_update", { roomCode, gameState });
  }

  // Place a bet
  placeBet(data: { roomCode: string; playerAddress: string; amount: number }) {
    this.emit("place_bet", data);
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;
