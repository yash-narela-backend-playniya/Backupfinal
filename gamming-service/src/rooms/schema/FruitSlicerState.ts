
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";


export class Vector2 extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;

  constructor(x?: number, y?: number) {
    super();
    this.x = x || 0;
    this.y = y || 0;
  }
}

export class Fruit extends Schema {
  @type("string") id: string = "";
  @type("number") type: number = 0;
  @type(Vector2) position: Vector2 = new Vector2();
  @type(Vector2) velocity: Vector2 = new Vector2();
  @type("boolean") isSliced: boolean = false;
  @type("number") rotation: number = 0;
  @type("number") angularVelocity: number = 0;
  @type("number") sliceAngle: number = 0;
}

export class Bomb extends Schema {
  @type("string") id: string = "";
  @type(Vector2) position: Vector2 = new Vector2();
  @type(Vector2) velocity: Vector2 = new Vector2();
  @type("boolean") isHit: boolean = false;
}

export class Player extends Schema {
  @type("string") uniqueId: string = "";
  @type("number") score: number = 0;
  @type("number") lives: number = 3;
  @type("boolean") ready: boolean = false;
  @type(["number"]) sliceTrail = new ArraySchema<number>();
  @type("boolean") rematchVote: boolean = false;
}

export class FruitNinjaState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Fruit }) fruits = new MapSchema<Fruit>();
  @type({ map: Bomb }) bombs = new MapSchema<Bomb>();
  @type("number") gameTime: number = 0;
  @type("string") gameStatus: string = "waiting"; // "waiting" | "countdown" | "playing" | "ended"
  
  // Wallet and game configuration
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 0;
  @type("number") playerCount: number = 0;
  
  // Game dimensions (set by client)
  @type("number") gameWidth: number = 800;
  @type("number") gameHeight: number = 600;
}
