// import mongoose from "mongoose";
// import { Delayed } from "@colyseus/timer";
// import MatchOption from "../models/MatchOption.model";
// import { ArraySchema } from "@colyseus/schema";
// import KafkaWalletService from "../kafka/walletKafka";
// import { Room, Client } from "colyseus";

// import {
//   FruitNinjaState,
//   Player,
//   Fruit,
//   Vector2,
//   Bomb,
// } from "./schema/FruitSlicerState";

// (async () => {
//   await KafkaWalletService.initialize();
//   console.log("✅ KafkaWalletService ready");
// })();

// const FRUIT_TYPES = [
//   { name: "apple", points: 10, color: "#ff0000" },
//   { name: "banana", points: 15, color: "#ffff00" },
//   { name: "orange", points: 12, color: "#ffa500" },
//   { name: "watermelon", points: 25, color: "#00ff00" },
//   { name: "strawberry", points: 20, color: "#ff69b4" },
//   { name: "kiwi", points: 20, color: "#66bb66" },
//   { name: "pear", points: 15, color: "#d1e231" },
//   { name: "blueberry", points: 30, color: "#4f86f7" },
//   { name: "papaya", points: 12, color: "#ffb347" },
//   { name: "pineapple", points: 12, color: "#fada5e" },
// ];

// const MAX_FRUITS_ON_SCREEN = 8; // or whatever limit you want

// const FRUIT_RADIUS = 30;

// export class FruitNinjaRoom extends Room<FruitNinjaState> {
//   private wasMovingLastFrame: boolean = false;

//   private spawnInterval!: NodeJS.Timeout;
//   private bombSpawnInterval!: NodeJS.Timeout;
//   private lastUpdateTime: number = Date.now();
//   private gameTimer!: NodeJS.Timeout;
//   private countdownTimer!: NodeJS.Timeout;
//   private gameStarted: boolean = false;
//   private gameEnded: boolean = false;
//   private playerUniqueIds: Map<string, string> = new Map();
//   private deductedPlayers: Map<string, string> = new Map();
//   private rematchVotes: Set<string> = new Set();
//   private gameWidth: number = 800;
//   private gameHeight: number = 600;

//   // Game configuration
//   private betAmount: number = 0;
//   private winAmount: number = 0;
//   private matchOptionId: string = "";
//   private minPlayer: number = 0;
//   private playerCount: number = 0;

//   async onAuth(client: Client, data: any) {
//     const { uniqueId, useBonus, name } = data;

//     if (
//       this.metadata?.isPrivate &&
//       !this.metadata.allowedUserIds.includes(name)
//     ) {
//       throw new Error("❌ You are not allowed to join this private room.");
//     }

//     try {
//       const roomId = this.listing.roomId;
//       const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
//         uniqueId,
//         this.betAmount,
//         useBonus,
//         roomId
//       );

//       if (!walletResponse.success) {
//         throw new Error(walletResponse.message || "Wallet deduction failed.");
//       }

//       // Store player info for potential refund
//       this.playerUniqueIds.set(client.sessionId, uniqueId);
//       this.deductedPlayers.set(client.sessionId, uniqueId);
//     } catch (err) {
//       console.error("Wallet Error:", err);
//       throw new Error("Unable to join: Wallet validation failed.");
//     }

//     return true;
//   }

//   async onCreate(data: any) {
//     const matchOptionId = new mongoose.Types.ObjectId(data.matchOptionId);
//     const matchOption = await MatchOption.findById(matchOptionId);
//     if (!matchOption) throw new Error("MatchOption not found");

//     const numberOfPlayers =
//       data.playerCount || matchOption.numberOfPlayers || 2;
//     const isPrivate = data.isPrivate || false;
//     const allowedUserIds = data.allowedUserIds || [];

//     // Get game dimensions from client or use defaults
//     this.gameWidth = data.gameWidth || 1280;
//     this.gameHeight = data.gameHeight || 720;

//     this.setMetadata({
//       playerCount: numberOfPlayers,
//       isPrivate,
//       allowedUserIds,
//       gameWidth: this.gameWidth,
//       gameHeight: this.gameHeight,
//       createdAt: new Date().toISOString(),
//     });

//     this.maxClients = numberOfPlayers;

//     this.betAmount = matchOption.bettingAmount;
//     this.winAmount = matchOption.winningAmount;
//     this.matchOptionId = matchOptionId.toString();
//     this.minPlayer = matchOption.minimumPlayers || 2;
//     this.playerCount = numberOfPlayers;

//     this.setState(new FruitNinjaState());
//     this.state.gameStatus = "waiting";
//     this.state.betAmount = this.betAmount;
//     this.state.winAmount = this.winAmount;
//     this.state.matchOptionId = this.matchOptionId;
//     this.state.minPlayer = this.minPlayer;
//     this.state.playerCount = this.playerCount;
//     this.state.gameWidth = this.gameWidth;
//     this.state.gameHeight = this.gameHeight;

//     this.setupMessageHandlers();
//     console.log("🎮 Fruit Ninja room created!");
//   }

//   private setupMessageHandlers() {
//     // this.onMessage("slice", (client, message) => {
//     //   if (!this.gameStarted || this.gameEnded) return;

//     //   const player = this.state.players.get(client.sessionId);
//     //   if (!player) return;

//     //    console.log(`🔪 Player ${client.sessionId} sliced with trail:`, message.trail);

//     //   if (!message.trail || message.trail.length < 2) {
//     //     console.log("❌ Invalid trail data");
//     //     return;
//     //   }

//     //   player.sliceTrail.clear();

//     //    const flattened = message.trail.flat();

//     //   player.sliceTrail.push(...flattened);

//     //   // Check collisions
//     //   const result = this.checkSliceCollisions(client, flattened);

//     //   if (result.slicedFruits > 0) {
//     //     this.broadcast("fruitSliced", {
//     //       playerId: client.sessionId,
//     //       fruitsSliced: result.slicedFruits,
//     //       newScore: player.score,
//     //     });
//     //   }

//     //   if (result.bombHit) {
//     //     this.handleBombHit(client);
//     //   }
//     // });

//     //    this.onMessage("slice", (client, message) => {
//     //   if (!this.gameStarted || this.gameEnded) return;

//     //   const player = this.state.players.get(client.sessionId);
//     //   if (!player) return;

//     //   console.log(`🔪 Player ${client.sessionId} sliced with trail:`, message.trail);

//     //   if (!message.trail || message.trail.length < 2) {
//     //     console.log("❌ Invalid trail data");
//     //     return;
//     //   }

//     //   player.sliceTrail.clear();

//     //   const trailArray = Array.from(message.trail);
//     //   const flattened = trailArray.reduce((acc: number[], val: number[]) => acc.concat(val), []);

//     //   console.log(flattened);

//     //      player.sliceTrail.push(...flattened);

//     //   const result = this.checkSliceCollisions(client, flattened);

//     //   if (result.slicedFruits > 0) {
//     //     this.broadcast("fruitSliced", {
//     //       playerId: client.sessionId,
//     //       fruitsSliced: result.slicedFruits,
//     //       newScore: player.score,
//     //     });
//     //   }

//     //   if (result.bombHit) {
//     //     this.handleBombHit(client);
//     //   }
//     // });

//     this.onMessage("join_game", (client) => {
//       const player = this.state.players.get(client.sessionId);
//       if (player) {
//         player.ready = true;
//         console.log(`✅ Player ${client.sessionId} is ready`);

//         // Start game when all players are ready
//         if (
//           this.allPlayersReady() &&
//           this.state.players.size === this.maxClients
//         ) {
//           this.startCountdown();
//         }
//       }
//     });

//     //     this.onMessage("slice", (client, message) => {
//     //   if (!this.gameStarted || this.gameEnded) return;

//     //   const player = this.state.players.get(client.sessionId);
//     //   if (!player) return;

//     //   console.log(`🔪 Player ${client.sessionId} sliced with trail:`, message.trail);

//     //   if (!message.trail || message.trail.length < 2) {
//     //     console.log("❌ Invalid trail data");
//     //     return;
//     //   }

//     //   player.sliceTrail.clear();

//     //   const trailArray = Array.from(message.trail);
//     //   const flattened = trailArray.reduce((acc: number[], val: number[]) => acc.concat(val), []);

//     //   console.log("Flattened trail:", flattened);

//     //   console.log("Flattened trail:", flattened);

//     //   player.sliceTrail.push(...flattened);

//     //   const result = this.checkSliceCollisions(client, flattened);

//     //   if (result.slicedFruits > 0) {
//     //     this.broadcast("fruitSliced", {
//     //       playerId: client.sessionId,
//     //       fruitsSliced: result.slicedFruits,
//     //       newScore: player.score,
//     //     });
//     //   }

//     //   if (result.bombHit) {
//     //     this.handleBombHit(client);
//     //   }
//     // });

//     this.onMessage("slice", (client, message) => {
//       if (!this.gameStarted || this.gameEnded) return;

//       const player = this.state.players.get(client.sessionId);

//         if (!player || player.lives <= 0) return;
//       if (!player) return;

//       let trail = message.trail;

//       if (typeof trail === "string") {
//         try {
//           trail = JSON.parse(trail);
//           console.log("✅ Parsed string trail to array:", trail);
//         } catch (err) {
//           console.log("❌ Failed to parse trail string:", err);
//           return;
//         }
//       }

//       if (!Array.isArray(trail) || trail.length < 4) {
//         console.log("❌ Invalid trail data");
//         return;
//       }

//       player.sliceTrail.clear();
//       player.sliceTrail.push(...trail);

//       const result = this.checkSliceCollisions(client, trail);

//       if (result.slicedFruits > 0) {
//         this.broadcast("fruitSliced", {
//           playerId: client.sessionId,
//           fruitsSliced: result.slicedFruits,
//           newScore: player.score,
//         });
//       }

//       if (result.bombHit) {
//         this.handleBombHit(client);
//       }
//     });

//     this.onMessage("rematch", (client) => {
//       if (this.state.gameStatus === "ended") {
//         const player = this.state.players.get(client.sessionId);
//         if (player) {
//           player.rematchVote = true;
//           this.rematchVotes.add(client.sessionId);

//           if (this.rematchVotes.size === this.state.players.size) {
//             this.resetGame();
//           }
//         }
//       }
//     });
//   }

//   onJoin(client: Client, data: any) {
//     console.log(`🎮 Player ${client.sessionId} joined the game`);

//     const player = new Player();
//     player.uniqueId = data.uniqueId;
//     player.score = 0;
//     player.lives = 3;
//     player.ready = false;
//     player.rematchVote = false;

//     this.state.players.set(client.sessionId, player);
//   }

//   async onLeave(client: Client, consented: boolean) {
//     console.log(`👋 Player ${client.sessionId} left the game`);

//     // Handle refund if game didn't start
//     if (!this.gameStarted) {
//       const uniqueId = this.deductedPlayers.get(client.sessionId);
//       if (uniqueId) {
//         await this.refundPlayer(uniqueId);
//         this.deductedPlayers.delete(client.sessionId);
//       }
//     }

//     this.state.players.delete(client.sessionId);
//     this.playerUniqueIds.delete(client.sessionId);
//     this.rematchVotes.delete(client.sessionId);

//     if (this.state.players.size < this.minPlayer && this.gameStarted) {
//       this.endGame();
//     }
//   }

