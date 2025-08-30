// CarRaceSchema.ts
import { Schema, MapSchema, ArraySchema, type,SetSchema } from "@colyseus/schema";

export class Vector2 extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class Car extends Schema {

 
  @type("string") uniqueId: string = ""; 
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") angle: number = 0;
  @type(Vector2) velocity = new Vector2();
  @type("number") steering: number = 0;
  @type("number") throttle: number = 0;
  @type("number") score: number = 0;
  @type("number") laps: number = 0;
  @type("number") lastCheckpointIndex: number = -1;
  @type("number") health: number = 100;
  @type("number") shield: number = 0;
  @type("number") boost: number = 0;
  @type("number") weaponCooldown: number = 0;
  @type("string") name: string = "";
}

export class PowerUp extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class Checkpoint extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

export class Projectile extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type(Vector2) velocity = new Vector2();
  @type("number") angle: number = 0;
}

export class Particle extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type(Vector2) velocity = new Vector2();
  @type("number") ttl: number = 1000;
}

export class GameState extends Schema {
  @type({ map: Car }) cars = new MapSchema<Car>();

  @type({ set: "string" }) rematchVotes = new SetSchema<string>();
  @type([PowerUp]) powerUps = new ArraySchema<PowerUp>();
  @type([Checkpoint]) checkpoints = new ArraySchema<Checkpoint>();
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
  @type([Particle]) particles = new ArraySchema<Particle>();
  @type("number") gameTime: number = 0;
}