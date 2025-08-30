
import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

export class TicTacToeState extends Schema {
  @type("string") playerX: string = "";
  @type("string") playerO: string = "";
  @type("string") currentTurn: string = "X";
  @type("string") winner: string = "";
  @type("boolean") isDraw: boolean = false;
  @type(["string"]) board = new ArraySchema<string>(
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  );
  @type("number") startTime: number = 0;
  @type({ map: "number" }) playerMoveTimes = new MapSchema<number>();
  @type("number") betAmount: number = 0;
  @type("number") winAmount: number = 0;
  @type("string") matchOptionId: string = "";
  @type("number") minPlayer: number = 0;
  @type("boolean") everyoneJoined: boolean = false;
  @type("string") gameStatus: string = "waiting";
  @type("string") playerXUniqueId: string = ""; 
  @type("string") playerOUniqueId: string = ""; 
}
