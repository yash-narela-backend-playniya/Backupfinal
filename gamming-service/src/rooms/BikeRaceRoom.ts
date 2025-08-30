import { Room, Client } from "colyseus";
import { BikeRaceState, Player } from "./schema/BikeRaceState";
import { KafkaWalletService } from "../kafka/walletKafka";
import MatchOption from "../models/MatchOption.model";
import mongoose from "mongoose";

export class BikeRaceRoom extends Room<BikeRaceState> {
  maxClients = 4;
  private gameLoop: any = null;
  private timerLoop: any = null;
  allowedUserIds: string[] = [];
  isPrivate: boolean = false;
  everyoneJoined: boolean = false;
  betAmount: number = 0;
  winAmount: number = 0;
  matchOptionId: string = "";
  minPlayers: number = 2;
  inactivityTimer: any = null;
  rematchVotes: Set<string> = new Set();

  async onAuth(client: Client, options: any): Promise<any> {
    const userId = options.userId;
    const uniqueId = options.uniqueId;
    const isPrivate = this.metadata?.isPrivate || false;
    const allowedUserIds = this.metadata?.allowedUserIds || [];
    const useBonus = options.useBonus;

    if (isPrivate && !allowedUserIds.includes(userId)) {
      throw new Error("You are not allowed to join this private room.");
    }

    const existingPlayer = Array.from(this.state.players.values()).find(
      (p) => p.uniqueId === uniqueId
    );

    if (existingPlayer) {
      (client as any).isReconnecting = true;
      (client as any).reconnectUniqueId = uniqueId;
      return true;
    }

    const isGameInProgress = this.state.phase === "playing";
    if ((this.state.everyoneJoined || isGameInProgress) && !existingPlayer) {
      throw new Error("Room is full or game already in progress.");
    }

    try {
      const roomId = this.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
        uniqueId, 
        this.betAmount, 
        useBonus, 
        roomId
      );
      
      if (!walletResponse.success) {
        throw new Error(walletResponse.message || "Wallet deduction failed.");
      }
    } catch (err) {
      console.error("Wallet Error:", err);
      throw new Error("Unable to join: Wallet validation failed.");
    }

