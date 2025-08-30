// schema/ArcadeBasketballState.ts
import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") sessionId: string;
  @type("string") name: string;
  @type("string") uniqueId: string;
  @type("number") score: number = 0;
  @type("number") xPosition: number = 400;
}

export class BallState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") visible: boolean = false;
}

export class GameState extends Schema {
  @type("string") phase: "waiting" | "playing" | "ended" = "waiting";
  @type("number") remainingTime: number = 180;
  @type("number") basketX: number = 400;
  @type("number") basketDirection: number = 1;
  @type("string") winner: string = "";
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayers: number = 2;
  
  @type({ map: PlayerState }) 
  players = new MapSchema<PlayerState>();
  
  @type(BallState) 
  ball = new BallState();
}