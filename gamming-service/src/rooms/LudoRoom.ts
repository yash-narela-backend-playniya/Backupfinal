

import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/MyRoomState";
import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";
import { KafkaClient } from "../kafka/kafkaClient";
import redisClient from "../redis/redisClient";
import MatchOption from "../models/MatchOption.model"
import mongoose from "mongoose"
import KafkaWalletService from "../kafka/walletKafka"

(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

export class LudoRoom extends Room<MyRoomState> {
  safeSpots: number[] = [];
  playerStartIndices = [0, 26, 13, 39];
  boardLength = 52;
  allowedUserIds: string[] = [];
  isPrivate: boolean = false;
  winner: string = "";
  everyoneJoined: boolean = false;
  betAmount: Number=0;
  winAmount: Number=0;
  matchOptionId: Number=0;
  minPlayer: Number=0;
  playerCount: Number=0;
  inactivityTimer: any = null;
  gameTimeout: any = null;
  rematchVotes: Set<string> = new Set();
 
  

  
  async onAuth(client: Client, options: any): Promise<any> {
  const userId = options.userId;
  const uniqueId = options.uniqueId;
  const isPrivate = this.metadata?.isPrivate || false;
  const allowedUserIds = this.metadata?.allowedUserIds || [];
  const useBonus = options.useBonus
  

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
    const roomId = this.listing.roomId
    const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(uniqueId, Number(this.betAmount), useBonus , roomId);
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
    console.log(matchoptionId)
  const matchOption = await MatchOption.findById(matchoptionId);
  console.log

  if (!matchOption) {
    throw new Error("MatchOption not found");
  }

  const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } = matchOption;

  this.playerCount = numberOfPlayers;
  this.minPlayer = minimumPlayers;
  this.betAmount = bettingAmount;
  this.winAmount = winningAmount;

  this.setMetadata({
    playerCount: numberOfPlayers,
    isPrivate: options.isPrivate || false,
    allowedUserIds: options.allowedUserIds || [],
  });

  this.setState(new MyRoomState());
  this.state.gameStatus = "waiting";
  this.state.playerCount = numberOfPlayers;
  this.state.betAmount = bettingAmount;
  this.state.winAmount = winningAmount;
  this.state.matchOptionId = options.matchOptionId;
  this.state.minPlayer = minimumPlayers;

  this.maxClients = numberOfPlayers;
  this.boardLength = numberOfPlayers === 3 ? 39 : 52;
  this.safeSpots = [0, 8, 13, 21, 26, 34, 39, 47];
  this.isPrivate = options.isPrivate || false;
  this.allowedUserIds = options.allowedUserIds || [];

    this.onMessage("join_game", (client, message) => {
      const existingPlayer = this.state.players.get(client.sessionId);
    
      if (this.state.players.size >= this.maxClients) {
        client.send("error", { message: "The room is full." });
        return;
      }
     
    
      if (!existingPlayer) {
        const player = new Player(message.name, message.uniqueId);
        const index = this.state.players.size;
        player.startIndex = this.playerStartIndices[index];
        this.state.players.set(client.sessionId, player);
      }
    
      if (this.state.players.size === this.maxClients) {
        this.state.gameStatus = "in-progress";
        this.state.everyoneJoined = true;
        this.state.currentPlayer = Array.from(this.state.players.keys())[0];
        this.startInactivityTimer();
        this.startGameTimeout();
        const users = Array.from(this.state.players.values()).map(player => player.uniqueId);
        const gameStartResponse = KafkaWalletService.sendGameStartRequest(users, this.betAmount, "68219aec39a3ab04b1b5f8ab", this.roomId)
      }
      
      this.broadcastState();
    });
    

    this.onMessage("roll_dice", (client) => {
      if (this.state.currentPlayer !== client.sessionId) return;
      if (this.state.diceRolls.has(client.sessionId)) {
        client.send("error", { message: "You already rolled." });
        return;
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      this.state.diceRolls.set(client.sessionId, roll);
      const player = this.state.players.get(client.sessionId);
      const unlocked = player.pawns.filter(p => p.isUnlocked && !p.hasReachedHome);
      const locked = player.pawns.filter(p => !p.isUnlocked);

      if (unlocked.length === 0 && roll !== 6) {
        client.send("no_valid_move", { reason: "All pawns are locked." });
        this.state.diceRolls.delete(client.sessionId);
        this.advanceTurn(client.sessionId);
        this.broadcastState();
        return;
      }

      if (unlocked.length === 1 && locked.length === 3 && roll !== 6) {
        const pawn = unlocked[0];
        const newPosition = pawn.position + roll;
        if (newPosition <= 30) {
          pawn.position = newPosition;
          this.handleCapture(client.sessionId, pawn);
          this.checkWinCondition(client.sessionId);
        } else {
          client.send("invalid_move", { reason: "Move exceeds." });
        }
        this.state.diceRolls.delete(client.sessionId);
        this.advanceTurn(client.sessionId);
        this.broadcastState();
        return;
      }

      this.broadcast("dice_result", {
        sessionId: client.sessionId,
        roll,
      });

      client.send("choose_pawn", { roll, pawns: player.pawns });
      this.startInactivityTimer()
    });

    this.onMessage("move_pawn", (client, message) => {
      if (this.state.currentPlayer !== client.sessionId) return;

      const player = this.state.players.get(client.sessionId);
      const roll = this.state.diceRolls.get(client.sessionId);
      if (roll === undefined) {
        client.send("error", { message: "Roll the dice first!" });
        return;
      }

      const pawn = player.pawns[message.pawnIndex];
      if (!pawn || pawn.hasReachedHome) {
        client.send("invalid_move", { reason: "Invalid pawn." });
        return;
      }

      let moveSuccess = false;
      let didCapture = false;

      if (!pawn.isUnlocked && roll === 6) {
        pawn.isUnlocked = true;
        pawn.position = 0;
        moveSuccess = true;
      } else if (pawn.isUnlocked) {
        const globalPos = (pawn.position + player.startIndex) % this.boardLength;
        const entry = (player.startIndex + this.boardLength - 1) % this.boardLength;
        const steps = (this.boardLength + entry - globalPos + 1) % this.boardLength || this.boardLength;

        if (!pawn.isInHomeStretch) {
          if (steps === roll) {
            pawn.isInHomeStretch = true;
            pawn.homeStretchPosition = 0;
            moveSuccess = true;
          } else if (roll < steps) {
            pawn.position += roll;
            moveSuccess = true;
          } else {
            client.send("invalid_move", { reason: "Overshoots home stretch." });
          }
        } else {
          const newStretch = pawn.homeStretchPosition + roll;
          if (newStretch < 5) {
            pawn.homeStretchPosition = newStretch;
            moveSuccess = true;
          } else if (newStretch === 5) {
            pawn.homeStretchPosition = 5;
            pawn.hasReachedHome = true;
            player.score += 20;
            moveSuccess = true;
          } else {
            client.send("invalid_move", { reason: "Overshoots home." });
          }
        }

        if (moveSuccess) {
          didCapture = this.handleCapture(client.sessionId, pawn);
          this.checkWinCondition(client.sessionId);
        }
      }

      this.state.diceRolls.delete(client.sessionId);
      if (!(roll === 6 || didCapture)) this.advanceTurn(client.sessionId);
      this.broadcastState();
    });

    this.onMessage("rematch_request", (client) => {
      this.rematchVotes.add(client.sessionId);
      if (this.rematchVotes.size === this.state.players.size) {
        this.resetGame();
      }
    });

    
    
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
  
  
  
  
  handleCapture(currentId: string, movedPawn: any): boolean {
    const current = this.state.players.get(currentId);
    const movedGlobal = (current.startIndex + movedPawn.position) % this.boardLength;
    let captured = false;6

    this.state.players.forEach((player, id) => {
      if (id === currentId) return;
      for (let p of player.pawns) {
        if (!p.isUnlocked || p.hasReachedHome || p.isInHomeStretch) continue;
        const pos = (player.startIndex + p.position) % this.boardLength;
        if (pos === movedGlobal && !this.safeSpots.includes(pos)) {
          p.position = 0;
          p.isUnlocked = false;
          p.isInHomeStretch = false;
          p.homeStretchPosition = 0;
          current.score += 10;
          captured = true;
        }
      }
    });

    return captured;
  }

  
  
  
  async onLeave(client: Client, consented: boolean) {
    if (this.state.gameStatus === "finished") {
      this.state.players.delete(client.sessionId);
      return;
    }
  
    this.broadcast("info", { message: `${this.state.players.get(client.sessionId)?.name} disconnected.` });
  }
  

  checkWinCondition(sessionId: string) {
    const player = this.state.players.get(sessionId);
    if (player.pawns.every(p => p.hasReachedHome)) {
      player.score += 100;
      this.state.gameStatus = "finished";
      this.clearTimers();
      this.determineWinner(); 
    }
  }

  determineWinner() {
    let winners: string[] = [];
    let maxScore = -1;

    this.state.players.forEach((player, id) => {
        const completed = player.pawns.filter(p => p.hasReachedHome).length;
        player.score = completed * 20;

        if (player.score > maxScore) {
            maxScore = player.score;
            winners = [id];
        } else if (player.score === maxScore) {
            winners.push(id);
        }
    });

    if (winners.length > 1 || maxScore <= 0) {
        let maxSum = -1;
        let finalWinners: string[] = [];

        this.state.players.forEach((player, id) => {
            const total = player.pawns.reduce((sum, p) => sum + p.position, 0);

            if (total > maxSum) {
                maxSum = total;
                finalWinners = [id];
            } else if (total === maxSum) {
                finalWinners.push(id);
            }
        });

        winners = finalWinners;
    }

    this.state.winner = winners[0];

    this.broadcast("game_ended", {
        winner: this.state.winner,
        scores: Array.from(this.state.players.entries()).map(([id, p]) => ({
            playerId: id,
            name: p.name,
            score: p.score,
        })),
    });

    console.log("Winner is", winners[0]);
    const winnerPlayer = this.state.players.get(this.state.winner);
    const winnerUniqueId = winnerPlayer ? winnerPlayer.uniqueId : null;

    if (!winnerUniqueId) {
      console.error("❌ Winner uniqueId not found!");
    } else {
      const users = Array.from(this.state.players.values()).map(player => player.uniqueId);

      KafkaWalletService.sendGameEndRequest(
        users,
        winnerUniqueId,
        "68219aec39a3ab04b1b5f8ab", 
        this.roomId,
        this.winAmount
      );
    }
        this.clock.setTimeout(() => this.disconnect(), 10000);
    }


  

  advanceTurn(currentId: string) {
    const ids = Array.from(this.state.players.keys());
    const next = (ids.indexOf(currentId) + 1) % ids.length;
    this.state.currentPlayer = ids[next];
    this.startInactivityTimer();
  }

  startInactivityTimer() {
    if (this.inactivityTimer) this.inactivityTimer.clear();
  
    this.inactivityTimer = this.clock.setTimeout(() => {
      const currentId = this.state.currentPlayer;
  
      if (!this.state.diceRolls.has(currentId)) {
        this.broadcast("info", { message: "Turn skipped due to inactivity." });
        this.advanceTurn(currentId);
        this.broadcastState();
        return;
      }
  
      const player = this.state.players.get(currentId);
      const roll = this.state.diceRolls.get(currentId);
      const movablePawns = player.pawns
        .map((p, i) => ({ ...p, index: i }))
        .filter(p => {
          if (!p.isUnlocked && roll === 6) return true;
          if (p.isUnlocked && !p.hasReachedHome) return true;
          return false;
          
        });
  
      if (movablePawns.length > 0) {
        const chosen = movablePawns[Math.floor(Math.random() * movablePawns.length)];
        this.onMessageHandlers.get("move_pawn")?.(this.clients.get(currentId), { pawnIndex: chosen.index });
      } else {
        this.broadcast("info", { message: "No valid move. Turn skipped." });
        this.advanceTurn(currentId);
        this.broadcastState();
      }
    }, 30000); 
  }
  

  startGameTimeout() {
    if (this.gameTimeout) this.gameTimeout.clear();
    this.gameTimeout = this.clock.setTimeout(() => {
      this.state.gameStatus = "finished";
      this.clearTimers();
      this.determineWinner();
      this.broadcastState();
    }, 3 * 60 * 1000);
  }

  resetGame() {
    this.state.players.forEach(player => {
      player.pawns.forEach(p => {
        p.position = 0;
        p.isUnlocked = false;
        p.isInHomeStretch = false;
        p.hasReachedHome = false;
        p.homeStretchPosition = 0;
      });
      player.score = 0;
    });

    this.rematchVotes.clear();
    this.state.diceRolls.clear();
    this.state.gameStatus = "in-progress";
    this.state.currentPlayer = Array.from(this.state.players.keys())[0];
    this.startInactivityTimer();
    this.startGameTimeout();
    this.broadcastState();
  }

  clearTimers() {
    if (this.inactivityTimer) this.inactivityTimer.clear();
    if (this.gameTimeout) this.gameTimeout.clear();
    this.inactivityTimer = null;
    this.gameTimeout = null;
  }

  broadcastState() {
    this.broadcast("state_update", this.state);
  }
}
