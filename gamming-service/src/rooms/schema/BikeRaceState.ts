import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") sessionId: string = "";
  @type("string") name: string = "";
  @type("string") uniqueId: string = "";
  @type("string") matchOptionId: string = "";
  @type("number") lane: number = 1; // 0 = left, 1 = center, 2 = right
  @type("number") speed: number = 0; // 0 to 10
  @type("number") distance: number = 0;
  @type("number") score: number = 0;
}

export class BikeRaceState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") phase: string = "waiting"; // "waiting", "playing", "ended"
  @type("number") remainingTime: number = 180;
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayers: number = 2;
  @type("string") winner: string = ""; // sessionId of the winner
  @type("boolean") everyoneJoined: boolean = false;
}