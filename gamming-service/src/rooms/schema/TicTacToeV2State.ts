import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("string") uniqueId: string = "";
  @type("number") timeRemaining: number = 0;
}

export class TicTacToeState extends Schema {
  @type("string") playerX: string = "";
  @type("string") playerO: string = "";
  @type("string") currentTurn: string = "";
  @type("string") winner: string = "";
  @type("boolean") isDraw: boolean = false;

  // Use 0 = empty, 1 = X, 2 = O
  @type(["number"]) board = new ArraySchema<number>(0, 0, 0, 0, 0, 0, 0, 0, 0);

  @type("number") timePerPlayer: number = 90;
  @type({ map: Player }) players = new MapSchema<Player>();

  @type("string") gameStatus: string = "waiting";
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 0;
  @type("number") playerCount: number = 0;

  @type({ map: "boolean" }) rematchVotes = new MapSchema<boolean>();

  PlayerSchema = Player;
}