//   async onDispose() {
//     console.log("🧹 Disposing game room");

 
//     if (!this.gameStarted) {
//       for (const [sessionId, uniqueId] of this.deductedPlayers) {
//         await this.refundPlayer(uniqueId);
//       }
//     }


//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);
//     clearInterval(this.gameTimer);

//     if (this.countdownTimer) {
//       clearInterval(this.countdownTimer);
//     }
//   }

//   private allPlayersReady(): boolean {
//     let allReady = true;
//     this.state.players.forEach((player) => {
//       if (!player.ready) allReady = false;
//     });
//     return allReady;
//   }

//   private startCountdown() {
//     const GAME_COUNTDOWN = 3;

//     this.state.gameStatus = "getting_ready";
//     this.state.gameTime = GAME_COUNTDOWN;

//     console.log("🚦 Sending READY signal...");

//     this.broadcast("starting", { message: "Ready" });

  
//     setTimeout(() => {
//       this.state.gameStatus = "countdown";
//       let countdown = GAME_COUNTDOWN;
//       this.state.gameTime = countdown;

//       this.broadcast("countdown", { count: countdown });

    
//       this.countdownTimer = setInterval(() => {
//         countdown--;
//         this.state.gameTime = countdown;

//         if (countdown > 0) {
//           this.broadcast("countdown", { count: countdown });
//         } else {
//           clearInterval(this.countdownTimer);

      
    
//           this.startGame();
//         }
//       }, 1000);
//     }, 1000); 
//   }

//   private startGame() {
//     this.gameStarted = true;
//     this.state.gameStatus = "playing";
//     this.state.gameTime = 180; 

//     this.broadcast("game_started", { message: "GO!", fruitTypes: FRUIT_TYPES });
//     console.log("🚀 Game started!");

//     const users = Array.from(this.playerUniqueIds.values());
//     KafkaWalletService.sendGameStartRequest(
//       users,
//       this.betAmount,
//       this.matchOptionId,
//       this.roomId
//     );

    
//     this.setSimulationInterval((dt) => this.update(), 1000 / 60);

 
//     this.spawnInterval = setInterval(() => this.spawnFruit(), 800);

//     // Bomb spawning (5 seconds)
//     // this.bombSpawnInterval = setInterval(() => this.spawnBomb(), 5000);
//     this.scheduleNextBombSpawn();

//     // Game timer
//     this.gameTimer = setInterval(() => {
//       this.state.gameTime -= 1;

//       if (this.state.gameTime <= 0) {
//         this.endGame();
//       }
//     }, 1000);
//   }
//   private scheduleNextBombSpawn() {
//     if (!this.gameStarted || this.gameEnded) return;

//     const randomDelay = 1000 + Math.random() * 4000; 

//     this.bombSpawnInterval = setTimeout(() => {
//       this.spawnBomb(); // spawn a bomb now
//       this.scheduleNextBombSpawn(); 
//     }, randomDelay);

//     console.log(`⏱️ Next bomb in ${(randomDelay / 1000).toFixed(2)}s`);
//   }

//   private async endGame() {
//     this.gameEnded = true;
//     this.state.gameStatus = "ended";

//     clearInterval(this.gameTimer);
//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);

//     // Calculate winner
//     let winnerSessionId: string | null = null;
//     let highestScore = -1;

//     this.state.players.forEach((player, sessionId) => {
//       if (player.score > highestScore) {
//         highestScore = player.score;
//         winnerSessionId = sessionId;
//       }
//     });

//     if (winnerSessionId) {
//       this.state.gameStatus = "ended";

      
//       const users = Array.from(this.playerUniqueIds.values());
//       const winnerUniqueId = this.playerUniqueIds.get(winnerSessionId);

//       if (winnerUniqueId) {
//         await KafkaWalletService.sendGameEndRequest(
//           users,
//           winnerUniqueId,
//           this.matchOptionId,
//           this.roomId,
//           this.winAmount
//         );
//       }

//       this.broadcast("gameEnd", {
//         winner: winnerSessionId,
//         finalScores: Array.from(this.state.players.values()).map((p) => ({
//           sessionId: p.uniqueId,
//           score: p.score,
//         })),
//       });
//     }

//     console.log("🏁 Game ended! Winner:", winnerSessionId);

//     // Auto-disconnect after 30 seconds
//     this.clock.setTimeout(() => this.disconnect(), 30000);
//   }

//   private resetGame() {
//     console.log("🔄 Starting rematch...");

   
//     this.gameStarted = false;
//     this.gameEnded = false;
//     this.rematchVotes.clear();

//     this.state.fruits.clear();
//     this.state.bombs.clear();

    
//     this.state.players.forEach((player) => {
//       player.score = 0;
//       player.lives = 3;
//       player.ready = false;
//       player.rematchVote = false;
//       player.sliceTrail.clear();
//     });

  
//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);
//     clearInterval(this.gameTimer);

//     this.startCountdown();
//   }

//   // private spawnFruit() {
//   //   if (!this.gameStarted || this.gameEnded) return;
//   //   if (this.state.fruits.size >= 8) return;

//   //   let maxTries = 5;
//   //   let position: Vector2;
//   //   let safe = false;

//   //   while (maxTries-- > 0 && !safe) {
//   //     const fruitTypeIndex = Math.floor(Math.random() * FRUIT_TYPES.length);
//   //     const fruitType = FRUIT_TYPES[fruitTypeIndex];

//   //     const spawnSide = Math.random() < 0.5 ? "left" : "right";
//   //     const spawnX =
//   //       spawnSide === "left"
//   //         ? 0.1 * this.gameWidth + Math.random() * 0.2 * this.gameWidth
//   //         : 0.7 * this.gameWidth + Math.random() * 0.2 * this.gameWidth;
//   //     const spawnY = this.gameHeight;

//   //     position = new Vector2(spawnX, spawnY);

//   //     // Check for overlap with existing fruits
//   //     safe = true;
//   //     this.state.fruits.forEach((existing) => {
//   //       const dx = existing.position.x - position.x;
//   //       const dy = existing.position.y - position.y;
//   //       if (Math.sqrt(dx * dx + dy * dy) < 60) {
//   //         safe = false;
//   //       }
//   //     });

//   //     if (safe) {
//   //       const fruit = new Fruit();
//   //       fruit.id = `fruit_${Date.now()}_${Math.random()
//   //         .toString(36)
//   //         .substr(2, 9)}`;
//   //       fruit.type = fruitTypeIndex;
//   //       fruit.position = position;

//   //       const targetX =
//   //         0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
//   //       const targetY =
//   //         0.2 * this.gameHeight + Math.random() * 0.2 * this.gameHeight;
//   //       const timeToTarget = 1.4 + Math.random() * 0.3;
//   //       const fps = 60;
//   //       const totalFrames = timeToTarget * fps;
//   //       const gravity = 0.35;

//   //       const velocityX = (targetX - spawnX) / totalFrames;
//   //       const velocityY =
//   //         (targetY - spawnY) / (timeToTarget * 60) -
//   //         0.5 * gravity * totalFrames;

//   //       fruit.velocity = new Vector2(velocityX, velocityY);
//   //       fruit.angularVelocity = (Math.random() - 0.5) * 5;
//   //       fruit.rotation = 0;

//   //       this.state.fruits.set(fruit.id, fruit);
//   //       this.broadcast("spawnFruit", fruit);
//   //       break;
//   //     }
//   //   }
//   // }

//   // private spawnBomb() {
//   //   if (!this.gameStarted || this.gameEnded) return;
//   //   if (this.state.bombs.size >= 2) return; // Max 2 bombs

//   //   const bomb = new Bomb();
//   //   bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//   //   // Spawn position
//   //   const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
//   //   bomb.position = new Vector2(spawnX, this.gameHeight);

//   //   // Trajectory
//   //   const velocityX = (Math.random() - 0.5) * 6;
//   //   const velocityY = -10 - Math.random() * 6;
//   //   bomb.velocity = new Vector2(velocityX, velocityY);

//   //   this.state.bombs.set(bomb.id, bomb);
//   //   this.broadcast("spawnBomb", bomb);
//   // }

//   // private spawnFruit() {
//   //   if (!this.gameStarted || this.gameEnded) return;

//   //   // Limit fruits on screen'
//   //   console.log(`🍇 Fruit count: ${this.state.fruits.size}`);

//   //   if (this.state.fruits.size >= MAX_FRUITS_ON_SCREEN) return;

//   //   const fruitType = Math.floor(Math.random() * FRUIT_TYPES.length);
//   //   const fruit = new Fruit();
//   //   fruit.id = `fruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   //   fruit.type = fruitType;

//   //   // Spawn from bottom edges with varied starting positions
//   //   // const spawnSide = Math.random() < 0.5 ? "left" : "right";
//   //   // const spawnX =
//   //   //   spawnSide === "left"
//   //   //     ? 50 + Math.random() * 200
//   //   //     : 600 + Math.random() * 150;

//   //   // fruit.position = new Vector2(spawnX, 650);

//   //   let spawnX: number;
//   //   let maxTries = 10;
//   //   let safeToSpawn = false;

//   //   const spawnSide = Math.random() < 0.5 ? "left" : "right";

//   //   while (!safeToSpawn && maxTries-- > 0) {
//   //     const tryX =
//   //       spawnSide === "left"
//   //         ? 50 + Math.random() * 200
//   //         : 600 + Math.random() * 150;

//   //     safeToSpawn = true;

//   //     this.state.fruits.forEach((otherFruit) => {
//   //       if (Math.abs(otherFruit.position.x - tryX) < FRUIT_RADIUS * 2) {
//   //         safeToSpawn = false; // Too close to another fruit
//   //       }
//   //     });

//   //     if (safeToSpawn) {
//   //       spawnX = tryX;
//   //     }
//   //   }

//   //   if (!safeToSpawn) {
//   //     console.log("⚠️ Could not find safe spawn spot for fruit");
//   //     return; // skip spawn to avoid overlap
//   //   }

//   //   fruit.position = new Vector2(spawnX!, 650);

//   //   // Calculate trajectory to create natural arc - FIXED CALCULATION
//   //   const targetX = 200 + Math.random() * 400; // Target area in middle-upper screen
//   //   const targetY = 100 + Math.random() * 200;

//   //   const timeToTarget = 1.4 + Math.random() * 0.3; // 1.4-1.7 seconds flight time

//   //   const fps = 60;
//   //   const totalFrames = timeToTarget * fps;

//   //   const speedFactor = 0.8; // 80% of original speed

//   //   //  const velocityX = (targetX - spawnX) / totalFrames;
//   //   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//   //   // FIXED: Use targetY instead of spawnX for Y velocity calculation

//   //   const gravity = 0.35; // Tunable gravity constant

//   //   // const velocityY =
//   //   //   (targetY - fruit.position.y) / (timeToTarget * 60) -
//   //   //   0.5 * gravity * totalFrames;// Account for gravity

//   //   const velocityY =
//   //     ((targetY - fruit.position.y) / totalFrames -
//   //       0.5 * gravity * totalFrames) *
//   //     speedFactor;

//   //   fruit.velocity = new Vector2(velocityX, velocityY);
//   //   fruit.angularVelocity = (Math.random() - 0.5) * 5; // Random rotation
//   //   fruit.rotation = 0; // Initialize rotation

