import { Room, Client } from "colyseus";
import { GameState, PlayerState, BallState } from "./schema/ArcadeBasketballlState";
import { GameEngine } from "./ArcadeBasketGameEngine";
import  KafkaWalletService  from "../kafka/walletKafka";
import MatchOption from "../models/MatchOption.model";
import mongoose from "mongoose";

export class ArcadeBasketballRoom extends Room<GameState> {
  maxClients: number = 4;
  engine: GameEngine;
  gameLoop: any;
  basketLoop: any;
  shotClock: any;
  private canShoot = true;
  private rematchVotes: Set<string> = new Set();
  private inactivityTimer: any = null;
  private gameTimeout: any = null;
  private betAmount: number = 0;
  private winAmount: number = 0;
  private matchOptionId: string = "";
  private minPlayers: number = 2;

  async onAuth(client: Client, options: any): Promise<any> {
    const userId = options.userId;
    const uniqueId = options.uniqueId;
    const isPrivate = this.metadata?.isPrivate || false;
    const allowedUserIds = this.metadata?.allowedUserIds || [];
    const useBonus = options.useBonus;

    if (isPrivate && !allowedUserIds.includes(userId)) {
      throw new Error("You are not allowed to join this private room.");
    }

    if (this.state.phase === "playing" || this.state.phase === "ended") {
      throw new Error("Game is already in progress or ended");
    }

    try {
      const roomId = this.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
        uniqueId, 
        Number(this.betAmount), 
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

    this.setState(new GameState());
    this.engine = new GameEngine();
    
    this.state.phase = "waiting";
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = options.matchOptionId;
    this.state.minPlayers = minimumPlayers;
    this.state.basketX = 400;
    this.state.basketDirection = 1;

    this.onMessage("shoot", (client, message) => this.handleShot(client, message));
    this.onMessage("move", (client, message) => this.handleMove(client, message));
    this.onMessage("autoShoot", (client) => this.autoAlignAndShoot(client));
    this.onMessage("rematch_request", (client) => this.handleRematch(client));

    console.log("Basketball room created:", this.roomId);
  }

  async onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = options.name || `Player_${client.sessionId.substr(0, 4)}`;
    player.uniqueId = options.uniqueId;
    player.xPosition = 400;
    player.score = 0;

    this.state.players.set(client.sessionId, player);

    if (this.state.players.size >= this.minPlayers && this.state.phase === "waiting") {
      this.startGame();
    }
  }

  onLeave(client: Client, consented: boolean) {
    if (this.state.phase === "ended") {
      this.state.players.delete(client.sessionId);
      return;
    }

    this.state.players.delete(client.sessionId);
    
    if (this.state.players.size < this.minPlayers && this.state.phase === "playing") {
      this.endGame("Game ended due to insufficient players");
    }
  }

  startGame() {
    this.state.phase = "playing";
    this.state.remainingTime = 180;
    this.state.players.forEach(player => player.score = 0);
    
    this.basketLoop = this.clock.setInterval(() => {
      const speed = 5;
      const left = 100; 
      const right = 700;

      this.state.basketX += this.state.basketDirection * speed; 

      if (this.state.basketX >= right) {    
        this.state.basketX = right;
        this.state.basketDirection = -1;
      } else if (this.state.basketX <= left) {
        this.state.basketX = left;
        this.state.basketDirection = 1;
      }
    }, 50);

    this.gameLoop = this.clock.setInterval(() => {
      this.state.remainingTime -= 1;
      if (this.state.remainingTime <= 0) {
        this.endGame("Time's up!");
      }
    }, 1000);

    this.shotClock = this.clock.setInterval(() => this.updatePhysics(), 16);
    
    // Start wallet transaction
    const users = Array.from(this.state.players.values()).map(p => p.uniqueId);
    KafkaWalletService.sendGameStartRequest(
      users, 
      this.betAmount, 
      "basketball-room", 
      this.roomId
    );
  }

private handleShot(client: Client, message: any) {
  if (this.state.phase !== "playing") return;
  if (!this.canShoot) return;

  const player = this.state.players.get(client.sessionId);
  if (!player || this.engine.getBallState().isActive) return;

  const angle = parseFloat(message.angle);
  const power = parseFloat(message.power);
  // const targetX = this.state.basketX; // 👈 aim at basket’s current position

    if (this.engine.startShot(angle, power, player.xPosition, client.sessionId)) {
      this.canShoot = false;
      this.broadcast("shotTaken", { playerId: client.sessionId, angle, power });
    }
}