    return true;
  }

  async onCreate(options: any) {
    const matchOptionId = new mongoose.Types.ObjectId(options.matchOptionId);
    const matchOption = await MatchOption.findById(matchOptionId);

    if (!matchOption) {
      throw new Error("MatchOption not found");
    }

    const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } = matchOption;

    this.maxClients = numberOfPlayers;
    this.minPlayers = minimumPlayers;
    this.betAmount = bettingAmount;
    this.winAmount = winningAmount;

    this.setMetadata({
      playerCount: numberOfPlayers,
      isPrivate: options.isPrivate || false,
      allowedUserIds: options.allowedUserIds || [],
    });

    this.setState(new BikeRaceState());
    this.state.phase = "waiting";
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = options.matchOptionId;
    this.state.minPlayers = minimumPlayers;
    this.isPrivate = options.isPrivate || false;
    this.allowedUserIds = options.allowedUserIds || [];

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "playing") return;
      
      if (data.direction === "left" && player.lane > 0) player.lane--;
      if (data.direction === "right" && player.lane < 2) player.lane++;
    });

    this.onMessage("accelerate", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "playing") return;
      player.speed = Math.min(player.speed + 1, 10);
    });

    this.onMessage("brake", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase !== "playing") return;
      player.speed = Math.max(player.speed - 1, 0);
    });

    this.onMessage("join_game", (client, message) => {
      const existingPlayer = this.state.players.get(client.sessionId);
    
      if (this.state.players.size >= this.maxClients) {
        client.send("error", { message: "The room is full." });
        return;
      }
     
      if (!existingPlayer) {
        const player = new Player();
        player.sessionId = client.sessionId;
        player.name = message.name || `Player_${client.sessionId.substring(0, 4)}`;
        player.uniqueId = message.uniqueId || client.sessionId;
        player.matchOptionId = message.matchOptionId || "default";
        this.state.players.set(client.sessionId, player);
      }
    
      if (this.state.players.size >= this.minPlayers && this.state.phase === "waiting") {
        this.startGame();
      }
    });

    this.onMessage("rematch_request", (client) => {
      this.rematchVotes.add(client.sessionId);
      if (this.rematchVotes.size === this.state.players.size) {
        this.resetGame();
      }
    });

    console.log("🚀 BikeRaceRoom created");
  }

  onJoin(client: Client, options: any) {
    const uniqueId = options.uniqueId;
    const playerName = options.name;
  
    if ((client as any).isReconnecting && (client as any).reconnectUniqueId) {
      const reconnectingId = (client as any).reconnectUniqueId;
  
      const oldPlayerEntry = Array.from(this.state.players.entries()).find(
        ([_, player]) => player.uniqueId === reconnectingId
      );
  
      if (oldPlayerEntry) {
        const [oldSessionId, oldPlayer] = oldPlayerEntry;
        this.state.players.delete(oldSessionId);
        this.state.players.set(client.sessionId, oldPlayer);
        console.log(`✅ Player reconnected: ${oldPlayer.name} (uniqueId: ${oldPlayer.uniqueId})`);
        return;
      }
    }
  
    console.log(`🆕 New client connected: ${playerName} (uniqueId: ${uniqueId})`);
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.phase === "ended") {
      this.state.players.delete(client.sessionId);
      return;
    }
  
    const player = this.state.players.get(client.sessionId);
    if (player) {
      this.broadcast("info", { message: `${player.name} disconnected.` });
      this.state.players.delete(client.sessionId);
    }
    
    if (this.state.players.size < this.minPlayers && this.state.phase === "playing") {
      this.endGame("Game ended due to insufficient players");
    }
  }

  private startGame() {
    this.state.phase = "playing";
    this.state.remainingTime = 180;
    this.state.everyoneJoined = true;
    
    // Start wallet transaction
    const users = Array.from(this.state.players.values()).map(p => p.uniqueId);
    KafkaWalletService.sendGameStartRequest(
      users, 
      this.betAmount, 
      "bike-race", 
      this.roomId
    );

    this.timerLoop = this.clock.setInterval(() => {
      this.state.remainingTime--;
      this.broadcast("timer", { time: this.state.remainingTime });
      if (this.state.remainingTime <= 0) {
        this.endGame("Time's up!");
      }
    }, 1000);

    this.gameLoop = this.clock.setInterval(() => {
      this.state.players.forEach((player) => {
        if (player.speed > 0) {
          player.distance += player.speed;
          player.score += Math.floor(player.speed / 2);
        }
      });
    }, 100);
  }

  private endGame(reason: string) {
    this.state.phase = "ended";
    this.timerLoop?.clear();
    this.gameLoop?.clear();
    if (this.inactivityTimer) this.inactivityTimer.clear();

    // Determine winner
    const rankings = Array.from(this.state.players.values()).sort(
      (a, b) => b.score - a.score
    );

    this.state.winner = rankings[0]?.sessionId || "";

    this.broadcast("gameEnd", {
      reason,
      winnerId: this.state.winner,
      rankings: rankings.map((p) => ({
        sessionId: p.sessionId,
        name: p.name,
        score: p.score,
        distance: p.distance,
      })),
    });

    // Process wallet transactions
    const winner = this.state.players.get(this.state.winner);
    const users = Array.from(this.state.players.values()).map(p => p.uniqueId);
    
    if (winner) {
      KafkaWalletService.sendGameEndRequest(
        users,
        winner.uniqueId,
        "bike-race",
        this.roomId,
        this.winAmount
      );
    }

    this.clock.setTimeout(() => this.disconnect(), 30000);
  }

  private resetGame() {
    this.state.phase = "waiting";
    this.state.remainingTime = 180;
    this.state.players.forEach(player => {
      player.lane = 1;
      player.speed = 0;
      player.distance = 0;
      player.score = 0;
    });
    this.rematchVotes.clear();
    this.state.winner = "";
  }

  private clearTimers() {
    if (this.timerLoop) this.timerLoop.clear();
    if (this.gameLoop) this.gameLoop.clear();
    if (this.inactivityTimer) this.inactivityTimer.clear();
    
    this.timerLoop = null;
    this.gameLoop = null;
    this.inactivityTimer = null;
  }
}