//   //   this.state.fruits.set(fruit.id, fruit);

//   //   console.log(
//   //     `🍎 Spawned ${FRUIT_TYPES[fruitType].name} at (${spawnX.toFixed(
//   //       1
//   //     )}, 650) with velocity (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`
//   //   );

//   //   this.broadcast("spawnFruit", {
//   //     id: fruit.id,
//   //     type: fruit.type,
//   //     position: fruit.position,
//   //     velocity: fruit.velocity,
//   //     angularVelocity: fruit.angularVelocity,
//   //     spawnTime: Date.now(),
//   //   });
//   // 
  
// //  this is the working one 
// // }

//   // private spawnBomb() {
//   //   if (!this.gameStarted || this.gameEnded) return;
//   //   if (this.state.bombs.size >= 3) return; // limit bombs

//   //   const bomb = new Bomb();
//   //   bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//   //   const spawnSide = Math.random() < 0.5 ? "left" : "right";
//   //   const spawnX =
//   //     spawnSide === "left"
//   //       ? 50 + Math.random() * 200
//   //       : 600 + Math.random() * 150;

//   //   bomb.position = new Vector2(spawnX, 650);

//   //   const targetX = 200 + Math.random() * 400;
//   //   const targetY = 100 + Math.random() * 200;
//   //   const timeToTarget = 1.2 + Math.random() * 0.3;
//   //   const speedFactor = 0.8;
//   //   const fps = 60;
//   //   const totalFrames = timeToTarget * fps;
//   //   const gravity = 0.35;

//   //   // const velocityX = (targetX - spawnX) / totalFrames;
//   //   // const velocityY =
//   //   //   (targetY - bomb.position.y) / totalFrames - 0.5 * gravity * totalFrames;

//   //   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//   //   const velocityY =
//   //     ((targetY - bomb.position.y) / totalFrames -
//   //       0.5 * gravity * totalFrames) *
//   //     speedFactor;

//   //   bomb.velocity = new Vector2(velocityX, velocityY);

//   //   this.state.bombs.set(bomb.id, bomb);

//   //   console.log(`💣 Spawned bomb at (${spawnX.toFixed(1)}, 650)`);

//   //   this.broadcast("spawnBomb", {
//   //     id: bomb.id,
//   //     position: bomb.position,
//   //     velocity: bomb.velocity,
//   //     spawnTime: Date.now(),
//   //   });

//   //   //  this is the working one  
//   // }

// private spawnBomb() {
//   if (!this.gameStarted || this.gameEnded) return;
//   if (this.state.bombs.size >= 3) return;

//   const bomb = new Bomb();
//   bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//   const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
//   const spawnY = this.gameHeight;

//   bomb.position = new Vector2(spawnX, spawnY);

//   const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
//   const targetY = 0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

//   const timeToTarget = 1.2 + Math.random() * 0.3;
//   const fps = 60;
//   const totalFrames = timeToTarget * fps;
//   const gravity = 0.35;
//   const speedFactor = 0.8;

//   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//   const velocityY =
//     ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) * speedFactor;

//   bomb.velocity = new Vector2(velocityX, velocityY);

//   this.state.bombs.set(bomb.id, bomb);

//   this.broadcast("spawnBomb", {
//     id: bomb.id,
//     position: bomb.position,
//     velocity: bomb.velocity,
//     spawnTime: Date.now(),
//   });
// }

//   private spawnFruit() {
//   if (!this.gameStarted || this.gameEnded) return;
//   if (this.state.fruits.size >= MAX_FRUITS_ON_SCREEN) return;

//   const fruitType = Math.floor(Math.random() * FRUIT_TYPES.length);
//   const fruit = new Fruit();
//   fruit.id = `fruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//   fruit.type = fruitType;

//   // 🎯 Spawn from bottom center-left/right to simulate arc in landscape
//   const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
//   const spawnY = this.gameHeight;

//   fruit.position = new Vector2(spawnX, spawnY);

//   // 🎯 Target toward upper screen
//   const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
//   const targetY = 0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

//   const timeToTarget = 1.4 + Math.random() * 0.3;
//   const fps = 60;
//   const totalFrames = timeToTarget * fps;
//   const gravity = 0.35;
//   const speedFactor = 0.8;

//   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//   const velocityY =
//     ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) * speedFactor;

//   fruit.velocity = new Vector2(velocityX, velocityY);
//   fruit.angularVelocity = (Math.random() - 0.5) * 5;
//   fruit.rotation = 0;

//   this.state.fruits.set(fruit.id, fruit);

//   this.broadcast("spawnFruit", {
//     id: fruit.id,
//     type: fruit.type,
//     position: fruit.position,
//     velocity: fruit.velocity,
//     angularVelocity: fruit.angularVelocity,
//     spawnTime: Date.now(),
//   });
// }

//   // private checkSliceCollisions(client: Client, trail: number[]) {
//   //   let bombHit = false;
//   //   const player = this.state.players.get(client.sessionId);
//   //   if (!player) return { slicedFruits: 0, bombHit: false };

//   //   const slicedFruitIds: string[] = [];

//   //   for (let i = 0; i < trail.length - 3; i += 2) {
//   //     const lineStart = { x: trail[i], y: trail[i + 1] };
//   //     const lineEnd = { x: trail[i + 2], y: trail[i + 3] };

//   //     this.state.fruits.forEach((fruit, fruitId) => {
//   //       if (fruit.isSliced || slicedFruitIds.includes(fruitId)) return;

//   //       const distance = this.pointToLineDistance(
//   //         fruit.position,
//   //         lineStart,
//   //         lineEnd
//   //       );
//   //       if (distance < 30) {
//   //         fruit.isSliced = true;
//   //         slicedFruitIds.push(fruitId);

//   //         this.clock.setTimeout(() => {
//   //           this.state.fruits.delete(fruitId);
//   //         }, 300);
//   //       }
//   //     });

//   //     this.state.bombs.forEach((bomb, bombId) => {
//   //       if (bomb.isHit) return;

//   //       const distance = this.pointToLineDistance(
//   //         bomb.position,
//   //         lineStart,
//   //         lineEnd
//   //       );
//   //       if (distance < 25) {
//   //         bomb.isHit = true;
//   //         bombHit = true;
//   //         this.handleBombHit(client);

//   //         this.clock.setTimeout(() => {
//   //           this.state.bombs.delete(bombId);
//   //         }, 100);
//   //       }
//   //     });
//   //   }

//   //   // Combo scoring
//   //   let totalPoints = 0;
//   //   if (slicedFruitIds.length > 0) {
//   //     slicedFruitIds.forEach((id) => {
//   //       const fruit = this.state.fruits.get(id);
//   //       if (fruit) {
//   //         const fruitType = FRUIT_TYPES[fruit.type];
//   //         totalPoints += fruitType.points;
//   //       }
//   //     });

//   //     // Combo bonuses
//   //     if (slicedFruitIds.length === 2) totalPoints += 10;
//   //     else if (slicedFruitIds.length === 3) totalPoints += 30;
//   //     else if (slicedFruitIds.length >= 4) totalPoints += 70;
//   //     else if (slicedFruitIds.length >= 5) totalPoints += 200;
//   //     else if (slicedFruitIds.length >= 6) totalPoints += 300;
//   //     else if (slicedFruitIds.length >= 7) totalPoints += 500;
//   //     else if (slicedFruitIds.length >= 8) totalPoints += 1000;

//   //     player.score += totalPoints;
//   //   }

//   //   return { slicedFruits: slicedFruitIds.length, bombHit };
//   // }



//   // 




//   // above is working one ⬆️
//   private handleBombHit(client: Client) {
//     const player = this.state.players.get(client.sessionId);
//     if (!player) return;

//     player.score = Math.max(0, player.score - 50);
//     player.lives = Math.max(0, player.lives - 1);

//     this.broadcast("bombHit", {
//       playerId: client.sessionId,
//       newScore: player.score,
//       livesLeft: player.lives,
//     });

//     if (player.lives <= 0) {
    
//       this.send(client, "gameOver", { reason: "No lives left" });
//           this.endGame();
//     }
//   }


// private checkSliceCollisions(client: Client, trail: number[]) {
//   let bombHit = false;
//   const player = this.state.players.get(client.sessionId);
//   if (!player) return { slicedFruits: 0, bombHit: false };

//   const slicedFruitIds: Set<string> = new Set();
//   const gridSize = 100;

//   // Build spatial grid index
//   const fruitGrid = new Map<string, string[]>();
//   const bombGrid = new Map<string, string[]>();

//   const getCellKey = (x: number, y: number) => {
//     const cellX = Math.floor(x / gridSize);
//     const cellY = Math.floor(y / gridSize);
//     return `${cellX},${cellY}`;
//   };

//   // Index fruits by grid cell
//   this.state.fruits.forEach((fruit, fruitId) => {
//     if (fruit.isSliced) return;
//     const key = getCellKey(fruit.position.x, fruit.position.y);
//     if (!fruitGrid.has(key)) fruitGrid.set(key, []);
//     fruitGrid.get(key)!.push(fruitId);
//   });

//   // Index bombs by grid cell
//   this.state.bombs.forEach((bomb, bombId) => {
//     if (bomb.isHit) return;
//     const key = getCellKey(bomb.position.x, bomb.position.y);
//     if (!bombGrid.has(key)) bombGrid.set(key, []);
//     bombGrid.get(key)!.push(bombId);
//   });

//   // Check only nearby cells for each trail segment
//   for (let i = 0; i < trail.length - 3; i += 2) {
//     const lineStart = { x: trail[i], y: trail[i + 1] };
//     const lineEnd = { x: trail[i + 2], y: trail[i + 3] };

//     const cellsToCheck = new Set<string>();

//     // Include lineStart + lineEnd cells and 8 neighbors
//     for (const point of [lineStart, lineEnd]) {
//       const cx = Math.floor(point.x / gridSize);
//       const cy = Math.floor(point.y / gridSize);
//       for (let dx = -1; dx <= 1; dx++) {
//         for (let dy = -1; dy <= 1; dy++) {
//           cellsToCheck.add(`${cx + dx},${cy + dy}`);
//         }
//       }
//     }

//     // Check fruits
//     for (const key of cellsToCheck) {
//       const fruitIds = fruitGrid.get(key);
//       if (!fruitIds) continue;

//       for (const fruitId of fruitIds) {
//         if (slicedFruitIds.has(fruitId)) continue;
//         const fruit = this.state.fruits.get(fruitId);
//         if (!fruit || fruit.isSliced) continue;

//         const dist = this.pointToLineDistance(
//           fruit.position,
//           lineStart,
//           lineEnd
//         );
//         if (dist < 30) {
//           fruit.isSliced = true;
//           slicedFruitIds.add(fruitId);

//           this.clock.setTimeout(() => {
//             this.state.fruits.delete(fruitId);
//           }, 300);
//         }
//       }
//     }

//     // Check bombs
//     for (const key of cellsToCheck) {
//       const bombIds = bombGrid.get(key);
//       if (!bombIds) continue;

//       for (const bombId of bombIds) {
//         const bomb = this.state.bombs.get(bombId);
//         if (!bomb || bomb.isHit) continue;

//         const dist = this.pointToLineDistance(
//           bomb.position,
//           lineStart,
//           lineEnd
//         );
//         if (dist < 25) {
//           bomb.isHit = true;
//           bombHit = true;
//           this.handleBombHit(client);

