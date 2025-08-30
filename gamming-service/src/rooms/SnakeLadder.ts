// // ✅ FULLY UPDATED CODE (Tested for Pawn Updates)

// import { Room, Client } from "colyseus";
// import { MyRoomState, Player } from "./schema/SnakeLadderState";


// import { v4 as uuidv4 } from "uuid";
// import { Types } from "mongoose";
// import { KafkaClient } from "../kafka/kafkaClient";
// import redisClient from "../redis/redisClient";
// import MatchOption from "../models/MatchOption.model"
// import mongoose from "mongoose"
// import KafkaWalletService from "../kafka/walletKafka"





// export class SnakeLadder extends Room<MyRoomState> {
//   snakes = { 38: 1, 91: 76, 99: 12 };
//   ladders = { 10: 12, 40: 61, 44: 56, 51: 88 };

//   isPrivate: boolean = false;
//   allowedUserIds: string[] = [];
//   gameTimeout: NodeJS.Timeout | null = null;
//   playerTimer: NodeJS.Timeout | null = null;


// // ------------------------------------
//   everyoneJoined: boolean = false;
//   betAmount: Number=0;
//   winAmount: Number=0;
//   matchOptionId: Number=0;
//   minPlayer: Number=0;
//   playerCount: Number=0;

// rematchVotes: Set<string> = new Set();

// // ------------------------------------

//   gameEnded: boolean = false;

//   async onAuth(client: Client, options: any) {
//     const userId = options.userId;
//     const isPrivate = this.metadata?.isPrivate || false;
//     const allowedUserIds = this.metadata?.allowedUserIds || [];

//     // ----------------------------------------------


//      const uniqueId = options.uniqueId;
//      const useBonus = options.useBonus
  









//     // ----------------------------------------------
//     if (isPrivate && !allowedUserIds.includes(userId)) {
//       throw new Error("You are not allowed to join this private room.");
//     }


//      const existingPlayer = Array.from(this.state.players.values()).find(
//         (p) => p.uniqueId === uniqueId
//       );
    
//       if (existingPlayer) {
//         (client as any).isReconnecting = true;
//         (client as any).reconnectUniqueId = uniqueId;
//         return true;
//       }
    
//       const isGameInProgress = this.state.gameStatus === "in-progress";
//       if ((this.state.everyoneJoined || isGameInProgress) && !existingPlayer) {
//         throw new Error("Room is full or game already in progress.");
//       }
    
//       try {
//         const roomId = this.listing.roomId
//         const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(uniqueId, Number(this.betAmount), useBonus , roomId);
//         if (!walletResponse.success) {
//           throw new Error(walletResponse.message || "Wallet deduction failed.");
//         }
//       } catch (err) {
//         console.error("Wallet Error:", err);
//         throw new Error("Unable to join: Wallet validation failed.");
//       }
    








//     // ----------------------------------------------
//     return true;
//   }



//   async onCreate(options: any) {


//       const matchoptionId = new mongoose.Types.ObjectId(options.matchOptionId);
//       const matchOption = await MatchOption.findById(matchoptionId);
    
//       if (!matchOption) {
//         throw new Error("MatchOption not found");
//       }
    
//       const { numberOfPlayers, winningAmount, bettingAmount, minimumPlayers } = matchOption;

 



//     const playerCount =  numberOfPlayers || 4;
//     const isPrivate = options.isPrivate || false;
//     const allowedUserIds = options.allowedUserIds || [];
//     const entryFee = options.entryFee || 0;
//     const matchId = options.matchOptionId ;

//     this.setMetadata({
//       playerCount,
//       matchId,
//       entryFee,
//       isPrivate,
//       allowedUserIds,
//       createdAt: new Date().toISOString(),
//     });

//     this.maxClients = playerCount;
//     this.minPlayer= minimumPlayers || 2;
//     this.isPrivate = isPrivate;
//     this.allowedUserIds = allowedUserIds;
//     this.setState(new MyRoomState());
//     this.gameEnded = false;

//     this.onMessage("chat", (client, message) => {
//       const pawnIndex = message.pawnIndex;
//       if (this.gameEnded || !this.state.gameStarted) return;

//       const player = this.state.players.get(client.sessionId);
//       if (!player) return;

//       if (this.state.currentPlayer !== client.sessionId) {
//         this.send(client, "log", "❌ Not your turn!");
//         return;
//       }

