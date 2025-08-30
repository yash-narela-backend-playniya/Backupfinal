import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

export class Pawn extends Schema {
  @type("boolean") isUnlocked: boolean = true;
  @type("number") position: number = 0; 
  @type("boolean") isInHomeStretch: boolean = false;
  @type("number") homeStretchPosition: number = -1; 
  @type("boolean") hasReachedHome: boolean = false;
}


export class Player extends Schema {
  @type("string") name: string;
  @type("boolean") isReady: boolean = false;
  @type([Pawn]) pawns = new ArraySchema<Pawn>();
  @type("number") score: number = 0;
  @type("boolean") isBlocked: boolean = false;
  @type("string") uniqueId: string;
  @type("number") startIndex: number;
  constructor(name: string = "", uniqueId: string = "") {
    super();
    this.name = name;
    this.uniqueId = uniqueId;
    for (let i = 0; i < 4; i++) {
      this.pawns.push(new Pawn());
    }
  }
}

export class MyRoomState extends Schema {
  @type("string") gameStatus: string = "waiting";
  @type("string") currentPlayer: string = "";
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: "number" }) diceRolls = new MapSchema<number>();
  @type("string") winner: string = "";
  @type("boolean") everyoneJoined: boolean = false;
  @type("number") minPlayer: number = 0;
  // Add these:
  @type("number") playerCount: number = 0;


}