//           this.clock.setTimeout(() => {
//             this.state.bombs.delete(bombId);
//           }, 100);
//         }
//       }
//     }
//   }

//   // Scoring logic
//   let totalPoints = 0;
//   if (slicedFruitIds.size > 0) {
//     for (const id of slicedFruitIds) {
//       const fruit = this.state.fruits.get(id);
//       if (fruit) {
//         totalPoints += FRUIT_TYPES[fruit.type].points;
//       }
//     }

//     // Combo bonuses
//     const count = slicedFruitIds.size;
//     if (count === 2) totalPoints += 10;
//     else if (count === 3) totalPoints += 30;
//     else if (count >= 4) totalPoints += 70;
//     else if (count >= 5) totalPoints += 200;
//     else if (count >= 6) totalPoints += 300;
//     else if (count >= 7) totalPoints += 500;
//     else if (count >= 8) totalPoints += 1000;

//     player.score += totalPoints;
//   }

//   return { slicedFruits: slicedFruitIds.size, bombHit };
// }



//   private pointToLineDistance(point: Vector2, lineA: any, lineB: any): number {
//     const A = point.x - lineA.x;
//     const B = point.y - lineA.y;
//     const C = lineB.x - lineA.x;
//     const D = lineB.y - lineA.y;

//     const dot = A * C + B * D;
//     const lenSq = C * C + D * D;
//     const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;

//     const xx = lineA.x + param * C;
//     const yy = lineA.y + param * D;

//     const dx = point.x - xx;
//     const dy = point.y - yy;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   private update() {
//     if (!this.gameStarted || this.gameEnded) return;

//     const now = Date.now();
//     const delta = Math.min(now - this.lastUpdateTime, 50) / 1000;
//     this.lastUpdateTime = now;

//     // Update fruits
//     this.state.fruits.forEach((fruit, fruitId) => {
//       if (fruit.isSliced) return;

//       fruit.velocity.y += 20 * delta;
//       fruit.position.x += fruit.velocity.x * delta * 60;
//       fruit.position.y += fruit.velocity.y * delta * 60;
//       fruit.rotation += fruit.angularVelocity * delta;

//       // Remove if off-screen
//       if (
//         fruit.position.y > this.gameHeight + 100 ||
//         fruit.position.x < -100 ||
//         fruit.position.x > this.gameWidth + 100
//       ) {
//         this.state.fruits.delete(fruitId);
//       }
//     });

//     // Update bombs
//     this.state.bombs.forEach((bomb, bombId) => {
//       if (bomb.isHit) return;

//       bomb.velocity.y += 20 * delta;
//       bomb.position.x += bomb.velocity.x * delta * 60;
//       bomb.position.y += bomb.velocity.y * delta * 60;

//       // Remove if off-screen
//       if (
//         bomb.position.y > this.gameHeight + 100 ||
//         bomb.position.x < -100 ||
//         bomb.position.x > this.gameWidth + 100
//       ) {
//         this.state.bombs.delete(bombId);
//       }
//     });
//   }

//   private async refundPlayer(uniqueId: string) {
//     try {
//       await KafkaWalletService.sendGameEndRequest(
//         uniqueId,
//         this.betAmount,
//         this.roomId
//       );
//       console.log(`💰 Refunded ${this.betAmount} to ${uniqueId}`);
//     } catch (err) {
//       console.error("Refund failed:", err);
//     }
//   }
// }

// import mongoose from "mongoose";
// import { Delayed } from "@colyseus/timer";
// import MatchOption from "../models/MatchOption.model";
// import { ArraySchema } from "@colyseus/schema";
// import KafkaWalletService from "../kafka/walletKafka";
// import { Room, Client } from "colyseus";
// import RBush from "rbush";

// import {
//   FruitNinjaState,
//   Player,
//   Fruit,
//   Vector2,
//   Bomb,
// } from "./schema/FruitSlicerState";

// const FRUIT_TYPES = [
//   { name: "apple", points: 10, color: "#ff0000" },
//   { name: "banana", points: 15, color: "#ffff00" },
//   { name: "orange", points: 12, color: "#ffa500" },
//   { name: "watermelon", points: 25, color: "#00ff00" },
//   { name: "strawberry", points: 20, color: "#ff69b4" },
//   { name: "kiwi", points: 20, color: "#66bb66" },
//   { name: "pear", points: 15, color: "#d1e231" },
//   { name: "blueberry", points: 30, color: "#4f86f7" },
//   { name: "papaya", points: 12, color: "#ffb347" },
//   { name: "pineapple", points: 12, color: "#fada5e" },
// ];

// const MAX_FRUITS_ON_SCREEN = 8;
// const FRUIT_RADIUS = 30;

// interface SpatialItem {
//   minX: number;
//   minY: number;
//   maxX: number;
//   maxY: number;
//   id: string;
//   type: "fruit" | "bomb";
// }

// (async () => {
//   await KafkaWalletService.initialize();
//   console.log("✅ KafkaWalletService ready");
// })();

// export class FruitNinjaRoom extends Room<FruitNinjaState> {
//   private wasMovingLastFrame: boolean = false;
//   private spawnInterval!: NodeJS.Timeout;
//   private bombSpawnInterval!: NodeJS.Timeout;
//   private lastUpdateTime: number = Date.now();
//   private gameTimer!: NodeJS.Timeout;
//   private countdownTimer!: NodeJS.Timeout;
//   private gameStarted: boolean = false;
//   private gameEnded: boolean = false;
//   private playerUniqueIds: Map<string, string> = new Map();
//   private deductedPlayers: Map<string, string> = new Map();
//   private rematchVotes: Set<string> = new Set();
//   private gameWidth: number = 800;
//   private gameHeight: number = 600;

//   // Game configuration
//   private betAmount: number = 0;
//   private winAmount: number = 0;
//   private matchOptionId: string = "";
//   private minPlayer: number = 0;
//   private playerCount: number = 0;

//   // RBush for spatial indexing
//   private fruitTree = new RBush<SpatialItem>();
//   private bombTree = new RBush<SpatialItem>();

//   async onAuth(client: Client, data: any) {
//     const { uniqueId, useBonus, name } = data;

//     if (
//       this.metadata?.isPrivate &&
//       !this.metadata.allowedUserIds.includes(name)
//     ) {
//       throw new Error("❌ You are not allowed to join this private room.");
//     }

//     try {
//       const roomId = this.listing.roomId;
//       const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
//         uniqueId,
//         this.betAmount,
//         useBonus,
//         roomId
//       );

//       if (!walletResponse.success) {
//         throw new Error(walletResponse.message || "Wallet deduction failed.");
//       }

//       this.playerUniqueIds.set(client.sessionId, uniqueId);
//       this.deductedPlayers.set(client.sessionId, uniqueId);
//     } catch (err) {
//       console.error("Wallet Error:", err);
//       throw new Error("Unable to join: Wallet validation failed.");
//     }

//     return true;
//   }

//   async onCreate(data: any) {
//     const matchOptionId = new mongoose.Types.ObjectId(data.matchOptionId);
//     const matchOption = await MatchOption.findById(matchOptionId);
//     if (!matchOption) throw new Error("MatchOption not found");

//     const numberOfPlayers =
//       data.playerCount || matchOption.numberOfPlayers || 2;
//     const isPrivate = data.isPrivate || false;
//     const allowedUserIds = data.allowedUserIds || [];

//     this.gameWidth = data.gameWidth || 1280;
//     this.gameHeight = data.gameHeight || 720;

//     this.setMetadata({
//       playerCount: numberOfPlayers,
//       isPrivate,
//       allowedUserIds,
//       gameWidth: this.gameWidth,
//       gameHeight: this.gameHeight,
//       createdAt: new Date().toISOString(),
//     });

//     this.maxClients = numberOfPlayers;

//     this.betAmount = matchOption.bettingAmount;
//     this.winAmount = matchOption.winningAmount;
//     this.matchOptionId = matchOptionId.toString();
//     this.minPlayer = matchOption.minimumPlayers || 2;
//     this.playerCount = numberOfPlayers;

//     this.setState(new FruitNinjaState());
//     this.state.gameStatus = "waiting";
//     this.state.betAmount = this.betAmount;
//     this.state.winAmount = this.winAmount;
//     this.state.matchOptionId = this.matchOptionId;
//     this.state.minPlayer = this.minPlayer;
//     this.state.playerCount = this.playerCount;
//     this.state.gameWidth = this.gameWidth;
//     this.state.gameHeight = this.gameHeight;

//     this.setupMessageHandlers();
//     console.log("🎮 Fruit Ninja room created!");
//   }

//   private setupMessageHandlers() {
//     this.onMessage("join_game", (client) => {
//       const player = this.state.players.get(client.sessionId);
//       if (player) {
//         player.ready = true;
//         console.log(`✅ Player ${client.sessionId} is ready`);

//         if (
//           this.allPlayersReady() &&
//           this.state.players.size === this.maxClients
//         ) {
//           this.startCountdown();
//         }
//       }
//     });

//     this.onMessage("slice", (client, message) => {
//       if (!this.gameStarted || this.gameEnded) return;

//       const player = this.state.players.get(client.sessionId);

//       if (!player || player.lives <= 0) return;

//       let trail = message.trail;

//       if (typeof trail === "string") {
//         try {
//           trail = JSON.parse(trail);
//           console.log("✅ Parsed string trail to array:", trail);
//         } catch (err) {
//           console.log("❌ Failed to parse trail string:", err);
//           return;
//         }
//       }

//       if (!Array.isArray(trail) || trail.length < 4) {
//         console.log("❌ Invalid trail data");
//         return;
//       }

//       player.sliceTrail.clear();
//       player.sliceTrail.push(...trail);

//       const result = this.checkSliceCollisions(client, trail);

//       if (result.slicedFruits > 0) {
//         this.broadcast("fruitSliced", {
//           playerId: client.sessionId,
//           fruitsSliced: result.slicedFruits,
//           newScore: player.score,
//         });
//       }

//       if (result.bombHit) {
//         this.handleBombHit(client);
//       }
//     });

//     this.onMessage("rematch", (client) => {
//       if (this.state.gameStatus === "ended") {
//         const player = this.state.players.get(client.sessionId);
//         if (player) {
//           player.rematchVote = true;
//           this.rematchVotes.add(client.sessionId);

//           if (this.rematchVotes.size === this.state.players.size) {
//             this.resetGame();
//           }
//         }
//       }
//     });
//   }

//   onJoin(client: Client, data: any) {
//     console.log(`🎮 Player ${client.sessionId} joined the game`);

//     const player = new Player();
//     player.uniqueId = data.uniqueId;
//     player.score = 0;
//     player.lives = 3;
//     player.ready = false;
//     player.rematchVote = false;

//     this.state.players.set(client.sessionId, player);
//   }

//   async onLeave(client: Client, consented: boolean) {
//     console.log(`👋 Player ${client.sessionId} left the game`);

//     if (!this.gameStarted) {
//       const uniqueId = this.deductedPlayers.get(client.sessionId);
//       if (uniqueId) {
//         await this.refundPlayer(uniqueId);
//         this.deductedPlayers.delete(client.sessionId);
//       }
//     }

//     this.state.players.delete(client.sessionId);
//     this.playerUniqueIds.delete(client.sessionId);
//     this.rematchVotes.delete(client.sessionId);

