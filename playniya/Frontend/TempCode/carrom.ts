import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";
import { Room, Client } from "colyseus";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import MatchOption from "../models/MatchOption.model";
import KafkaWalletService from "../kafka/walletKafka";

export enum PieceType {
  WHITE = "white",
  BLACK = "black",
  QUEEN = "queen",
  STRIKER = "striker",
}

const FRICTION = 0.99;
const BOARD_SIZE = 600;
const POCKET_RADIUS = 25;
const PIECE_RADIUS = 12;
const STRIKER_RADIUS = 15;
const MAX_POWER = 35;
const MIN_VELOCITY = 0.4;
const WALL_BOUNCE = 0.95;
const TURN_TIME = 10;

const POCKET_MULTIPLIERS = [1.0, 1.2, 1.5, 2.0];

const POCKETS = [
  { x: 30, y: 30 },
  { x: 570, y: 30 },
  { x: 30, y: 570 },
  { x: 570, y: 570 },
];

export class CarromPiece extends Schema {
  @type("string") id: string;
  @type("string") type: PieceType;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") radius: number;
  @type("boolean") isActive: boolean = true;
  @type("boolean") isPocketed: boolean = false;

  constructor(id: string, type: PieceType, x: number, y: number) {
    super();
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = type === PieceType.STRIKER ? STRIKER_RADIUS : PIECE_RADIUS;
  }
}

export class Player extends Schema {
  @type("string") sessionId: string;
  @type("string") name: string;
  @type("number") score: number = 0;
  @type("number") position: number; // 0-3 (clockwise positions)
  @type("boolean") isActive: boolean = false;
  @type("number") timeRemaining: number = TURN_TIME;
  @type("number") whitesPocketed: number = 0;
  @type("number") blacksPocketed: number = 0;
  @type("boolean") hasQueen: boolean = false;
  @type("boolean") queenCovered: boolean = false;
  @type("number") lives: number = 3;
  @type("boolean") disqualified: boolean = false;
  @type("string") uniqueId: string = "";
  @type("boolean") isReady: boolean = false;

  constructor(
    sessionId: string,
    name: string,
    position: number,
    uniqueId: string
  ) {
    super();
    this.sessionId = sessionId;
    this.name = name;
    this.position = position;
    this.uniqueId = uniqueId;
  }
}

export class GameEvent extends Schema {
  @type("string") type: string;
  @type("string") playerId: string;
  @type("string") pieceType?: string;
  @type("number") points?: number;
  @type("string") message?: string;
  @type("number") timestamp: number;

  constructor() {
    super();
    this.timestamp = Date.now();
  }
}

export class CarromGameState extends Schema {
  @type("number") currentPlayerIndex: number = 0;
  @type("number") gameTimeRemaining: number = 300; // 5 minutes
  @type("boolean") isGameStarted: boolean = false;
  @type("boolean") isGameOver: boolean = false;
  @type("string") gamestatus: string = "waiting"; // waiting, in-progress, ended
  @type("number") turnTimeRemaining: number = TURN_TIME;
  @type("boolean") isPaused: boolean = false;
  @type("string") winner?: string;
  @type("number") totalPlayers: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 2;
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: CarromPiece }) pieces = new MapSchema<CarromPiece>();
  @type([GameEvent]) events = new ArraySchema<GameEvent>();
  @type({ map: "boolean" }) playReady = new MapSchema<boolean>();
  @type("boolean") countdownStarted: boolean = false;
  @type("number") countdown: number = 10;
}

