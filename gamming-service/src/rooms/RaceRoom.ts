import { Room, Client } from "colyseus";
import { PlayerSchema, GameState, ObstacleSchema } from "./schema/RaceRoomState";
import {
  GAME_DURATION,
  COUNTDOWN_DURATION,
  RESPAWN_TIME,
  BASE_SPEED,
  SPEED_INCREMENT,
  MAX_SPEED,
  ACCELERATION,
  OBSTACLE_SPAWN_INTERVAL,
} from "./schema/RaceRoomState";
import KafkaWalletService from "../kafka/walletKafka";
import mongoose from "mongoose";
import MatchOption from "../models/MatchOption.model";


(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

export class RaceRoom extends Room<GameState> {
  private fixedObstaclePattern: number[] = [];
  private patternIndex: number = 0;
  private lastCountdownSecond: number = -1;
  private gameStartTimeout: NodeJS.Timeout | null = null;
  private playerUniqueIds: Map<string, string> = new Map();
  private deductedPlayers: Map<string, string> = new Map();
  private gameStarted: boolean = false;
  private betAmount: number = 0;
  private winAmount: number = 0;
  private matchOptionId: string = "";
  private minPlayers: number = 2;
  private rematchVotes: Set<string> = new Set();

  async onAuth(client: Client, options: any) {
    const { uniqueId, useBonus } = options;

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

    
      this.playerUniqueIds.set(client.sessionId, uniqueId);
      this.deductedPlayers.set(client.sessionId, uniqueId);
      return true;
    } catch (err) {
      console.error("Wallet Error:", err);
      throw new Error("Unable to join: Wallet validation failed.");
    }
  }

  async onCreate(options: any) {
    const matchOptionId = new mongoose.Types.ObjectId(options.matchOptionId);
    const matchOption = await MatchOption.findById(matchOptionId);
    if (!matchOption) throw new Error("MatchOption not found");

    this.betAmount = matchOption.bettingAmount;
    this.winAmount = matchOption.winningAmount;
    this.matchOptionId = matchOptionId.toString();
    this.minPlayers = matchOption.minimumPlayers || 2;

    this.setState(new GameState());
    this.state.gamePhase = "waiting";
    this.state.betAmount = this.betAmount;
    this.state.winAmount = this.winAmount;
    this.state.minPlayers = this.minPlayers;

    this.setMetadata({
      betAmount: this.betAmount,
      winAmount: this.winAmount,
      minPlayers: this.minPlayers,
      createdAt: new Date().toISOString()
    });

    this.generateFixedPattern();
    this.setupTimers();
    this.setupMessageHandlers();
  }

  private generateFixedPattern() {
    for (let i = 0; i < 100; i++) {
      this.fixedObstaclePattern.push(Math.floor(Math.random() * 3));
    }
  }

  private setupTimers() {
    this.setSimulationInterval((delta) => this.updateGame(delta / 1000));
  }

  private setupMessageHandlers() {
    this.onMessage("accelerate", (client, isAccelerating) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isRespawning) {
        player.isAccelerating = isAccelerating;
      }
    });

    this.onMessage("move", (client, direction: "left" | "right") => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isRespawning) return;

      if (direction === "left") {
        player.lane = Math.max(0, player.lane - 1);
      } else {
        player.lane = Math.min(2, player.lane + 1);
      }
    });

    this.onMessage("rematch", (client) => {
      if (this.state.gamePhase === "finished") {
        this.rematchVotes.add(client.sessionId);
        if (this.rematchVotes.size === this.state.players.size) {
          this.resetGame();
        }
      }
    });
  }

  async onJoin(client: Client, options: any) {
    this.state.players.set(
      client.sessionId,
      new PlayerSchema(client.sessionId)
    );

    this.broadcast("player_joined", {
      count: this.state.players.size
    });

 
    if (this.state.players.size >= this.minPlayers) {
      if (this.gameStartTimeout) clearTimeout(this.gameStartTimeout);
      this.gameStartTimeout = setTimeout(() => this.startGame(), 3000);
    }
  }

  async onLeave(client: Client, consented: boolean) {
    
    if (!this.gameStarted) {
      const uniqueId = this.deductedPlayers.get(client.sessionId);
      if (uniqueId) {
        await this.refundPlayer(uniqueId);
        this.deductedPlayers.delete(client.sessionId);
      }
    }

    this.state.players.delete(client.sessionId);
    this.playerUniqueIds.delete(client.sessionId);
    
    if (this.state.gamePhase === "waiting" && this.state.players.size < this.minPlayers) {
      if (this.gameStartTimeout) {
        clearTimeout(this.gameStartTimeout);
        this.gameStartTimeout = null;
      }
      this.broadcast("waiting_for_players");
    }
  }

  async onDispose() {

    if (!this.gameStarted) {
      for (const [sessionId, uniqueId] of this.deductedPlayers) {
        await this.refundPlayer(uniqueId);
      }
    }
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

  private startGame() {
    this.gameStarted = true;
    this.state.gamePhase = "countdown";
    this.state.countdownTimer = COUNTDOWN_DURATION;
    
    // Initialize player states
    this.state.players.forEach(player => {
      player.speed = BASE_SPEED;
      player.lane = 1;
      player.score = 0;
      player.respawnCount = 0;
      player.isRespawning = false;
    });
    
    // Notify wallet service game started
    const users = Array.from(this.playerUniqueIds.values());
    KafkaWalletService.sendGameStartRequest(
      users,
      this.betAmount,
      this.matchOptionId,
      this.roomId
    );
  }

  private resetGame() {
    this.rematchVotes.clear();
    this.state.players.forEach(player => {
      player.score = 0;
      player.respawnCount = 0;
      player.lane = 1;
      player.isRespawning = false;
      player.speed = BASE_SPEED;
    });
    this.state.obstacles.clear();
    this.state.nextObstacleId = 1;
    this.patternIndex = 0;
    this.startGame();
  }

  updateGame(deltaTime: number) {
    switch (this.state.gamePhase) {
      case "countdown":
        this.updateCountdown(deltaTime);
        break;
      case "racing":
        this.updateRacing(deltaTime);
        break;
      case "finished":
        break;
    }
  }

  updateCountdown(deltaTime: number) {
    this.state.countdownTimer -= deltaTime;

    const currentSecond = Math.ceil(this.state.countdownTimer);

    if (currentSecond !== this.lastCountdownSecond && currentSecond > 0) {
      this.lastCountdownSecond = currentSecond;
      this.broadcast("countdown", currentSecond);
    }

    if (this.state.countdownTimer <= 0) {
      this.state.gamePhase = "racing";
      this.state.gameTimer = GAME_DURATION;
      this.broadcast("countdown", "Go!");
    }
  }

  updateRacing(deltaTime: number) {
    this.state.gameTimer -= deltaTime;
    if (this.state.gameTimer <= 0) {
      this.endGame();
      return;
    }

    this.state.gameSpeed = Math.min(
      BASE_SPEED + (GAME_DURATION - this.state.gameTimer) * SPEED_INCREMENT,
      MAX_SPEED
    );

    this.state.obstacleSpawnTimer += deltaTime;
    if (this.state.obstacleSpawnTimer >= OBSTACLE_SPAWN_INTERVAL) {
      this.spawnObstacle();
      this.state.obstacleSpawnTimer = 0;
    }

    this.updateObstacles(deltaTime);

    this.state.players.forEach((player) => {
      if (player.finished) return;
    
      this.updatePlayerPhysics(player, deltaTime);
   
      if (!player.isRespawning) {
        this.checkCollisions(player);
        this.checkPassedObstacles(player);
      } else {
        this.updateRespawn(player, deltaTime);
      }
    });
  }

  spawnObstacle() {
    const lane = this.fixedObstaclePattern[this.patternIndex];
    this.state.obstacles.push(
      new ObstacleSchema(
        this.state.nextObstacleId++,
        lane,
        0 // Start at top
      )
    );

    this.patternIndex =
      (this.patternIndex + 1) % this.fixedObstaclePattern.length;
  }

  updateObstacles(deltaTime: number) {
    for (let i = this.state.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.state.obstacles[i];
      obstacle.y += this.state.gameSpeed * deltaTime;

      if (obstacle.y > this.state.screenHeight) {
        this.state.obstacles.splice(i, 1);
      }
    }
  }

  updatePlayerPhysics(player: PlayerSchema, deltaTime: number) {
    if (player.isAccelerating) {
      const targetSpeed = this.state.gameSpeed * 1.2;
      player.speed = Math.min(
        player.speed + ACCELERATION * deltaTime,
        targetSpeed
      );
    }

    if (player.speed < this.state.gameSpeed) {
      player.speed = this.state.gameSpeed;
    }

    if (!player.isRespawning) {
      player.score += player.speed * 0.1 * deltaTime;
    }
  }

  private checkPassedObstacles(player: PlayerSchema) {
    const playerY = this.state.screenHeight - 100;

    this.state.obstacles.forEach((obstacle) => {
      if (
        !obstacle.passedByPlayers?.includes(player.sessionId) &&
        obstacle.lane === player.lane &&
        obstacle.y > playerY + this.state.carHeight
      ) {
        if (!obstacle.passedByPlayers) obstacle.passedByPlayers = [];
        obstacle.passedByPlayers.push(player.sessionId);
        player.score += 30;
      }
    });
  }

  checkCollisions(player: PlayerSchema) {
    if (player.isRespawning) return;

    const playerX = player.lane * 100 + (100 - this.state.carWidth) / 2;
    const playerY = this.state.screenHeight - 100;

    const playerRect = {
      left: playerX,
      right: playerX + this.state.carWidth,
      top: playerY,
      bottom: playerY + this.state.carHeight,
    };

    for (const obstacle of this.state.obstacles) {
      const obstacleX = obstacle.lane * 100 + (100 - this.state.obstacleWidth) / 2;
      const obstacleY = obstacle.y;

      const obstacleRect = {
        left: obstacleX,
        right: obstacleX + this.state.obstacleWidth,
        top: obstacleY,
        bottom: obstacleY + this.state.obstacleHeight,
      };

      const isColliding = !(
        playerRect.right < obstacleRect.left ||
        playerRect.left > obstacleRect.right ||
        playerRect.bottom < obstacleRect.top ||
        playerRect.top > obstacleRect.bottom
      );

      if (isColliding) {
        player.isRespawning = true;
        player.respawnTimer = RESPAWN_TIME;
        player.speed = 0;
        player.respawnCount++;
        break;
      }
    }
  }

  updateRespawn(player: PlayerSchema, deltaTime: number) {
    player.respawnTimer -= deltaTime;

    if (player.respawnTimer <= 0) {
      player.isRespawning = false;
      player.lane = 1;
      player.speed = this.state.gameSpeed;
    }
  }

  private async endGame() {
    this.state.gamePhase = "finished";

    
    const players = Array.from(this.state.players.values())
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        sessionId: player.sessionId,
        score: Math.round(player.score),
        respawnCount: player.respawnCount,
        position: index + 1
      }));

    const winnerSessionId = players[0].sessionId;
    const winnerUniqueId = this.playerUniqueIds.get(winnerSessionId);

  
    if (winnerUniqueId) {
      const users = Array.from(this.playerUniqueIds.values());
      await KafkaWalletService.sendGameEndRequest(
        users,
        winnerUniqueId,
        this.matchOptionId,
        this.roomId,
        this.winAmount
      );
    }

    this.broadcast("game_end", { 
      leaderboard: players,
      winner: winnerSessionId
    });
    
 
    this.clock.setTimeout(() => this.disconnect(), 30000);
  }
}