  private handleMove(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId);
    if (player && message.x !== undefined) {
      player.xPosition = message.x;
      this.broadcast("playerMoved", { playerId: client.sessionId, x: player.xPosition });
    }
  } 


  private autoAlignAndShoot(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "playing" || !this.canShoot) return;

    player.xPosition = this.state.basketX;
    this.broadcast("playerMoved", { playerId: client.sessionId, x: player.xPosition });

    this.handleShot(client, { angle: 50, power: 8 });
  }

  private updatePhysics() {
    const ballState = this.engine.getBallState();
    if (!ballState.isActive) {
      if (this.state.ball.visible) {
        this.state.ball.visible = false;
        this.canShoot = true;
        this.broadcast("shotReset");
      }
      return;
    }

    const update = this.engine.update(this.state.basketX);
    if (!update) return;

    this.state.ball.x = update.position.x;
    this.state.ball.y = update.position.y;
    this.state.ball.visible = true;

    if (update.scored) {
      const scoringPlayer = this.findLastShooter();





      if (scoringPlayer) {
        scoringPlayer.score += update.points;
        this.broadcast("scoreUpdate", {
          playerId: scoringPlayer.sessionId,
          points: update.points,
          totalScore: scoringPlayer.score
        });
      }
    }

    if (update.reset) {
      this.state.ball.visible = false;
      this.canShoot = true;
      this.broadcast("shotReset");
    }
  }

  endGame(reason: string) {
    this.state.phase = "ended";
    this.clearTimers();
    this.determineWinner();
    
    this.broadcast("gameEnd", {
      reason,
      winnerId: this.state.winner,
      scores: Array.from(this.state.players.values()).map(p => ({
        sessionId: p.sessionId,
        name: p.name,
        score: p.score,
      })),
    });

    // Process wallet transactions
    const winner = this.state.players.get(this.state.winner);
    const users = Array.from(this.state.players.values()).map(p => p.uniqueId);
    
    if (winner) {
      KafkaWalletService.sendGameEndRequest(
        users,
        winner.uniqueId,
        "basketball-room",
        this.roomId,
        this.winAmount
      );
    }

    this.clock.setTimeout(() => this.disconnect(), 30000);
  }

  private determineWinner() {
    let highestScore = -1;
    let winnerId = "";

    this.state.players.forEach(player => {
      if (player.score > highestScore) {
        highestScore = player.score;
        winnerId = player.sessionId;
      }
    });

    this.state.winner = winnerId;
  }

  private handleRematch(client: Client) {
    this.rematchVotes.add(client.sessionId);
    if (this.rematchVotes.size === this.state.players.size) {
      this.resetGame();
    }
  }

  private resetGame() {
    this.state.phase = "waiting";
    this.state.players.forEach(player => player.score = 0);
    this.state.basketX = 400;
    this.state.basketDirection = 1;
    this.rematchVotes.clear();
    this.canShoot = true;
    this.engine = new GameEngine();
    this.state.ball = new BallState();
  }

  private clearTimers() {
    if (this.basketLoop) this.basketLoop.clear();
    if (this.gameLoop) this.gameLoop.clear();
    if (this.shotClock) this.shotClock.clear();
    if (this.inactivityTimer) this.inactivityTimer.clear();
    if (this.gameTimeout) this.gameTimeout.clear();
    
    this.basketLoop = null;
    this.gameLoop = null;
    this.shotClock = null;
    this.inactivityTimer = null;
    this.gameTimeout = null;
  }

  private findLastShooter(): PlayerState | undefined {
    const lastShooterId = this.engine.getLastShooterId();
    return lastShooterId ? this.state.players.get(lastShooterId) : undefined;
  }
}