//       if (pawnIndex >= player.pawns.length) {
//         this.send(client, "log", "❌ Invalid pawn selection.");
//         return;
//       }

//       this.clearPlayerTimer();

//       const dice = Math.floor(Math.random() * 6) + 1;
//       console.log(`🎲 Dice Result → ${player.name} rolled ${dice}`);
//       this.broadcast("dice_result", { playerId: player.id, value: dice, pawnIndex });

//       if (!player.started[pawnIndex]) {
//         if (dice === 6) {
//           player.started[pawnIndex] = true;
//           player.pawns[pawnIndex] = 1; // 🟢 Pawn enters board at position 1
//           this.broadcast("pawn_update", { playerId: player.id, pawnIndex, position: 1 });
//           this.send(client, "log", `🎯 Pawn ${pawnIndex + 1} entered the board!`);
//         } else {
//           this.nextTurn();
//         }
//         return;
//       }

//       let newPos = player.pawns[pawnIndex] + dice;
//       if (newPos > 100) newPos = player.pawns[pawnIndex];

//       if (this.snakes[newPos]) {
//         const to = this.snakes[newPos];
//         this.broadcast("snake", { playerId: player.id, pawnIndex, from: newPos, to });
//         newPos = to;
//       } else if (this.ladders[newPos]) {
//         const to = this.ladders[newPos];
//         this.broadcast("ladder", { playerId: player.id, pawnIndex, from: newPos, to });
//         newPos = to;
//       }

//       player.pawns[pawnIndex] = newPos;
//       this.broadcast("pawn_update", { playerId: player.id, pawnIndex, position: newPos });

//       if (newPos === 100) {
//         player.finished[pawnIndex] = true;
//         this.send(client, "log", `✅ Pawn ${pawnIndex + 1} finished!`);
//       }

//       if (player.finished.every(f => f)) {
//         this.broadcast("game_over", { winner: player.name });
//         this.clearGameTimer();
//         this.clearPlayerTimer();
//         this.gameEnded = true;
//         this.lock();
//         this.disconnect();
//         return;
//       }

//       if (dice !== 6) this.nextTurn();
//     });
//   }

//   onJoin(client: Client, options: any) {
//     console.log("✅ Player joined:", options.name);
//     const newPlayer = new Player();
//     newPlayer.id = client.sessionId;
//     newPlayer.name = options.name || `Player ${this.clients.length}`;

//     const pawnCount = options.pawnCount || 2;
//     newPlayer.pawns = Array(pawnCount).fill(0);
//     newPlayer.started = Array(pawnCount).fill(false);
//     newPlayer.finished = Array(pawnCount).fill(false);

//     this.state.players.set(client.sessionId, newPlayer);

//     if (this.clients.length === this.maxClients && !this.state.gameStarted) {
//       this.state.gameStarted = true;
//       const first = this.clients[0];
//       this.state.currentPlayer = first.sessionId;
//       this.broadcast("game_start", { currentPlayer: this.state.currentPlayer });
//       this.startPlayerTimer();
//       this.gameTimeout = setTimeout(() => this.endGameByTimeout(), 3 * 60 * 1000);
//     }
//   }

//   onLeave(client: Client) {
//     this.state.players.delete(client.sessionId);
//   }

//   nextTurn() {
//     const ids = Array.from(this.state.players.keys());
//     const currentIndex = ids.indexOf(this.state.currentPlayer);
//     const nextIndex = (currentIndex + 1) % ids.length;
//     this.state.currentPlayer = ids[nextIndex];
//     this.broadcast("next_turn", { currentPlayer: this.state.currentPlayer });
//     this.startPlayerTimer();
//   }

//   startPlayerTimer() {
//     this.clearPlayerTimer();
//     this.playerTimer = setTimeout(() => {
//       console.log(`⏱️ Player ${this.state.currentPlayer} timed out. Skipping turn.`);
//       const client = this.clients.find(c => c.sessionId === this.state.currentPlayer);
//       if (client) {
//         client.send("log", "⏳ You took too long. Turn skipped.");
//       }
//       this.nextTurn();
//     }, 30 * 1000);
//   }

//   clearPlayerTimer() {
//     if (this.playerTimer) {
//       clearTimeout(this.playerTimer);
//       this.playerTimer = null;
//     }
//   }