//     if (this.state.players.size < this.minPlayer && this.gameStarted) {
//       this.endGame();
//     }
//   }

//   async onDispose() {
//     console.log("🧹 Disposing game room");

//     if (!this.gameStarted) {
//       for (const [sessionId, uniqueId] of this.deductedPlayers) {
//         await this.refundPlayer(uniqueId);
//       }
//     }

//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);
//     clearInterval(this.gameTimer);

//     if (this.countdownTimer) {
//       clearInterval(this.countdownTimer);
//     }
//   }

//   private allPlayersReady(): boolean {
//     let allReady = true;
//     this.state.players.forEach((player) => {
//       if (!player.ready) allReady = false;
//     });
//     return allReady;
//   }

//   private startCountdown() {
//     const GAME_COUNTDOWN = 3;

//     this.state.gameStatus = "getting_ready";
//     this.state.gameTime = GAME_COUNTDOWN;

//     this.broadcast("starting", { message: "Ready" });

//     setTimeout(() => {
//       this.state.gameStatus = "countdown";
//       let countdown = GAME_COUNTDOWN;
//       this.state.gameTime = countdown;

//       this.broadcast("countdown", { count: countdown });

//       this.countdownTimer = setInterval(() => {
//         countdown--;
//         this.state.gameTime = countdown;

//         if (countdown > 0) {
//           this.broadcast("countdown", { count: countdown });
//         } else {
//           clearInterval(this.countdownTimer);
//           this.startGame();
//         }
//       }, 1000);
//     }, 1000);
//   }

//   private startGame() {
//     this.gameStarted = true;
//     this.state.gameStatus = "playing";
//     this.state.gameTime = 180;

//     this.broadcast("game_started", { message: "GO!", fruitTypes: FRUIT_TYPES });
//     console.log("🚀 Game started!");

//     const users = Array.from(this.playerUniqueIds.values());
//     KafkaWalletService.sendGameStartRequest(
//       users,
//       this.betAmount,
//       this.matchOptionId,
//       this.roomId
//     );

//     this.setSimulationInterval((dt) => this.update(), 1000 / 60);
//     this.spawnInterval = setInterval(() => this.spawnFruit(), 800);
//     this.scheduleNextBombSpawn();

//     this.gameTimer = setInterval(() => {
//       this.state.gameTime -= 1;
//       if (this.state.gameTime <= 0) {
//         this.endGame();
//       }
//     }, 1000);
//   }

//   private scheduleNextBombSpawn() {
//     if (!this.gameStarted || this.gameEnded) return;

//     const randomDelay = 1000 + Math.random() * 4000;

//     this.bombSpawnInterval = setTimeout(() => {
//       this.spawnBomb();
//       this.scheduleNextBombSpawn();
//     }, randomDelay);

//     console.log(`⏱️ Next bomb in ${(randomDelay / 1000).toFixed(2)}s`);
//   }

//   private async endGame() {
//     this.gameEnded = true;
//     this.state.gameStatus = "ended";

//     clearInterval(this.gameTimer);
//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);

//     let winnerSessionId: string | null = null;
//     let highestScore = -1;

//     this.state.players.forEach((player, sessionId) => {
//       if (player.score > highestScore) {
//         highestScore = player.score;
//         winnerSessionId = sessionId;
//       }
//     });

//     if (winnerSessionId) {
//       this.state.gameStatus = "ended";

//       const users = Array.from(this.playerUniqueIds.values());
//       const winnerUniqueId = this.playerUniqueIds.get(winnerSessionId);

//       if (winnerUniqueId) {
//         await KafkaWalletService.sendGameEndRequest(
//           users,
//           winnerUniqueId,
//           this.matchOptionId,
//           this.roomId,
//           this.winAmount
//         );
//       }

//       this.broadcast("gameEnd", {
//         winner: winnerSessionId,
//         finalScores: Array.from(this.state.players.values()).map((p) => ({
//           sessionId: p.uniqueId,
//           score: p.score,
//         })),
//       });
//     }

//     console.log("🏁 Game ended! Winner:", winnerSessionId);

//     this.clock.setTimeout(() => this.disconnect(), 30000);
//   }

//   private resetGame() {
//     console.log("🔄 Starting rematch...");

//     this.gameStarted = false;
//     this.gameEnded = false;
//     this.rematchVotes.clear();

//     this.state.fruits.clear();
//     this.state.bombs.clear();

//     this.state.players.forEach((player) => {
//       player.score = 0;
//       player.lives = 3;
//       player.ready = false;
//       player.rematchVote = false;
//       player.sliceTrail.clear();
//     });

//     clearInterval(this.spawnInterval);
//     clearInterval(this.bombSpawnInterval);
//     clearInterval(this.gameTimer);

//     this.startCountdown();
//   }

//   private spawnBomb() {
//     if (!this.gameStarted || this.gameEnded) return;
//     if (this.state.bombs.size >= 3) return;

//     const bomb = new Bomb();
//     bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//     const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
//     const spawnY = this.gameHeight;

//     bomb.position = new Vector2(spawnX, spawnY);

//     const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
//     const targetY = 0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

//     const timeToTarget = 1.2 + Math.random() * 0.3;
//     const fps = 60;
//     const totalFrames = timeToTarget * fps;
//     const gravity = 0.35;
//     const speedFactor = 0.8;

//     const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//     const velocityY =
//       ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) * speedFactor;

//     bomb.velocity = new Vector2(velocityX, velocityY);

//     this.state.bombs.set(bomb.id, bomb);

//     this.broadcast("spawnBomb", {
//       id: bomb.id,
//       position: bomb.position,
//       velocity: bomb.velocity,
//       spawnTime: Date.now(),
//     });
//   }

//   private spawnFruit() {
//     if (!this.gameStarted || this.gameEnded) return;
//     if (this.state.fruits.size >= MAX_FRUITS_ON_SCREEN) return;

//     const fruitType = Math.floor(Math.random() * FRUIT_TYPES.length);
//     const fruit = new Fruit();
//     fruit.id = `fruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
//     fruit.type = fruitType;

//     const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
//     const spawnY = this.gameHeight;

//     fruit.position = new Vector2(spawnX, spawnY);

//     const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
//     const targetY = 0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

//     const timeToTarget = 1.4 + Math.random() * 0.3;
//     const fps = 60;
//     const totalFrames = timeToTarget * fps;
//     const gravity = 0.35;
//     const speedFactor = 0.8;

//     const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
//     const velocityY =
//       ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) * speedFactor;

//     fruit.velocity = new Vector2(velocityX, velocityY);
//     fruit.angularVelocity = (Math.random() - 0.5) * 5;
//     fruit.rotation = 0;

//     this.state.fruits.set(fruit.id, fruit);

//     this.broadcast("spawnFruit", {
//       id: fruit.id,
//       type: fruit.type,
//       position: fruit.position,
//       velocity: fruit.velocity,
//       angularVelocity: fruit.angularVelocity,
//       spawnTime: Date.now(),
//     });
//   }

//   private handleBombHit(client: Client) {
//     const player = this.state.players.get(client.sessionId);
//     if (!player) return;

//     player.score = Math.max(0, player.score - 50);
//     player.lives = Math.max(0, player.lives - 1);

//     this.broadcast("bombHit", {
//       playerId: client.sessionId,
//       newScore: player.score,
//       livesLeft: player.lives,
//     });

//     if (player.lives <= 0) {
//       this.send(client, "gameOver", { reason: "No lives left" });
//       this.endGame();
//     }
//   }

//   private updateSpatialIndexes() {
//     const fruitItems: SpatialItem[] = [];
//     this.state.fruits.forEach((fruit, fruitId) => {
//       if (fruit.isSliced) return;
//       fruitItems.push({
//         minX: fruit.position.x - FRUIT_RADIUS,
//         minY: fruit.position.y - FRUIT_RADIUS,
//         maxX: fruit.position.x + FRUIT_RADIUS,
//         maxY: fruit.position.y + FRUIT_RADIUS,
//         id: fruitId,
//         type: "fruit",
//       });
//     });
//     this.fruitTree.clear();
//     this.fruitTree.load(fruitItems);

//     const bombItems: SpatialItem[] = [];
//     this.state.bombs.forEach((bomb, bombId) => {
//       if (bomb.isHit) return;
//       const radius = 25;
//       bombItems.push({
//         minX: bomb.position.x - radius,
//         minY: bomb.position.y - radius,
//         maxX: bomb.position.x + radius,
//         maxY: bomb.position.y + radius,
//         id: bombId,
//         type: "bomb",
//       });
//     });
//     this.bombTree.clear();
//     this.bombTree.load(bombItems);
//   }

//   private checkSliceCollisions(client: Client, trail: number[]) {
//     let bombHit = false;
//     const player = this.state.players.get(client.sessionId);
//     if (!player) return { slicedFruits: 0, bombHit: false };

//     const slicedFruitIds = new Set<string>();

//     for (let i = 0; i < trail.length - 3; i += 2) {
//       const lineStart = { x: trail[i], y: trail[i + 1] };
//       const lineEnd = { x: trail[i + 2], y: trail[i + 3] };

//       // Compute AABB for this segment
//       const minX = Math.min(lineStart.x, lineEnd.x) - FRUIT_RADIUS;
//       const minY = Math.min(lineStart.y, lineEnd.y) - FRUIT_RADIUS;
//       const maxX = Math.max(lineStart.x, lineEnd.x) + FRUIT_RADIUS;
//       const maxY = Math.max(lineStart.y, lineEnd.y) + FRUIT_RADIUS;

//       // Query only fruits in this bounding box
//       const fruits = this.fruitTree.search({ minX, minY, maxX, maxY });
//       for (const item of fruits) {
//         if (slicedFruitIds.has(item.id)) continue;
//         const fruit = this.state.fruits.get(item.id);
//         if (!fruit || fruit.isSliced) continue;
//         const dist = this.pointToLineDistance(fruit.position, lineStart, lineEnd);
//         if (dist < FRUIT_RADIUS) {
//           fruit.isSliced = true;
//           slicedFruitIds.add(item.id);
//           this.clock.setTimeout(() => {
//             this.state.fruits.delete(item.id);
//           }, 300);
//         }
//       }

//       // Query only bombs in this bounding box
//       const bombs = this.bombTree.search({ minX, minY, maxX, maxY });
//       for (const item of bombs) {
//         const bomb = this.state.bombs.get(item.id);
//         if (!bomb || bomb.isHit) continue;
//         const dist = this.pointToLineDistance(bomb.position, lineStart, lineEnd);
//         if (dist < 25) {
//           bomb.isHit = true;
//           bombHit = true;
//           this.handleBombHit(client);
//           this.clock.setTimeout(() => {
//             this.state.bombs.delete(item.id);
//           }, 100);
//         }
//       }
//     }

//     // Scoring logic
//     let totalPoints = 0;
//     if (slicedFruitIds.size > 0) {
//       for (const id of slicedFruitIds) {
//         const fruit = this.state.fruits.get(id);
//         if (fruit) {
//           totalPoints += FRUIT_TYPES[fruit.type].points;
//         }
//       }
//       const count = slicedFruitIds.size;
//       if (count === 2) totalPoints += 10;
//       else if (count === 3) totalPoints += 30;
//       else if (count >= 4) totalPoints += 70;
//       else if (count >= 5) totalPoints += 200;
//       else if (count >= 6) totalPoints += 300;
//       else if (count >= 7) totalPoints += 500;
//       else if (count >= 8) totalPoints += 1000;

