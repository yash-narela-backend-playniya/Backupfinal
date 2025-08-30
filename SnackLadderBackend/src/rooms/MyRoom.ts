


import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  // Positions of 3 pawns on the board (values from 0 to 100)
  @type([ "number" ])
  pawnPositions = new ArraySchema<number>();

  @type("number") score = 0;          // Player's score
  @type("number") movesTaken = 0;     // Number of moves taken
  @type("number") missedMoves = 0;    // Consecutive missed moves
  @type("boolean") disqualified = false;
  @type("string") sessionId = "";
  @type("string") name = "";
  @type("string") uniqueId = "";

  constructor() {
    super();
    // Initialize all 3 pawns at position 0 (start)
    this.pawnPositions.push(0, 0, 0);
  }

  getNextRequiredPawn(): number | null {
    // Return index of first pawn that hasn't started moving (pos == 0)
    if (this.pawnPositions[0] === 0) return 0;
    if (this.pawnPositions[1] === 0) return 1;
    if (this.pawnPositions[2] === 0) return 2;
    return null;
  }

  hasWon(): boolean {
    // Check if all pawns reached position 100 (end)
    return this.pawnPositions.every(pos => pos === 100);
  }
}

export class SnakeLadderState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();  // sessionId => Player

  @type("string")
  currentPlayer = "";                 // sessionId of current turn player
    @type("number") playerCount: number = 0;

      @type("number") countdown: number = 0;

  @type("string")                     // Game mode, either 'turn' or 'time'
  mode: "turn" | "time" = "turn";

  @type("number")
  timer = 180;                       // Game timer in seconds (for 'time' mode)

  @type("number")
  moveLimit = 30;                    // Max moves allowed (for 'turn' mode)

  @type("boolean")
  started = false;                   // Game started flag

  @type("boolean")
  ended = false;                     // Game ended flag

  @type({ map: "string" })
  modeVotes = new MapSchema<string>(); // sessionId => vote ('turn' or 'time')

  @type("boolean")
  modeSelected = false;              // Whether mode has been finalized

  @type("string")                    // Game status lifecycle
  gameStatus: "waiting" | "starting" | "in-progress" | "finished" = "waiting";

  @type("string")
  winner = "";                      // sessionId of winner or empty if none

  @type("string")
  matchOptionId = "";               // Match config ID

  @type("number")
  betAmount = 0;                   // Amount players bet

  @type("number")
  winAmount = 0;                   // Prize money for winner

  @type("boolean")
  everyoneJoined = false;          // True if all required players joined

  // Board data: snakes and ladders
  @type([ "number" ])
  snakeMouths = new ArraySchema<number>();  // Positions where snake heads are

  @type([ "number" ])
  snakeTails = new ArraySchema<number>();   // Positions where snake tails are

  @type([ "number" ])
  ladderBottoms = new ArraySchema<number>(); // Positions where ladder bottoms are

  @type([ "number" ])
  ladderTops = new ArraySchema<number>();
}

import { Room, Client, Delayed } from "colyseus";
import { SnakeLadderState, Player } from "./schema/SnakeLadderState";
import mongoose from "mongoose";
import MatchOption from "../models/MatchOption.model";
import KafkaWalletService from "../kafka/walletKafka";
import { ArraySchema, MapSchema } from "@colyseus/schema";

const MATCH_DURATION_MS = 3 * 60 * 1000;

export class SnakeLadderRoom extends Room<SnakeLadderState> {
  autoDispose = false;
  allowedUserIds: string[] = [];
  isPrivate: boolean = false;
  betAmount: number = 0;
  winAmount: number = 0;
  matchOptionId: string = "";
  minPlayer: number = 0;
  playerCount: number = 0;

  private simulationInterval?: NodeJS.Timeout;
  private countdownTimer?: Delayed;
  private inactivityTimer?: Delayed;
  private gameTimeout?: Delayed;
  private playerInactivityTimers: Map<string, NodeJS.Timeout> = new Map();
  private rematchVotes: Set<string> = new Set();
  private joinGameConfirmedPlayers: Set<string> = new Set();

  // --- MODE LOGIC ---
  private modeVotes: Map<string, string> = new Map(); // sessionId -> "turn"|"time"