//   clearGameTimer() {
//     this.gameEnded = true;
//     if (this.gameTimeout) {
//       clearTimeout(this.gameTimeout);
//       this.gameTimeout = null;
//     }
//   }

//   endGameByTimeout() {
//     if (this.gameEnded) return;

//     let highestPlayer: Player | null = null;
//     let highestScore = -1;

//     this.state.players.forEach((player) => {
//       const totalScore = player.pawns.reduce((sum, pos) => sum + pos, 0);
//       if (totalScore > highestScore) {
//         highestScore = totalScore;
//         highestPlayer = player;
//       }
//     });

//     if (highestPlayer) {
//       this.broadcast("game_over", {
//         winner: highestPlayer.name,
//         reason: "timeout",
//         score: highestScore,
//       });
//     } else {
//       this.broadcast("game_over", { winner: null, reason: "timeout" });
//     }

//     this.clearGameTimer();
//     this.clearPlayerTimer();
//     this.gameEnded = true;
//     this.lock();
//     this.disconnect();
//   }
// }
// ✅ SnakeLadderState.ts (Schema)

import { Room, Client } from "colyseus";
import { MyRoomState, Player } from "./schema/SnakeLadderState";

import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import MatchOption from "../models/MatchOption.model";
import KafkaWalletService from "../kafka/walletKafka";

export class SnakeLadder extends Room<MyRoomState> {
  snakes = { 38: 1, 91: 76, 99: 12 };
  ladders = { 10: 12, 40: 61, 44: 56, 51: 88 };

  isPrivate: boolean = false;
  allowedUserIds: string[] = [];
  gameTimeout: NodeJS.Timeout | null = null;
  playerTimer: NodeJS.Timeout | null = null;
  matchOptionId: string ="";

  gameEnded: boolean = false;

