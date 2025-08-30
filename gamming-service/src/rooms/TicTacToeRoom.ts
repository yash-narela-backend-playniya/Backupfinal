
import { Room, Client } from "colyseus";
import { TicTacToeState } from "./schema/TicTacToeState";
import { ArraySchema } from "@colyseus/schema";
import KafkaWalletService from "../kafka/walletKafka";
import mongoose from "mongoose";
import MatchOption from "../models/MatchOption.model";
// Add at the top of TicTacToeRoom.ts
(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

export class TicTacToeRoom extends Room<TicTacToeState> {
  maxClients = 2;
  isPrivate: boolean = false;
  allowedUserIds: string[] = [];
  gameTimer: any;
  moveStartTime: number = 0;
  gameStarted: boolean = false;
  private playerUniqueIds: Map<string, string> = new Map();
  private deductedPlayers: Map<string, string> = new Map();

  async onAuth(client: Client, options: any) {
    const { uniqueId, useBonus, userId } = options;

    if (this.metadata?.isPrivate && !this.metadata.allowedUserIds.includes(userId)) {
      throw new Error("❌ You are not allowed to join this private room.");
    }

    try {
      const roomId = this.listing.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
        uniqueId,
        Number(this.state.betAmount),
        useBonus,
        roomId
      );

      console.log(`[onAuth] Wallet response for client ${client.sessionId}:`, walletResponse);
      
      if (!walletResponse.success) {
        throw new Error(walletResponse.message || "Wallet deduction failed.");
      }

      // Store player info for potential refund
      this.playerUniqueIds.set(client.sessionId, uniqueId);
      this.deductedPlayers.set(client.sessionId, uniqueId);
      client.uniqueId = uniqueId;  // Attach for later access

    } catch (err) {
      console.error("Wallet Error:", err);
      throw new Error("Unable to join: Wallet validation failed.");
    }

    return true;
  }

  async onCreate(options: any) {
    this.setSeatReservationTime(3000);
    this.setState(new TicTacToeState());

    const matchOptionId = new mongoose.Types.ObjectId(options.matchOptionId);
    const matchOption = await MatchOption.findById(matchOptionId);
    if (!matchOption) throw new Error("MatchOption not found");

    const numberOfPlayers = options.playerCount || matchOption.numberOfPlayers || 2;
    const isPrivate = options.isPrivate || false;
    const allowedUserIds = options.allowedUserIds || [];

    this.setMetadata({
      playerCount: numberOfPlayers,
      entryFee: options.entryFee || 0,
      isPrivate,
      allowedUserIds,
      createdAt: new Date().toISOString(),
    });

    this.isPrivate = isPrivate;
    this.allowedUserIds = allowedUserIds;
    this.maxClients = numberOfPlayers;

    this.state.betAmount = matchOption.bettingAmount;
    this.state.winAmount = matchOption.winningAmount;
    this.state.matchOptionId = matchOptionId.toString();
    this.state.minPlayer = matchOption.minimumPlayers || 2;

    console.log("Room created with options:", options);

    this.onMessage("makeMove", (client, message) => {
      if (!this.gameStarted) return;
      this.handleMakeMove(client, message.position);
    });

    this.onMessage("restart", () => {
      if (this.state.winner || this.state.isDraw) {
        this.resetGame();
      }
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`[onJoin] Client ${client.sessionId} joined, total clients: ${this.clients.length}`);

    if (this.clients.length === 1) {
      this.state.playerX = client.sessionId;
      this.state.playerXUniqueId = client.uniqueId;
      console.log(`Player X assigned to ${client.sessionId}`);
    } else if (this.clients.length === 2) {
      this.state.playerO = client.sessionId;
      this.state.playerOUniqueId = client.uniqueId;
      this.lock();
      console.log(`Player O assigned to ${client.sessionId}, room locked`);
      this.startGame();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`[onLeave] Client ${client.sessionId} left`);
    
    // Handle refund if game didn't start
    if (!this.gameStarted) {
      const uniqueId = this.deductedPlayers.get(client.sessionId);
      if (uniqueId) {
        console.log(`Refunding ${uniqueId} because game didn't start`);
        await this.refundPlayer(uniqueId);
        this.deductedPlayers.delete(client.sessionId);
      }
    }

    // Handle game win condition
    if (this.gameStarted && !this.state.winner) {
      if (this.state.playerX === client.sessionId && this.state.playerO) {
        this.state.winner = this.state.playerO;
      } else if (this.state.playerO === client.sessionId && this.state.playerX) {
        this.state.winner = this.state.playerX;
      }
      
      if (this.state.winner) {
        console.log(`Player ${this.state.winner} wins by opponent leaving`);
        await this.endGame(this.state.winner);
      }
    }
  }

  async onDispose() {
    console.log("[onDispose] Room disposed");
    
    // Refund all players if game never started
    if (!this.gameStarted) {
      for (const [sessionId, uniqueId] of this.deductedPlayers) {
        console.log(`Refunding ${uniqueId} on room disposal`);
        await this.refundPlayer(uniqueId);
      }
    }
    this.deductedPlayers.clear();
    this.playerUniqueIds.clear();
  }

  startGame() {
    this.state.gameStatus = "in-progress";
    this.gameStarted = true;
    this.state.currentTurn = "X";
    this.state.startTime = Date.now();
    this.state.playerMoveTimes.set(this.state.playerX, 0);
    this.state.playerMoveTimes.set(this.state.playerO, 0);
    this.moveStartTime = Date.now();

    // Notify wallet service game started
    const users = [
      this.state.playerXUniqueId, 
      this.state.playerOUniqueId
    ].filter(Boolean) as string[];
    
    KafkaWalletService.sendGameStartRequest(
      users,
      this.state.betAmount,
      this.state.matchOptionId,
      this.roomId
    );

    console.log("✅ Game started with players:", users);

    this.gameTimer = this.clock.setTimeout(() => {
      console.log("Game timer ended after 3 minutes");
      if (!this.state.winner && !this.state.isDraw) {
        this.resolveDrawByTime();
      }
    }, 180000);
  }

  private async refundPlayer(uniqueId: string) {
    try {
      await KafkaWalletService.sendRefundRequest(
        uniqueId,
        Number(this.state.betAmount),
        this.roomId
      );
      console.log(`✅ Refund successful for ${uniqueId}`);
    } catch (err) {
      console.error("Refund failed:", err);
    }
  }

  private async endGame(winnerSessionId: string) {
    if (this.state.gameStatus === "finished") return;
    this.state.gameStatus = "finished";
    
    const winnerUniqueId = winnerSessionId === this.state.playerX 
      ? this.state.playerXUniqueId 
      : this.state.playerOUniqueId;
    
    const users = [
      this.state.playerXUniqueId, 
      this.state.playerOUniqueId
    ].filter(Boolean) as string[];

    console.log("🏆 Ending game. Winner:", winnerUniqueId);

    await KafkaWalletService.sendGameEndRequest(
      users,
      winnerUniqueId,
      this.state.matchOptionId,
      this.roomId,
      this.state.winAmount
    );

    // Disconnect room after delay
    this.clock.setTimeout(() => this.disconnect(), 10000);
  }

  private resolveDrawByTime() {
    this.state.isDraw = true;
    const xTime = this.state.playerMoveTimes.get(this.state.playerX) || 0;
    const oTime = this.state.playerMoveTimes.get(this.state.playerO) || 0;

    if (xTime < oTime) {
      this.state.winner = this.state.playerX;
    } else if (oTime < xTime) {
      this.state.winner = this.state.playerO;
    } else {
      this.state.winner = [this.state.playerX, this.state.playerO][
        Math.floor(Math.random() * 2)
      ];
    }

    console.log(`Draw resolved by time. Winner: ${this.state.winner}`);
    this.endGame(this.state.winner);
  }

  handleMakeMove(client: Client, position: number) {
    if (this.state.winner || this.state.isDraw) return;
    if (position < 0 || position > 8 || this.state.board[position] !== "") return;

    const playerSymbol = client.sessionId === this.state.playerX ? "X" : "O";
    if (playerSymbol !== this.state.currentTurn) return;

    const timeTaken = Date.now() - this.moveStartTime;
    const currentTotal = this.state.playerMoveTimes.get(client.sessionId) || 0;
    this.state.playerMoveTimes.set(client.sessionId, currentTotal + timeTaken);
    this.moveStartTime = Date.now();

    this.state.board[position] = playerSymbol;
    console.log(`Board updated: position ${position} = ${playerSymbol}`);

    if (this.checkWin(playerSymbol)) {
      this.state.winner = client.sessionId;
      console.log(`Player ${playerSymbol} wins!`);
      this.gameTimer?.clear();
      this.endGame(this.state.winner);
    } else if (this.checkDraw()) {
      this.resolveDrawByTime();
    } else {
      this.state.currentTurn = playerSymbol === "X" ? "O" : "X";
    }
  }

  checkWin(symbol: string): boolean {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    return winPatterns.some((pattern) =>
      pattern.every((index) => this.state.board[index] === symbol)
    );
  }

  checkDraw(): boolean {
    return this.state.board.every((cell) => cell !== "");
  }

  resetGame() {
    console.log("Resetting game");
    this.state.board = new ArraySchema<string>("", "", "", "", "", "", "", "", "");
    this.state.currentTurn = "X";
    this.state.winner = "";
    this.state.isDraw = false;
    this.state.playerMoveTimes.set(this.state.playerX, 0);
    this.state.playerMoveTimes.set(this.state.playerO, 0);
    this.moveStartTime = Date.now();
    this.gameTimer?.clear();
    this.startGame();
  }
}

