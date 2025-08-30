import { Room, Client } from "colyseus";
import { TicTacToeState, Player } from "./schema/TicTacToeV2State";
import { ArraySchema } from "@colyseus/schema";
import KafkaWalletService from "../kafka/walletKafka";
import mongoose from "mongoose";
import { Delayed } from "@colyseus/timer";
import MatchOption from "../models/MatchOption.model";

(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

export class TicTacToeRoom extends Room<TicTacToeState> {
  private gameTimer: any;
  private moveTimers: Map<string, any> = new Map();
  private moveHistory: Map<string, number[]> = new Map();

  private isPrivate: boolean = false;
  private allowedUserIds: string[] = [];
  private playerUniqueIds: Map<string, string> = new Map();
  private deductedPlayers: Map<string, string> = new Map();
  private gameStarted: boolean = false;

  // Game configuration
  private betAmount: number = 0;
  private winAmount: number = 0;
  private matchOptionId: string = "";
  private minPlayer: number = 0;
  private playerCount: number = 0;
  private maxMovesBeforeRemoval = 3;

  async onAuth(client: Client, data: any) {
    const { uniqueId, useBonus, name } = data;

    if (
      this.metadata?.isPrivate &&
      !this.metadata.allowedUserIds.includes(name)
    ) {
      throw new Error("❌ You are not allowed to join this private room.");
    }

    try {
      const roomId = this.listing.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
        uniqueId,
        this.betAmount,
        useBonus,
        roomId
      );

      if (!walletResponse.success) {
        throw new Error(walletResponse.message || "Wallet deduction failed.");
      }

      // Store player info for potential refund
      this.playerUniqueIds.set(client.sessionId, uniqueId);
      this.deductedPlayers.set(client.sessionId, uniqueId);
    } catch (err) {
      console.error("Wallet Error:", err);
      throw new Error("Unable to join: Wallet validation failed.");
    }

    return true;
  }

  async onCreate(data: any) {
    const matchOptionId = new mongoose.Types.ObjectId(data.matchOptionId);
    const matchOption = await MatchOption.findById(matchOptionId);
    if (!matchOption) throw new Error("MatchOption not found");

    const numberOfPlayers =
      data.playerCount || matchOption.numberOfPlayers || 2;
    const isPrivate = data.isPrivate || false;
    const allowedUserIds = data.allowedUserIds || [];

    this.setMetadata({
      playerCount: numberOfPlayers,
      isPrivate,
      allowedUserIds,
      createdAt: new Date().toISOString(),
    });

    this.isPrivate = isPrivate;
    this.allowedUserIds = allowedUserIds;
    this.maxClients = numberOfPlayers;

    this.betAmount = matchOption.bettingAmount;
    this.winAmount = matchOption.winningAmount;
    this.matchOptionId = matchOptionId.toString();
    this.minPlayer = matchOption.minimumPlayers || 2;
    this.playerCount = numberOfPlayers;

    this.setState(new TicTacToeState());
    this.state.gameStatus = "waiting";
    this.state.betAmount = this.betAmount;
    this.state.winAmount = this.winAmount;
    this.state.matchOptionId = this.matchOptionId;
    this.state.minPlayer = this.minPlayer;
    this.state.playerCount = this.playerCount;
    this.state.timePerPlayer = 90; // 90 seconds per player

    this.onMessage("makeMove", (client, message) => {
      if (!this.gameStarted || this.state.gameStatus !== "in-progress") return;
      const position = message?.data?.position ?? message?.position;
      if (typeof position === "number") {
        this.handleMakeMove(client, position);
      }
    });

    this.onMessage("rematch", (client) => {
      if (this.state.gameStatus === "finished") {
        this.rematchVotes.add(client.sessionId);
        if (this.rematchVotes.size === this.state.players.size) {
          this.resetGame();
        }
      }
    });
  }

  onJoin(client: Client, data: any) {
    const player = new Player();
    player.uniqueId = data.uniqueId;
    player.timeRemaining = this.state.timePerPlayer;
    this.state.players.set(client.sessionId, player);
    this.moveHistory.set(client.sessionId, []);
    // Assign symbols
    if (this.state.players.size === 1) {
      this.state.playerX = client.sessionId;
    } else if (this.state.players.size === 2) {
      this.state.playerO = client.sessionId;
    }

    // Start game when both players join
    // if (this.state.players.size === this.maxClients) {
    //   this.startGame();

    // }

    if (this.state.players.size === this.maxClients) {
      this.broadcast("countdown", { message: "Game starting in 3..." });
      this.clock.setTimeout(
        () => this.broadcast("countdown", { message: "2..." }),
        1000
      );
      this.clock.setTimeout(
        () => this.broadcast("countdown", { message: "1..." }),
        2000
      );
      this.clock.setTimeout(
        () => this.broadcast("countdown", { message: "Go!" }),
        3000
      );
      this.clock.setTimeout(() => this.startGame(), 3000);
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);

    // Handle refund if game didn't start
    if (!this.gameStarted) {
      const uniqueId = this.deductedPlayers.get(client.sessionId);
      if (uniqueId) {
        await this.refundPlayer(uniqueId);
        this.deductedPlayers.delete(client.sessionId);
      }
    }

    // Clear player timer
    this.clearPlayerTimer(client.sessionId);

    // Remove player from game
    this.state.players.delete(client.sessionId);
    this.playerUniqueIds.delete(client.sessionId);
    this.moveHistory.delete(client.sessionId);

    // Handle player symbols
    if (this.state.playerX === client.sessionId) {
      this.state.playerX = "";
    }
    if (this.state.playerO === client.sessionId) {
      this.state.playerO = "";
    }

    // End game if not enough players
    if (this.state.players.size < this.minPlayer && this.gameStarted) {
      this.endGame();
    }
  }

  async onDispose() {
    // Refund all players if game never started
    if (!this.gameStarted) {
      for (const [sessionId, uniqueId] of this.deductedPlayers) {
        await this.refundPlayer(uniqueId);
      }
    }
    this.clearAllTimers();
  }

  private startGame() {
    this.gameStarted = true;
    this.state.gameStatus = "in-progress";
    this.state.currentTurn = this.state.playerX;
    this.startPlayerTimer(this.state.currentTurn);

    // Notify wallet service game started
    const users = Array.from(this.playerUniqueIds.values());
    KafkaWalletService.sendGameStartRequest(
      users,
      this.betAmount,
      this.matchOptionId,
      this.roomId
    );

    // Overall game timeout (3 minutes)
    this.gameTimer = this.clock.setTimeout(() => {
      if (this.state.gameStatus === "in-progress") {
        this.endGameByTime();
      }
    }, 3 * 60 * 1000);
  }

  private startPlayerTimer(sessionId: string) {
    // Clear any existing timer for this player
    this.clearPlayerTimer(sessionId);

    const player = this.state.players.get(sessionId);
    if (!player) return;

    // Start new timer
    const timer = this.clock.setInterval(() => {
      player.timeRemaining -= 1;

      if (player.timeRemaining <= 0) {
        this.clearPlayerTimer(sessionId);
        this.handleTimeOut(sessionId);
      }
    }, 1000);

    this.moveTimers.set(sessionId, timer);
  }

  private handleMakeMove(client: Client, position: number) {
    if (client.sessionId !== this.state.currentTurn) return;
    if (position < 0 || position > 8) return;
    if (this.state.board[position] !== 0) return;

    const symbol = client.sessionId === this.state.playerX ? 1 : 2;

    const history = this.moveHistory.get(client.sessionId);
    if (!history) return;

    if (history.length >= 3) {
      const oldestPosition = history.shift();
      if (typeof oldestPosition === "number") {
        this.state.board[oldestPosition] = 0;
      }
    }

    this.state.board[position] = symbol;
    history.push(position);

    if (this.checkWin(symbol)) {
      this.endGame(client.sessionId);
      return;
    }

    const allMoves = [...this.moveHistory.values()].flat();
    if (allMoves.length >= 9) {
      this.state.gameStatus = "finished";
      this.state.winner = "";
      this.clearAllTimers();
      this.clock.setTimeout(() => this.disconnect(), 10000);
      return;
    }

    this.switchTurn();
  }

  private switchTurn() {
    // Clear current player's timer

    this.clearPlayerTimer(this.state.currentTurn);

    // Switch to next player
    this.state.currentTurn =
      this.state.currentTurn === this.state.playerX
        ? this.state.playerO
        : this.state.playerX;

    // Start new player's timer
    this.startPlayerTimer(this.state.currentTurn);
  }

  private handleTimeOut(sessionId: string) {
    const otherPlayer =
      sessionId === this.state.playerX
        ? this.state.playerO
        : this.state.playerX;

    this.endGame(otherPlayer);
  }

  private checkWin(symbol: number): boolean {
    const b = this.state.board;

    const winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    return winPatterns.some((pattern) =>
      pattern.every((index) => b[index] === symbol)
    );
  }

  private checkDraw(): boolean {
    return this.state.board.every((cell) => cell !== "");
  }

  private async endGame(winnerSessionId: string) {
    if (this.state.gameStatus === "finished") return;
    this.state.gameStatus = "finished";
    this.state.winner = winnerSessionId;

    // Clear all timers
    this.clearAllTimers();

    // Notify wallet service
    const users = Array.from(this.playerUniqueIds.values());








    
    const winnerUniqueId = this.playerUniqueIds.get(winnerSessionId);

    if (winnerUniqueId) {
      await KafkaWalletService.sendGameEndRequest(
        users,
        winnerUniqueId,
        this.matchOptionId,
        this.roomId,
        this.winAmount
      );
    }

    // Disconnect room after delay
    this.clock.setTimeout(() => this.disconnect(), 10000);
  }

  private endGameByTime() {
    if (this.state.gameStatus === "finished") return;
    this.state.gameStatus = "finished";

    // Determine winner by time remaining
    let winnerSessionId: string | null = null;
    let maxTime = -1;

    this.state.players.forEach((player, sessionId) => {
      if (player.timeRemaining > maxTime) {
        maxTime = player.timeRemaining;
        winnerSessionId = sessionId;
      }
    });

    if (winnerSessionId) {
      this.state.winner = winnerSessionId;
    } else {
      // Fallback if no time found
      this.state.winner = this.state.playerX;
    }

    // Clear all timers
    this.clearAllTimers();

    // Notify wallet service
    const users = Array.from(this.playerUniqueIds.values());
    const winnerUniqueId = this.playerUniqueIds.get(this.state.winner);

    if (winnerUniqueId) {
      KafkaWalletService.sendGameEndRequest(
        users,
        winnerUniqueId,
        this.matchOptionId,
        this.roomId,
        this.winAmount
      );
    }

    // Disconnect room after delay
    this.clock.setTimeout(() => this.disconnect(), 10000);
  }

  private resetGame() {
    this.state.board = new ArraySchema<number>(0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.state.winner = "";
    this.state.gameStatus = "in-progress";
    this.rematchVotes.clear();

    this.state.players.forEach((player) => {
      player.timeRemaining = this.state.timePerPlayer;
    });

    this.moveHistory.forEach((_, sessionId) => {
      this.moveHistory.set(sessionId, []);
    });

    this.state.currentTurn = this.state.playerX;
    this.startPlayerTimer(this.state.currentTurn);

    this.gameTimer = this.clock.setTimeout(() => {
      if (this.state.gameStatus === "in-progress") {
        this.endGameByTime();
      }
    }, 3 * 60 * 1000);
  }

  private async refundPlayer(uniqueId: string) {
    try {
      await KafkaWalletService.sendGameEndRequest(
        uniqueId,
        this.betAmount,
        this.roomId
      );
    } catch (err) {
      console.error("Refund failed:", err);
    }
  }

  private clearPlayerTimer(sessionId: string) {
    const timer = this.moveTimers.get(sessionId);
    if (timer) {
      timer.clear();
      this.moveTimers.delete(sessionId);
    }
  }

  private clearAllTimers() {
    // Clear player timers
    this.moveTimers.forEach((timer) => timer.clear());
    this.moveTimers.clear();

    // Clear game timer
    if (this.gameTimer) {
      this.gameTimer.clear();
    }
  }
}