  async onAuth(client: Client, options: any) {
    const userId = options.userId;
    const uniqueId = options.uniqueId;
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

    const isGameInProgress = this.state.gameStatus === "in-progress";
    if ((this.state.everyoneJoined || isGameInProgress) && !existingPlayer) {
      throw new Error("Room is full or game already in progress.");
    }

    try {
      const roomId = this.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
        uniqueId,
        this.betAmount,
        options.useBonus,
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

    const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } = matchOption;

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

    this.setState(new SnakeLadderState());
    this.state.gameStatus = "waiting";
    this.state.playerCount = numberOfPlayers;
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = options.matchOptionId;
    this.state.minPlayer = minimumPlayers;

    this.maxClients = numberOfPlayers;
    this.isPrivate = options.isPrivate || false;
    this.allowedUserIds = options.allowedUserIds || [];

    this.setupMessageHandlers();
  }

  onJoin(client: Client, options: any) {
    // Only handle reconnect logic here—actual player creation happens in "join_game"
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
        this.clearPlayerInactivityTimer(oldSessionId);
        this.resetPlayerInactivityTimer(client.sessionId);
        return;
      }
    }
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.gameStatus === "finished") {
      this.state.players.delete(client.sessionId);
      this.clearPlayerInactivityTimer(client.sessionId);
      return;
    }

    this.broadcast("info", { message: `${player.name} disconnected. Waiting 60s to reconnect...` });

    this.clock.setTimeout(() => {
      const stillMissing = !Array.from(this.state.players.values()).some(
        (p) => p.uniqueId === player.uniqueId
      );
      if (stillMissing && this.state.gameStatus !== "finished") {
        player.disqualified = true;
        this.broadcast("info", { message: `${player.name} failed to reconnect. Marked as disqualified.` });
        this.clearPlayerInactivityTimer(client.sessionId);
        this.checkWinCondition();
      }
    }, 60 * 1000); // 60 seconds to reconnect
  }

  private setupMessageHandlers() {
    // Player joining the game (confirm join)
    this.onMessage("join_game", (client, message) => {
      if (this.state.players.size >= this.maxClients) {
        client.send("error", { message: "Room is full." });
        return;
      }

      // Only create player state here
      if (!this.state.players.has(client.sessionId)) {
        const player = new Player();
        player.sessionId = client.sessionId;
        player.name = message.name || `Player${this.state.players.size + 1}`;
        player.uniqueId = message.uniqueId || "";
        player.pawnPositions = new ArraySchema<number>(0, 0, 0);
        player.score = 0;
        player.movesTaken = 0;
        player.missedMoves = 0;
        player.disqualified = false;
        this.state.players.set(client.sessionId, player);
      }

      this.joinGameConfirmedPlayers.add(client.sessionId);
      this.resetPlayerInactivityTimer(client.sessionId);

      this.broadcast("player_ready", {
        playerId: client.sessionId,
        name: this.state.players.get(client.sessionId)?.name,
        totalReady: this.joinGameConfirmedPlayers.size,
        totalPlayers: this.playerCount,
      });

      this.broadcastState();

      // --- MODE LOGIC: Only select mode after all players joined ---
      if (this.joinGameConfirmedPlayers.size === this.playerCount) {
        this.state.everyoneJoined = true;
        // Start mode voting
        this.broadcast("mode_vote_start", { options: ["turn", "time"] });
      }
    });

    // --- MODE LOGIC: Handle mode vote messages ---
    this.onMessage("vote_mode", (client, message) => {
      if (this.state.modeSelected) return;
      if (message.mode !== "turn" && message.mode !== "time") return;

      this.modeVotes.set(client.sessionId, message.mode);
      this.broadcast("mode_vote_update", {
        votes: Array.from(this.modeVotes.entries())
      });

      // When all players have voted, tally mode
      if (this.modeVotes.size === this.playerCount) {
        const count = { turn: 0, time: 0 };
        for (const m of this.modeVotes.values()) count[m]++;
        let chosenMode = count.time > count.turn ? "time" : "turn";
        this.state.mode = chosenMode;
        this.state.modeSelected = true;
        this.broadcast("mode_selected", { mode: chosenMode, votes: count });
        // Start countdown after mode selection
        this.startCountdown();
      }
    });
    this.onMessage("rollDice", (client, { pawnIndex }: { pawnIndex?: number }) => {
      // --- MODE LOGIC: Both modes supported ---
      if (this.state.ended || !this.state.started) return;
      const player = this.state.players.get(client.sessionId);
      if (!player || player.disqualified || this.state.currentPlayer !== client.sessionId) return;
      const diceRoll = this.randomInt(1, 6);
      const moveSuccess = this.handlePlayerMove(player, diceRoll, pawnIndex);

      this.broadcast("dice_rolled", {
        playerId: client.sessionId,
        value: diceRoll,
        pawnIndex,
        success: moveSuccess,
      });

      if (moveSuccess) {
        this.broadcast("pawn_moved", {
          playerId: client.sessionId,
          pawnIndex,
          position: player.pawnPositions[pawnIndex || 0],
          score: player.score,
        });

        if (diceRoll !== 6 && this.state.mode === "turn") {
          this.advanceTurn();
        }
        this.checkWinCondition();
      }

      this.broadcastState();
    });

    this.onMessage("rematch_request", (client) => {
      this.rematchVotes.add(client.sessionId);
      if (this.rematchVotes.size === this.state.players.size) {
        this.resetGame();
      }
    });
  }

  private startCountdown() {
    this.state.gameStatus = "starting";
    this.state.countdown = 3;

    this.countdownTimer = this.clock.setInterval(() => {
      if (this.state.countdown > 0) {
        this.broadcast("countdown-update", { countdown: this.state.countdown });
        this.state.countdown--;
      } else {
        this.clearCountdown();
        this.clock.setTimeout(() => this.startGame(), 1000);
      }
    }, 1000);
  }

  private startGame() {
    if (this.state.started) return;
    this.state.started = true;
    this.state.gameStatus = "in-progress";
    this.state.timer = this.state.mode === "time" ? MATCH_DURATION_MS / 1000 : undefined;
    this.state.currentPlayer = this.pickFirstActivePlayer();
    this.generateBoard();
    if (this.state.mode === "time") {
      this.simulationInterval = setInterval(() => this.updateGame(), 1000);
    }
    const users = Array.from(this.state.players.values()).map((p) => p.uniqueId);
    KafkaWalletService.sendGameStartRequest(users, this.betAmount, this.matchOptionId, this.roomId);

    this.startTurnTimer(this.state.currentPlayer);
    this.startInactivityTimer();
    this.startGameTimeout();

    this.broadcast("game_started", {
      mode: this.state.mode,
      firstPlayer: this.state.currentPlayer,
      board: {
        snakes: this.state.snakeMouths.map((mouth, i) => ({
          from: mouth,
          to: this.state.snakeTails[i],
        })),
        ladders: this.state.ladderBottoms.map((bottom, i) => ({
          from: bottom,
          to: this.state.ladderTops[i],
        })),
      },
    });
    this.broadcastState();
  }

  private updateGame() {
    if (this.state.ended || !this.state.started || this.state.mode !== "time") return;
    this.state.timer--;
    this.broadcast("timer_tick", { remainingSeconds: this.state.timer });
    if (this.state.timer <= 0) {
      this.endGame();
    }
  }

  private generateBoard() {
    this.state.snakeMouths.clear();
    this.state.snakeTails.clear();
    this.state.ladderBottoms.clear();
    this.state.ladderTops.clear();

    const snakeCount = this.randomInt(7, 9);
    for (let i = 0; i <= snakeCount; i++) {
      let mouth: number, tail: number;
      do {
        mouth = this.randomInt(20, 99);
        tail = this.randomInt(1, mouth - 5);
      } while (this.state.snakeMouths.includes(mouth));
      this.state.snakeMouths.push(mouth);
      this.state.snakeTails.push(tail);
    }

    const ladderCount = this.randomInt(7, 8);
    for (let i = 0; i <= ladderCount; i++) {
      let bottom: number, top: number;
      do {
        bottom = this.randomInt(1, 85);
        top = this.randomInt(bottom + 5, 99);
      } while (this.state.ladderBottoms.includes(bottom));
      this.state.ladderBottoms.push(bottom);
      this.state.ladderTops.push(top);
    }
  }

  private handlePlayerMove(player: Player, diceValue: number, pawnIndex?: number): boolean {
    if (pawnIndex === undefined) {
      const requiredPawn = player.getNextRequiredPawn();
      if (requiredPawn !== null) pawnIndex = requiredPawn;
      else return false;
    }

    const currentPos = player.pawnPositions[pawnIndex];
    let newPosition = currentPos;

    if (diceValue === 6 && currentPos >= 94 && currentPos < 100) {
      newPosition = 100;
      player.score += (100 - currentPos);
      player.score += 100;
    } else if (currentPos === 0) {
      newPosition = diceValue;
    } else {
      newPosition = currentPos + diceValue;
      if (newPosition > 100) return false;
    }

    player.pawnPositions[pawnIndex] = newPosition;
    player.score += newPosition !== 100 ? 1 : 0;

    this.checkSnakesAndLadders(player, pawnIndex);
    this.checkCollisions(player, pawnIndex);

    player.movesTaken++;
    player.missedMoves = 0;
    return true;
  }

  private checkSnakesAndLadders(player: Player, pawnIndex: number) {
    const currentPos = player.pawnPositions[pawnIndex];

    const ladderIndex = this.state.ladderBottoms.indexOf(currentPos);
    if (ladderIndex !== -1) {
      const ladderTop = this.state.ladderTops[ladderIndex];
      const delta = ladderTop - currentPos;
      player.pawnPositions[pawnIndex] = ladderTop;
      player.score += delta;

      this.broadcast("ladder_climbed", {
        playerId: player.sessionId,
        pawnIndex,
        from: currentPos,
        to: ladderTop,
        delta,
      });
    }

    const snakeIndex = this.state.snakeMouths.indexOf(currentPos);
    if (snakeIndex !== -1) {
      const snakeTail = this.state.snakeTails[snakeIndex];
      const delta = currentPos - snakeTail;
      player.pawnPositions[pawnIndex] = snakeTail;
      player.score -= delta;

      this.broadcast("snake_bitten", {
        playerId: player.sessionId,
        pawnIndex,
        from: currentPos,
        to: snakeTail,
        delta,
      });
    }
  }

  private checkCollisions(currentPlayer: Player, pawnIndex: number) {
    const currentPos = currentPlayer.pawnPositions[pawnIndex];
    if (currentPos === 0 || currentPos === 100) return;

    this.state.players.forEach((player, sessionId) => {
      if (sessionId !== currentPlayer.sessionId && !player.disqualified) {
        for (let i = 0; i < 3; i++) {
          if (player.pawnPositions[i] === currentPos) {
            this.broadcast("collision", {
              attackerId: currentPlayer.sessionId,
              victimId: sessionId,
              position: currentPos,
              pawnIndex: i,
            });
            player.pawnPositions[i] = 0;
          }
        }
      }
    });
  }

  private advanceTurn() {
    const activePlayers = Array.from(this.state.players.values()).filter((p) => !p.disqualified);

    if (activePlayers.length === 0) {
      this.endGame();
      return;
    }

    const currentIndex = activePlayers.findIndex((p) => p.sessionId === this.state.currentPlayer);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[nextIndex];
    this.state.currentPlayer = nextPlayer.sessionId;

    this.broadcast("turn_changed", {
      playerId: nextPlayer.sessionId,
      name: nextPlayer.name,
    });

    this.startTurnTimer(this.state.currentPlayer);
  }

  private startTurnTimer(sessionId: string) {
    this.clearPlayerInactivityTimer(sessionId);

    const timer = setTimeout(() => {
      const player = this.state.players.get(sessionId);
      if (player) {
        player.missedMoves++;

        this.broadcast("missed_move", {
          playerId: sessionId,
          name: player.name,
          missedMoves: player.missedMoves,
        });

        if (player.missedMoves >= 3) {
          player.disqualified = true;
          this.broadcast("player_disqualified", {
            playerId: sessionId,
            name: player.name,
          });
        }
        if (this.state.mode === "turn") {
          this.advanceTurn();
        }
      }
      this.broadcastState();
    }, 10_000);

    this.playerInactivityTimers.set(sessionId, timer);
  }

  private checkWinCondition() {
    for (const player of this.state.players.values()) {
      if (player.hasWon && player.hasWon()) {
        this.endGame();
        return;
      }
    }

    const activePlayers = Array.from(this.state.players.values()).filter((p) => !p.disqualified);
    if (activePlayers.length <= 1) {
      this.endGame();
    }
  }

  private async endGame() {
    this.clearTimers();
    this.state.gameStatus = "finished";
    this.state.ended = true;

    const allScoresAreZero = Array.from(this.state.players.values()).every((p) => p.score === 0);
    if (allScoresAreZero) {
      this.broadcast("game_ended", {
        winner: "",
        noContest: true,
        scores: Array.from(this.state.players.entries()).map(([id, p]) => ({
          playerId: id,
          name: p.name,
          score: p.score,
        })),
      });
      await this.refundAllPlayers();
      this.clock.setTimeout(() => this.disconnect(), 10_000);
      return;
    }

    let maxScore = -1;
    let winners: string[] = [];

    this.state.players.forEach((player, id) => {
      if (player.score > maxScore) {
        maxScore = player.score;
        winners = [id];
      } else if (player.score === maxScore) {
        winners.push(id);
      }
    });

    const isDraw = winners.length > 1;
    this.state.winner = isDraw ? "" : winners[0];

    this.broadcast("game_ended", {
      winner: this.state.winner,
      isDraw,
      scores: Array.from(this.state.players.entries()).map(([id, p]) => ({
        playerId: id,
        name: p.name,
        score: p.score,
      })),
    });

    if (isDraw) {
      await this.refundAllPlayers();
    } else {
      const winnerPlayer = this.state.players.get(this.state.winner);
      const winnerUniqueId = winnerPlayer?.uniqueId;

      if (winnerUniqueId) {
        const users = Array.from(this.state.players.values()).map((player) => player.uniqueId);

        KafkaWalletService.sendGameEndRequest(users, winnerUniqueId, this.matchOptionId, this.roomId, this.winAmount);
      }
    }

    this.clock.setTimeout(() => this.disconnect(), 10_000);
  }

  private async refundAllPlayers() {
    try {
      const users = Array.from(this.state.players.values()).map((player) => player.uniqueId);
      await KafkaWalletService.sendGameDrawRequest(users, this.matchOptionId, this.roomId, "match_draw");
    } catch (err) {
      console.error("Refund failed:", err);
    }
  }

  private resetGame() {
    // Reset mode votes for rematch
    this.modeVotes.clear();
    this.state.mode = "";
    this.state.modeSelected = false;

    this.generateBoard();
    this.state.players.forEach((player, sessionId) => {
      player.pawnPositions = new ArraySchema<number>(0, 0, 0);
      player.score = 0;
      player.movesTaken = 0;
      player.missedMoves = 0;
      player.disqualified = false;
      this.resetPlayerInactivityTimer(sessionId);
    });

    this.rematchVotes.clear();
    this.state.currentPlayer = this.pickFirstActivePlayer();
    this.state.gameStatus = "waiting";
    this.state.started = false;
    this.state.ended = false;

    this.broadcast("game_restarted");
    this.broadcast("mode_vote_start", { options: ["turn", "time"] });
    this.broadcastState();
  }

  private pickFirstActivePlayer(): string {
    const activePlayers = Array.from(this.state.players.values()).filter((p) => !p.disqualified);
    return activePlayers[Math.floor(Math.random() * activePlayers.length)]?.sessionId || "";
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private clearCountdown() {
    if (this.countdownTimer) {
      this.countdownTimer.clear();
      this.countdownTimer = undefined;
    }
  }

  private resetPlayerInactivityTimer(sessionId: string, timeoutMs = 2 * 60 * 1000) {
    this.clearPlayerInactivityTimer(sessionId);
    const timer = setTimeout(() => {
      const player = this.state.players.get(sessionId);
      if (player && !player.disqualified) {
        player.disqualified = true;
        this.broadcast("player_disqualified", { playerId: player.sessionId, reason: "inactivity" });
        this.checkWinCondition();
      }
      this.broadcastState();
    }, timeoutMs);
    this.playerInactivityTimers.set(sessionId, timer);
  }

  private clearPlayerInactivityTimer(sessionId: string) {
    if (this.playerInactivityTimers.has(sessionId)) {
      clearTimeout(this.playerInactivityTimers.get(sessionId));
      this.playerInactivityTimers.delete(sessionId);
    }
  }

  private startInactivityTimer() {
    if (this.inactivityTimer) this.inactivityTimer.clear();
    this.inactivityTimer = this.clock.setTimeout(() => {
      this.broadcast("info", { message: "Game ended due to inactivity." });
      this.endGame();
    }, 1000 * 60 * 10);
  }

  private startGameTimeout() {
    if (this.gameTimeout) this.gameTimeout.clear();
    this.gameTimeout = this.clock.setTimeout(() => {
      this.endGame();
    }, MATCH_DURATION_MS);
  }

  private clearTimers() {
    if (this.inactivityTimer) {
      this.inactivityTimer.clear();
      this.inactivityTimer = undefined;
    }
    if (this.gameTimeout) {
      this.gameTimeout.clear();
      this.gameTimeout = undefined;
    }
    this.clearCountdown();
    for (const timer of this.playerInactivityTimers.values()) {
      clearTimeout(timer);
    }
    this.playerInactivityTimers.clear();
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }
  }

  private broadcastState() {
    this.broadcast("state-update", this.state.toJSON());
  }
}
