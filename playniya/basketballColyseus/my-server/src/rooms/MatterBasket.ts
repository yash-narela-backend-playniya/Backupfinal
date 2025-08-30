// File: rooms/BasketballRoom.ts
import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import Matter from "matter-js";

// ==== Game State Schema ====
class Ball extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") vx = 0;
  @type("number") vy = 0;
}

class Hoop extends Schema {
  @type("number") x = 700;
  @type("number") y = 300;
}

class GameState extends Schema {
  @type(Ball) ball = new Ball();
  @type(Hoop) hoop = new Hoop();
  @type({ map: "number" }) scores = new MapSchema<number>();
}

export class BasketballRoom extends Room<GameState> {
  maxClients = 2;

  private engine = Matter.Engine.create();
  private world = this.engine.world;
  private ballBody!: Matter.Body;
  private hoopSensor!: Matter.Body;
  private hoopBaseX = 700;

  onCreate() {
    this.setState(new GameState());

    // Create ball
    this.ballBody = Matter.Bodies.circle(400, 500, 15, { restitution: 0.8 });
    Matter.World.add(this.world, this.ballBody);

    // Hoop sensor (for scoring detection)
    this.hoopSensor = Matter.Bodies.rectangle(this.state.hoop.x, this.state.hoop.y, 60, 10, {
      isSensor: true,
      isStatic: true
    });
    Matter.World.add(this.world, this.hoopSensor);

    // Floor
    const ground = Matter.Bodies.rectangle(400, 600, 800, 20, { isStatic: true });
    Matter.World.add(this.world, ground);

    // Physics update loop
    this.setSimulationInterval((dt) => this.update(dt));

    // Handle input
    this.onMessage("shoot", (client, message) => this.handleShoot(client, message));

    // Detect scoring
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (let pair of event.pairs) {
        if ((pair.bodyA === this.ballBody && pair.bodyB === this.hoopSensor) ||
            (pair.bodyB === this.ballBody && pair.bodyA === this.hoopSensor)) {
          const id = [...this.clients.entries()].find(([_, c]) => c === client)?.[0];
          if (id) this.incrementScore(id);
        }
      }
    });
  }

  handleShoot(client: Client, { angle, power }: { angle: number, power: number }) {
    const force = power * 0.03;
    Matter.Body.setPosition(this.ballBody, { x: 400, y: 500 });
    Matter.Body.setVelocity(this.ballBody, {
      x: Math.cos(angle) * force * 60,
      y: -Math.sin(angle) * force * 60,
    });
  }

  incrementScore(sessionId: string) {
    if (!this.state.scores.has(sessionId)) {
      this.state.scores.set(sessionId, 0);
    }
    this.state.scores.set(sessionId, this.state.scores.get(sessionId)! + 1);
  }

  update(deltaTime: number) {
    Matter.Engine.update(this.engine, deltaTime);

    // Move hoop side to side
    const time = Date.now() / 1000;
    const hoopX = this.hoopBaseX + Math.sin(time * 2) * 100;
    Matter.Body.setPosition(this.hoopSensor, { x: hoopX, y: this.state.hoop.y });

    // Sync with Colyseus state
    this.state.ball.x = this.ballBody.position.x;
    this.state.ball.y = this.ballBody.position.y;
    this.state.ball.vx = this.ballBody.velocity.x;
    this.state.ball.vy = this.ballBody.velocity.y;
    this.state.hoop.x = this.hoopSensor.position.x;
  }

  onJoin(client: Client) {
    this.state.scores.set(client.sessionId, 0);
  }

  onLeave(client: Client) {
    this.state.scores.delete(client.sessionId);
  }
} 

// === Don't forget to register this room in your main server entry point ===