(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

export class CarromGameRoom extends Room<CarromGameState> {
  private queenPendingCover: string | null = null;
  private queenPocketedThisTurn: boolean = false;
  private pocketMultipliers: number[] = [];
  private awaitingQueenCoverAttempt: boolean = false;

  private simulationInterval!: any;
  private gameTimer!: any;
  private turnTimer!: any;
  private shotTaken: boolean = false;
  private gameStartTime!: number;
  private pocketedThisTurn: string[] = [];
  private currentTurnPlayer: string = "";
  private piecesMoving: boolean = false;
  private turnTimerPaused: boolean = false;

  private rematchVotes: Set<string> = new Set();
  private reconnectionMap: Map<string, Player> = new Map();

  maxClients = 4;
  allowedUserIds: string[] = [];
  betAmount: number = 0;
  winAmount: number = 0;
  matchOptionId: string = "";
  minPlayer: number = 2;
  playerCount: number = 4;

  async onAuth(client: Client, options: any): Promise<any> {
    const userId = options.userId;
    const uniqueId = options.uniqueId;
    const useBonus = options.useBonus;
    const isPrivate = this.metadata?.isPrivate || false;
    const allowedUserIds = this.metadata?.allowedUserIds || [];

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

    const isGameInProgress = this.state.isGameStarted;
    if (
      (this.state.totalPlayers >= this.maxClients || isGameInProgress) &&
      !existingPlayer
    ) {
      throw new Error("Room is full or game already in progress.");
    }

    try {
      const roomId = this.listing?.roomId || this.roomId;
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
    const matchoptionId = new mongoose.Types.ObjectId(options.matchOptionId);
    const matchOption = await MatchOption.findById(matchoptionId);
    if (!matchOption) {
      throw new Error("MatchOption not found");
    }

    const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } =
      matchOption;
    this.playerCount = numberOfPlayers;
    this.minPlayer = minimumPlayers;
    this.betAmount = bettingAmount;
    this.winAmount = winningAmount;
    this.matchOptionId = options.matchOptionId;

    this.setMetadata({
      playerCount: numberOfPlayers,
      isPrivate: options.isPrivate || false,
      allowedUserIds: options.allowedUserIds || [],
    });

    this.maxClients = numberOfPlayers;

    this.setState(new CarromGameState());
    this.state.totalPlayers = numberOfPlayers;
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = options.matchOptionId;
    this.state.minPlayer = minimumPlayers;

    this.setupMessageHandlers();
    this.initializeBoard();

    this.simulationInterval = setInterval(
      () => this.updatePhysics(),
      1000 / 80
    );
    this.autoDispose = true;
  }

  async onJoin(client: Client, options: any) {
    const uniqueId = options.uniqueId;
    const playerName = options.name;
    const playerCount = this.state.players.size;

    if ((client as any).isReconnecting && (client as any).reconnectUniqueId) {
      const reconnectingId = (client as any).reconnectUniqueId;
      const oldPlayerEntry = Array.from(this.state.players.entries()).find(
        ([_, player]) => player.uniqueId === reconnectingId
      );
      if (oldPlayerEntry) {
        const [oldSessionId, oldPlayer] = oldPlayerEntry;
        this.state.players.delete(oldSessionId);
        this.state.players.set(client.sessionId, oldPlayer);
        this.reconnectionMap.set(client.sessionId, oldPlayer);
        console.log(
          `✅ Player reconnected: ${oldPlayer.name} (uniqueId: ${oldPlayer.uniqueId})`
        );
        return;
      }
    }

    if (playerCount >= this.maxClients) {
      client.send("error", { message: "Room is full." });
      return false;
    }

    const player = new Player(
      client.sessionId,
      playerName || `Player${playerCount + 1}`,
      playerCount,
      uniqueId
    );
    this.state.players.set(client.sessionId, player);
    this.state.totalPlayers = this.state.players.size;
    this.state.playReady.set(client.sessionId, false);

    client.send("playReady", { countdown: this.state.countdown });

    if (
      this.state.players.size === this.maxClients &&
      !this.state.countdownStarted
    ) {
      this.state.countdownStarted = true;
      this.startCountdown();
    }

    return true;
  }

  async onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    this.state.totalPlayers = this.state.players.size;

    if (this.state.isGameStarted && !this.state.isGameOver) {
      this.endGame("Player left the game");
    } else {
      this.state.playReady.delete(client.sessionId);
    }
  }

  private setupMessageHandlers() {
    this.onMessage("playReady", (client) => {
      this.state.playReady.set(client.sessionId, true);
      if (
        Array.from(this.state.playReady.values()).every(Boolean) &&
        !this.state.isGameStarted
      ) {
        this.state.countdownStarted = true;
        this.startCountdown();
      }
    });

    this.onMessage("rematch_request", (client) => {
      this.rematchVotes.add(client.sessionId);
      if (this.rematchVotes.size === this.state.players.size) {
        this.resetGame();
      }
    });

    this.onMessage(
      "shoot",
      (
        client,
        data: {
          dragStart: { x: number; y: number };
          dragEnd: { x: number; y: number };
          power: number;
        }
      ) => {
        if (!this.state.isGameStarted || this.state.isGameOver) return;

        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
          return;
        }
        if (this.piecesMoving) {
          return;
        }
        this.shootStriker(data);
      }
    );

    this.onMessage("moveStriker", (client, data: { x: number }) => {
      const currentPlayer = this.getCurrentPlayer();
      if (!currentPlayer || currentPlayer.sessionId !== client.sessionId) {
        return;
      }
      const striker = this.state.pieces.get("striker");
      if (!striker || this.piecesMoving) return;

      const minX = 100;
      const maxX = BOARD_SIZE - 100;
      let requestedX = Math.max(minX, Math.min(maxX, data.x));
      let strikerY = BOARD_SIZE - 50;
      const allPieces = Array.from(this.state.pieces.values()).filter(
        (p) =>
          p.type !== PieceType.STRIKER &&
          !p.isPocketed &&
          Math.abs(p.y - strikerY) < PIECE_RADIUS + STRIKER_RADIUS
      );
      for (const piece of allPieces) {
        const dist = Math.abs(requestedX - piece.x);
        const minDist = piece.radius + striker.radius;
        if (dist < minDist) {
          if (requestedX < piece.x) {
            requestedX = piece.x - minDist;
          } else {
            requestedX = piece.x + minDist;
          }
        }
      }
      requestedX = Math.max(minX, Math.min(maxX, requestedX));
      const blocked = allPieces.some(
        (piece) =>
          Math.abs(requestedX - piece.x) < piece.radius + striker.radius
      );
      if (blocked) {
        const event = new GameEvent();
        event.type = "strikerBlocked";
        event.playerId = currentPlayer.sessionId;
        event.message =
          "Striker cannot be placed here — blocked by a coin on the baseline!";
        this.state.events.push(event);
        return;
      }
      striker.x = requestedX;
      striker.y = strikerY;
    });

    this.onMessage("skipTurn", (client) => {
      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer && currentPlayer.sessionId === client.sessionId) {
        this.processTurnEnd();
      }
    });
  }

  private resetGame() {
    this.rematchVotes.clear();
    this.state.isGameStarted = false;
    this.state.isGameOver = false;
    this.state.gamestatus = "waiting";
    this.state.winner = "";
    this.state.events = new ArraySchema<GameEvent>();
    this.state.turnTimeRemaining = TURN_TIME;
    this.state.gameTimeRemaining = 300;
    this.state.currentPlayerIndex = 0;
    this.state.countdown = 10;
    this.state.countdownStarted = false;
    this.state.players.forEach((player) => {
      player.score = 0;
      player.whitesPocketed = 0;
      player.blacksPocketed = 0;
      player.hasQueen = false;
      player.queenCovered = false;
      player.lives = 3;
      player.disqualified = false;
      player.isActive = false;
      player.timeRemaining = TURN_TIME;
      player.isReady = false;
    });
    this.initializeBoard();
    this.state.playReady.forEach((_, key) =>
      this.state.playReady.set(key, false)
    );
    this.broadcast("rematch_reset", {});
    this.startCountdown();
  }

  private endGame(reason?: string) {
    this.state.isGameOver = true;
    this.state.gamestatus = "ended";
    const players = Array.from(this.state.players.values()).filter(
      (p) => !p.disqualified
    );
    const winner =
      players.length > 0
        ? players.reduce((max, player) =>
            player.score > max.score ? player : max
          )
        : null;
    this.state.winner = winner?.sessionId || "";

    const event = new GameEvent();
    event.type = "gameOver";
    event.playerId = winner?.sessionId || "";
    event.message =
      reason ||
      (winner
        ? `🏆 ${winner.name} wins with ${winner.score} points!`
        : "No winner (all disqualified)");
    this.state.events.push(event);

    clearInterval(this.gameTimer);
    clearInterval(this.turnTimer);

    this.state.players.forEach((player) => {
      player.isActive = false;
      player.timeRemaining = 0;
    });

    if (winner && winner.uniqueId) {
      const users = Array.from(this.state.players.values()).map(
        (player) => player.uniqueId
      );
      KafkaWalletService.sendGameEndRequest(
        users,
        winner.uniqueId,
        "carrom", // Pass your real game type or match id here!
        this.roomId,
        this.winAmount
      );
    }

    this.clock.setTimeout(() => this.broadcast("rematch_possible", {}), 10000);
  }

  private startCountdown() {
    this.state.countdown = 10;
    const countdownInterval = setInterval(() => {
      this.state.countdown--;
      this.broadcast("countdown", { countdown: this.state.countdown });
      if (this.state.countdown <= 0) {
        clearInterval(countdownInterval);
        this.startGame();
      }
    }, 1000);
  }

  onDispose() {
    clearInterval(this.simulationInterval);
    clearInterval(this.gameTimer);
    clearInterval(this.turnTimer);
  }

  private shuffleMultipliers() {
    this.pocketMultipliers = [...POCKET_MULTIPLIERS];
  }

  private initializeBoard() {
    this.state.pieces.clear();

    const centerX = BOARD_SIZE / 2;
    const centerY = BOARD_SIZE / 2;

    this.state.pieces.set(
      "queen",
      new CarromPiece("queen", PieceType.QUEEN, centerX, centerY)
    );

    const positions = this.getCircularPositions(centerX, centerY, 40);

    let whiteCount = 0;
    let blackCount = 0;

    positions.forEach(({ x, y, color }) => {
      const id =
        color === PieceType.WHITE
          ? `white_${whiteCount++}`
          : `black_${blackCount++}`;
      this.state.pieces.set(id, new CarromPiece(id, color, x, y));
    });

    this.state.pieces.set(
      "striker",
      new CarromPiece("striker", PieceType.STRIKER, centerX, BOARD_SIZE - 50)
    );
  }

  private getCircularPositions(
    centerX: number,
    centerY: number,
    radius: number
  ): Array<{ x: number; y: number; color: PieceType }> {
    const positions: Array<{ x: number; y: number; color: PieceType }> = [];
    const totalPieces = 18;
    const angleStep = (2 * Math.PI) / totalPieces;
    const rotationOffset = Math.floor(Math.random() * totalPieces);

    for (let i = 0; i < totalPieces; i++) {
      const angle = (i + rotationOffset) * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      const color = i % 2 === 0 ? PieceType.WHITE : PieceType.BLACK;
      positions.push({ x, y, color });
    }
    return positions;
  }

  private startGame() {
    this.state.isGameStarted = true;
    this.state.gamestatus = "in-progress";
    this.state.currentPlayerIndex = 0;
    this.gameStartTime = Date.now();
    this.pocketedThisTurn = [];
    this.queenPendingCover = null;
    this.queenPocketedThisTurn = false;

    this.state.players.forEach((player) => {
      player.isActive = false;
      player.score = 0;
      player.whitesPocketed = 0;
      player.blacksPocketed = 0;
      player.hasQueen = false;
      player.queenCovered = false;
      player.lives = 3;
      player.disqualified = false;
    });

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      currentPlayer.isActive = true;
      this.currentTurnPlayer = currentPlayer.sessionId;
    }

    this.gameTimer = setInterval(() => {
      this.state.gameTimeRemaining--;
      if (this.state.gameTimeRemaining <= 0) {
        this.endGame("Time's up!");
      }
    }, 1000);

    this.startTurnTimer();
    this.shuffleMultipliers();

    const event = new GameEvent();
    event.type = "gameStart";
    event.playerId = "";
    event.message = "Game started! Good luck!";
    this.state.events.push(event);
  }

  private startTurnTimer() {
    clearInterval(this.turnTimer);
    this.state.turnTimeRemaining = TURN_TIME;
    this.turnTimerPaused = false;

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      currentPlayer.timeRemaining = TURN_TIME;
    }

    this.turnTimer = setInterval(() => {
      this.state.turnTimeRemaining--;

      const currentPlayer = this.getCurrentPlayer();
      if (currentPlayer) {
        currentPlayer.timeRemaining = this.state.turnTimeRemaining;
      }

      if (this.state.turnTimeRemaining <= 0) {
        this.handleTurnTimeout();
      }
    }, 1000);
  }

  private pauseTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
      this.turnTimerPaused = true;
    }
  }

  private resumeTurnTimer() {
    if (!this.turnTimer && this.turnTimerPaused && !this.state.isGameOver) {
      this.turnTimerPaused = false;
      this.turnTimer = setInterval(() => {
        this.state.turnTimeRemaining--;

        const currentPlayer = this.getCurrentPlayer();
        if (currentPlayer) {
          currentPlayer.timeRemaining = this.state.turnTimeRemaining;
        }

        if (this.state.turnTimeRemaining <= 0) {
          this.handleTurnTimeout();
        }
      }, 1000);
    }
  }

  private handleTurnTimeout() {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      currentPlayer.lives--;
      const event = new GameEvent();
      event.type = "timeout";
      event.playerId = currentPlayer.sessionId;
      if (currentPlayer.lives <= 0) {
        currentPlayer.disqualified = true;
        event.message = `${currentPlayer.name} missed 3 turns and is disqualified!`;
      } else {
        event.message = `${currentPlayer.name} ran out of time! (-1 life, ${currentPlayer.lives} left)`;
      }
      this.state.events.push(event);
    }
    this.processTurnEnd();
  }

  private shootStriker(data: {
    dragStart: { x: number; y: number };
    dragEnd: { x: number; y: number };
    power: number;
  }) {
    const striker = this.state.pieces.get("striker");
    if (!striker || this.piecesMoving) return;

    const dx = data.dragEnd.x - data.dragStart.x;
    const dy = data.dragEnd.y - data.dragStart.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) return;

    const maxPower = MAX_POWER;
    const power = Math.min(data.power || distance * 0.1, maxPower);

    striker.vx = (dx / distance) * power;
    striker.vy = (dy / distance) * power;

    this.shotTaken = true;
    this.piecesMoving = true;
    this.pocketedThisTurn = [];
    this.queenPocketedThisTurn = false;

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      const event = new GameEvent();
      event.type = "shot";
      event.playerId = currentPlayer.sessionId;
      event.message = `${currentPlayer.name} took a shot!`;
      this.state.events.push(event);
    }
  }

  private updatePhysics() {
    if (!this.state.isGameStarted || this.state.isGameOver) return;

    const pieces = Array.from(this.state.pieces.values());
    let anyMoving = false;

    pieces.forEach((piece) => {
      if (!piece.isActive || piece.isPocketed) return;

      piece.vx *= FRICTION;
      piece.vy *= FRICTION;

      if (
        Math.abs(piece.vx) < MIN_VELOCITY &&
        Math.abs(piece.vy) < MIN_VELOCITY
      ) {
        piece.vx = 0;
        piece.vy = 0;
      }

      if (piece.vx !== 0 || piece.vy !== 0) {
        anyMoving = true;
        piece.x += piece.vx;
        piece.y += piece.vy;
        this.handleWallCollision(piece);
        this.checkPocketing(piece);
      }
    });

    this.handleCollisions();

    if (anyMoving && !this.turnTimerPaused) {
      this.pauseTurnTimer();
    } else if (!anyMoving && this.turnTimerPaused) {
      this.resumeTurnTimer();
    }

    this.piecesMoving = anyMoving;

    if (!anyMoving && this.shotTaken) {
      this.shotTaken = false;
      this.processTurnEnd();
    }
  }

  private handleWallCollision(piece: CarromPiece) {
    const margin = piece.radius;

    if (piece.x - margin < 0 || piece.x + margin > BOARD_SIZE) {
      piece.vx *= -WALL_BOUNCE;
      piece.x = Math.max(margin, Math.min(BOARD_SIZE - margin, piece.x));
    }

    if (piece.y - margin < 0 || piece.y + margin > BOARD_SIZE) {
      piece.vy *= -WALL_BOUNCE;
      piece.y = Math.max(margin, Math.min(BOARD_SIZE - margin, piece.y));
    }
  }

  private checkPocketing(piece: CarromPiece) {
    POCKETS.forEach((pocket, index) => {
      const distance = Math.sqrt(
        Math.pow(piece.x - pocket.x, 2) + Math.pow(piece.y - pocket.y, 2)
      );

      if (distance < POCKET_RADIUS) {
        piece.isPocketed = true;
        piece.isActive = false;
        piece.vx = 0;
        piece.vy = 0;

        this.pocketedThisTurn.push(piece.id);

        const multiplier = this.pocketMultipliers[index];
        this.handlePiecePocketed(piece, multiplier, index);
      }
    });
  }

  private handlePiecePocketed(
    piece: CarromPiece,
    multiplier: number,
    pocketIdx: number
  ) {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return;

    const event = new GameEvent();
    event.playerId = currentPlayer.sessionId;

    // Check if striker is pocketed on this turn
    const strikerId = "striker";
    const strikerPocketed = this.pocketedThisTurn.includes(strikerId);
    const coinPocketed = this.pocketedThisTurn.some(
      (id) => id !== strikerId && id !== "queen"
    );
    const isCoin =
      piece.type === PieceType.WHITE || piece.type === PieceType.BLACK;
    const isStriker = piece.type === PieceType.STRIKER;

    // If this is a coin, but striker also pocketed this turn, it's a foul
    if (isCoin && strikerPocketed) {
      event.type = "foul";
      event.message = `${currentPlayer.name} fouled: striker and coin pocketed together! Coin returned to board.`;
      this.returnCoinToBoard(piece);
      this.state.events.push(event);
      return;
    }

    // If this is the striker, deduct points and immediately skip to next player
    if (isStriker) {
      const pointsLost = Math.round(10 * multiplier);
      currentPlayer.score = Math.max(0, currentPlayer.score - pointsLost);
      event.type = "foul";
      event.points = -pointsLost;
      event.message = `${currentPlayer.name} pocketed the striker! Foul: -${pointsLost} points (x${multiplier} multiplier)`;
      this.resetStriker();
      this.state.events.push(event);

      // End turn immediately, do not allow continue
      this.shotTaken = false;
      setTimeout(() => this.processTurnEnd(true), 10);
      return;
    }

    // Normal coin/queen handling
    let baseValue = 0;
    switch (piece.type) {
      case PieceType.WHITE:
        baseValue = 20;
        currentPlayer.whitesPocketed++;
        break;
      case PieceType.BLACK:
        baseValue = 10;
        currentPlayer.blacksPocketed++;
        break;
      case PieceType.QUEEN:
        baseValue = 50;
        currentPlayer.hasQueen = true;
        this.queenPendingCover = currentPlayer.sessionId;
        this.queenPocketedThisTurn = true;
        event.type = "pocketed";
        event.pieceType = "queen";
        event.points = baseValue;
        event.message = `${currentPlayer.name} pocketed the Queen! Must cover it by pocketing another piece.`;
        this.state.events.push(event);
        return;
    }

    const pointsEarned = Number((baseValue * multiplier).toFixed(1));
    currentPlayer.score += pointsEarned;

    event.type = "pocketed";
    event.pieceType = piece.type;
    event.points = pointsEarned;
    event.message = `${currentPlayer.name} pocketed a ${piece.type} with x${multiplier} multiplier! +${pointsEarned} points`;
    this.state.events.push(event);
  }

  private returnCoinToBoard(piece: CarromPiece) {
    piece.isPocketed = false;
    piece.isActive = true;
    let cx = BOARD_SIZE / 2,
      cy = BOARD_SIZE / 2,
      r = 0,
      theta = 0;
    let tries = 0,
      found = false;
    while (!found && tries < 36) {
      let x = cx + Math.cos(theta) * r;
      let y = cy + Math.sin(theta) * r;
      const collision = Array.from(this.state.pieces.values()).some(
        (p) =>
          p !== piece &&
          !p.isPocketed &&
          Math.hypot(p.x - x, p.y - y) < p.radius + piece.radius
      );
      if (!collision) {
        piece.x = x;
        piece.y = y;
        found = true;
      }
      r += 5;
      theta += Math.PI / 8;
      tries++;
    }
    piece.vx = 0;
    piece.vy = 0;
  }

  private handleCollisions() {
    const pieces = Array.from(this.state.pieces.values()).filter(
      (p) => p.isActive && !p.isPocketed
    );

    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        const piece1 = pieces[i];
        const piece2 = pieces[j];

        const dx = piece2.x - piece1.x;
        const dy = piece2.y - piece1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < piece1.radius + piece2.radius) {
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          const vx1 = piece1.vx * cos + piece1.vy * sin;
          const vy1 = piece1.vy * cos - piece1.vx * sin;
          const vx2 = piece2.vx * cos + piece2.vy * sin;
          const vy2 = piece2.vy * cos - piece2.vx * sin;

          const newVx1 = vx2;
          const newVx2 = vx1;

          piece1.vx = newVx1 * cos - vy1 * sin;
          piece1.vy = vy1 * cos + newVx1 * sin;
          piece2.vx = newVx2 * cos - vy2 * sin;
          piece2.vy = vy2 * cos + newVx2 * sin;

          const overlap = piece1.radius + piece2.radius - distance;
          const separationX = (dx / distance) * overlap * 0.5;
          const separationY = (dy / distance) * overlap * 0.5;

          piece1.x -= separationX;
          piece1.y -= separationY;
          piece2.x += separationX;
          piece2.y += separationY;
        }
      }
    }
  }

  private resetQueen() {
    const queen = this.state.pieces.get("queen");
    if (queen) {
      queen.isPocketed = false;
      queen.isActive = true;
      queen.x = BOARD_SIZE / 2;
      queen.y = BOARD_SIZE / 2;
      queen.vx = 0;
      queen.vy = 0;
    }
  }

  private processTurnEnd(forceEndTurn: boolean = false) {
    const currentPlayer = this.getCurrentPlayer();
    if (!currentPlayer) return;

    const piecesPocketedThisShot = this.pocketedThisTurn.filter(
      (id) => !id.includes("striker")
    );
    const queenPocketedThisShot = this.pocketedThisTurn.includes("queen");
    const regularPiecesPocketed = piecesPocketedThisShot.some(
      (id) => !id.includes("queen")
    );

    if (!this.awaitingQueenCoverAttempt && queenPocketedThisShot) {
      this.queenPendingCover = currentPlayer.sessionId;
      currentPlayer.hasQueen = true;
      this.awaitingQueenCoverAttempt = true;

      const event = new GameEvent();
      event.type = "queenPocketed";
      event.playerId = currentPlayer.sessionId;
      event.message = `${currentPlayer.name} pocketed the Queen! Must cover it in next shot.`;
      this.state.events.push(event);

      this.resetStriker();
      this.startTurnTimer();
      return;
    }

    if (
      this.awaitingQueenCoverAttempt &&
      this.queenPendingCover === currentPlayer.sessionId
    ) {
      if (regularPiecesPocketed) {
        currentPlayer.queenCovered = true;
        currentPlayer.score += 3;
        this.queenPendingCover = null;
        this.awaitingQueenCoverAttempt = false;

        const event = new GameEvent();
        event.type = "queenCovered";
        event.playerId = currentPlayer.sessionId;
        event.points = 3;
        event.message = `${currentPlayer.name} covered the Queen! +3 bonus points!`;
        this.state.events.push(event);
      } else {
        this.resetQueen();
        currentPlayer.hasQueen = false;
        this.queenPendingCover = null;
        this.awaitingQueenCoverAttempt = false;

        const event = new GameEvent();
        event.type = "queenNotCovered";
        event.playerId = currentPlayer.sessionId;
        event.message = `${currentPlayer.name} failed to cover the Queen! Queen returned to board.`;
        this.state.events.push(event);
      }
    }

    if (forceEndTurn) {
      this.nextTurn();
      return;
    }

    const continueTurn = regularPiecesPocketed || queenPocketedThisShot;
    if (this.checkWinCondition()) {
      this.endGame();
      return;
    }

    if (continueTurn) {
      this.startTurnTimer();
      this.resetStriker();

      const event = new GameEvent();
      event.type = "continueTurn";
      event.playerId = currentPlayer.sessionId;
      event.message = `${currentPlayer.name} gets another turn!`;
      this.state.events.push(event);
    } else {
      this.nextTurn();
    }
  }
  private checkWinCondition(): boolean {
    const players = Array.from(this.state.players.values());

    for (const player of players) {
      const totalPocketed = player.whitesPocketed + player.blacksPocketed;
      if (totalPocketed >= 9) {
        return true;
      }
    }

    const allWhites = Array.from(this.state.pieces.values()).filter(
      (p) => p.type === PieceType.WHITE
    );
    const allBlacks = Array.from(this.state.pieces.values()).filter(
      (p) => p.type === PieceType.BLACK
    );

    const whitesRemaining = allWhites.filter((p) => !p.isPocketed).length;
    const blacksRemaining = allBlacks.filter((p) => !p.isPocketed).length;

    return whitesRemaining === 0 || blacksRemaining === 0;
  }

  private nextTurn() {
    this.queenPocketedThisTurn = false;
    this.pocketedThisTurn = [];

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer) {
      currentPlayer.isActive = false;
      currentPlayer.timeRemaining = 0;
    }

    const last = this.pocketMultipliers.pop();
    if (last !== undefined) {
      this.pocketMultipliers.unshift(last);
    }

    let nextPlayerIndex = this.state.currentPlayerIndex;
    let attempts = 0;
    do {
      nextPlayerIndex = (nextPlayerIndex + 1) % 4;
      attempts++;
    } while (
      attempts < 4 &&
      (!this.getPlayerByPosition(nextPlayerIndex) ||
        this.getPlayerByPosition(nextPlayerIndex)?.disqualified)
    );

    this.state.currentPlayerIndex = nextPlayerIndex;

    const nextPlayer = this.getCurrentPlayer();
    if (nextPlayer) {
      nextPlayer.isActive = true;
      this.currentTurnPlayer = nextPlayer.sessionId;
    }

    this.resetStriker();
    this.startTurnTimer();

    if (nextPlayer) {
      const event = new GameEvent();
      event.type = "turnChange";
      event.playerId = nextPlayer.sessionId;
      event.message = `${nextPlayer.name}'s turn!`;
      this.state.events.push(event);
    }
  }
  private resetStriker() {
    const striker = this.state.pieces.get("striker");
    if (striker) {
      striker.isPocketed = false;
      striker.isActive = true;
      striker.x = BOARD_SIZE / 2;
      striker.y = BOARD_SIZE - 50;
      striker.vx = 0;
      striker.vy = 0;
    }
  }

  private getCurrentPlayer(): Player | undefined {
    return this.getPlayerByPosition(this.state.currentPlayerIndex);
  }

  private getPlayerByPosition(position: number): Player | undefined {
    const players = Array.from(this.state.players.values());
    return players.find((p) => p.position === position);
  }
}
