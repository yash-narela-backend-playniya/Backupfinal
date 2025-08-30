
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") id: string;
  @type("string") name: string;

  @type(["number"]) pawns: ArraySchema<number> = new ArraySchema<number>();  
  @type(["boolean"]) started: ArraySchema<boolean> = new ArraySchema<boolean>();
  @type(["boolean"]) finished: ArraySchema<boolean> = new ArraySchema<boolean>();

  @type("string") uniqueId: string = ""; 
}

export class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") currentPlayer: string = "";
  @type("boolean") gameStarted: boolean = false;

  @type("number") playerCount: number = 0;
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 0;

  @type("boolean") everyoneJoined: boolean = false;
  @type("string") gameStatus: string = "waiting";
}