//       player.score += totalPoints;
//     }
//     return { slicedFruits: slicedFruitIds.size, bombHit };
//   }

//   private pointToLineDistance(point: Vector2, lineA: any, lineB: any): number {
//     const A = point.x - lineA.x;
//     const B = point.y - lineA.y;
//     const C = lineB.x - lineA.x;
//     const D = lineB.y - lineA.y;

//     const dot = A * C + B * D;
//     const lenSq = C * C + D * D;
//     const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;

//     const xx = lineA.x + param * C;
//     const yy = lineA.y + param * D;

//     const dx = point.x - xx;
//     const dy = point.y - yy;
//     return Math.sqrt(dx * dx + dy * dy);
//   }

//   private update() {
//     if (!this.gameStarted || this.gameEnded) return;

//     const now = Date.now();
//     const delta = Math.min(now - this.lastUpdateTime, 50) / 1000;
//     this.lastUpdateTime = now;

//     // Update fruits
//     this.state.fruits.forEach((fruit, fruitId) => {
//       if (fruit.isSliced) return;

//       fruit.velocity.y += 20 * delta;
//       fruit.position.x += fruit.velocity.x * delta * 60;
//       fruit.position.y += fruit.velocity.y * delta * 60;
//       fruit.rotation += fruit.angularVelocity * delta;

//       // Remove if off-screen
//       if (
//         fruit.position.y > this.gameHeight + 100 ||
//         fruit.position.x < -100 ||
//         fruit.position.x > this.gameWidth + 100
//       ) {
//         this.state.fruits.delete(fruitId);
//       }
//     });

//     // Update bombs
//     this.state.bombs.forEach((bomb, bombId) => {
//       if (bomb.isHit) return;

//       bomb.velocity.y += 20 * delta;
//       bomb.position.x += bomb.velocity.x * delta * 60;
//       bomb.position.y += bomb.velocity.y * delta * 60;

//       if (
//         bomb.position.y > this.gameHeight + 100 ||
//         bomb.position.x < -100 ||
//         bomb.position.x > this.gameWidth + 100
//       ) {
//         this.state.bombs.delete(bombId);
//       }
//     });

//     // Update spatial indexes after object positions have changed
//     this.updateSpatialIndexes();
//   }

//   private async refundPlayer(uniqueId: string) {
//     try {
//       await KafkaWalletService.sendGameEndRequest(
//         uniqueId,
//         this.betAmount,
//         this.roomId
//       );
//       console.log(`💰 Refunded ${this.betAmount} to ${uniqueId}`);
//     } catch (err) {
//       console.error("Refund failed:", err);
//     }
//   }
// }




// ++++++++++++++++++++++++++++++++++++++++++++++++++


import mongoose from "mongoose";
import { Delayed } from "@colyseus/timer";
import MatchOption from "../models/MatchOption.model";
import { ArraySchema } from "@colyseus/schema";
import KafkaWalletService from "../kafka/walletKafka";
import { Room, Client } from "colyseus";

import {
  FruitNinjaState,
  Player,
  Fruit,
  Vector2,
  Bomb,
} from "./schema/FruitSlicerState";

(async () => {
  await KafkaWalletService.initialize();
  console.log("✅ KafkaWalletService ready");
})();

const FRUIT_TYPES = [
  { name: "apple", points: 10, color: "#ff0000" },
  { name: "banana", points: 15, color: "#ffff00" },
  { name: "orange", points: 12, color: "#ffa500" },
  { name: "watermelon", points: 25, color: "#00ff00" },
  { name: "strawberry", points: 20, color: "#ff69b4" },
  { name: "kiwi", points: 20, color: "#66bb66" },
  { name: "pear", points: 15, color: "#d1e231" },
  { name: "blueberry", points: 30, color: "#4f86f7" },
  { name: "papaya", points: 12, color: "#ffb347" },
  { name: "pineapple", points: 12, color: "#fada5e" },
];

const MAX_FRUITS_ON_SCREEN = 8; // or whatever limit you want

const FRUIT_RADIUS = 30;

export class FruitNinjaRoom extends Room<FruitNinjaState> {
  private wasMovingLastFrame: boolean = false;

  private spawnInterval!: NodeJS.Timeout;
  private bombSpawnInterval!: NodeJS.Timeout;
  private lastUpdateTime: number = Date.now();
  private gameTimer!: NodeJS.Timeout;
  private countdownTimer!: NodeJS.Timeout;
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private playerUniqueIds: Map<string, string> = new Map();
  private deductedPlayers: Map<string, string> = new Map();
  private rematchVotes: Set<string> = new Set();
  private gameWidth: number = 800;
  private gameHeight: number = 600;
  allowedUserIds: string[] = [];
  // Game configuration
  private betAmount: number = 0;
  private winAmount: number = 0;
  private matchOptionId: string = "";
  private minPlayer: number = 0;
  private playerCount: number = 0;

  async onAuth(client: Client, data: any) {
    const userId = data.userId;
    const uniqueId = data.uniqueId;
    const isPrivate = this.metadata?.isPrivate || false;
    const allowedUserIds = this.metadata?.allowedUserIds || [];
    const useBonus = data.useBonus;

    if (
      this.metadata?.isPrivate &&
      !this.metadata.allowedUserIds.includes(userId)
    ) {
      throw new Error("❌ You are not allowed to join this private room.");
    }

    const existingPlayer = Array.from(this.state.players.values()).find(
      (p) => p.uniqueId === uniqueId
    );
    if (existingPlayer) {
      (client as any).isReconnecting = true;
      (client as any).reconnectUniqueId = uniqueId;
      return true;
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

    const numberOfPlayers = matchOption.numberOfPlayers || 2;
    const isPrivate = data.isPrivate || false;
    const allowedUserIds = data.allowedUserIds || [];

    this.gameWidth = data.gameWidth || 1280;
    this.gameHeight = data.gameHeight || 720;

    this.setMetadata({
      playerCount: numberOfPlayers,
      isPrivate,
      allowedUserIds,
      gameWidth: this.gameWidth,
      gameHeight: this.gameHeight,
      createdAt: new Date().toISOString(),
    });

    this.maxClients = numberOfPlayers;

    this.betAmount = matchOption.bettingAmount;
    this.winAmount = matchOption.winningAmount;
    this.matchOptionId = matchOptionId.toString();
    this.minPlayer = matchOption.minimumPlayers || 2;
    this.playerCount = numberOfPlayers;

    this.setState(new FruitNinjaState());
    this.state.gameStatus = "waiting";
    this.state.betAmount = this.betAmount;
    this.state.winAmount = this.winAmount;
    this.state.matchOptionId = this.matchOptionId;
    this.state.minPlayer = this.minPlayer;
    this.state.playerCount = this.playerCount;
    this.state.gameWidth = this.gameWidth;
    this.state.gameHeight = this.gameHeight;

    this.setupMessageHandlers();
    console.log("🎮 Fruit Ninja room created!");
  }

  private setupMessageHandlers() {
    //    this.onMessage("slice", (client, message) => {
    //   if (!this.gameStarted || this.gameEnded) return;

    //   const player = this.state.players.get(client.sessionId);
    //   if (!player) return;

    //   console.log(`🔪 Player ${client.sessionId} sliced with trail:`, message.trail);

    //   if (!message.trail || message.trail.length < 2) {
    //     console.log("❌ Invalid trail data");
    //     return;
    //   }

    //   player.sliceTrail.clear();

    //   const trailArray = Array.from(message.trail);
    //   const flattened = trailArray.reduce((acc: number[], val: number[]) => acc.concat(val), []);

    //   console.log(flattened);

    //      player.sliceTrail.push(...flattened);

    //   const result = this.checkSliceCollisions(client, flattened);

    //   if (result.slicedFruits > 0) {
    //     this.broadcast("fruitSliced", {
    //       playerId: client.sessionId,
    //       fruitsSliced: result.slicedFruits,
    //       newScore: player.score,
    //     });
    //   }

    //   if (result.bombHit) {
    //     this.handleBombHit(client);
    //   }
    // });

    this.onMessage("join_game", (client: Client, data: any) => {
    
   
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        console.log(`✅ Player ${client.sessionId} is ready`);

        // Start game when all players are ready
        if (
          this.allPlayersReady() &&
          this.state.players.size === this.maxClients
        ) {
          this.startCountdown();
        }
      }
    });

    this.onMessage("slice", (client, message) => {
      if (!this.gameStarted || this.gameEnded) return;

      const player = this.state.players.get(client.sessionId);

      if (!player || player.lives <= 0) return;
      if (!player) return;

      let trail = message.trail;

      if (typeof trail === "string") {
        try {
          trail = JSON.parse(trail);
          console.log("✅ Parsed string trail to array:", trail);
        } catch (err) {
          console.log("❌ Failed to parse trail string:", err);
          return;
        }
      }

      if (!Array.isArray(trail) || trail.length < 4) {
        console.log("❌ Invalid trail data");
        return;
      }

      player.sliceTrail.clear();
      player.sliceTrail.push(...trail);

      const result = this.checkSliceCollisions(client, trail);

      if (result.slicedFruits > 0) {
        this.broadcast("fruitSliced", {
          playerId: client.sessionId,
          fruitsSliced: result.slicedFruits,
          newScore: player.score,
        });
      }

      if (result.bombHit) {
        this.handleBombHit(client);
      }
    });

    this.onMessage("rematch", (client) => {
      if (this.state.gameStatus === "ended") {
        const player = this.state.players.get(client.sessionId);
        if (player) {
          player.rematchVote = true;
          this.rematchVotes.add(client.sessionId);

          if (this.rematchVotes.size === this.state.players.size) {
            this.resetGame();
          }
        }
      }
    });
  }

  // onJoin(client: Client, data: any) {
  //   console.log(`🎮 Player ${client.sessionId} joined the game`);



  //     const uniqueId = data.uniqueId;
  //     const playerName = data.name;

  //   if ((client as any).isReconnecting && (client as any).reconnectUniqueId) {
  //     const reconnectingId = (client as any).reconnectUniqueId;
  
  //     const oldPlayerEntry = Array.from(this.state.players.entries()).find(
  //       ([_, player]) => player.uniqueId === reconnectingId
  //     );
  
  //     if (oldPlayerEntry) {
  //       const [oldSessionId, oldPlayer] = oldPlayerEntry;
  
  //       this.state.players.delete(oldSessionId);
  //       this.state.players.set(client.sessionId, oldPlayer);
  
  //       console.log(`✅ Player reconnected: ${oldPlayer.name} (uniqueId: ${oldPlayer.uniqueId})`);
  //       return;
  //     }
  //   }

    
  
  //   console.log(`🆕 New client connected: ${playerName} (uniqueId: ${uniqueId})`);






  //   const player = new Player();
  //   player.uniqueId = data.uniqueId;
  //   player.score = 0;
  //   player.lives = 3;
  //   player.ready = false;
  //   player.rematchVote = false;

  //   this.state.players.set(client.sessionId, player);
  // }


