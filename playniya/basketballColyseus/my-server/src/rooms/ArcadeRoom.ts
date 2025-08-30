

import { Room, Client, Delayed } from "colyseus";
import { GameState,BallState, PlayerState } from "./schema/ArcadeDState";


export class ArcadeBasketballRoom extends Room<GameState> {
  // ... existing properties ...



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

//   async onAuth(client: Client, options: any): Promise<any> {
//     const userId = options.userId;
//     const uniqueId = options.uniqueId;
//     const isPrivate = this.metadata?.isPrivate || false;
//     const allowedUserIds = this.metadata?.allowedUserIds || [];
//     const useBonus = options.useBonus;

//     if (isPrivate && !allowedUserIds.includes(userId)) {
//       throw new Error("You are not allowed to join this private room.");
//     }

//     if (this.state.phase === "playing" || this.state.phase === "ended") {
//       throw new Error("Game is already in progress or ended");
//     }

//     try {
//       const roomId = this.roomId;
//       const walletResponse = await KafkaWalletService.sendWalletRequestAndWait(
//         uniqueId, 
//         Number(this.betAmount), 
//         useBonus, 
//         roomId
//       );
      
//       if (!walletResponse.success) {
//         throw new Error(walletResponse.message || "Wallet deduction failed.");
//       }
//     } catch (err) {
//       console.error("Wallet Error:", err);
//       throw new Error("Unable to join: Wallet validation failed.");
//     }

//     return true;
//   }



  async onCreate(options: any) {
    // ... existing match option setup ...

    this.setState(new GameState());
    this.engine = new GameEngine();
    
    this.state.phase = "waiting";
    this.state.betAmount = bettingAmount;
    this.state.winAmount = winningAmount;
    this.state.matchOptionId = options.matchOptionId;
    this.state.minPlayers = minimumPlayers;
    this.state.basketZ = 300; // Start at mid-court depth
    this.state.basketDirection = 1;

    // ... message handlers ...
  }

  startGame() {
    this.state.phase = "playing";
    this.state.remainingTime = 180;
    
    // Move basket along Z-axis (depth)
    this.basketLoop = this.clock.setInterval(() => {
      const speed = 5;
      const minDepth = 100;
      const maxDepth = 700;

      this.state.basketZ += this.state.basketDirection * speed;

      if (this.state.basketZ >= maxDepth) {
        this.state.basketZ = maxDepth;
        this.state.basketDirection = -1;
      } else if (this.state.basketZ <= minDepth) {
        this.state.basketZ = minDepth;
        this.state.basketDirection = 1;
      }
    }, 50);

    // ... rest of game setup ...
  }

  private handleShot(client: Client, message: any) {
    if (this.state.phase !== "playing") return;
    if (!this.canShoot) return;

    const player = this.state.players.get(client.sessionId);
    if (!player || this.engine.getBallState().isActive) return;

    const angle = parseFloat(message.angle);
    const power = parseFloat(message.power);
    const basketZ = this.state.basketZ;

    if (this.engine.startShot(angle, power, player.xPosition, basketZ, client.sessionId)) {
      this.canShoot = false;
      this.broadcast("shotTaken", { playerId: client.sessionId, angle, power });
    }
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

    const update = this.engine.update(this.state.basketZ);
    if (!update) return;

    // Update 3D ball position
    this.state.ball.x = update.position.x;
    this.state.ball.y = update.position.y;
    this.state.ball.z = update.position.z;
    this.state.ball.visible = true;

    // ... scoring logic ...
  }

  // ... rest of room implementation ...
}