import { Room, Client, Delayed } from "colyseus";
import { GameState, PlayerState } from "./schema/MyRoomState";
import { GameEngine } from "../logic/GameEngine";

export class ArcadeBasketballRoom extends Room<GameState> {
  maxClients = 4;
  engine: GameEngine;
  gameLoop: Delayed | null = null;
  basketLoop: Delayed | null = null;
  shotClock: Delayed | null = null;
  private canShoot = true;

  onCreate(options: any) {  
    this.maxClients = options.maxClients || 4;
    console.log("Room created with options:", options);

    this.engine = new GameEngine();
    this.setState(new GameState());

    this.state.basketX = 400;
    this.state.basketDirection = 1;
    this.state.phase = "waiting";

    this.setMetadata({
      playerCount: 0,   
      isPrivate: options.isPrivate || false,
      maxClients: this.maxClients
    });

    console.log("Initial metadata:", this.metadata);

    this.onMessage("shoot", (client, message) => this.handleShot(client, message));
    this.onMessage("move", (client, message) => this.handleMove(client, message));
    this.onMessage("autoShoot", (client) => this.autoAlignAndShoot(client));

    console.log("Room created and handlers registered.");
  }

  private handleShot(client: Client, message: any) {
    if (this.state.phase !== "playing") {
      console.log("Rejected shot: game not playing");
      return;
    }
    if (!this.canShoot) {
      console.log("Rejected shot: cooldown");
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (!player) {
      console.log("Rejected shot: player not found");
      return;
    }

    if (this.engine.getBallState().isActive) {
      console.log("Rejected shot: ball already active");
      return;
    }

    const angle = parseFloat(message.angle);
    const power = parseFloat(message.power);

    const success = this.engine.startShot(angle, power, player.xPosition, client.sessionId);

    if (success) {
      this.canShoot = false;
      this.broadcast("shotTaken", {
        playerId: client.sessionId,
        angle,
        power
      });
      console.log(`Shot taken: angle=${angle}, power=${power}`);
    }
  }

  private handleMove(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId);
    if (player && message.x !== undefined) {
      player.xPosition = message.x;
      this.broadcast("playerMoved", { playerId: client.sessionId, x: player.xPosition });
      console.log(`Player ${client.sessionId} moved to x=${player.xPosition}`);
    }
  }

  private autoAlignAndShoot(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "playing" || !this.canShoot) {
      console.log("Cannot auto shoot.");
      return;
    }

    const targetX = this.state.basketX;
    player.xPosition = targetX;
    this.broadcast("playerMoved", { playerId: client.sessionId, x: targetX });

    console.log(`Auto-aligning and shooting for player ${client.sessionId}`);

    const angle = 50;
    const power = 8;

    this.handleShot(client, { angle, power });
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.name = options.name || `Player_${client.sessionId.substr(0, 4)}`;
    player.xPosition = 400;
    player.score = 0;

    this.state.players.set(client.sessionId, player);
    console.log(`Player joined: ${player.name} (${client.sessionId})`);

    this.setMetadata({
      ...this.metadata,
      playerCount: this.state.players.size
    });

    console.log("Updated metadata on join:", this.metadata);

    if (this.state.players.size >= 2 && this.state.phase === "waiting") {
      this.startGame();
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(`Player left: ${client.sessionId}`);

    this.setMetadata({
      ...this.metadata,
      playerCount: this.state.players.size
    });

    console.log("Updated metadata on leave:", this.metadata);





    if (this.state.players.size < 2 && this.state.phase === "playing") {
      this.endGame();
    }
  }

  startGame() {
    this.state.phase = "playing";
    this.state.remainingTime = 180;
    
    this.state.players.forEach(player => player.score = 0);
    this.resetBall();

    console.log("Game started");

    this.basketLoop?.clear();
    this.gameLoop?.clear();
    this.shotClock?.clear();

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
      console.log("Time remaining:", this.state.remainingTime);
      if (this.state.remainingTime <= 0) {
        this.endGame();
      }
    }, 1000);

    this.shotClock = this.clock.setInterval(() => this.updatePhysics(), 16);
  }

  private resetBall() {
    this.state.ball.x = 400;
    this.state.ball.y = 0;
    this.state.ball.visible = false;
    this.canShoot = true;
    this.engine = new GameEngine();
    console.log("Ball reset");
  }

  private updatePhysics() {
    const ballState = this.engine.getBallState();

    if (!ballState.isActive) {
      if (this.state.ball.visible) {
        this.state.ball.visible = false;
        this.canShoot = true;
        this.broadcast("shotReset");
        console.log("Ball reset after inactivity");
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
        console.log(`Score! Player ${scoringPlayer.sessionId} +${update.points} pts`);

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
      console.log("Ball reset after score/miss");
    }
  }

  endGame() {
    this.state.phase = "ended";
    this.gameLoop?.clear();
    this.basketLoop?.clear();
    this.shotClock?.clear();

    const players = Array.from(this.state.players.values());
    const winner = players.reduce((a, b) => (a.score > b.score ? a : b), players[0]);

    console.log(`Game ended. Winner: ${winner.name} (${winner.sessionId})`);

    this.broadcast("gameEnd", {
      winnerId: winner.sessionId,
      scores: players.map(p => ({
        sessionId: p.sessionId,
        name: p.name,
        score: p.score,
      })),
    });

    this.lock();
  }

  private findLastShooter(): PlayerState | undefined {
    const lastShooterId = this.engine.getLastShooterId();
    return lastShooterId ? this.state.players.get(lastShooterId) : undefined;
  }
}