  async onAuth(client: Client, options: any) {
    const userId = options.userId;
    const uniqueId = options.uniqueId;
    const useBonus = options.useBonus;
    
    console.log(options)
    if (this.metadata?.isPrivate && !this.metadata.allowedUserIds.includes(userId)) {
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
      const roomId = this.listing.roomId;
      const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(uniqueId, Number(this.state.betAmount), useBonus, roomId);
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

    const playerCount = numberOfPlayers || 4;
    const isPrivate = options.isPrivate || false;
    const allowedUserIds = options.allowedUserIds || [];
    const entryFee = options.entryFee || 0;

    this.setMetadata({
      playerCount,
      
      entryFee,
      isPrivate,
      allowedUserIds,
      createdAt: new Date().toISOString(),
    });

    this.maxClients = playerCount;
    this.isPrivate = isPrivate;
    this.allowedUserIds = allowedUserIds;

    this.setState(new MyRoomState());
    this.state.playerCount = playerCount;
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = matchoptionId.toString();
    this.state.minPlayer = minimumPlayers || 2;
    this.gameEnded = false;

    this.onMessage("chat", (client, message) => {
      const pawnIndex = message.pawnIndex;
      if (this.gameEnded || !this.state.gameStarted) return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      if (this.state.currentPlayer !== client.sessionId) {
        this.send(client, "log", "❌ Not your turn!");
        return;
      }

      if (pawnIndex >= player.pawns.length) {
        this.send(client, "log", "❌ Invalid pawn selection.");
        return;
      }

      this.clearPlayerTimer();

      const dice = Math.floor(Math.random() * 6) + 1;
      console.log(`🎲 Dice Result → ${player.name} rolled ${dice}`);
      this.broadcast("dice_result", { playerId: player.id, value: dice, pawnIndex });

      if (!player.started[pawnIndex]) {
        if (dice === 6) {
          player.started[pawnIndex] = true;
          player.pawns[pawnIndex] = 1;
          this.broadcast("pawn_update", { playerId: player.id, pawnIndex, position: 1 });
          this.send(client, "log", `🎯 Pawn ${pawnIndex + 1} entered the board!`);
        } else {
          this.nextTurn();
        }
        return;
      }

      let newPos = player.pawns[pawnIndex] + dice;
      if (newPos > 100) newPos = player.pawns[pawnIndex];

      if (this.snakes[newPos]) {
        const to = this.snakes[newPos];
        this.broadcast("snake", { playerId: player.id, pawnIndex, from: newPos, to });
        newPos = to;
      } else if (this.ladders[newPos]) {
        const to = this.ladders[newPos];
        this.broadcast("ladder", { playerId: player.id, pawnIndex, from: newPos, to });
        newPos = to;
      }

      player.pawns[pawnIndex] = newPos;
      this.broadcast("pawn_update", { playerId: player.id, pawnIndex, position: newPos });

      if (newPos === 100) {
        player.finished[pawnIndex] = true;
        this.send(client, "log", `✅ Pawn ${pawnIndex + 1} finished!"`);
      }

      if (player.finished.every(f => f)) {
        this.broadcast("game_over", { winner: player.name });
        this.clearGameTimer();
        this.clearPlayerTimer();
        this.gameEnded = true;
        this.lock();
        this.disconnect();
        return;
      }

      if (dice !== 6) this.nextTurn();
    });
  }

  onJoin(client: Client, options: any) {
    console.log("✅ Player joined:", options.name);
    const newPlayer = new Player();
    newPlayer.id = client.sessionId;
    newPlayer.name = options.name || `Player ${this.clients.length}`;
    newPlayer.uniqueId = options.uniqueId || uuidv4();

    const pawnCount = options.pawnCount || 2;
    newPlayer.pawns = Array(pawnCount).fill(0);
    newPlayer.started = Array(pawnCount).fill(false);
    newPlayer.finished = Array(pawnCount).fill(false);

    this.state.players.set(client.sessionId, newPlayer);

    if (this.clients.length === this.maxClients && !this.state.gameStarted) {
      this.state.gameStarted = true;
      const first = this.clients[0];
      this.state.currentPlayer = first.sessionId;
      this.broadcast("game_start", { currentPlayer: this.state.currentPlayer });

          const users = Array.from(this.state.players.values()).map(player => player.uniqueId);
              const gameStartResponse = KafkaWalletService.sendGameStartRequest(users,this.state.betAmount, "68219aec39a3ab04b1b5f8ab", this.roomId)
      this.startPlayerTimer();
      this.gameTimeout = setTimeout(() => this.endGameByTimeout(), 3 * 60 * 1000);
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  nextTurn() {
    const ids = Array.from(this.state.players.keys());
    const currentIndex = ids.indexOf(this.state.currentPlayer);
    const nextIndex = (currentIndex + 1) % ids.length;
    this.state.currentPlayer = ids[nextIndex];
    this.broadcast("next_turn", { currentPlayer: this.state.currentPlayer });
    this.startPlayerTimer();
  }

  startPlayerTimer() {
    this.clearPlayerTimer();
    this.playerTimer = setTimeout(() => {
      console.log(`⏱️ Player ${this.state.currentPlayer} timed out. Skipping turn.`);
      const client = this.clients.find(c => c.sessionId === this.state.currentPlayer);
      if (client) {
        client.send("log", "⏳ You took too long. Turn skipped.");
      }
      this.nextTurn();
    }, 30 * 1000);
  }

  clearPlayerTimer() {
    if (this.playerTimer) {
      clearTimeout(this.playerTimer);
      this.playerTimer = null;
    }
  }

  clearGameTimer() {
    this.gameEnded = true;
    if (this.gameTimeout) {
      clearTimeout(this.gameTimeout);
      this.gameTimeout = null;
    }
  }

  endGameByTimeout() {
    if (this.gameEnded) return;

    let highestPlayer: Player | null = null;
    let highestScore = -1;

    this.state.players.forEach((player) => {
      const totalScore = player.pawns.reduce((sum, pos) => sum + pos, 0);
      if (totalScore > highestScore) {
        highestScore = totalScore;
        highestPlayer = player;
      }
    });

    if (highestPlayer) {
      this.broadcast("game_over", {
        winner: highestPlayer.name,
        reason: "timeout",
        score: highestScore,
      });


      const users = Array.from(this.state.players.values()).map(player => player.uniqueId);
      
            KafkaWalletService.sendGameEndRequest(
    
      
     
        users,
        highestPlayer.uniqueId, // ✅ Send winner's uniqueId here
        "68219aec39a3ab04b1b5f8ab", 
        this.roomId,
         this.state.winAmount // ✅ Use the correct win amount from the state
            );
    } else {


      this.broadcast("game_over", { winner: null, reason: "timeout" });
    }

    this.clearGameTimer();
    this.clearPlayerTimer();
    this.gameEnded = true;
    this.lock();
    this.disconnect();
  }
}