  onJoin(client: Client, data: any) {
  console.log(`🎮 Player ${client.sessionId} joined the game`);

  const uniqueId = data.uniqueId;
  const playerName = data.name;

  if (!uniqueId || !playerName) {
    console.warn("⚠️ Missing uniqueId or name during join");
    return;
  }

  // 🛑 Block new joins if game already started
  if (this.gameStarted && !this.state.players.has(client.sessionId)) {
    const alreadyInGame = Array.from(this.state.players.values()).some(
      player => player.uniqueId === uniqueId
    );

    if (!alreadyInGame) {
      console.warn(`❌ Rejected new join: Game already started`);
      client.leave(); // Kick them out
      return;
    }
  }

  // 🔁 Handle reconnection
  if ((client as any).isReconnecting && (client as any).reconnectUniqueId) {
    const reconnectingId = (client as any).reconnectUniqueId;

    const oldPlayerEntry = Array.from(this.state.players.entries()).find(
      ([_, player]) => player.uniqueId === reconnectingId
    );

    if (oldPlayerEntry) {
      const [oldSessionId, oldPlayer] = oldPlayerEntry;

      this.state.players.delete(oldSessionId);
      this.state.players.set(client.sessionId, oldPlayer);

      (oldPlayer as any).sessionId = client.sessionId;

      console.log(`✅ Player reconnected: ${oldPlayer.name} (uniqueId: ${oldPlayer.uniqueId})`);
      return;
    } else {
      console.warn(`⚠️ Reconnection failed. No matching player for ${reconnectingId}`);
    }
  }

  // 🆕 Only allow new joins if game hasn't started
  if (this.gameStarted) {
    console.warn(`❌ Game already started. Rejecting new join: ${uniqueId}`);
    client.leave();
    return;
  }

  console.log(`🆕 New client connected: ${playerName} (uniqueId: ${uniqueId})`);

  const player = new Player();
  player.uniqueId = uniqueId;
  player.name = playerName;
  player.score = 0;
  player.lives = 3;
  player.ready = false;
  player.rematchVote = false;
  (player as any).sessionId = client.sessionId;

  this.state.players.set(client.sessionId, player);
}


  async onLeave(client: Client, consented: boolean) {
    console.log(`👋 Player ${client.sessionId} left the game`);

    // Handle refund if game didn't start
    if (!this.gameStarted) {
      const uniqueId = this.deductedPlayers.get(client.sessionId);
      if (uniqueId) {
        await this.refundPlayer(uniqueId);
        this.deductedPlayers.delete(client.sessionId);
      }
    }

    this.state.players.delete(client.sessionId);
    this.playerUniqueIds.delete(client.sessionId);
    this.rematchVotes.delete(client.sessionId);

    if (this.state.players.size < this.minPlayer && this.gameStarted) {
      this.endGame();
    }
  }

  async onDispose() {
    console.log("🧹 Disposing game room");

    if (!this.gameStarted) {
      for (const [sessionId, uniqueId] of this.deductedPlayers) {
        await this.refundPlayer(uniqueId);
      }
    }

    clearInterval(this.spawnInterval);
    clearInterval(this.bombSpawnInterval);
    clearInterval(this.gameTimer);

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }

  private allPlayersReady(): boolean {
    let allReady = true;
    this.state.players.forEach((player) => {
      if (!player.ready) allReady = false;
    });
    return allReady;
  }

  private startCountdown() {
    const GAME_COUNTDOWN = 3;

    this.state.gameStatus = "getting_ready";
    this.state.gameTime = GAME_COUNTDOWN;

    console.log("🚦 Sending READY signal...");

    this.broadcast("starting", { message: "Ready" });

    setTimeout(() => {
      this.state.gameStatus = "countdown";
      let countdown = GAME_COUNTDOWN;
      this.state.gameTime = countdown;

      this.broadcast("countdown", { count: countdown });

      this.countdownTimer = setInterval(() => {
        countdown--;
        this.state.gameTime = countdown;

        if (countdown > 0) {
          this.broadcast("countdown", { count: countdown });
        } else {
          clearInterval(this.countdownTimer);

          this.startGame();
        }
      }, 1000);
    }, 1000);
  }

  private startGame() {
    this.gameStarted = true;
    this.state.gameStatus = "playing";
    this.state.gameTime = 180;

    this.broadcast("game_started", { message: "GO!", fruitTypes: FRUIT_TYPES });
    console.log("🚀 Game started!");

    const users = Array.from(this.playerUniqueIds.values());
    KafkaWalletService.sendGameStartRequest(
      users,
      this.betAmount,
      this.matchOptionId,
      this.roomId
    );

    this.setSimulationInterval((dt) => this.update(), 1000 / 60);

    this.spawnInterval = setInterval(() => this.spawnFruit(), 800);

    // Bomb spawning (5 seconds)
    // this.bombSpawnInterval = setInterval(() => this.spawnBomb(), 5000);
    this.scheduleNextBombSpawn();

    // Game timer
    this.gameTimer = setInterval(() => {
      this.state.gameTime -= 1;

      if (this.state.gameTime <= 0) {
        this.endGame();
      }
    }, 1000);
  }
  private scheduleNextBombSpawn() {
    if (!this.gameStarted || this.gameEnded) return;

    const randomDelay = 1000 + Math.random() * 4000;

    this.bombSpawnInterval = setTimeout(() => {
      this.spawnBomb(); // spawn a bomb now
      this.scheduleNextBombSpawn();
    }, randomDelay);

    console.log(`⏱️ Next bomb in ${(randomDelay / 1000).toFixed(2)}s`);
  }

  private async endGame() {
    this.gameEnded = true;
    this.state.gameStatus = "ended";

    clearInterval(this.gameTimer);
    clearInterval(this.spawnInterval);
    clearInterval(this.bombSpawnInterval);

    // Calculate winner
    let winnerSessionId: string | null = null;
    let highestScore = -1;

    this.state.players.forEach((player, sessionId) => {
      if (player.score > highestScore) {
        highestScore = player.score;
        winnerSessionId = sessionId;
      }
    });

    if (winnerSessionId) {
      this.state.gameStatus = "ended";

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

      this.broadcast("gameEnd", {
        winner: winnerSessionId,
        finalScores: Array.from(this.state.players.values()).map((p) => ({
          sessionId: p.uniqueId,
          score: p.score,
        })),
      });
    }

    console.log("🏁 Game ended! Winner:", winnerSessionId);

    // Auto-disconnect after 30 seconds
    this.clock.setTimeout(() => this.disconnect(), 30000);
  }

  private resetGame() {
    console.log("🔄 Starting rematch...");

    this.gameStarted = false;
    this.gameEnded = false;
    this.rematchVotes.clear();

    this.state.fruits.clear();
    this.state.bombs.clear();

    this.state.players.forEach((player) => {
      player.score = 0;
      player.lives = 3;
      player.ready = false;
      player.rematchVote = false;
      player.sliceTrail.clear();
    });

    clearInterval(this.spawnInterval);
    clearInterval(this.bombSpawnInterval);
    clearInterval(this.gameTimer);

    this.startCountdown();
  }

  // private spawnFruit() {
  //   if (!this.gameStarted || this.gameEnded) return;
  //   if (this.state.fruits.size >= 8) return;

  //   let maxTries = 5;
  //   let position: Vector2;
  //   let safe = false;

  //   while (maxTries-- > 0 && !safe) {
  //     const fruitTypeIndex = Math.floor(Math.random() * FRUIT_TYPES.length);
  //     const fruitType = FRUIT_TYPES[fruitTypeIndex];

  //     const spawnSide = Math.random() < 0.5 ? "left" : "right";
  //     const spawnX =
  //       spawnSide === "left"
  //         ? 0.1 * this.gameWidth + Math.random() * 0.2 * this.gameWidth
  //         : 0.7 * this.gameWidth + Math.random() * 0.2 * this.gameWidth;
  //     const spawnY = this.gameHeight;

  //     position = new Vector2(spawnX, spawnY);

  //     // Check for overlap with existing fruits
  //     safe = true;
  //     this.state.fruits.forEach((existing) => {
  //       const dx = existing.position.x - position.x;
  //       const dy = existing.position.y - position.y;
  //       if (Math.sqrt(dx * dx + dy * dy) < 60) {
  //         safe = false;
  //       }
  //     });

  //     if (safe) {
  //       const fruit = new Fruit();
  //       fruit.id = `fruit_${Date.now()}_${Math.random()
  //         .toString(36)
  //         .substr(2, 9)}`;
  //       fruit.type = fruitTypeIndex;
  //       fruit.position = position;

  //       const targetX =
  //         0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
  //       const targetY =
  //         0.2 * this.gameHeight + Math.random() * 0.2 * this.gameHeight;
  //       const timeToTarget = 1.4 + Math.random() * 0.3;
  //       const fps = 60;
  //       const totalFrames = timeToTarget * fps;
  //       const gravity = 0.35;

  //       const velocityX = (targetX - spawnX) / totalFrames;
  //       const velocityY =
  //         (targetY - spawnY) / (timeToTarget * 60) -
  //         0.5 * gravity * totalFrames;

  //       fruit.velocity = new Vector2(velocityX, velocityY);
  //       fruit.angularVelocity = (Math.random() - 0.5) * 5;
  //       fruit.rotation = 0;

  //       this.state.fruits.set(fruit.id, fruit);
  //       this.broadcast("spawnFruit", fruit);
  //       break;
  //     }
  //   }
  // }

  // private spawnBomb() {
  //   if (!this.gameStarted || this.gameEnded) return;
  //   if (this.state.bombs.size >= 2) return; // Max 2 bombs

  //   const bomb = new Bomb();
  //   bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  //   // Spawn position
  //   const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
  //   bomb.position = new Vector2(spawnX, this.gameHeight);

  //   // Trajectory
  //   const velocityX = (Math.random() - 0.5) * 6;
  //   const velocityY = -10 - Math.random() * 6;
  //   bomb.velocity = new Vector2(velocityX, velocityY);

  //   this.state.bombs.set(bomb.id, bomb);
  //   this.broadcast("spawnBomb", bomb);
  // }

  // private spawnFruit() {
  //   if (!this.gameStarted || this.gameEnded) return;

  //   // Limit fruits on screen'
  //   console.log(`🍇 Fruit count: ${this.state.fruits.size}`);

  //   if (this.state.fruits.size >= MAX_FRUITS_ON_SCREEN) return;

  //   const fruitType = Math.floor(Math.random() * FRUIT_TYPES.length);
  //   const fruit = new Fruit();
  //   fruit.id = `fruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  //   fruit.type = fruitType;

  //   // Spawn from bottom edges with varied starting positions
  //   // const spawnSide = Math.random() < 0.5 ? "left" : "right";
  //   // const spawnX =
  //   //   spawnSide === "left"
  //   //     ? 50 + Math.random() * 200
  //   //     : 600 + Math.random() * 150;

  //   // fruit.position = new Vector2(spawnX, 650);

  //   let spawnX: number;
  //   let maxTries = 10;
  //   let safeToSpawn = false;

  //   const spawnSide = Math.random() < 0.5 ? "left" : "right";

  //   while (!safeToSpawn && maxTries-- > 0) {
  //     const tryX =
  //       spawnSide === "left"
  //         ? 50 + Math.random() * 200
  //         : 600 + Math.random() * 150;

  //     safeToSpawn = true;

