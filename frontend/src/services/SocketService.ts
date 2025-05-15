import { io, Socket } from "socket.io-client";

export class SocketService {
  private socket: Socket;

  constructor() {
    this.socket = io("http://localhost:3001");
  }

  createRoom(data: {
    roomCode: string;
    nickname: string;
    address: string;
    stakeAmount: number;
  }) {
    this.socket.emit("create_room", data);
  }

  joinRoom(data: { roomCode: string; nickname: string; address: string }) {
    this.socket.emit("join_room", data);
  }

  checkRoom(roomCode: string): Promise<{
    exists: boolean;
    stakeAmount?: number;
    players?: number;
  }> {
    return new Promise((resolve) => {
      this.socket.emit("check_room", { roomCode }, (response: any) => {
        resolve(response);
      });
    });
  }

  sendChallenge(data: {
    roomCode: string;
    challengerAddress: string;
    challengedAddress: string;
  }) {
    this.socket.emit("send_challenge", data);
  }

  acceptChallenge(roomCode: string) {
    this.socket.emit("accept_challenge", { roomCode });
  }

  onRoomCreated(callback: (room: any) => void) {
    this.socket.on("room_created", callback);
  }

  onRoomJoined(callback: (room: any) => void) {
    this.socket.on("room_joined", callback);
  }

  onRoomUpdated(callback: (room: any) => void) {
    this.socket.on("room_updated", callback);
  }

  onRoomError(callback: (error: { message: string }) => void) {
    this.socket.on("room_error", callback);
  }

  onChallengeSent(callback: (data: any) => void) {
    this.socket.on("challenge_sent", callback);
  }

  onChallengeAccepted(callback: (data: any) => void) {
    this.socket.on("challenge_accepted", callback);
  }

  onMatchStarted(callback: (data: any) => void) {
    this.socket.on("match_started", callback);
  }

  onGameOver(callback: (data: any) => void) {
    this.socket.on("game_over", callback);
  }

  onWinnerRewarded(callback: (data: any) => void) {
    this.socket.on("winner_rewarded", callback);
  }

  disconnect() {
    this.socket.disconnect();
  }
}