  //     this.state.fruits.forEach((otherFruit) => {
  //       if (Math.abs(otherFruit.position.x - tryX) < FRUIT_RADIUS * 2) {
  //         safeToSpawn = false; // Too close to another fruit
  //       }
  //     });

  //     if (safeToSpawn) {
  //       spawnX = tryX;
  //     }
  //   }

  //   if (!safeToSpawn) {
  //     console.log("⚠️ Could not find safe spawn spot for fruit");
  //     return; // skip spawn to avoid overlap
  //   }

  //   fruit.position = new Vector2(spawnX!, 650);

  //   // Calculate trajectory to create natural arc - FIXED CALCULATION
  //   const targetX = 200 + Math.random() * 400; // Target area in middle-upper screen
  //   const targetY = 100 + Math.random() * 200;

  //   const timeToTarget = 1.4 + Math.random() * 0.3; // 1.4-1.7 seconds flight time

  //   const fps = 60;
  //   const totalFrames = timeToTarget * fps;

  //   const speedFactor = 0.8; // 80% of original speed

  //   //  const velocityX = (targetX - spawnX) / totalFrames;
  //   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
  //   // FIXED: Use targetY instead of spawnX for Y velocity calculation

  //   const gravity = 0.35; // Tunable gravity constant

  //   // const velocityY =
  //   //   (targetY - fruit.position.y) / (timeToTarget * 60) -
  //   //   0.5 * gravity * totalFrames;// Account for gravity

  //   const velocityY =
  //     ((targetY - fruit.position.y) / totalFrames -
  //       0.5 * gravity * totalFrames) *
  //     speedFactor;

  //   fruit.velocity = new Vector2(velocityX, velocityY);
  //   fruit.angularVelocity = (Math.random() - 0.5) * 5; // Random rotation
  //   fruit.rotation = 0; // Initialize rotation

  //   this.state.fruits.set(fruit.id, fruit);

  //   console.log(
  //     `🍎 Spawned ${FRUIT_TYPES[fruitType].name} at (${spawnX.toFixed(
  //       1
  //     )}, 650) with velocity (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`
  //   );

  //   this.broadcast("spawnFruit", {
  //     id: fruit.id,
  //     type: fruit.type,
  //     position: fruit.position,
  //     velocity: fruit.velocity,
  //     angularVelocity: fruit.angularVelocity,
  //     spawnTime: Date.now(),
  //   });
  //

  //  this is the working one
  // }

  // private spawnBomb() {
  //   if (!this.gameStarted || this.gameEnded) return;
  //   if (this.state.bombs.size >= 3) return; // limit bombs

  //   const bomb = new Bomb();
  //   bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  //   const spawnSide = Math.random() < 0.5 ? "left" : "right";
  //   const spawnX =
  //     spawnSide === "left"
  //       ? 50 + Math.random() * 200
  //       : 600 + Math.random() * 150;

  //   bomb.position = new Vector2(spawnX, 650);

  //   const targetX = 200 + Math.random() * 400;
  //   const targetY = 100 + Math.random() * 200;
  //   const timeToTarget = 1.2 + Math.random() * 0.3;
  //   const speedFactor = 0.8;
  //   const fps = 60;
  //   const totalFrames = timeToTarget * fps;
  //   const gravity = 0.35;

  //   // const velocityX = (targetX - spawnX) / totalFrames;
  //   // const velocityY =
  //   //   (targetY - bomb.position.y) / totalFrames - 0.5 * gravity * totalFrames;

  //   const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
  //   const velocityY =
  //     ((targetY - bomb.position.y) / totalFrames -
  //       0.5 * gravity * totalFrames) *
  //     speedFactor;

  //   bomb.velocity = new Vector2(velocityX, velocityY);

  //   this.state.bombs.set(bomb.id, bomb);

  //   console.log(`💣 Spawned bomb at (${spawnX.toFixed(1)}, 650)`);

  //   this.broadcast("spawnBomb", {
  //     id: bomb.id,
  //     position: bomb.position,
  //     velocity: bomb.velocity,
  //     spawnTime: Date.now(),
  //   });

  //   //  this is the working one
  // }

  private spawnBomb() {
    if (!this.gameStarted || this.gameEnded) return;
    if (this.state.bombs.size >= 3) return;

    const bomb = new Bomb();
    bomb.id = `bomb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
    const spawnY = this.gameHeight;

    bomb.position = new Vector2(spawnX, spawnY);

    const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
    const targetY =
      0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

    const timeToTarget = 1.2 + Math.random() * 0.3;
    const fps = 60;
    const totalFrames = timeToTarget * fps;
    const gravity = 0.35;
    const speedFactor = 0.8;

    const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
    const velocityY =
      ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) *
      speedFactor;

    bomb.velocity = new Vector2(velocityX, velocityY);

    this.state.bombs.set(bomb.id, bomb);

    this.broadcast("spawnBomb", {
      id: bomb.id,
      position: bomb.position,
      velocity: bomb.velocity,
      spawnTime: Date.now(),
    });
  }

  private spawnFruit() {
    if (!this.gameStarted || this.gameEnded) return;
    if (this.state.fruits.size >= MAX_FRUITS_ON_SCREEN) return;

    const fruitType = Math.floor(Math.random() * FRUIT_TYPES.length);
    const fruit = new Fruit();
    fruit.id = `fruit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    fruit.type = fruitType;

    // 🎯 Spawn from bottom center-left/right to simulate arc in landscape
    const spawnX = 0.2 * this.gameWidth + Math.random() * 0.6 * this.gameWidth;
    const spawnY = this.gameHeight;

    fruit.position = new Vector2(spawnX, spawnY);

    // 🎯 Target toward upper screen
    const targetX = 0.3 * this.gameWidth + Math.random() * 0.4 * this.gameWidth;
    const targetY =
      0.2 * this.gameHeight + Math.random() * 0.3 * this.gameHeight;

    const timeToTarget = 1.4 + Math.random() * 0.3;
    const fps = 60;
    const totalFrames = timeToTarget * fps;
    const gravity = 0.35;
    const speedFactor = 0.8;

    const velocityX = ((targetX - spawnX) / totalFrames) * speedFactor;
    const velocityY =
      ((targetY - spawnY) / totalFrames - 0.5 * gravity * totalFrames) *
      speedFactor;

    fruit.velocity = new Vector2(velocityX, velocityY);
    fruit.angularVelocity = (Math.random() - 0.5) * 5;
    fruit.rotation = 0;

    this.state.fruits.set(fruit.id, fruit);

    this.broadcast("spawnFruit", {
      id: fruit.id,
      type: fruit.type,
      position: fruit.position,
      velocity: fruit.velocity,
      angularVelocity: fruit.angularVelocity,
      spawnTime: Date.now(),
    });
  }

  private checkSliceCollisions(client: Client, trail: number[]) {
    let bombHit = false;
    const player = this.state.players.get(client.sessionId);
    if (!player) return { slicedFruits: 0, bombHit: false };

    const slicedFruitIds: string[] = [];

    for (let i = 0; i < trail.length - 3; i += 2) {
      const lineStart = { x: trail[i], y: trail[i + 1] };
      const lineEnd = { x: trail[i + 2], y: trail[i + 3] };

      this.state.fruits.forEach((fruit, fruitId) => {
        if (fruit.isSliced || slicedFruitIds.includes(fruitId)) return;

        const distance = this.pointToLineDistance(
          fruit.position,
          lineStart,
          lineEnd
        );
        if (distance < 30) {
          fruit.isSliced = true;
          slicedFruitIds.push(fruitId);

          this.clock.setTimeout(() => {
            this.state.fruits.delete(fruitId);
          }, 300);
        }
      });

      this.state.bombs.forEach((bomb, bombId) => {
        if (bomb.isHit) return;

        const distance = this.pointToLineDistance(
          bomb.position,
          lineStart,
          lineEnd
        );
        if (distance < 25) {
          bomb.isHit = true;
          bombHit = true;
          this.handleBombHit(client);

          this.clock.setTimeout(() => {
            this.state.bombs.delete(bombId);
          }, 100);
        }
      });
    }

    // Combo scoring
    let totalPoints = 0;
    if (slicedFruitIds.length > 0) {
      slicedFruitIds.forEach((id) => {
        const fruit = this.state.fruits.get(id);
        if (fruit) {
          const fruitType = FRUIT_TYPES[fruit.type];
          totalPoints += fruitType.points;
        }
      });

      // Combo bonuses
      if (slicedFruitIds.length === 2) totalPoints += 10;
      else if (slicedFruitIds.length === 3) totalPoints += 30;
      else if (slicedFruitIds.length >= 4) totalPoints += 70;
      else if (slicedFruitIds.length >= 5) totalPoints += 200;
      else if (slicedFruitIds.length >= 6) totalPoints += 300;
      else if (slicedFruitIds.length >= 7) totalPoints += 500;
      else if (slicedFruitIds.length >= 8) totalPoints += 1000;

      player.score += totalPoints;
    }

    return { slicedFruits: slicedFruitIds.length, bombHit };
  }

  private handleBombHit(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    player.score = Math.max(0, player.score - 50);
    player.lives = Math.max(0, player.lives - 1);

    this.broadcast("bombHit", {
      playerId: client.sessionId,
      newScore: player.score,
      livesLeft: player.lives,
    });

    if (player.lives <= 0) {
      this.send(client, "gameOver", { reason: "No lives left" });
      this.endGame();
    }
  }

  private pointToLineDistance(point: Vector2, lineA: any, lineB: any): number {
    const A = point.x - lineA.x;
    const B = point.y - lineA.y;
    const C = lineB.x - lineA.x;
    const D = lineB.y - lineA.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;

    const xx = lineA.x + param * C;
    const yy = lineA.y + param * D;

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private update() {
    if (!this.gameStarted || this.gameEnded) return;

    const now = Date.now();
    const delta = Math.min(now - this.lastUpdateTime, 50) / 1000;
    this.lastUpdateTime = now;

    // Update fruits
    this.state.fruits.forEach((fruit, fruitId) => {
      if (fruit.isSliced) return;

      fruit.velocity.y += 20 * delta;
      fruit.position.x += fruit.velocity.x * delta * 60;
      fruit.position.y += fruit.velocity.y * delta * 60;
      fruit.rotation += fruit.angularVelocity * delta;

      // Remove if off-screen
      if (
        fruit.position.y > this.gameHeight + 100 ||
        fruit.position.x < -100 ||
        fruit.position.x > this.gameWidth + 100
      ) {
        this.state.fruits.delete(fruitId);
      }
    });

    // Update bombs
    this.state.bombs.forEach((bomb, bombId) => {
      if (bomb.isHit) return;

      bomb.velocity.y += 20 * delta;
      bomb.position.x += bomb.velocity.x * delta * 60;
      bomb.position.y += bomb.velocity.y * delta * 60;

      // Remove if off-screen
      if (
        bomb.position.y > this.gameHeight + 100 ||
        bomb.position.x < -100 ||
        bomb.position.x > this.gameWidth + 100
      ) {
        this.state.bombs.delete(bombId);
      }
    });
  }

  private async refundPlayer(uniqueId: string) {
    try {
      await KafkaWalletService.sendGameEndRequest(
        uniqueId,
        this.betAmount,
        this.roomId
      );
      console.log(`💰 Refunded ${this.betAmount} to ${uniqueId}`);
    } catch (err) {
      console.error("Refund failed:", err);
    }
  }
}
